import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";

// Browser globals shim so keyVault.js (a "use client" module) runs under
// node --test.  The crypto.subtle API in Node 22+ matches the WebCrypto
// surface used by the module.
const memoryStore = new Map();
const stubStorage = {
  getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
  setItem: (k, v) => { memoryStore.set(k, String(v)); },
  removeItem: (k) => { memoryStore.delete(k); },
  clear: () => { memoryStore.clear(); },
};

globalThis.window = globalThis.window || {};
globalThis.window.crypto = webcrypto;
// `globalThis.crypto` is already defined as a getter in Node 20+; only
// override if the ambient one is missing.
if (!globalThis.crypto || typeof globalThis.crypto.subtle === "undefined") {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}
globalThis.localStorage = stubStorage;
// Some environments expect btoa/atob on globalThis.
globalThis.btoa = globalThis.btoa || ((s) => Buffer.from(s, "binary").toString("base64"));
globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, "base64").toString("binary"));

const { encryptForStorage, decryptFromStorage, readEncryptedSlot, writeEncryptedSlot } = await import("../src/lib/keyVault.js");

test("encryptForStorage/decryptFromStorage round-trips a JSON-able value", async () => {
  const value = { gemini: ["sk-test-1"], groq: ["gsk-x"] };
  const blob = await encryptForStorage(value);
  assert.ok(blob.startsWith("v1:"), "expected v1: format tag");
  const decoded = await decryptFromStorage(blob);
  assert.deepEqual(decoded, value);
});

test("decryptFromStorage falls back to JSON.parse for legacy plaintext", async () => {
  const legacy = '{"gemini":["plain-key"]}';
  const decoded = await decryptFromStorage(legacy);
  assert.deepEqual(decoded, { gemini: ["plain-key"] });
});

test("decryptFromStorage returns null for null/empty input", async () => {
  assert.equal(await decryptFromStorage(null), null);
  assert.equal(await decryptFromStorage(""), null);
  assert.equal(await decryptFromStorage(undefined), null);
});

test("decryptFromStorage returns null for corrupt v1: blob", async () => {
  // Random bytes that can't be decrypted by the device key.
  const decoded = await decryptFromStorage("v1:notarealciphertext");
  assert.equal(decoded, null);
});

test("write/readEncryptedSlot persists through localStorage stub", async () => {
  memoryStore.clear();
  const value = { mistral: ["m-test"] };
  const ok = await writeEncryptedSlot(stubStorage, "test-slot", value);
  assert.equal(ok, true);
  const stored = stubStorage.getItem("test-slot");
  assert.ok(stored && stored.startsWith("v1:"), "should be stored encrypted");
  const decoded = await readEncryptedSlot(stubStorage, "test-slot");
  assert.deepEqual(decoded, value);
});

test("encrypted blob does NOT contain the plaintext key", async () => {
  const value = { gemini: ["sk-secret-canary-12345"] };
  const blob = await encryptForStorage(value);
  assert.ok(!blob.includes("sk-secret-canary-12345"));
});
