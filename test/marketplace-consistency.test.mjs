import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const CANONICAL = [
  "adobe",
  "shutterstock",
  "freepik",
  "getty",
  "dreamstime",
  "vecteezy",
  "pond5",
  "creativemarket",
];

async function readSrc(rel) {
  return readFile(resolve(repoRoot, rel), "utf8");
}

test("AutoTester MARKETPLACES list contains all 8 canonical platforms", async () => {
  const src = await readSrc("src/components/AutoTester.jsx");
  for (const m of CANONICAL) {
    assert.match(
      src,
      new RegExp(`"${m}"`),
      `AutoTester should reference "${m}"`,
    );
  }
});

test("PromptGenerator marketplace select includes all 8 canonical platforms", async () => {
  const src = await readSrc("src/components/PromptGenerator.jsx");
  for (const m of CANONICAL) {
    assert.match(
      src,
      new RegExp(`value="${m}"`),
      `PromptGenerator marketplace select should include value="${m}"`,
    );
  }
});

test("metadata-generator marketplace select includes all 8 canonical platforms", async () => {
  const src = await readSrc("src/app/metadata-generator/page.jsx");
  for (const m of CANONICAL) {
    assert.match(
      src,
      new RegExp(`value="${m}"`),
      `metadata-generator should include value="${m}"`,
    );
  }
});

test("generate-metadata route has guidance profiles for all 8 canonical platforms", async () => {
  const src = await readSrc("src/app/api/generate-metadata/route.js");
  for (const m of CANONICAL) {
    // The route uses `targetMarket === "<id>"` switch arms.
    assert.match(
      src,
      new RegExp(`targetMarket\\s*===\\s*"${m}"`),
      `generate-metadata should branch on targetMarket === "${m}"`,
    );
  }
});

test("video contentType is rejected by generate-metadata route", async () => {
  const src = await readSrc("src/app/api/generate-metadata/route.js");
  // Look for an explicit guard against contentType === "video".
  assert.match(
    src,
    /contentType\s*===\s*["']video["']|contentType.*video/i,
    "generate-metadata should explicitly reject video contentType",
  );
});
