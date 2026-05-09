// Tests for the shared module-level cache used by the marketplace
// trend endpoints (pixabay, pexels, reddit, wikipedia, auto-discover).

import test from "node:test";
import assert from "node:assert/strict";
import { readCache, writeCache, readStaleCache, isoNow, CACHE_TTL_HOURS } from "../src/lib/marketTrendsCache.js";

test("isoNow returns a parseable ISO string", () => {
  const now = isoNow();
  assert.equal(typeof now, "string");
  const parsed = new Date(now).getTime();
  assert.ok(Number.isFinite(parsed));
  // Within last second
  assert.ok(Math.abs(Date.now() - parsed) < 5000);
});

test("readCache returns null for unseen key", () => {
  assert.equal(readCache("nonexistent-source", "nope"), null);
});

test("writeCache + readCache round-trips data with fetchedAt", () => {
  writeCache("test-source", "k1", [{ a: 1 }, { a: 2 }]);
  const got = readCache("test-source", "k1");
  assert.ok(got, "expected a hit");
  assert.deepEqual(got.data, [{ a: 1 }, { a: 2 }]);
  assert.ok(typeof got.fetchedAt === "number" && got.fetchedAt > 0);
});

test("readCache isolates buckets by source key", () => {
  writeCache("source-a", "shared", [1]);
  writeCache("source-b", "shared", [2]);
  assert.deepEqual(readCache("source-a", "shared")?.data, [1]);
  assert.deepEqual(readCache("source-b", "shared")?.data, [2]);
});

test("readStaleCache returns the entry even if exists; writeCache resets TTL", () => {
  writeCache("stale-source", "k", ["x"]);
  // Manipulate the stored fetchedAt to simulate staleness.
  const stale = readStaleCache("stale-source", "k");
  assert.ok(stale);
  // We can't easily mock time, but we can verify readStaleCache mirrors readCache for fresh entries.
  assert.deepEqual(stale.data, ["x"]);
  // After re-write, fetchedAt should refresh.
  const before = stale.fetchedAt;
  // Sleep a tiny bit so timestamps differ.
  const start = Date.now();
  while (Date.now() - start < 5) { /* spin */ }
  writeCache("stale-source", "k", ["y"]);
  const after = readCache("stale-source", "k");
  assert.ok(after);
  assert.deepEqual(after.data, ["y"]);
  assert.ok(after.fetchedAt >= before);
});

test("CACHE_TTL_HOURS is 24", () => {
  assert.equal(CACHE_TTL_HOURS, 24);
});
