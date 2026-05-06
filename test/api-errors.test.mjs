import assert from "node:assert/strict";
import test from "node:test";

import { mapApiError } from "../src/lib/apiErrors.js";

test("mapApiError prefers server message for VALIDATION_ERROR (no t)", () => {
  const msg = mapApiError({
    error: "Enter a prompt first.",
    code: "VALIDATION_ERROR",
  });
  assert.equal(msg, "Enter a prompt first.");
});

test("mapApiError prefers server message for VALIDATION_ERROR (with t)", () => {
  const t = (key) => (key === "errors.invalidInput" ? "Invalid input." : key);
  const msg = mapApiError(
    { error: "Market Research requires a Google Gemini API key.", code: "VALIDATION_ERROR" },
    t,
  );
  assert.equal(msg, "Market Research requires a Google Gemini API key.");
});

test("mapApiError uses translation for specific codes when t is supplied", () => {
  const t = (key) => `T:${key}`;
  const msg = mapApiError({ error: "raw upstream message", code: "PROVIDER_AUTH" }, t);
  assert.equal(msg, "T:errors.invalidKey");
});

test("mapApiError falls back to generic translation when generic code has no server message", () => {
  const t = (key) => `T:${key}`;
  const msg = mapApiError({ code: "VALIDATION_ERROR" }, t);
  assert.equal(msg, "T:errors.invalidInput");
});

test("mapApiError surfaces server message for NO_KEYS code", () => {
  const t = (key) => `T:${key}`;
  const msg = mapApiError(
    { error: "No OpenRouter key configured.", code: "NO_KEYS" },
    t,
  );
  assert.equal(msg, "No OpenRouter key configured.");
});

test("mapApiError without code falls back to server message", () => {
  const msg = mapApiError({ error: "raw error" });
  assert.equal(msg, "raw error");
});

test("mapApiError without code or message returns generic fallback", () => {
  const msg = mapApiError({});
  assert.equal(msg, "Request failed. Please try again.");
});
