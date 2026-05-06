#!/usr/bin/env node
//
// Weekly model-deprecation audit.
//
// Pings each provider's public model catalog ("/v1/models" or equivalent)
// and verifies that every model id we ship in src/config/models.js still
// resolves.  Missing ids print a "::warning::" line so a CI workflow
// can surface them.  Exits 0 even on warnings — the goal is signal,
// not a failed build.
//
// Run locally:    node scripts/check-model-deprecations.mjs
//
// We deliberately avoid sending API keys here.  Catalog endpoints that
// require auth (Cerebras, NVIDIA, Mistral) are skipped unless the
// corresponding env var (e.g. CEREBRAS_API_KEY) is provided.

import { MODEL_IDS, OR_MODEL_MAP } from "../src/config/models.js";

const TIMEOUT_MS = 8000;

async function fetchJson(url, headers = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, json: await res.json() };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, error: String(e?.message || e) };
  }
}

function flagMissing(provider, expected, available) {
  const missing = expected.filter(id => !available.has(id));
  if (missing.length) {
    console.log(`::warning::${provider}: ${missing.length} model id(s) missing from live catalog → ${missing.join(", ")}`);
  } else {
    console.log(`✓ ${provider}: all ${expected.length} ids verified live`);
  }
}

async function checkOpenRouter() {
  const r = await fetchJson("https://openrouter.ai/api/v1/models");
  if (!r.ok) {
    console.log(`::warning::OpenRouter catalog unreachable (${r.status || r.error})`);
    return;
  }
  const ids = new Set((r.json?.data || []).map(m => m.id));
  flagMissing("OpenRouter", Object.values(OR_MODEL_MAP), ids);
}

async function checkGroq() {
  const key = process.env.GROQ_API_KEY;
  const headers = key ? { Authorization: `Bearer ${key}` } : {};
  const r = await fetchJson("https://api.groq.com/openai/v1/models", headers);
  if (!r.ok) {
    if (r.status === 401 && !key) {
      console.log("⊘ Groq: skipped (no GROQ_API_KEY in env — endpoint now requires auth)");
      return;
    }
    console.log(`::warning::Groq catalog unreachable (${r.status || r.error})`);
    return;
  }
  const ids = new Set((r.json?.data || []).map(m => m.id));
  const expected = Object.entries(MODEL_IDS)
    .filter(([k]) => k.startsWith("groq"))
    .map(([, v]) => v);
  flagMissing("Groq", expected, ids);
}

async function checkGemini() {
  // Gemini list endpoint *does* take an api key as ?key=, but we can also
  // try without — it returns 401, which is enough to treat as "could not
  // verify" rather than "deprecated".
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) {
    console.log("⊘ Gemini: skipped (no GEMINI_API_KEY in env)");
    return;
  }
  const r = await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
  if (!r.ok) {
    console.log(`::warning::Gemini catalog unreachable (${r.status || r.error})`);
    return;
  }
  const ids = new Set((r.json?.models || []).map(m => (m.name || "").replace(/^models\//, "")));
  const expected = Object.entries(MODEL_IDS)
    .filter(([k]) => k.startsWith("gemini"))
    .map(([, v]) => v);
  flagMissing("Gemini", expected, ids);
}

async function checkMistral() {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) {
    console.log("⊘ Mistral: skipped (no MISTRAL_API_KEY in env)");
    return;
  }
  const r = await fetchJson("https://api.mistral.ai/v1/models", { Authorization: `Bearer ${key}` });
  if (!r.ok) {
    console.log(`::warning::Mistral catalog unreachable (${r.status || r.error})`);
    return;
  }
  const ids = new Set((r.json?.data || []).map(m => m.id));
  // mistral-small-latest is an alias; treat its presence as success.
  const expected = ["mistral-small-latest", "mistral-medium-latest", "mistral-large-latest"].filter(id => true);
  flagMissing("Mistral", expected, ids);
}

async function checkCerebras() {
  const key = process.env.CEREBRAS_API_KEY;
  if (!key) {
    console.log("⊘ Cerebras: skipped (no CEREBRAS_API_KEY in env)");
    return;
  }
  const r = await fetchJson("https://api.cerebras.ai/v1/models", { Authorization: `Bearer ${key}` });
  if (!r.ok) {
    console.log(`::warning::Cerebras catalog unreachable (${r.status || r.error})`);
    return;
  }
  const ids = new Set((r.json?.data || []).map(m => m.id));
  const expected = Object.entries(MODEL_IDS)
    .filter(([k]) => k.startsWith("cerebras-"))
    .map(([, v]) => v);
  flagMissing("Cerebras", expected, ids);
}

async function checkNvidia() {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) {
    console.log("⊘ NVIDIA NIM: skipped (no NVIDIA_API_KEY in env)");
    return;
  }
  const r = await fetchJson("https://integrate.api.nvidia.com/v1/models", { Authorization: `Bearer ${key}` });
  if (!r.ok) {
    console.log(`::warning::NVIDIA NIM catalog unreachable (${r.status || r.error})`);
    return;
  }
  const ids = new Set((r.json?.data || []).map(m => m.id));
  const expected = Object.entries(MODEL_IDS)
    .filter(([k]) => k.startsWith("nvidia-"))
    .map(([, v]) => v);
  flagMissing("NVIDIA NIM", expected, ids);
}

async function checkHuggingFace() {
  // HF Inference Providers list is public.
  const r = await fetchJson("https://router.huggingface.co/v1/models");
  if (!r.ok) {
    console.log(`::warning::HuggingFace catalog unreachable (${r.status || r.error})`);
    return;
  }
  const ids = new Set((r.json?.data || []).map(m => m.id));
  const expected = Object.entries(MODEL_IDS)
    .filter(([k]) => k.startsWith("hf-") || k === "huggingface")
    .map(([, v]) => v);
  flagMissing("HuggingFace", expected, ids);
}

async function main() {
  console.log("== PromptStudio model-deprecation audit ==");
  console.log("Run date:", new Date().toISOString());
  console.log("");
  await Promise.all([
    checkOpenRouter(),
    checkGroq(),
    checkGemini(),
    checkMistral(),
    checkCerebras(),
    checkNvidia(),
    checkHuggingFace(),
  ]);
  console.log("");
  console.log("Done.  Any '::warning::' line above indicates a model that may have been deprecated.");
}

main().catch(e => {
  // We deliberately do NOT throw — the audit is informational.
  console.log(`::warning::audit script crashed: ${String(e?.message || e)}`);
});
