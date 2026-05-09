import { enforceSameOrigin, fetchWithTimeout } from "@/lib/apiUtils";
import { readCache, readStaleCache, writeCache, isoNow } from "@/lib/marketTrendsCache";

/**
 * /api/market-trends/reddit — design-aesthetic subreddit trends.
 *
 * Why Reddit?
 *   The most reliable early signal for what will sell on stock /
 *   Etsy / print-on-demand 6-12 weeks from now is what's bubbling up
 *   on aesthetic subreddits today. r/cottagecore, r/InteriorDesign,
 *   r/Minimalism, r/Etsy etc. are full of mood boards, room photos
 *   and product pictures with built-in popularity signal.
 *
 * Why the RSS / Atom feed instead of the .json endpoint?
 *   Reddit started blocking unauthenticated `.json` requests in 2023
 *   (returns 403 "Blocked" or HTML for any non-OAuth client). The
 *   Atom feed at /r/<sub>/top/.rss?t=week stays accessible without
 *   auth and contains everything we need (title, link, thumbnail,
 *   author, timestamp, optional media:thumbnail). We don't get a
 *   numeric upvote count, but the items already arrive in popularity
 *   order — which is the signal we actually wanted.
 *
 * Quota discipline:
 *   - User-triggered only (the /market-trends page exposes a manual
 *     "Load Reddit" button — no auto-fetch on page load).
 *   - 24-hour module-level cache per (subs, timeframe).
 *   - Hard timeout per upstream call so a slow Reddit node can't stall
 *     the whole batch.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 8000;
const MAX_POSTS_PER_SUB = 8;
const MAX_RETURNED = 30;

const ALLOWED_SUBS = new Set([
  "cottagecore",
  "InteriorDesign",
  "Minimalism",
  "DesignPorn",
  "RoomPorn",
  "MostBeautiful",
  "Etsy",
  "EtsySellers",
  "Watercolor",
  "DigitalArt",
  "graphic_design",
  "Illustration",
  "Bohemian",
  "Coastal",
  "Farmhouse",
  "Scandinavian",
  "Japandi",
  "VintageAesthetic",
  "ArtNouveau",
]);

const DEFAULT_SUBS = [
  "cottagecore",
  "InteriorDesign",
  "Minimalism",
  "DesignPorn",
  "Etsy",
];

const ALLOWED_TIMEFRAMES = new Set(["day", "week", "month"]);
const DEFAULT_TIMEFRAME = "week";

export async function GET(request) {
  const csrf = enforceSameOrigin(request);
  if (csrf) return csrf;

  const url = new URL(request.url);
  const subsParam = url.searchParams.get("subs");
  const requestedSubs = (subsParam ? subsParam.split(",") : DEFAULT_SUBS)
    .map(s => s.trim())
    .filter(s => ALLOWED_SUBS.has(s));
  const subs = requestedSubs.length > 0 ? requestedSubs : DEFAULT_SUBS;

  const requestedTimeframe = (url.searchParams.get("t") || DEFAULT_TIMEFRAME).toLowerCase();
  const timeframe = ALLOWED_TIMEFRAMES.has(requestedTimeframe) ? requestedTimeframe : DEFAULT_TIMEFRAME;

  const cacheKey = `${subs.slice().sort().join(",")}:${timeframe}`;
  const cached = readCache("reddit", cacheKey);
  if (cached) {
    return jsonResponse({
      ok: true,
      cached: true,
      fetchedAt: new Date(cached.fetchedAt).toISOString(),
      source: "reddit",
      subs,
      timeframe,
      items: cached.data,
    });
  }

  const results = await Promise.all(subs.map(sub => fetchSub(sub, timeframe)));
  const items = dedupe(results.flat()).slice(0, MAX_RETURNED);

  if (items.length === 0) {
    const stale = readStaleCache("reddit", cacheKey);
    if (stale && stale.data.length > 0) {
      return jsonResponse({
        ok: true,
        cached: true,
        stale: true,
        fetchedAt: new Date(stale.fetchedAt).toISOString(),
        source: "reddit",
        subs,
        timeframe,
        items: stale.data,
      });
    }
    return jsonResponse({
      ok: false,
      cached: false,
      fetchedAt: isoNow(),
      source: "reddit",
      subs,
      timeframe,
      items: [],
      error: "No usable posts returned by upstream",
    });
  }

  writeCache("reddit", cacheKey, items);

  return jsonResponse({
    ok: true,
    cached: false,
    fetchedAt: isoNow(),
    source: "reddit",
    subs,
    timeframe,
    items,
  });
}

async function fetchSub(sub, timeframe) {
  // Atom feed for the "top" listing of a subreddit. Reddit silently
  // ignores unrecognised query params, so passing `t=` is safe.
  const upstream = `https://www.reddit.com/r/${encodeURIComponent(sub)}/top/.rss?t=${encodeURIComponent(timeframe)}`;
  try {
    const res = await fetchWithTimeout(upstream, {
      headers: {
        "user-agent": "PromptStudio/1.0 (+https://github.com/allbookfree/V5New) market-trends",
        accept: "application/atom+xml, application/xml, text/xml, */*",
      },
    }, FETCH_TIMEOUT_MS);
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRedditAtom(xml, sub).slice(0, MAX_POSTS_PER_SUB);
  } catch {
    return [];
  }
}

// ─── Atom feed parser ────────────────────────────────────────────────
//
// Reddit's Atom feed has the shape:
//   <entry>
//     <title>...</title>
//     <link href="https://www.reddit.com/r/.../comments/.../" />
//     <author><name>/u/...</name></author>
//     <updated>2026-05-09T...</updated>
//     <content type="html">&lt;img src="..."&gt; ...</content>
//     <media:thumbnail url="..." />
//   </entry>
//
// We pull title / link / updated / thumbnail (preferring media:thumbnail
// and falling back to the first <img> in the HTML-encoded content).

function parseRedditAtom(xml, sub) {
  if (typeof xml !== "string" || !xml.includes("<entry>")) return [];
  const out = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = entryRe.exec(xml)) !== null) {
    const block = m[1];
    const title = decodeXml(stripCdata(captureTag(block, "title")));
    const linkHref = captureAttr(block, "link", "href");
    const updated = captureTag(block, "updated");
    const author = stripCdata(captureTag(block, "name"));
    const mediaThumb = captureAttr(block, "media:thumbnail", "url");
    const content = decodeXml(stripCdata(captureTag(block, "content")));
    const fallbackImg = mediaThumb || extractFirstImg(content);
    if (!title || !linkHref) continue;
    out.push({
      title,
      url: linkHref,
      image: fallbackImg || null,
      author: typeof author === "string" ? author.replace(/^\/u\//, "") : null,
      subreddit: sub,
      updatedAt: updated || null,
      source: "reddit",
    });
  }
  return out;
}

function captureTag(block, tag) {
  const re = new RegExp(`<${escapeReg(tag)}(?:[^>]*)>([\\s\\S]*?)<\\/${escapeReg(tag)}>`);
  const m = re.exec(block);
  return m ? m[1].trim() : "";
}

function captureAttr(block, tag, attr) {
  const re = new RegExp(`<${escapeReg(tag)}[^>]*\\b${escapeReg(attr)}=["']([^"']+)["']`);
  const m = re.exec(block);
  return m ? m[1] : "";
}

function extractFirstImg(html) {
  if (typeof html !== "string") return "";
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  return m ? m[1] : "";
}

function escapeReg(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = (item.title || "").toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
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
