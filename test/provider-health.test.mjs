import assert from "node:assert/strict";
import test from "node:test";

import {
  recordSuccess,
  recordFailure,
  getScore,
  reorderQueue,
  _resetForTests,
} from "../src/lib/providerHealth.js";

test("providerHealth: success raises score, failure lowers it", () => {
  _resetForTests();
  for (let i = 0; i < 5; i += 1) recordSuccess("modelA");
  for (let i = 0; i < 5; i += 1) recordFailure("modelB");
  assert.ok(getScore("modelA") > getScore("modelB"));
});

test("providerHealth: 429 within cooldown applies a heavy penalty", () => {
  _resetForTests();
  recordSuccess("good");
  recordFailure("bad", "rate_limit");
  // Cooldown penalty is -5; one 429 should sink "bad" well below "good".
  assert.ok(getScore("bad") < getScore("good") - 4);
});

test("providerHealth: reorderQueue keeps user's primary model first", () => {
  _resetForTests();
  recordFailure("primary");
  recordSuccess("alt-a");
  recordSuccess("alt-a");
  const queue = [
    { model: "primary", keys: ["k1"] },
    { model: "alt-a", keys: ["k2"] },
    { model: "alt-b", keys: ["k3"] },
  ];
  const reordered = reorderQueue(queue);
  assert.equal(reordered[0].model, "primary");
  assert.equal(reordered[1].model, "alt-a");
});

test("providerHealth: reorderQueue is a no-op for short queues", () => {
  _resetForTests();
  const q = [{ model: "x", keys: ["k"] }];
  assert.deepEqual(reorderQueue(q), q);
});
