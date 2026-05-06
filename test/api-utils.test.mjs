import assert from "node:assert/strict";
import test from "node:test";

import {
  enforceSameOrigin,
  readJsonBody,
  MAX_REQUEST_BODY_BYTES,
} from "../src/lib/apiUtils.js";

function mockRequest({
  origin,
  host,
  body,
  contentLength,
  hostHeader = host,
  proto = "http",
} = {}) {
  const headers = new Map();
  if (origin) headers.set("origin", origin);
  if (hostHeader) headers.set("host", hostHeader);
  if (proto) headers.set("x-forwarded-proto", proto);
  if (contentLength != null) headers.set("content-length", String(contentLength));
  return {
    headers: { get: (k) => headers.get(k.toLowerCase()) ?? null },
    text: async () => body ?? "",
    url: `${proto}://${host || "localhost:5000"}/api/x`,
  };
}

test("MAX_REQUEST_BODY_BYTES exposes per-route caps", () => {
  assert.equal(typeof MAX_REQUEST_BODY_BYTES.prompts, "number");
  assert.equal(typeof MAX_REQUEST_BODY_BYTES.metadata, "number");
  assert.equal(typeof MAX_REQUEST_BODY_BYTES.general, "number");
  // Sanity: metadata cap (image base64) >> prompts cap (text JSON).
  assert.ok(MAX_REQUEST_BODY_BYTES.metadata > MAX_REQUEST_BODY_BYTES.prompts);
});

test("enforceSameOrigin: same-origin via Host header passes", () => {
  const req = mockRequest({
    origin: "http://example.com",
    host: "example.com",
  });
  const result = enforceSameOrigin(req);
  // Either undefined (allowed) or returns null/undefined — either way
  // it must NOT return a Response object.
  assert.ok(!(result instanceof Response), "should allow same-origin");
});

test("enforceSameOrigin: cross-origin in production rejects", () => {
  const orig = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const req = mockRequest({
      origin: "http://attacker.example",
      host: "myapp.com",
    });
    const result = enforceSameOrigin(req);
    assert.ok(result instanceof Response, "should return rejection Response");
    assert.equal(result.status, 403);
  } finally {
    process.env.NODE_ENV = orig;
  }
});

test("readJsonBody: rejects bodies that exceed Content-Length cap", async () => {
  const req = mockRequest({
    body: '{"x":1}',
    contentLength: 999_999_999,
    host: "localhost:5000",
  });
  await assert.rejects(
    () => readJsonBody(req, 1024),
    (err) => err && err.code === "BODY_TOO_LARGE",
  );
});

test("readJsonBody: rejects empty body with structured error", async () => {
  const req = mockRequest({ body: "", host: "localhost:5000" });
  await assert.rejects(
    () => readJsonBody(req, 1024),
    (err) => err && err.code === "BODY_EMPTY",
  );
});

test("readJsonBody: rejects invalid JSON with structured error", async () => {
  const req = mockRequest({ body: "{not json", host: "localhost:5000" });
  await assert.rejects(
    () => readJsonBody(req, 1024),
    (err) => err && err.code === "BODY_INVALID_JSON",
  );
});

test("readJsonBody: returns parsed object on valid input", async () => {
  const req = mockRequest({ body: '{"hello":"world"}', host: "localhost:5000" });
  const out = await readJsonBody(req, 1024);
  assert.deepEqual(out, { hello: "world" });
});
