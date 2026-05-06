import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRetryAfter } from "../src/lib/retryAfter.js";

test("normalizeRetryAfter: returns null for missing/blank input", () => {
  assert.equal(normalizeRetryAfter(null), null);
  assert.equal(normalizeRetryAfter(undefined), null);
  assert.equal(normalizeRetryAfter(""), null);
  assert.equal(normalizeRetryAfter("   "), null);
});

test("normalizeRetryAfter: passes through small delta seconds unchanged", () => {
  assert.equal(normalizeRetryAfter("30"), 30);
  assert.equal(normalizeRetryAfter("0"), 0);
  assert.equal(normalizeRetryAfter("5"), 5);
});

test("normalizeRetryAfter: strips 's' / 'sec' / 'seconds' suffix", () => {
  assert.equal(normalizeRetryAfter("30s"), 30);
  assert.equal(normalizeRetryAfter("30 seconds"), 30);
  assert.equal(normalizeRetryAfter("45secs"), 45);
});

test("normalizeRetryAfter: epoch seconds become delta seconds", () => {
  // Pin "now" so the test is deterministic.
  const now = 1_730_000_000_000; // some 2024 ms
  // 90 seconds in the future, expressed as epoch seconds.
  const epochSecs = (now / 1000) + 90;
  const out = normalizeRetryAfter(String(epochSecs), now);
  assert.equal(out, 90);
});

test("normalizeRetryAfter: epoch milliseconds become delta seconds", () => {
  const now = 1_730_000_000_000;
  const epochMs = now + 60_000; // 60s in future
  const out = normalizeRetryAfter(String(epochMs), now);
  assert.equal(out, 60);
});

test("normalizeRetryAfter: past epochs clamp to 0", () => {
  const now = 1_730_000_000_000;
  const pastEpochSecs = (now / 1000) - 100;
  assert.equal(normalizeRetryAfter(String(pastEpochSecs), now), 0);
});

test("normalizeRetryAfter: HTTP date parses to delta seconds", () => {
  const now = Date.parse("2025-01-01T00:00:00Z");
  const future = "Wed, 01 Jan 2025 00:01:00 GMT"; // 60s after now
  assert.equal(normalizeRetryAfter(future, now), 60);
});

test("normalizeRetryAfter: garbage input returns null", () => {
  assert.equal(normalizeRetryAfter("hello world"), null);
  assert.equal(normalizeRetryAfter("not-a-date"), null);
});
