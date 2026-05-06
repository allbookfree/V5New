import assert from "node:assert/strict";
import test from "node:test";

import { ALLOWED_MODELS, OR_MODEL_MAP, VISION_ELITE_ORDER, VISION_MODELS } from "../src/config/models.js";

const retiredVisionModels = new Set([
  "llama-3.2-11b-vision-preview",
  "llama-3.2-90b-vision-preview",
  "pixtral-12b-2409",
  "pixtral-large-latest",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
]);

test("metadata vision model lists avoid retired provider IDs", () => {
  const configuredVisionIds = Object.values(VISION_MODELS).flatMap((models) => models.map((model) => model.id));
  const eliteIds = VISION_ELITE_ORDER.map((entry) => entry.model);
  for (const modelId of [...configuredVisionIds, ...eliteIds]) {
    assert.equal(retiredVisionModels.has(modelId), false, `${modelId} should not be configured`);
  }
});

test("prompt model allow-list stays text-alias only", () => {
  const rawVisionIds = new Set(Object.values(VISION_MODELS).flatMap((models) => models.map((model) => model.id)));
  for (const modelId of ALLOWED_MODELS) {
    assert.equal(rawVisionIds.has(modelId), false, `${modelId} should not be a prompt model key`);
  }
});

test("OpenRouter Qwen alias resolves to a free current model", () => {
  assert.equal(OR_MODEL_MAP["or-qwen"], "qwen/qwen3-coder:free");
  assert.equal(OR_MODEL_MAP["or-qwen"].endsWith(":free"), true);
});
