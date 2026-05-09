import { enforceSameOrigin, fetchWithTimeout } from "@/lib/apiUtils";
import { readCache, readStaleCache, writeCache, isoNow } from "@/lib/marketTrendsCache";

/**
 * /api/market-trends/pexels — Pexels' editorially curated daily feed.
 *
 * Why Pexels?
 *   Pexels' `/v1/curated` endpoint is hand-picked daily by their
 *   editorial team. It's the closest free signal we have to "what
 *   the photo industry thinks is trending right now" without paying
 *   for an Adobe / Shutterstock data feed.
 *
 *   We also expose `/v1/popular/videos` for video creators (orientation
 *   / size unfiltered — vertical and horizontal both surface).
 *
 * What we return:
 *   { ok, cached, fetchedAt, source: "pexels", kind, items: [{ title,
 *     image, url, photographer, alt, source }] }
 *
 * Quota discipline:
 *   - User-triggered only.
 *   - 24-hour module-level cache per `kind` (curated-photo / popular-video).
 *   - Pexels free tier: 200 requests / hour. With the 24h cache we'll
 *     comfortably stay under 5 calls per bucket per day per lambda.
 *   - If PEXELS_API_KEY isn't set we return a configured:false body
 *     the UI can render gracefully.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 8000;
const MAX_RETURNED = 30;

const ALLOWED_KINDS = new Set(["curated-photo", "popular-video"]);
const DEFAULT_KIND = "curated-photo";

export async function GET(request) {
  const csrf = enforceSameOrigin(request);
  if (csrf) return csrf;

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return jsonResponse({
      ok: false,
      configured: false,
      source: "pexels",
      fetchedAt: isoNow(),
      items: [],
      error: "PEXELS_API_KEY not configured. Get a free key from https://www.pexels.com/api/new/",
    });
  }

  const url = new URL(request.url);
  const requestedKind = (url.searchParams.get("kind") || DEFAULT_KIND).toLowerCase();
  const kind = ALLOWED_KINDS.has(requestedKind) ? requestedKind : DEFAULT_KIND;

  const cacheKey = kind;
  const cached = readCache("pexels", cacheKey);
  if (cached) {
    return jsonResponse({
      ok: true,
      cached: true,
      configured: true,
      fetchedAt: new Date(cached.fetchedAt).toISOString(),
      source: "pexels",
      kind,
      items: cached.data,
    });
  }

  const items = await fetchFromPexels(apiKey, kind);
  if (items.length === 0) {
    const stale = readStaleCache("pexels", cacheKey);
    if (stale && stale.data.length > 0) {
      return jsonResponse({
        ok: true,
        cached: true,
        stale: true,
        configured: true,
        fetchedAt: new Date(stale.fetchedAt).toISOString(),
        source: "pexels",
        kind,
        items: stale.data,
      });
    }
    return jsonResponse({
      ok: false,
      cached: false,
      configured: true,
      fetchedAt: isoNow(),
      source: "pexels",
      kind,
      items: [],
      error: "No usable assets returned by upstream",
    });
  }

  writeCache("pexels", cacheKey, items);
  return jsonResponse({
    ok: true,
    cached: false,
    configured: true,
    fetchedAt: isoNow(),
    source: "pexels",
    kind,
    items,
  });
}

async function fetchFromPexels(apiKey, kind) {
  if (kind === "popular-video") {
    return fetchPopularVideos(apiKey);
  }
  return fetchCuratedPhotos(apiKey);
}

async function fetchCuratedPhotos(apiKey) {
  const upstream = `https://api.pexels.com/v1/curated?per_page=${MAX_RETURNED}`;
  try {
    const res = await fetchWithTimeout(upstream, {
      headers: {
        Authorization: apiKey,
        "user-agent": "PromptStudio/1.0 (+https://github.com/allbookfree/V5New)",
        accept: "application/json",
      },
    }, FETCH_TIMEOUT_MS);
    if (!res.ok) return [];
    const json = await res.json();
    const photos = Array.isArray(json?.photos) ? json.photos : [];
    return photos.slice(0, MAX_RETURNED).map(p => ({
      title: typeof p.alt === "string" && p.alt.trim() ? p.alt.trim() : "Curated photo",
      alt: typeof p.alt === "string" ? p.alt : "",
      image: p?.src?.medium || p?.src?.large || null,
      preview: p?.src?.tiny || p?.src?.small || null,
      url: typeof p.url === "string" ? p.url : null,
      photographer: typeof p.photographer === "string" ? p.photographer : null,
      width: typeof p.width === "number" ? p.width : null,
      height: typeof p.height === "number" ? p.height : null,
      type: "photo",
      source: "pexels",
    }));
  } catch {
    return [];
  }
}

async function fetchPopularVideos(apiKey) {
  const upstream = `https://api.pexels.com/videos/popular?per_page=${MAX_RETURNED}`;
  try {
    const res = await fetchWithTimeout(upstream, {
      headers: {
        Authorization: apiKey,
        "user-agent": "PromptStudio/1.0 (+https://github.com/allbookfree/V5New)",
        accept: "application/json",
      },
    }, FETCH_TIMEOUT_MS);
    if (!res.ok) return [];
    const json = await res.json();
    const videos = Array.isArray(json?.videos) ? json.videos : [];
    return videos.slice(0, MAX_RETURNED).map(v => {
      const cover = Array.isArray(v?.video_pictures) ? v.video_pictures[0] : null;
      return {
        title: typeof v?.user?.name === "string" ? `Video by ${v.user.name}` : "Popular video",
        image: typeof v?.image === "string" ? v.image : (cover?.picture || null),
        preview: cover?.picture || null,
        url: typeof v.url === "string" ? v.url : null,
        photographer: v?.user?.name || null,
        duration: typeof v.duration === "number" ? v.duration : null,
        width: typeof v.width === "number" ? v.width : null,
        height: typeof v.height === "number" ? v.height : null,
        type: "video",
        source: "pexels",
      };
    });
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
