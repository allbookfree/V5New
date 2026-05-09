// Tests for the stock-relevance scorer used by /api/market-trends to
// down-rank Google Trends queries that don't translate to stock-image
// demand (sports fixtures, breaking news, election headlines, etc.).

import test from "node:test";
import assert from "node:assert/strict";
import { scoreStockRelevance } from "../src/lib/marketTrendsRelevance.js";

test("scoreStockRelevance: empty / invalid input returns neutral 5", () => {
  assert.equal(scoreStockRelevance("", []), 5);
  assert.equal(scoreStockRelevance(null, null), 5);
  assert.equal(scoreStockRelevance(undefined, undefined), 5);
});

test("scoreStockRelevance: pure sports fixture is penalised", () => {
  const score = scoreStockRelevance("Man City vs Brentford", [
    { title: "Premier League: Live results" },
  ]);
  assert.ok(score <= 2, `expected sports fixture to score <=2, got ${score}`);
});

test("scoreStockRelevance: election / political headline is penalised", () => {
  const score = scoreStockRelevance("Senator votes against bill in Congress", []);
  assert.ok(score <= 2, `expected political headline to score <=2, got ${score}`);
});

test("scoreStockRelevance: breaking-news death headline is penalised", () => {
  const score = scoreStockRelevance("3 killed in highway crash", []);
  assert.ok(score <= 2, `expected breaking-news death to score <=2, got ${score}`);
});

test("scoreStockRelevance: aesthetic / lifestyle phrase is boosted", () => {
  const score = scoreStockRelevance("Boho minimalist home decor ideas", []);
  assert.ok(score >= 7, `expected aesthetic phrase to score >=7, got ${score}`);
});

test("scoreStockRelevance: seasonal holiday is boosted", () => {
  const score = scoreStockRelevance("Christmas wedding floral table setting", []);
  assert.ok(score >= 7, `expected holiday/seasonal to score >=7, got ${score}`);
});

test("scoreStockRelevance: nature scenery is boosted", () => {
  const score = scoreStockRelevance("Sunset mountain landscape with flowers", []);
  assert.ok(score >= 7, `expected nature scenery to score >=7, got ${score}`);
});

test("scoreStockRelevance: clamps to 0..10 range", () => {
  // Stack many positive matches — should clamp at 10.
  const veryHigh = scoreStockRelevance(
    "Boho minimalist Christmas wedding sunset mountain yoga office decor",
    [],
  );
  assert.ok(veryHigh <= 10, `expected score clamped <=10, got ${veryHigh}`);
  assert.ok(veryHigh >= 7, `expected very high score >=7, got ${veryHigh}`);

  // Stack many negative matches — should clamp at 0.
  const veryLow = scoreStockRelevance(
    "President crash killed in election earthquake hurricane scandal",
    [],
  );
  assert.ok(veryLow >= 0, `expected score clamped >=0, got ${veryLow}`);
  assert.ok(veryLow <= 2, `expected very low score <=2, got ${veryLow}`);
});

test("scoreStockRelevance: neutral generic noun stays around 5", () => {
  const score = scoreStockRelevance("ruth chris", []);
  assert.equal(score, 5);
});
