import { enforceSameOrigin, fetchWithTimeout, jsonError } from "@/lib/apiUtils";

/**
 * /api/market-trends — server-side proxy for Google Trends "daily search
 * trends" RSS feed.
 *
 * Why a proxy?
 *   1. Google Trends RSS doesn't send CORS headers, so the browser can't
 *      fetch it directly.
 *   2. We can cache the result for a few minutes per geo so we don't get
 *      rate-limited by Google during heavy in-app traffic.
 *   3. We can normalise Google's verbose XML into a simple JSON shape
 *      tailored to the /market-trends page.
 *
 * GET /api/market-trends?geo=US
 *   → { ok: true, geo, fetchedAt, trends: [{ title, traffic, picture,
 *                                            newsItems: [{ title, url, source }] }] }
 *
 * On any upstream failure (timeout, 4xx/5xx, parse error) we return an
 * empty list with `ok:false` so the page can render a "couldn't load
 * trends, try again later" state instead of crashing.
 *
 * Same-origin only — the in-app /market-trends page is the only legitimate
 * caller, and there's no value in exposing this proxy publicly.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Allowed Google Trends geo codes. The list is intentionally small —
// Google supports far more, but every extra code is another upstream
// fetch + cache slot we have to maintain.
const ALLOWED_GEOS = new Set(["US", "BD", "IN", "GB", "JP", "BR", "DE", "FR"]);
const DEFAULT_GEO = "US";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT_MS = 8000;
const MAX_TRENDS = 25;
const MAX_NEWS_PER_TREND = 3;

// Module-level cache: { geo: { fetchedAt: number, trends: [...] } }
// Resets on cold start, which is fine — the only consequence is one extra
// upstream fetch per cold lambda.
const cache = new Map();

export async function GET(request) {
  const csrf = enforceSameOrigin(request);
  if (csrf) return csrf;

  const url = new URL(request.url);
  const requestedGeo = (url.searchParams.get("geo") || DEFAULT_GEO).toUpperCase();
  const geo = ALLOWED_GEOS.has(requestedGeo) ? requestedGeo : DEFAULT_GEO;

  // Serve from cache when fresh.
  const cached = cache.get(geo);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return jsonResponse({
      ok: true,
      geo,
      fetchedAt: new Date(cached.fetchedAt).toISOString(),
      cached: true,
      trends: cached.trends,
    });
  }

  let xml;
  try {
    const upstream = `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}&hl=en-US`;
    const res = await fetchWithTimeout(upstream, {
      headers: {
        // Google sometimes returns 403 to bare User-Agents; pose as a
        // generic browser to keep the public RSS feed accessible.
        "user-agent":
          "Mozilla/5.0 (compatible; PromptStudio/1.0; +https://github.com/allbookfree/V5New)",
        accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    }, FETCH_TIMEOUT_MS);
    if (!res.ok) {
      return jsonResponse({
        ok: false,
        geo,
        fetchedAt: new Date(now).toISOString(),
        trends: cached?.trends || [],
        error: `Upstream returned ${res.status}`,
      });
    }
    xml = await res.text();
  } catch (e) {
    return jsonResponse({
      ok: false,
      geo,
      fetchedAt: new Date(now).toISOString(),
      trends: cached?.trends || [],
      error: e?.name === "AbortError" ? "Upstream timed out" : String(e?.message || e),
    });
  }

  const trends = parseGoogleTrendsRss(xml).slice(0, MAX_TRENDS);
  cache.set(geo, { fetchedAt: now, trends });

  return jsonResponse({
    ok: true,
    geo,
    fetchedAt: new Date(now).toISOString(),
    cached: false,
    trends,
  });
}

function jsonResponse(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
      // Tell upstream caches (Vercel edge etc.) they may cache the
      // payload for the same TTL we use internally; clients still see
      // fresh data because we set s-maxage shorter than CACHE_TTL_MS.
      "cache-control": "public, max-age=0, s-maxage=240, stale-while-revalidate=60",
    },
  });
}

// ─── RSS parser ──────────────────────────────────────────────────────
//
// Google Trends RSS is well-formed XML, but bringing in a full parser
// (xml2js / fast-xml-parser) just for one endpoint isn't worth the
// dependency surface. The format is stable enough that targeted regex
// extraction is robust — and we tolerate missing optional fields.

function parseGoogleTrendsRss(xml) {
  if (typeof xml !== "string" || !xml.includes("<item>")) return [];
  const out = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const title = decodeXml(extractFirst(block, /<title>([\s\S]*?)<\/title>/));
    if (!title) continue;
    const traffic = decodeXml(extractFirst(block, /<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/));
    const picture = decodeXml(extractFirst(block, /<ht:picture>([\s\S]*?)<\/ht:picture>/));
    const pubDate = decodeXml(extractFirst(block, /<pubDate>([\s\S]*?)<\/pubDate>/));
    const newsItems = [];
    const newsRe = /<ht:news_item>([\s\S]*?)<\/ht:news_item>/g;
    let nm;
    while (newsItems.length < MAX_NEWS_PER_TREND && (nm = newsRe.exec(block)) !== null) {
      const nb = nm[1];
      const ntitle = decodeXml(extractFirst(nb, /<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/));
      const nurl = decodeXml(extractFirst(nb, /<ht:news_item_url>([\s\S]*?)<\/ht:news_item_url>/));
      const nsource = decodeXml(extractFirst(nb, /<ht:news_item_source>([\s\S]*?)<\/ht:news_item_source>/));
      if (ntitle && nurl) {
        newsItems.push({ title: ntitle, url: nurl, source: nsource || "" });
      }
    }
    out.push({ title, traffic: traffic || "", picture: picture || "", pubDate: pubDate || "", newsItems });
  }
  return out;
}

function extractFirst(block, re) {
  const m = re.exec(block);
  if (!m) return "";
  return stripCdata(m[1]).trim();
}

function stripCdata(s) {
  if (typeof s !== "string") return "";
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(s.trim());
  return cdata ? cdata[1] : s;
}

function decodeXml(s) {
  if (typeof s !== "string") return "";
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
