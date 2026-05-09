import {
  enforceSameOrigin,
  fetchWithTimeout,
  jsonError,
  readJsonBody,
  sanitizeKeys,
  MAX_REQUEST_BODY_BYTES,
} from "@/lib/apiUtils";
import { readCache, writeCache, isoNow } from "@/lib/marketTrendsCache";

/**
 * /api/market-trends/analyze — per-trend AI live analysis.
 *
 * What it does:
 *   For a single trend query (e.g. "cottagecore", "frankincense candles",
 *   "Eras Tour outfits") we ask Gemini 2.5 Flash with the
 *   `tools: [{ google_search: {} }]` grounding tool to return a
 *   structured JSON answering the questions a creator actually cares
 *   about:
 *
 *     - Is this currently trending on Adobe Stock / Shutterstock /
 *       Etsy / Pinterest / TikTok? (one short verdict per platform)
 *     - Top 5 related search keywords creators should target.
 *     - Recommended marketplace + format (image / vector / video / POD).
 *     - Current selling colour / mood / aesthetic.
 *     - Verdict: stock-friendly / niche / passing fad / overcrowded.
 *
 * Why a dedicated endpoint:
 *   We don't want to inflate the existing /api/generate-prompts route
 *   with a totally different prompt + response shape. Keeping this
 *   separate means we can iterate on the analysis UX (cache strategy,
 *   rate limit, fallback prompts) without touching the prompt
 *   generator. It also makes the explicit "no auto-call" contract
 *   easier to enforce — only the Analyze button hits this URL.
 *
 * Quota discipline:
 *   - Strictly user-triggered. The /market-trends UI exposes one
 *     "Analyze" button per trend card; clicking is the only path here.
 *   - 24-hour module-level cache per query string (lower-cased,
 *     trimmed). If you click Analyze on the same trend twice in a day,
 *     the second response is served instantly with `cached: true`,
 *     spending zero Gemini tokens.
 *   - 90-second hard timeout on the Gemini call.
 *   - Returns 400 (no LLM call) if no Gemini key is supplied.
 *
 * Auth:
 *   - Same-origin only.
 *   - The user's own Gemini API key is sent in the JSON body
 *     (`apiKeys: [...]`) — this matches how /api/generate-prompts
 *     already handles user-supplied keys.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 90000;
const MAX_QUERY_LEN = 200;
const GEMINI_MODEL = "gemini-2.5-flash";

export async function POST(request) {
  const csrf = enforceSameOrigin(request);
  if (csrf) return csrf;

  let body;
  try {
    body = await readJsonBody(request, MAX_REQUEST_BODY_BYTES.general);
  } catch (e) {
    return jsonError(`Invalid JSON body: ${e?.message || e}`, 400, "BAD_BODY");
  }

  const rawQuery = typeof body.query === "string" ? body.query.trim() : "";
  if (!rawQuery) return jsonError("Missing 'query' string in body.", 400, "MISSING_QUERY");
  if (rawQuery.length > MAX_QUERY_LEN) {
    return jsonError(`'query' exceeds ${MAX_QUERY_LEN} characters.`, 400, "QUERY_TOO_LONG");
  }
  const query = rawQuery;

  const apiKeys = sanitizeKeys(body.apiKeys);
  const geminiKeys = body.apiKeysByModel?.gemini
    ? sanitizeKeys(body.apiKeysByModel.gemini)
    : apiKeys;
  if (geminiKeys.length === 0) {
    return jsonError(
      "Live Analysis requires a Google Gemini API key. Add one in the API Keys panel.",
      400,
      "NO_GEMINI_KEY",
    );
  }

  const cacheKey = query.toLowerCase();
  const cached = readCache("analyze", cacheKey);
  if (cached) {
    return jsonResponse({
      ok: true,
      cached: true,
      fetchedAt: new Date(cached.fetchedAt).toISOString(),
      query,
      analysis: cached.data,
    });
  }

  // Try each provided Gemini key in order; fall through on rate-limit /
  // transient failures. We deliberately don't surface one user's
  // quota-exhausted error to the next caller — if every key fails,
  // we report the last error and don't poison the cache.
  let lastError = null;
  for (let i = 0; i < geminiKeys.length; i++) {
    const apiKey = geminiKeys[i];
    try {
      const analysis = await runGroundedAnalysis(apiKey, query);
      writeCache("analyze", cacheKey, analysis);
      return jsonResponse({
        ok: true,
        cached: false,
        fetchedAt: isoNow(),
        query,
        analysis,
      });
    } catch (e) {
      lastError = e;
      const status = e?.status || 0;
      // 429 / 503 → try the next key. Anything else → bubble up.
      if (status !== 429 && status !== 503) break;
    }
  }

  return jsonResponse({
    ok: false,
    cached: false,
    fetchedAt: isoNow(),
    query,
    analysis: null,
    error: lastError?.message || "Gemini call failed",
  });
}

async function runGroundedAnalysis(apiKey, query) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const prompt = buildAnalysisPrompt(query);

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
        maxOutputTokens: 4096,
      },
    }),
  }, FETCH_TIMEOUT_MS);

  if (!res.ok) {
    let msg = `Gemini error (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error?.message) msg = errBody.error.message;
    } catch { /* ignore parse error */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const rawText = parts
    .filter((p) => !p.thought && typeof p.text === "string")
    .map((p) => p.text)
    .join("");

  const parsed = extractAnalysisJson(rawText);
  // Surface the grounded sources Gemini cited so the user can
  // verify the analysis isn't hallucinated. Best-effort — newer
  // Gemini versions may shift the field name.
  const groundingChunks =
    data?.candidates?.[0]?.groundingMetadata?.groundingChunks ||
    data?.candidates?.[0]?.grounding_metadata?.grounding_chunks ||
    [];
  const sources = groundingChunks
    .map((c) => {
      const w = c?.web || c?.webResource || null;
      if (!w) return null;
      return {
        title: typeof w.title === "string" ? w.title : "",
        url: typeof w.uri === "string" ? w.uri : (typeof w.url === "string" ? w.url : ""),
      };
    })
    .filter((s) => s && s.url)
    .slice(0, 8);

  return { ...parsed, sources, rawText };
}

function buildAnalysisPrompt(query) {
  return `You are a stock-content market analyst. Use Google Search grounding to research the keyword in real time, then return ONLY a JSON object — no commentary, no markdown fences.

Keyword: "${query}"

JSON shape (all fields required):
{
  "verdict": "stock-friendly" | "niche" | "overcrowded" | "passing-fad" | "not-suitable",
  "summary": "1-2 sentence plain-English summary of where this keyword stands right now",
  "platforms": [
    { "name": "Adobe Stock"  | "Shutterstock" | "Getty/iStock" | "Etsy" | "Redbubble" | "Pinterest" | "TikTok" | "Instagram",
      "trending": true | false,
      "note": "1 sentence — what is selling there right now?" }
  ],
  "topKeywords": ["...", "...", "...", "...", "..."],
  "recommendedMarketplace": "Adobe Stock" | "Shutterstock" | "Etsy" | "Redbubble" | "Creative Market" | "Pixabay" | "Pinterest" | "...",
  "recommendedFormat": "image" | "vector" | "video" | "pod" | "template",
  "colorPalette": ["#hex", "#hex", "#hex"],
  "moodTags": ["...", "...", "..."],
  "warnings": ["..."]
}

Rules:
- "platforms" must include 4-6 platforms with the most reliable data.
- "topKeywords" should be search-engine-friendly long-tail terms creators can immediately use.
- "warnings" lists oversaturation / IP / cultural-sensitivity / halal flags. Empty array if none.
- Output JSON only. No explanation outside the JSON.`;
}

function extractAnalysisJson(text) {
  if (typeof text !== "string" || !text.trim()) {
    return fallbackAnalysis("Empty model response");
  }
  // Strip any accidental ```json fences.
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = (fenced ? fenced[1] : text).trim();
  // Find first '{' and last '}' to be tolerant of preface / suffix text.
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    return fallbackAnalysis("No JSON object in response");
  }
  const slice = candidate.slice(first, last + 1);
  try {
    const parsed = JSON.parse(slice);
    return normaliseAnalysis(parsed);
  } catch {
    return fallbackAnalysis("JSON parse failed");
  }
}

function normaliseAnalysis(obj) {
  const verdict = typeof obj.verdict === "string" ? obj.verdict : "unknown";
  const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
  const platforms = Array.isArray(obj.platforms)
    ? obj.platforms
        .map((p) => ({
          name: typeof p?.name === "string" ? p.name : "",
          trending: !!p?.trending,
          note: typeof p?.note === "string" ? p.note : "",
        }))
        .filter((p) => p.name)
        .slice(0, 8)
    : [];
  const topKeywords = Array.isArray(obj.topKeywords)
    ? obj.topKeywords.filter((k) => typeof k === "string" && k.trim()).slice(0, 8)
    : [];
  const recommendedMarketplace = typeof obj.recommendedMarketplace === "string"
    ? obj.recommendedMarketplace : "";
  const recommendedFormat = typeof obj.recommendedFormat === "string"
    ? obj.recommendedFormat.toLowerCase() : "";
  const colorPalette = Array.isArray(obj.colorPalette)
    ? obj.colorPalette
        .filter((c) => typeof c === "string" && /^#[0-9a-fA-F]{3,8}$/.test(c.trim()))
        .slice(0, 6)
    : [];
  const moodTags = Array.isArray(obj.moodTags)
    ? obj.moodTags.filter((m) => typeof m === "string" && m.trim()).slice(0, 8)
    : [];
  const warnings = Array.isArray(obj.warnings)
    ? obj.warnings.filter((w) => typeof w === "string" && w.trim()).slice(0, 6)
    : [];
  return {
    verdict,
    summary,
    platforms,
    topKeywords,
    recommendedMarketplace,
    recommendedFormat,
    colorPalette,
    moodTags,
    warnings,
  };
}

function fallbackAnalysis(reason) {
  return {
    verdict: "unknown",
    summary: `Could not parse a structured analysis (${reason}). Raw model output is available in 'rawText'.`,
    platforms: [],
    topKeywords: [],
    recommendedMarketplace: "",
    recommendedFormat: "",
    colorPalette: [],
    moodTags: [],
    warnings: [],
  };
}

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
