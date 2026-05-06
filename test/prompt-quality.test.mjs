import assert from "node:assert/strict";
import test from "node:test";

import { scorePrompt, scoreCollection } from "../src/lib/promptQuality.js";

test("scorePrompt: empty input returns 0 / weak", () => {
  const r = scorePrompt("");
  assert.equal(r.score, 0);
  assert.equal(r.band, "weak");
});

test("scorePrompt: short prompt is flagged as weak", () => {
  const r = scorePrompt("a cat");
  assert.ok(r.score < 50, `expected weak, got ${r.score}`);
  assert.ok(r.reasons.some(s => /short/i.test(s)));
});

test("scorePrompt: rich prompt scores in good/strong band", () => {
  const r = scorePrompt(
    "Editorial photograph of a steaming espresso cup on a warm oak table, golden hour lighting from the window, shallow depth of field, muted earth-tone palette, minimalist composition with copy space."
  );
  assert.ok(r.score >= 70, `expected >=70, got ${r.score}`);
  assert.ok(r.band === "good" || r.band === "strong");
});

test("scoreCollection: detects duplicates by 12-word signature", () => {
  const prompts = [
    "Editorial photo of a single red apple on a white linen surface with soft window light.",
    "Editorial photo of a single red apple on a white linen surface with bright morning glow.",
    "Editorial photo of a single red apple on a white linen surface with vibrant noon light.",
  ];
  const r = scoreCollection(prompts);
  assert.ok(r.duplicates >= 2, `expected at least 2 duplicates, got ${r.duplicates}`);
  assert.ok(r.collectionScore < 95, "collection score should be penalised for repetition");
});

test("scoreCollection: rich diverse set scores high", () => {
  const prompts = [
    "Editorial close-up of dewdrops on a fern leaf at dawn, soft diffused light, cool green palette, macro photograph.",
    "Cinematic wide shot of a desert dune at sunset, golden hour, warm orange sand against a violet sky, photorealistic.",
    "Minimalist watercolor illustration of three cherry blossoms on a cream paper background, gentle pastel palette.",
  ];
  const r = scoreCollection(prompts);
  assert.ok(r.collectionScore >= 70, `expected high score, got ${r.collectionScore}`);
});

test("scoreCollection: empty input is safe", () => {
  const r = scoreCollection([]);
  assert.equal(r.collectionScore, 0);
  assert.equal(r.individual.length, 0);
});
