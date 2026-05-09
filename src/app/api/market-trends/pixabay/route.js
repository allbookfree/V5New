import { enforceSameOrigin, fetchWithTimeout } from "@/lib/apiUtils";
import { readCache, readStaleCache, writeCache, isoNow } from "@/lib/marketTrendsCache";

/**
 * /api/market-trends/pixabay — popular stock photos / vectors right now.
 *
 * Why Pixabay?
 *   It's the only free stock platform that exposes a public API
 *   returning real download counts and view counts per asset. That
 *   gives us a genuine "what's actually selling vs. what's just being
 *   uploaded" signal — exactly the gap the user wanted closed.
 *
 *   We use `order=popular` (download-weighted) and surface the top
 *   results as creator-facing trend cards.
 *
 * What we return:
 *   { ok, cached, fetchedAt, source: "pixabay", category, format,
 *     items: [{ title, image, url, views, downloads, likes, tags,
 *               source }] }
 *
 * Quota discipline:
 *   - User-triggered only — the /market-trends UI surfaces a manual
 *     "Load Pixabay" button. No auto-fetch.
 *   - 24-hour module-level cache per (category, format).
 *   - Pixabay free tier: 100 requests / 60 seconds. With the 24h
 *     cache and per-(category, format) buckets, the realistic daily
 *     ceiling is well under 50 calls per lambda instance.
 *   - If PIXABAY_API_KEY isn't set we return a structured 503-style
 *     body that the UI can render as "configure your free Pixabay
 *     key" rather than crashing.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 8000;
const MAX_RETURNED = 30;

// Allow-list of categories supported by Pixabay's API. Trimmed to
// stock-relevant ones; the generic "all" path falls through to no
// category param (Pixabay returns global popular).
const ALLOWED_CATEGORIES = new Set([
  "all",
  "backgrounds",
  "fashion",
  "nature",
  "food",
  "places",
  "animals",
  "buildings",
  "business",
  "computer",
  "education",
  "feelings",
  "health",
  "industry",
  "music",
  "people",
  "religion",
  "science",
  "sports",
  "transportation",
  "travel",
]);
const DEFAULT_CATEGORY = "all";

const ALLOWED_FORMATS = new Set(["photo", "vector", "illustration", "all"]);
const DEFAULT_FORMAT = "all";

export async function GET(request) {
  const csrf = enforceSameOrigin(request);
  if (csrf) return csrf;

  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return jsonResponse({
      ok: false,
      configured: false,
      source: "pixabay",
      fetchedAt: isoNow(),
      items: [],
      error: "PIXABAY_API_KEY not configured. Add a free key from https://pixabay.com/api/docs/",
    });
  }

  const url = new URL(request.url);
  const requestedCategory = (url.searchParams.get("category") || DEFAULT_CATEGORY).toLowerCase();
  const category = ALLOWED_CATEGORIES.has(requestedCategory) ? requestedCategory : DEFAULT_CATEGORY;
  const requestedFormat = (url.searchParams.get("format") || DEFAULT_FORMAT).toLowerCase();
  const format = ALLOWED_FORMATS.has(requestedFormat) ? requestedFormat : DEFAULT_FORMAT;

  const cacheKey = `${category}:${format}`;
  const cached = readCache("pixabay", cacheKey);
  if (cached) {
    return jsonResponse({
      ok: true,
      cached: true,
      configured: true,
      fetchedAt: new Date(cached.fetchedAt).toISOString(),
      source: "pixabay",
      category,
      format,
      items: cached.data,
    });
  }

  const items = await fetchFromPixabay(apiKey, { category, format });
  if (items.length === 0) {
    const stale = readStaleCache("pixabay", cacheKey);
    if (stale && stale.data.length > 0) {
      return jsonResponse({
        ok: true,
        cached: true,
        stale: true,
        configured: true,
        fetchedAt: new Date(stale.fetchedAt).toISOString(),
        source: "pixabay",
        category,
        format,
        items: stale.data,
      });
    }
    return jsonResponse({
      ok: false,
      cached: false,
      configured: true,
      fetchedAt: isoNow(),
      source: "pixabay",
      category,
      format,
      items: [],
      error: "No usable assets returned by upstream",
    });
  }

  writeCache("pixabay", cacheKey, items);
  return jsonResponse({
    ok: true,
    cached: false,
    configured: true,
    fetchedAt: isoNow(),
    source: "pixabay",
    category,
    format,
    items,
  });
}

async function fetchFromPixabay(apiKey, { category, format }) {
  // Pixabay split photos and vectors into two endpoints. For "all" we
  // call the photo endpoint (which is the dominant population) — we
  // intentionally don't merge to keep quota usage at one call per
  // bucket.
  const isVector = format === "vector" || format === "illustration";
  const endpoint = isVector
    ? "https://pixabay.com/api/?image_type=vector"
    : "https://pixabay.com/api/?image_type=photo";

  const params = new URLSearchParams({
    key: apiKey,
    order: "popular",
    safesearch: "true",
    per_page: String(Math.max(MAX_RETURNED, 30)),
  });
  if (category && category !== "all") params.set("category", category);

  const upstream = `${endpoint}&${params.toString()}`;
  try {
    const res = await fetchWithTimeout(upstream, {
      headers: {
        "user-agent": "PromptStudio/1.0 (+https://github.com/allbookfree/V5New)",
        accept: "application/json",
      },
    }, FETCH_TIMEOUT_MS);
    if (!res.ok) return [];
    const json = await res.json();
    const hits = Array.isArray(json?.hits) ? json.hits : [];
    return hits.slice(0, MAX_RETURNED).map(h => ({
      title: typeof h.tags === "string" ? h.tags.split(",")[0].trim() : "",
      tags: typeof h.tags === "string" ? h.tags.split(",").map(t => t.trim()) : [],
      image: typeof h.webformatURL === "string" ? h.webformatURL : null,
      preview: typeof h.previewURL === "string" ? h.previewURL : null,
      url: typeof h.pageURL === "string" ? h.pageURL : null,
      views: typeof h.views === "number" ? h.views : 0,
      downloads: typeof h.downloads === "number" ? h.downloads : 0,
      likes: typeof h.likes === "number" ? h.likes : 0,
      type: typeof h.type === "string" ? h.type : (isVector ? "vector" : "photo"),
      author: typeof h.user === "string" ? h.user : null,
      source: "pixabay",
    }));
  } catch {
    return [];
  }
}

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
