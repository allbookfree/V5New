/**
 * /api/test-key — Real API key health check
 *
 * This route sends a tiny real generation request to verify that
 * a key is actually working for prompt generation, not just listing models.
 *
 * Body: { provider: "gemini"|"groq"|"mistral"|"openrouter"|"huggingface"|"cerebras"|"nvidia", key: "..." }
 * Response: { status: "working"|"invalid"|"rate"|"error", message: "..." }
 */

import { MODEL_IDS } from "@/config/models";
import { fetchWithTimeout, enforceSameOrigin, readJsonBody, MAX_REQUEST_BODY_BYTES, APP_REFERER, APP_TITLE } from "@/lib/apiUtils";

// Edge runtime: this route only does fetch() to upstream providers and
// has no Node-only dependencies. Edge cold-start is ~3s faster than
// Node serverless on Vercel and has lower per-request cost.
export const runtime = "edge";

// Minimal test prompt — uses almost no tokens
const TEST_PROMPT = "Say OK";

async function testGemini(key) {
  const modelId = MODEL_IDS["gemini-lite"] || "gemini-2.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: TEST_PROMPT }] }],
      generationConfig: { maxOutputTokens: 5 },
    }),
  }, 15000);
  return res;
}

async function testGroq(key) {
  const modelId = MODEL_IDS["groq-fast"] || "llama-3.1-8b-instant";
  const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: TEST_PROMPT }],
      max_tokens: 5,
    }),
  }, 15000);
  return res;
}

async function testMistral(key) {
  const res = await fetchWithTimeout("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [{ role: "user", content: TEST_PROMPT }],
      max_tokens: 5,
    }),
  }, 15000);
  return res;
}

async function testOpenRouter(key) {
  const res = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      // OpenRouter ranks free-tier requests by referer/title; keep them
      // in sync with the deployed origin so the test reflects production
      // behavior (and so we don't impersonate a different app).
      "HTTP-Referer": APP_REFERER,
      "X-Title": APP_TITLE,
    },
    body: JSON.stringify({
      model: "openrouter/free",
      messages: [{ role: "user", content: TEST_PROMPT }],
      max_tokens: 5,
    }),
  }, 15000);
  return res;
}

async function testHuggingFace(key) {
  const modelId = MODEL_IDS["hf-qwen"] || "Qwen/Qwen2.5-72B-Instruct";
  const res = await fetchWithTimeout(`https://router.huggingface.co/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: TEST_PROMPT }],
      max_tokens: 5,
    }),
  }, 15000);
  return res;
}

async function testCerebras(key) {
  // Use the smallest available model so the test consumes minimal tokens.
  const modelId = MODEL_IDS["cerebras-gpt-oss"] || "gpt-oss-120b";
  const res = await fetchWithTimeout("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: TEST_PROMPT }],
      max_tokens: 5,
    }),
  }, 15000);
  return res;
}

async function testNvidia(key) {
  // Llama 3.3 70B is the cheapest credit-cost option; using it for the
  // health check keeps NVIDIA's monthly free credit pool intact.
  const modelId = MODEL_IDS["nvidia-llama70"] || "meta/llama-3.3-70b-instruct";
  const res = await fetchWithTimeout("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: "user", content: TEST_PROMPT }],
      max_tokens: 5,
    }),
  }, 15000);
  return res;
}

function interpretResponse(res) {
  if (res.ok) return { status: "working" };
  if (res.status === 401 || res.status === 403) return { status: "invalid" };
  if (res.status === 429) return { status: "rate" };
  return { status: "error" };
}

export async function POST(request) {
  const csrf = enforceSameOrigin(request);
  if (csrf) return csrf;

  const { limited, response: limitResponse } = await (await import("@/lib/rateLimit")).rateLimit(request);
  if (limited) return limitResponse;

  let body;
  try {
    body = await readJsonBody(request, MAX_REQUEST_BODY_BYTES.general);
  } catch {
    return Response.json({ status: "error", message: "Invalid request body." }, { status: 400 });
  }
  try {
    const { provider, key } = body;

    if (!provider || typeof provider !== "string" || !key || typeof key !== "string" || !key.trim()) {
      return Response.json({ status: "invalid", message: "No key provided" }, { status: 200 });
    }
    // Cap key length defensively — real provider keys are well under 256 chars.
    if (key.length > 256) {
      return Response.json({ status: "invalid", message: "Key too long" }, { status: 200 });
    }

    let res;
    try {
      switch (provider) {
        case "gemini":
          res = await testGemini(key.trim());
          break;
        case "groq":
          res = await testGroq(key.trim());
          break;
        case "mistral":
          res = await testMistral(key.trim());
          break;
        case "openrouter":
          res = await testOpenRouter(key.trim());
          break;
        case "huggingface":
          res = await testHuggingFace(key.trim());
          break;
        case "cerebras":
          res = await testCerebras(key.trim());
          break;
        case "nvidia":
          res = await testNvidia(key.trim());
          break;
        default:
          return Response.json({ status: "error", message: "Unknown provider" }, { status: 200 });
      }
    } catch (err) {
      if (err.name === "AbortError") {
        return Response.json({ status: "error", message: "Request timed out" }, { status: 200 });
      }
      return Response.json({ status: "offline", message: "Could not reach server" }, { status: 200 });
    }

    const result = interpretResponse(res);

    // Try to extract server error message for more context
    if (result.status !== "working") {
      try {
        const errBody = await res.text();
        const parsed = JSON.parse(errBody);
        const msg = parsed?.error?.message || parsed?.error || parsed?.message || "";
        if (msg) result.serverMessage = typeof msg === "string" ? msg.substring(0, 200) : String(msg).substring(0, 200);
      } catch {}
    }

    return Response.json(result, { status: 200 });
  } catch (err) {
    try {
      const { reportError } = await import("@/lib/errorReporter");
      await reportError(err, { route: "/api/test-key" });
    } catch {}
    return Response.json({ status: "error", message: "Internal error" }, { status: 200 });
  }
}
