import { METADATA_PROMPTS } from "@/lib/metadataPrompts";
import { jsonError, sanitizeKeys, fetchWithTimeout, APP_REFERER, APP_TITLE, enforceSameOrigin, readJsonBody, MAX_REQUEST_BODY_BYTES } from "@/lib/apiUtils";
import { VISION_ELITE_ORDER, VISION_MODELS } from "@/config/models";

const PROMPTS = METADATA_PROMPTS;

// SVG is intentionally excluded: providers typically expect raster image bytes.
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 90000;
const MAX_TITLE_CHARS = 70;
const MAX_DESCRIPTION_CHARS = 250;
const MAX_KEYWORDS = 49;
const MIN_QUALITY_KEYWORDS = 25;
const VISION_MODEL_IDS = {
  gemini: new Set(VISION_MODELS.gemini.map(m => m.id)),
  groq: new Set(VISION_MODELS.groq.map(m => m.id)),
  mistral: new Set(VISION_MODELS.mistral.map(m => m.id)),
  openrouter: new Set(VISION_MODELS.openrouter.map(m => m.id)),
  huggingface: new Set(VISION_MODELS.huggingface.map(m => m.id)),
  nvidia: new Set(VISION_MODELS.nvidia.map(m => m.id)),
  github: new Set(VISION_MODELS.github.map(m => m.id)),
};
// Gemini fallback order: Flash > Flash-Lite > Pro (all vision-capable, stable)
const GEMINI_VISION_FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro"];
// Mistral fallback: pixtral-12b-latest (dedicated vision) > mistral-small-latest (Small 4, vision-capable)
const MISTRAL_VISION_FALLBACK_MODELS = ["pixtral-12b-latest", "mistral-small-latest"];

function getMetadataMarketplaceGuidance(targetMarket, contentType = "image") {
  const isVideo = contentType === "video";

  if (targetMarket === "adobe") {
    if (isVideo) {
      return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: ADOBE STOCK VIDEO]
- Title: 5-12 words, strictly factual. Lead with the camera technique or subject action ("Aerial Drone Shot of...", "Slow Motion Close-Up of..."). Max 70 characters.
- Keywords: Max 49 keywords. Accuracy is PARAMOUNT — Adobe auto-suppresses footage with irrelevant keywords.
- ADOBE VIDEO BOOST: Include technique keywords early: "cinematic", "4K", "slow motion", "aerial", "time lapse", "loopable". Then add conceptual keywords: "serenity", "power", "flow", "transformation", "motion", "energy".
- Include "nobody" and "no people" explicitly — Adobe buyers filter for human-free footage constantly.
- AVOID: file specs in title ("4K"), brand names, subjective adjectives (beautiful, stunning).`;
    }
    return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: ADOBE STOCK]
- Title: 5-10 words, strictly factual and descriptive. Avoid ALL subjective adjectives (beautiful, stunning, amazing). Max 70 characters.
- Keywords: Max 49 keywords. Accuracy is PARAMOUNT — Adobe auto-suppresses assets with irrelevant keywords.
- ADOBE-SPECIFIC RANKING BOOST: Conceptual and emotional keywords are given higher search weight on Adobe than on any other platform. After describing what you see (slots 1-10), HEAVILY lean into abstract concepts in slots 11-30: "growth", "innovation", "balance", "transformation", "abundance", "serenity", "focus", "minimal", "zen", "connection", "flow", "clarity", "calm". These are the hidden revenue keywords on Adobe Stock.
- COPY SPACE is a major Adobe search filter — always include "copy space" if the image has open areas.
- Include "nobody" explicitly — Adobe buyers specifically filter for human-free content.`;
  } else if (targetMarket === "shutterstock") {
    if (isVideo) {
      return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: SHUTTERSTOCK VIDEO]
- Title: Factual and direct. Max 200 characters, aim under 70. NEVER use subjective words (beautiful, stunning, nice).
- Keywords: 7-50 keywords. Order by relevance — shot type FIRST.
- Shutterstock Video Best Practices:
  → First 3 keywords MUST be the shot technique: "slow motion", "aerial view", "time lapse", "loopable clip", "B-roll"
  → Include resolution: "4K", "HD", "cinematic"
  → Include use-case: "background video", "social media", "website background", "commercial use"
  → Include motion descriptor: "smooth", "dynamic", "seamless", "flowing"
  → NEVER include: brand names, subjective adjectives, plural nouns.`;
    }
    return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: SHUTTERSTOCK]
- Title: Factual and direct. Max 200 characters but aim for under 70. NEVER use subjective words (beautiful, stunning, amazing, nice) — these trigger rejections.
- Keywords: 7-50 keywords maximum. Order by relevance (most important FIRST).
- Shutterstock Metadata Best Practices:
  → Description: reads like a mini-story — answer What, Where, Mood + commercial use
  → Include commercial-use terms: "commercial use", "professional", "corporate" where appropriate
  → Include use-case terms: "website", "advertisement", "brochure", "social media", "presentation"
  → For vectors: include style terms ("flat design", "line art", "isometric")
  → NEVER include: brand names, artist names, AI-related terms, subjective quality words, plural nouns
  → SHUTTERSTOCK BOOST: Include both the broad category AND the specific item — e.g., "food" AND "coffee bean"`;
  } else if (targetMarket === "freepik") {
    if (isVideo) {
      return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: FREEPIK VIDEO]
- Title: Creative and modern. Include the visual mood and technique.
- Keywords: Trendy, energy-forward terminology. Focus on what a social media creator would search for.
- Freepik Video Best Practices:
  → Include motion style: "loopable", "animated background", "motion graphic", "seamless loop"
  → Include aesthetic terms: "modern", "minimal", "aesthetic", "gradient", "neon", "retro"
  → Include use-case: "social media background", "story background", "reel", "TikTok background"`;
    }
    return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: FREEPIK]
- Title: Can be more creative and catchy. Use trendy and modern descriptors.
- Keywords: Include vibrant, contemporary, and high-energy terminology that appeals to social media and web designers.
- Freepik Metadata Best Practices:
  → Title and keywords must be embedded in file metadata (for vectors: in EPS metadata)
  → Include design-style keywords: "modern", "trendy", "minimalist", "gradient", "flat"
  → Include use-case keywords: "web design", "social media", "banner", "flyer", "template"
  → For vectors: layer descriptions should be clean and in English
  → Trending keywords on Freepik: "aesthetic", "y2k", "retro", "boho", "minimal", "pastel"`;
  } else if (targetMarket === "getty") {
    if (isVideo) {
      return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: GETTY IMAGES VIDEO / ISTOCK VIDEO]
- Title: Cinematic and narrative. Describe the 'scene moment' — not just the subject.
- Keywords: Lean heavily into conceptual, emotional, and technique keywords.
- Getty Video Best Practices:
  → Technique keywords FIRST: "aerial footage", "slow motion clip", "time lapse video", "drone shot"
  → Conceptual keywords: "growth", "freedom", "journey", "transformation", "discovery"
  → Include "nobody" and "no people" — Getty buyers filter heavily for human-free footage
  → Emphasize editorial/commercial distinction: add "editorial use" or "commercial use" as appropriate
  → iStock Signature values EXCLUSIVITY — write metadata as if this clip is one-of-a-kind footage
  → AVOID: Generic terms, brand names, technical jargon buyers don't search for.`;
    }
    return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: GETTY IMAGES / ISTOCK]
- Title: Focus on story and conceptual depth. Describe the 'moment' or 'narrative', not just the objects.
- Keywords: Lean heavily into conceptual and emotional keywords.
- iStock/Getty Metadata Best Practices:
  → Conceptual keywords are KING: "growth", "innovation", "connection", "balance", "transformation"
  → Emotional keywords: "comfort", "joy", "serenity", "determination", "hope", "resilience"
  → Include "nobody" / "no people" for content without humans — this is a highly searched filter on Getty
  → Include visual style: "authentic", "candid", "editorial", "lifestyle", "conceptual"
  → Use specific descriptors over generic: "morning light through window" not just "light"
  → iStock Signature collection values EXCLUSIVITY and uniqueness — metadata should emphasize distinctiveness
  → AVOID: Generic stock terms, AI-related terms, brand names, overly technical photography jargon`;
  } else if (targetMarket === "dreamstime") {
    if (isVideo) {
      return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: DREAMSTIME VIDEO]
- Title: Clear and directly descriptive. Max 70 characters.
- Keywords: Up to 50 keywords. Broad and specific mix.
- Dreamstime Video Best Practices:
  → Include shot type: "time lapse", "slow motion", "aerial", "loopable"
  → Include practical use-case: "website background", "blog video", "marketing", "commercial"
  → Include visual mood: "calm", "dramatic", "peaceful", "energetic"
  → DEPOSITPHOTOS BOOST: Include color descriptors — buyers filter by color.`;
    }
    return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: DREAMSTIME / DEPOSITPHOTOS]
- Title: Clear, simple, and directly descriptive. Max 70 characters. Focus on utility and immediate visual recognition.
- Keywords: Up to 50 keywords. Prioritize broad, universally searchable terms.
- Dreamstime Metadata Best Practices:
  → Dreamstime accepts AI-generated content — emphasize quality and visual authenticity in keywords
  → Include practical use-case keywords: "blog post", "marketing", "advertising", "editorial", "website"
  → Include both specific AND broad keywords for maximum discoverability
  → DEPOSITPHOTOS BOOST: Include color descriptors prominently — buyers frequently filter by color`;
  } else if (targetMarket === "vecteezy") {
    if (isVideo) {
      return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: VECTEEZY VIDEO]
- Title: Motion-focused and designer-friendly. Lead with the motion type.
- Keywords: Mix motion and design vocabulary.
- Vecteezy Video Best Practices:
  → Include motion type: "loopable", "animated", "seamless loop", "motion background"
  → Include style: "flat animation", "geometric motion", "particle", "abstract"
  → Avoid: brand names, year numbers.`;
    }
    return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: VECTEEZY]
- Title: Concrete, designer-friendly. Lead with the asset type, then mood/use ("Cozy autumn cafe scene illustration").
- Keywords: Mix designer-utility terms ("flat illustration", "icon set", "isolated", "vector illustration", "transparent background") with content terms.
- Vecteezy Metadata Best Practices:
  → AI content welcome but quality bar is real — keywords should sound like a designer wrote them, not a stock farm
  → Include format/style: "flat", "isometric", "outline", "filled", "duotone", "gradient", "line art"
  → Include common designer use cases: "web", "social media", "packaging", "merch", "marketing"
  → Avoid: brand names, holiday names tied to past dates, year numbers (2024/2025), "stock"/"royalty"`;
  } else if (targetMarket === "pond5") {
    return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: POND5]
- Title: Cinematic and specific. 40-80 characters. Lead with camera technique ("Aerial Drone Shot of...", "Slow Motion Close-Up of...", "4K Time-Lapse of...").
- Keywords: 40-50 keywords (Pond5 performs best at this count — more than other platforms).
- Pond5 Metadata Best Practices:
  → Buyers are professional filmmakers, ad agencies, broadcast editors — write like a footage library catalog
  → ALWAYS include the shot/camera technique in the first 3 keywords: "aerial shot", "drone footage", "slow motion", "time lapse", "B-roll", "establishing shot", "loopable clip"
  → Include resolution/quality terms ("cinematic", "4K quality", "ProRes") — Pond5 buyers FILTER by these
  → For vertical footage: include "P5Vertical" as a keyword — this is Pond5's official vertical video tag
  → Avoid: watermarks, "viral", subjective adjectives (beautiful, amazing), social-media filter language
  → POND5 BOOST: Include specific niche genre tags — "documentary", "nature footage", "travel video", "corporate B-roll"`;
  } else if (targetMarket === "creativemarket") {
    return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: CREATIVE MARKET]
- Title: Designer-product framing. Treat this as a product listing ("Minimal Botanical Logo Pack — 24 Vector Marks").
- Keywords: Heavy on design-system vocabulary — "branding", "identity", "logo pack", "icon set", "social templates", "presets", "mockup".
- Creative Market Metadata Best Practices:
  → Buyers are designers building brand systems — emphasize cohesion, editability, palette discipline
  → For sets: explicitly state count + format ("24 icons", "EPS + AI + SVG", "Procreate brushes")
  → Include trend-but-timeless modifiers: "editorial", "modern", "minimal", "boho", "y2k", "retro" (only if accurate)
  → Avoid: one-off generic stock tone, "AI-generated" framing (CM buyers want curated craft)`;
  } else if (targetMarket === "envato") {
    if (isVideo) {
      return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: ENVATO ELEMENTS VIDEO]
- Title: Clear, utility-focused. Max 70 characters.
- Keywords: 30-50 keywords. Focus on corporate, agency, and presentation use-cases.
- Envato Video Best Practices:
  → Include use-case: "background video", "presentation background", "corporate b-roll", "commercial use"
  → Highlight aesthetics: "clean", "modern", "minimal", "professional", "high quality"
  → Include technique: "loopable", "seamless", "4K", "slow motion"`;
    }
    return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: ENVATO ELEMENTS]
- Title: Highly functional and direct. Treat it like a drop-in asset for an agency.
- Keywords: Utility-first. Include terms like "template", "background", "hero image", "mockup", "presentation".
- Envato Metadata Best Practices:
  → Emphasize immediate utility — buyers are freelancers with tight deadlines.
  → Include aesthetic terms: "modern", "clean", "minimal", "glassmorphism", "corporate"
  → For vectors: mention "editable", "organized", "layered", "flat design", "isometric"
  → Include "copy space" and "isolated" if applicable.`;
  } else if (targetMarket === "etsy") {
    if (isVideo) {
      return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: ETSY VIDEO]
- Title: Aesthetic and emotional. Focus on craft, decor, or mood.
- Keywords: B2C aesthetic terms, craft themes, mood descriptors.
- Etsy Video Best Practices:
  → Include style tags: "aesthetic", "vintage", "boho", "cozy", "moody"
  → Highlight the end-buyer's feeling: "relaxing", "calming", "beautiful", "decorative"`;
    }
    return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: ETSY]
- Title: B2C-friendly, emotional, and highly descriptive. Mention the aesthetic style ("Boho aesthetic watercolor floral...").
- Keywords: Trend-driven B2C search terms.
- Etsy Metadata Best Practices:
  → Buyers are end-consumers or crafters, not corporate agencies.
  → Include aesthetic tags: "boho", "vintage", "pastel", "minimalist wall art", "cottagecore", "nursery decor"
  → Emphasize emotion/mood over corporate utility.`;
  } else if (targetMarket === "wirestock") {
    if (isVideo) {
      return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: WIRESTOCK VIDEO]
- Title: Ultra-literal, hyper-descriptive. No fluff.
- Keywords: Max 50 keywords. Only describe exactly what is in the frame.
- Wirestock Video Best Practices:
  → Strict adherence to photorealism. No subjective adjectives.
  → Ensure technique keywords are 100% accurate (do not say 4K if it's not clear).`;
    }
    return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: WIRESTOCK]
- Title: Extremely literal and factual. Do not use creative fluff.
- Keywords: Purely descriptive. 30-50 keywords.
- Wirestock Metadata Best Practices:
  → Wirestock reviewers reject subjective terms and hallucinated metadata.
  → Focus strictly on the physical reality of the asset.
  → Emphasize lighting, texture, and physical objects.`;
  } else if (targetMarket === "redbubble") {
    return `\n\n[CRITICAL TARGET PLATFORM STRATEGY: REDBUBBLE]
- Title: Catchy, pop-culture adjacent, or highly expressive.
- Keywords: Gen-Z/Millennial trend tags, apparel search terms.
- Redbubble Metadata Best Practices:
  → Treat as a t-shirt or sticker design. Include keywords like "graphic tee", "sticker design", "pop art", "funny".
  → Include style keywords: "retro", "vaporwave", "y2k", "kawaii", "typographic".`;
  }
  return "";
}

const BANNED_KEYWORDS_COMMON = new Set([
  "photo", "image", "stock", "picture", "photograph", "photography",
  "stock photo", "stock image", "royalty free", "royalty-free",
  "clip art", "clipart", "ai generated", "ai-generated",
  "high quality", "high-quality", "high resolution", "high-resolution",
  "hd", "4k", "8k", "beautiful", "nice", "good",
  "amazing", "stunning", "gorgeous", "wonderful", "awesome", "best",
]);

const BANNED_KEYWORDS_VECTOR = new Set([
  ...BANNED_KEYWORDS_COMMON,
  "vector", "illustration", "graphic design", "design element",
  "stock vector", "stock illustration", "eps", "svg", "artwork",
]);

const BANNED_KEYWORDS_IMAGE = new Set([
  ...BANNED_KEYWORDS_COMMON,
  "stock photo", "stock photography", "digital art", "artwork",
]);

function estimateBase64Bytes(base64Data) {
  const padding = (base64Data.match(/=+$/) || [""])[0].length;
  return Math.floor((base64Data.length * 3) / 4) - padding;
}

function smartTruncateTitle(title, maxLen) {
  if (title.length <= maxLen) return title;
  const truncated = title.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.6) {
    let result = truncated.slice(0, lastSpace).trim();
    result = result.replace(/[,\-–—:;|/\\]+$/, "").trim();
    return result;
  }
  return truncated.trim();
}

function isBannedKeyword(keyword, bannedSet) {
  const norm = keyword.toLowerCase().trim()
    .replace(/[.,;:!?'"]+$/, "")
    .replace(/^[.,;:!?'"]+/, "");
  if (bannedSet.has(norm)) return true;
  const noDash = norm.replace(/-/g, " ");
  if (noDash !== norm && bannedSet.has(noDash)) return true;
  if (norm.endsWith("s") && bannedSet.has(norm.slice(0, -1))) return true;
  return false;
}

function normalizeKeywords(input, contentType = "image") {
  const bannedSet = contentType === "vector" ? BANNED_KEYWORDS_VECTOR : BANNED_KEYWORDS_IMAGE;
  const raw = typeof input === "string" ? input : Array.isArray(input) ? input.join(", ") : "";
  const list = raw
    .split(",")
    .map((item) => item.trim().replace(/^\d+\.\s*/, ""))
    .filter(Boolean);
  const unique = [];
  const seen = new Set();
  for (const key of list) {
    const normalized = key.toLowerCase().trim();
    if (seen.has(normalized)) continue;
    if (isBannedKeyword(key, bannedSet)) continue;
    seen.add(normalized);
    unique.push(key);
    if (unique.length >= MAX_KEYWORDS) break;
  }
  return unique;
}

function normalizeMetadata(metadata, contentType = "image") {
  const titleRaw = typeof metadata?.title === "string" ? metadata.title.trim() : "";
  const descriptionRaw = typeof metadata?.description === "string" ? metadata.description.trim() : "";
  const keywordsList = normalizeKeywords(metadata?.keywords, contentType);
  const title = smartTruncateTitle(titleRaw, MAX_TITLE_CHARS);
  const description = descriptionRaw.slice(0, MAX_DESCRIPTION_CHARS);
  const keywords = keywordsList.join(", ");
  const keywordCount = keywordsList.length;
  const hasMinimumContent = title.length > 0 && description.length > 0 && keywordsList.length >= MIN_QUALITY_KEYWORDS;
  return { title, description, keywords, keywordCount, hasMinimumContent };
}

function parseJsonResponse(rawText) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {}
    return null;
  }
}

function getSelectedVisionModel(selectedModels, provider, fallback) {
  const model = typeof selectedModels?.[provider] === "string" ? selectedModels[provider] : "";
  return VISION_MODEL_IDS[provider]?.has(model) ? model : fallback;
}

function uniqueModelOrder(primary, fallbacks) {
  return Array.from(new Set([primary, ...fallbacks].filter(Boolean)));
}

// ── Gemini (Flash or Flash-Lite) ──────────────────────────────────────────────
async function tryGemini(geminiKeys, mimeType, base64Data, prompt, model, contentType = "image") {
  for (const apiKey of geminiKeys) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64Data } },
              ],
            },
          ],
          generationConfig: { temperature: 0.4, topP: 0.8, maxOutputTokens: 1024 },
        }),
      }, REQUEST_TIMEOUT_MS);

      if (res.status === 429) {
        let errMsg = "";
        try { const e = await res.json(); errMsg = e?.error?.message || ""; } catch { }
        console.error(`[Gemini Metadata] ${model} → 429: ${errMsg || "Rate limited"}`);
        continue; // try next key
      }
      if (!res.ok) {
        let errMsg = `Gemini error (${res.status})`;
        try { const e = await res.json(); if (e?.error?.message) errMsg = e.error.message; } catch { }
        console.error(`[Gemini Metadata] ${model} → ${res.status}: ${errMsg}`);
        return { error: errMsg, retry: false };
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const metadata = parseJsonResponse(rawText);
      if (!metadata) continue;

      const normalized = normalizeMetadata(metadata, contentType);
      if (normalized.hasMinimumContent) return { ok: true, data: normalized, provider: model };
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.includes("timeout") || msg.includes("aborted")) continue;
    }
  }
  return { error: null, retry: true }; // all keys failed/rate-limited, try next provider
}

async function tryGeminiReliable(geminiKeys, mimeType, base64Data, prompt, model, contentType = "image") {
  const modelsToTry = uniqueModelOrder(model, GEMINI_VISION_FALLBACK_MODELS);
  for (const apiKey of geminiKeys) {
    for (const modelId of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
      try {
        const res = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inline_data: { mime_type: mimeType, data: base64Data } },
                ],
              },
            ],
            generationConfig: { temperature: 0.4, topP: 0.8, maxOutputTokens: 1536 },
          }),
        }, REQUEST_TIMEOUT_MS);

        if (res.status === 429) continue;
        if (!res.ok) {
          if (res.status === 400 || res.status === 404) continue;
          let errMsg = `Gemini error (${res.status})`;
          try {
            const e = await res.json();
            if (e?.error?.message) errMsg = e.error.message;
          } catch {}
          return { error: errMsg, retry: false };
        }

        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const metadata = parseJsonResponse(rawText);
        if (!metadata) continue;

        const normalized = normalizeMetadata(metadata, contentType);
        if (normalized.hasMinimumContent) return { ok: true, data: normalized, provider: modelId };
      } catch (err) {
        const msg = String(err?.message || "");
        if (msg.includes("timeout") || msg.includes("aborted")) continue;
      }
    }
  }
  return { error: null, retry: true };
}

// ── OpenRouter (dynamic free vision model discovery) ──────────────────────────
// Fallback list only — actual models fetched dynamically from the API
const OR_FALLBACK_MODELS = [
  "openrouter/free",
  "google/gemma-3-27b-it:free",
  "nvidia/nemotron-nano-12b-v2-vl:free",
];

const _orModelCache = new Map(); // key → { models, ts }
const OR_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getFreeVisionModels(apiKey) {
  const cached = _orModelCache.get(apiKey);
  if (cached && Date.now() - cached.ts < OR_CACHE_TTL_MS) return cached.models;

  try {
    const res = await fetchWithTimeout("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    }, 10000);
    if (!res.ok) return OR_FALLBACK_MODELS;

    const json = await res.json();
    const models = (json.data || [])
      .filter(m => {
        const free = m.id?.endsWith(":free") || Number(m.pricing?.prompt) === 0;
        const modality = (m.architecture?.modality || m.architecture?.input_modalities || []);
        const vision = (typeof modality === "string" ? modality : modality.join(","))
          .toLowerCase().includes("image");
        return free && vision;
      })
      // prefer smaller/faster models first
      .sort((a, b) => {
        const sizeA = (a.id?.match(/(\d+)b/i) || [, 999])[1];
        const sizeB = (b.id?.match(/(\d+)b/i) || [, 999])[1];
        return Number(sizeA) - Number(sizeB);
      })
      .map(m => m.id)
      .slice(0, 6);

    const result = models.length > 0 ? models : OR_FALLBACK_MODELS;
    _orModelCache.set(apiKey, { models: result, ts: Date.now() });
    return result;
  } catch (err) {
    console.error("[OpenRouter] Model discovery failed:", err?.message);
    return OR_FALLBACK_MODELS;
  }
}

async function tryOpenRouter(orKeys, mimeType, base64Data, prompt, contentType = "image", preferredModel = "") {
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  let lastErr = "";

  for (const apiKey of orKeys) {
    const discoveredModels = await getFreeVisionModels(apiKey);
    const models = preferredModel ? uniqueModelOrder(preferredModel, discoveredModels) : discoveredModels;
    for (const model of models) {
      try {
        const res = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": APP_REFERER,
            "X-Title": APP_TITLE,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: dataUrl } },
                ],
              },
            ],
            temperature: 0.4,
            max_tokens: 1024,
          }),
        }, REQUEST_TIMEOUT_MS);

        if (!res.ok) {
          let errBody = "";
          try { errBody = await res.text(); } catch { }
          let parsed = null;
          try { parsed = JSON.parse(errBody); } catch { }
          const apiMsg = parsed?.error?.message || parsed?.message || errBody || `HTTP ${res.status}`;
          console.error(`[OpenRouter] ${model} → ${res.status}: ${apiMsg}`);

          if (res.status === 401 || res.status === 403) {
            return { error: `OpenRouter key invalid (${res.status}). Check your key in Settings.`, retry: false };
          }
          if (res.status === 402) {
            return { error: "OpenRouter free credits exhausted. Add credits or use another provider.", retry: false };
          }
          if (res.status === 429) { lastErr = "Rate limit"; continue; }
          // 400 or other: capture error and try next model
          lastErr = apiMsg.slice(0, 120);
          continue;
        }

        const data = await res.json();
        const rawText = data?.choices?.[0]?.message?.content || "";
        const metadata = parseJsonResponse(rawText);
        if (!metadata) { lastErr = "No valid JSON in response"; continue; }

        const normalized = normalizeMetadata(metadata, contentType);
        if (normalized.hasMinimumContent) {
          return { ok: true, data: normalized, provider: `openrouter:${model.split("/")[1].split(":")[0]}` };
        }
        lastErr = "Incomplete metadata returned";
      } catch (err) {
        const msg = String(err?.message || "");
        console.error(`[OpenRouter] ${model} exception:`, msg);
        if (msg.includes("timeout") || msg.includes("aborted")) { lastErr = "Timeout"; continue; }
        lastErr = msg.slice(0, 80);
      }
    }
  }
  return { error: lastErr ? `OpenRouter: ${lastErr}` : null, retry: false };
}

// ── Groq Scout (vision) ───────────────────────────────────────────────────────
async function tryGroq(groqKeys, mimeType, base64Data, prompt, targetModel = "meta-llama/llama-4-scout-17b-16e-instruct", contentType = "image") {
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  for (const apiKey of groqKeys) {
    try {
      const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          temperature: 0.4,
          max_tokens: 1024,
        }),
      }, REQUEST_TIMEOUT_MS);

      if (res.status === 429) continue;
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return { error: `Groq auth error (${res.status}) — check your key.`, retry: false };
        }
        // 400 often means image too large/unsupported — skip, don't stop chain
        continue;
      }

      const data = await res.json();
      const rawText = data?.choices?.[0]?.message?.content || "";
      const metadata = parseJsonResponse(rawText);
      if (!metadata) continue;

      const normalized = normalizeMetadata(metadata, contentType);
      if (normalized.hasMinimumContent) return { ok: true, data: normalized, provider: "groq-scout" };
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.includes("timeout") || msg.includes("aborted")) continue;
    }
  }
  return { error: null, retry: false };
}

// ── Mistral Pixtral (vision) ──────────────────────────────────────────────────
async function tryMistral(mistralKeys, mimeType, base64Data, prompt, targetModel = "mistral-small-latest", contentType = "image") {
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  let lastErr = "";

  for (const apiKey of mistralKeys) {
    const modelsToTry = uniqueModelOrder(targetModel, MISTRAL_VISION_FALLBACK_MODELS);
    for (const model of modelsToTry) {
      try {
        const res = await fetchWithTimeout("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: dataUrl } },
                ],
              },
            ],
            temperature: 0.4,
            max_tokens: 1024,
          }),
        }, REQUEST_TIMEOUT_MS);

        if (!res.ok) {
          let errBody = "";
          try { errBody = await res.text(); } catch { }
          let parsed = null;
          try { parsed = JSON.parse(errBody); } catch { }
          const apiMsg = parsed?.message || parsed?.error?.message || errBody || `HTTP ${res.status}`;
          console.error(`[Mistral] ${model} → ${res.status}: ${apiMsg}`);

          if (res.status === 401 || res.status === 403) {
            return { error: `Mistral key invalid (${res.status}). Check your key in Settings.`, retry: false };
          }
          if (res.status === 429) { lastErr = "Rate limit"; continue; }
          lastErr = (typeof apiMsg === "string" ? apiMsg : String(apiMsg)).slice(0, 120);
          continue;
        }

        const data = await res.json();
        const rawText = data?.choices?.[0]?.message?.content || "";
        const metadata = parseJsonResponse(rawText);
        if (!metadata) { lastErr = "No valid JSON in response"; continue; }

        const normalized = normalizeMetadata(metadata, contentType);
        if (normalized.hasMinimumContent) {
          return { ok: true, data: normalized, provider: model };
        }
        lastErr = "Incomplete metadata returned";
      } catch (err) {
        const msg = String(err?.message || "");
        console.error(`[Mistral] ${model} exception:`, msg);
        if (msg.includes("timeout") || msg.includes("aborted")) { lastErr = "Timeout"; continue; }
        lastErr = msg.slice(0, 80);
      }
    }
  }
  return { error: lastErr ? `Mistral: ${lastErr}` : null, retry: false };
}

const HF_VISION_MODELS = [
  "meta-llama/Llama-3.2-11B-Vision-Instruct",
  "Qwen/Qwen2.5-VL-7B-Instruct",
  "microsoft/Phi-3.5-vision-instruct",
  "google/paligemma-3b-mix-448",
];

async function tryHuggingFace(hfKeys, mimeType, base64Data, prompt, targetModel, contentType = "image") {
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  let lastErr = "";

  const mainModel = targetModel?.includes("Vision") || targetModel?.includes("VL") ? targetModel : HF_VISION_MODELS[0];
  const modelsToTry = Array.from(new Set([mainModel, ...HF_VISION_MODELS]));

  for (const apiKey of hfKeys) {
    for (const model of modelsToTry) {
      try {
        const res = await fetchWithTimeout("https://router.huggingface.co/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: dataUrl } },
                ],
              },
            ],
            temperature: 0.4,
            max_tokens: 1024,
          }),
        }, REQUEST_TIMEOUT_MS);

        if (!res.ok) {
          let errBody = "";
          try { errBody = await res.text(); } catch { }
          let parsed = null;
          try { parsed = JSON.parse(errBody); } catch { }
          const apiMsg = parsed?.error?.message || parsed?.error || errBody || `HTTP ${res.status}`;
          console.error(`[HuggingFace] ${model} → ${res.status}: ${apiMsg}`);

          if (res.status === 401 || res.status === 403) {
            return { error: `HuggingFace token invalid (${res.status}). Check your token in Settings.`, retry: false };
          }
          if (res.status === 402) {
            return { error: "HuggingFace free credits exhausted.", retry: false };
          }
          if (res.status === 429) { lastErr = "Rate limit"; continue; }
          lastErr = (typeof apiMsg === "string" ? apiMsg : String(apiMsg)).slice(0, 120);
          continue;
        }

        const data = await res.json();
        const rawText = data?.choices?.[0]?.message?.content || "";
        const metadata = parseJsonResponse(rawText);
        if (!metadata) { lastErr = "No valid JSON in response"; continue; }

        const normalized = normalizeMetadata(metadata, contentType);
        if (normalized.hasMinimumContent) {
          const shortName = model.split("/")[1] || model;
          return { ok: true, data: normalized, provider: `hf:${shortName}` };
        }
        lastErr = "Incomplete metadata returned";
      } catch (err) {
        const msg = String(err?.message || "");
        console.error(`[HuggingFace] ${model} exception:`, msg);
        if (msg.includes("timeout") || msg.includes("aborted")) { lastErr = "Timeout"; continue; }
        lastErr = msg.slice(0, 80);
      }
    }
  }
  return { error: lastErr ? `HuggingFace: ${lastErr}` : null, retry: false };
}

async function tryGitHub(keys, mimeType, base64Data, prompt, model, contentType) {
  let lastErr = null;
  for (const key of keys) {
    if (!key) continue;
    try {
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      const isVector = contentType === "vector";
      const userContent = isVector
        ? [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } }
          ]
        : [
            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
            { type: "text", text: prompt }
          ];

      const res = await fetchWithTimeout("https://models.inference.ai.azure.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: "You are an expert SEO metadata generator. Analyze the visual and return ONLY valid JSON." },
            { role: "user", content: userContent }
          ],
          temperature: 0.2,
          max_tokens: 1024,
          response_format: { type: "json_object" }
        })
      }, REQUEST_TIMEOUT_MS);

      if (!res.ok) {
        let errBody = "";
        try { errBody = await res.text(); } catch { }
        let parsed = null;
        try { parsed = JSON.parse(errBody); } catch { }
        const apiMsg = parsed?.error?.message || parsed?.error || errBody || `HTTP ${res.status}`;
        console.error(`[GitHub Models] ${model} → ${res.status}: ${apiMsg}`);

        if (res.status === 401 || res.status === 403) {
          return { error: `GitHub Models PAT invalid (${res.status}).`, retry: false };
        }
        // Azure content filter — retrying won't help, return immediately
        if (parsed?.error?.code === "content_filter") {
          return { error: "GitHub Models (Azure) blocked this request due to content policy. Try another provider.", retry: false };
        }
        if (res.status === 429) { lastErr = "Rate limit"; continue; }
        lastErr = (typeof apiMsg === "string" ? apiMsg : String(apiMsg)).slice(0, 120);
        continue;
      }

      const data = await res.json();
      const rawText = data?.choices?.[0]?.message?.content || "";
      const metadata = parseJsonResponse(rawText);
      if (!metadata) { lastErr = "No valid JSON in response"; continue; }

      const normalized = normalizeMetadata(metadata, contentType);
      if (normalized.hasMinimumContent) return { ok: true, data: normalized, provider: `github:${model}` };
      lastErr = "Incomplete metadata returned";
    } catch (err) {
      const msg = String(err?.message || "");
      console.error(`[GitHub Models] ${model} exception:`, msg);
      if (msg.includes("timeout") || msg.includes("aborted")) { lastErr = "Timeout"; continue; }
      lastErr = msg.slice(0, 80);
    }
  }
  return { error: lastErr ? `GitHub Models: ${lastErr}` : null, retry: false };
}

export async function POST(request) {
  const csrf = enforceSameOrigin(request);
  if (csrf) return csrf;

  const { limited, response: limitResponse } = await (await import("@/lib/rateLimit")).rateLimit(request);
  if (limited) return limitResponse;

  let body;
  try {
    body = await readJsonBody(request, MAX_REQUEST_BODY_BYTES.metadata);
  } catch (err) {
    return jsonError(err.message || "Invalid request body.", err.status || 400, err.code || "VALIDATION_ERROR");
  }
  try {
    const { image, apiKeys, groqKeys: rawGroqKeys, mistralKeys: rawMistralKeys, orKeys: rawOrKeys, hfKeys: rawHfKeys, githubKeys: rawGithubKeys, preferredProvider, selectedModels = {}, contentType = "image", targetMarket = "all" } = body;

    const geminiKeys = sanitizeKeys(apiKeys);
    const groqKeys = sanitizeKeys(rawGroqKeys);
    const mistralKeys = sanitizeKeys(rawMistralKeys);
    const orKeys = sanitizeKeys(rawOrKeys);
    const hfKeys = sanitizeKeys(rawHfKeys);
    const githubKeys = sanitizeKeys(rawGithubKeys);

    if (geminiKeys.length === 0 && groqKeys.length === 0 && mistralKeys.length === 0 && orKeys.length === 0 && hfKeys.length === 0 && githubKeys.length === 0) {
      return jsonError("No API keys found. Add Gemini, Groq, Mistral, OpenRouter, HuggingFace, or GitHub keys in Settings.", 400, "VALIDATION_API_KEYS");
    }

    if (!image || typeof image !== "string") {
      return jsonError("Upload an image first.", 400, "VALIDATION_IMAGE_REQUIRED");
    }

    // Validate content type — image, vector, and video are all supported.
    if (contentType !== "image" && contentType !== "vector" && contentType !== "video") {
      return jsonError(
        "Unsupported content type. Use 'image', 'vector', or 'video'.",
        400,
        "VALIDATION_CONTENT_TYPE",
      );
    }

    const match = image.match(/^data:(image\/[\w+]+);base64,(.+)$/);
    if (!match) return jsonError("Invalid image format. Use PNG, JPG, or WEBP.", 400, "VALIDATION_IMAGE_FORMAT");

    const [mimeType, base64Data] = [match[1].toLowerCase(), match[2]];
    if (!ALLOWED_MIME_TYPES.has(mimeType)) return jsonError("Invalid image format. Use PNG, JPG, or WEBP.", 400, "VALIDATION_IMAGE_MIME");
    if (estimateBase64Bytes(base64Data) > MAX_IMAGE_BYTES) {
      return jsonError("Image too large. Use a file under 10MB.", 413, "VALIDATION_IMAGE_SIZE");
    }

    const marketGuide = getMetadataMarketplaceGuidance(targetMarket, contentType);
    const prompt = (PROMPTS[contentType] || PROMPTS.image) + marketGuide;

    const autoLogs = [];

    // --- Elite Tier Auto-Routing ---
    if (preferredProvider === "auto") {
      for (const elite of VISION_ELITE_ORDER) {
        const { provider, model: eliteModel } = elite;
        const targetModel = getSelectedVisionModel(selectedModels, provider, eliteModel);

        if (provider === "gemini" && geminiKeys.length > 0) {
          const r = await tryGeminiReliable(geminiKeys, mimeType, base64Data, prompt, targetModel, contentType);
          if (r.ok) return Response.json({ ...r.data, provider: r.provider });
          autoLogs.push(`Gemini: ${r.error || "failed"}`);
        } 
        else if (provider === "huggingface" && hfKeys.length > 0) {
          const r = await tryHuggingFace(hfKeys, mimeType, base64Data, prompt, targetModel, contentType);
          if (r.ok) return Response.json({ ...r.data, provider: r.provider });
          autoLogs.push(`HF: ${r.error || "failed"}`);
        }
        else if (provider === "mistral" && mistralKeys.length > 0) {
          const r = await tryMistral(mistralKeys, mimeType, base64Data, prompt, targetModel, contentType);
          if (r.ok) return Response.json({ ...r.data, provider: r.provider });
          autoLogs.push(`Mistral: ${r.error || "failed"}`);
        }
        else if (provider === "groq" && groqKeys.length > 0) {
          const r = await tryGroq(groqKeys, mimeType, base64Data, prompt, targetModel, contentType);
          if (r.ok) return Response.json({ ...r.data, provider: r.provider });
          autoLogs.push(`Groq: ${r.error || "failed"}`);
        }
        else if (provider === "openrouter" && orKeys.length > 0) {
          const r = await tryOpenRouter(orKeys, mimeType, base64Data, prompt, contentType, targetModel);
          if (r.ok) return Response.json({ ...r.data, provider: r.provider });
          autoLogs.push(`OpenRouter: ${r.error || "failed"}`);
        }
        else if (provider === "nvidia" && nvidiaKeys.length > 0) {
          const r = await tryNvidia(nvidiaKeys, mimeType, base64Data, prompt, targetModel, contentType);
          if (r.ok) return Response.json({ ...r.data, provider: r.provider });
          autoLogs.push(`NVIDIA: ${r.error || "failed"}`);
        }
        else if (provider === "github" && githubKeys.length > 0) {
          const r = await tryGitHub(githubKeys, mimeType, base64Data, prompt, targetModel, contentType);
          if (r.ok) return Response.json({ ...r.data, provider: r.provider });
          autoLogs.push(`GitHub: ${r.error || "failed"}`);
        }
      }

      const providersTried = autoLogs.map(l => l.split(":")[0]).join(", ");
      return jsonError(
        `All elite providers reached limits or failed (${providersTried}). Please add more keys or wait.`,
        429,
        "ALL_PROVIDERS_FAILED"
      );
    }

    // --- Manual Provider Mode ---
    if (preferredProvider === "gemini") {
      if (!geminiKeys.length) return jsonError("No Gemini keys configured.", 400, "NO_KEYS");
      const model = getSelectedVisionModel(selectedModels, "gemini", "gemini-2.5-flash");
      const r = await tryGeminiReliable(geminiKeys, mimeType, base64Data, prompt, model, contentType);
      if (r.ok) return Response.json({ ...r.data, provider: r.provider });
      return jsonError(r.error || "Gemini failed.", 502, "PROVIDER_ERROR");
    }

    if (preferredProvider === "groq") {
      if (!groqKeys.length) return jsonError("No Groq keys configured.", 400, "NO_KEYS");
      // llama-4-scout is the only vision-capable model on Groq
      const model = getSelectedVisionModel(selectedModels, "groq", "meta-llama/llama-4-scout-17b-16e-instruct");
      const r = await tryGroq(groqKeys, mimeType, base64Data, prompt, model, contentType);
      if (r.ok) return Response.json({ ...r.data, provider: r.provider });
      return jsonError(r.error || "Groq failed.", 502, "PROVIDER_ERROR");
    }

    if (preferredProvider === "mistral") {
      if (!mistralKeys.length) return jsonError("No Mistral keys configured.", 400, "NO_KEYS");
      // pixtral-12b-latest is the canonical current vision model
      const model = getSelectedVisionModel(selectedModels, "mistral", "pixtral-12b-latest");
      const r = await tryMistral(mistralKeys, mimeType, base64Data, prompt, model, contentType);
      if (r.ok) return Response.json({ ...r.data, provider: r.provider });
      return jsonError(r.error || "Mistral failed.", 502, "PROVIDER_ERROR");
    }

    if (preferredProvider === "openrouter") {
      if (!orKeys.length) return jsonError("No OpenRouter keys configured.", 400, "NO_KEYS");
      const model = getSelectedVisionModel(selectedModels, "openrouter", "openrouter/free");
      const r = await tryOpenRouter(orKeys, mimeType, base64Data, prompt, contentType, model);
      if (r.ok) return Response.json({ ...r.data, provider: r.provider });
      return jsonError(r.error || "OpenRouter failed.", 502, "PROVIDER_ERROR");
    }

    if (preferredProvider === "huggingface") {
      if (!hfKeys.length) return jsonError("No HuggingFace keys configured.", 400, "NO_KEYS");
      // Default to best quality vision model; Qwen 2.5 VL 72B
      const model = getSelectedVisionModel(selectedModels, "huggingface", "Qwen/Qwen2.5-VL-72B-Instruct");
      const r = await tryHuggingFace(hfKeys, mimeType, base64Data, prompt, model, contentType);
      if (r.ok) return Response.json({ ...r.data, provider: r.provider });
      return jsonError(r.error || "HuggingFace failed.", 502, "PROVIDER_ERROR");
    }

    if (preferredProvider === "nvidia") {
      if (!nvidiaKeys.length) return jsonError("No NVIDIA keys configured.", 400, "NO_KEYS");
      // Best vision model: Llama 4 Maverick > Llama 3.2 90B > Llama 3.2 11B
      const model = getSelectedVisionModel(selectedModels, "nvidia", "meta/llama-4-maverick-17b-128e-instruct");
      const r = await tryNvidia(nvidiaKeys, mimeType, base64Data, prompt, model, contentType);
      if (r.ok) return Response.json({ ...r.data, provider: r.provider });
      return jsonError(r.error || "NVIDIA NIM failed.", 502, "PROVIDER_ERROR");
    }

    if (preferredProvider === "github") {
      if (!githubKeys.length) return jsonError("No GitHub keys configured.", 400, "NO_KEYS");
      const model = getSelectedVisionModel(selectedModels, "github", "gpt-4o");
      const r = await tryGitHub(githubKeys, mimeType, base64Data, prompt, model, contentType);
      if (r.ok) return Response.json({ ...r.data, provider: r.provider });
      // Auto-fallback on Azure content filter — try other vision providers
      if (r.error && r.error.includes("content policy")) {
        const visionFallbacks = [
          { keys: geminiKeys, fn: () => tryGeminiReliable(geminiKeys, mimeType, base64Data, prompt, "gemini-2.5-flash", contentType) },
          { keys: groqKeys, fn: () => tryGroq(groqKeys, mimeType, base64Data, prompt, "meta-llama/llama-4-scout-17b-16e-instruct", contentType) },
          { keys: mistralKeys, fn: () => tryMistral(mistralKeys, mimeType, base64Data, prompt, "pixtral-12b-latest", contentType) },
          { keys: hfKeys, fn: () => tryHuggingFace(hfKeys, mimeType, base64Data, prompt, "Qwen/Qwen2.5-VL-72B-Instruct", contentType) },
        ];
        for (const fb of visionFallbacks) {
          if (!fb.keys.length) continue;
          try {
            const fr = await fb.fn();
            if (fr.ok) return Response.json({ ...fr.data, provider: fr.provider });
          } catch { continue; }
        }
      }
      return jsonError(r.error || "GitHub Models failed.", 502, "PROVIDER_ERROR");
    }
    return jsonError("Unsupported metadata provider.", 400, "VALIDATION_ERROR");
  } catch (err) {
    try {
      const { reportError } = await import("@/lib/errorReporter");
      await reportError(err, { route: "/api/generate-metadata" });
    } catch {}
    return jsonError("Something went wrong.", 500, "INTERNAL_ERROR");
  }
}
