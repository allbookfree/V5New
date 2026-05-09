import { enforceSameOrigin, fetchWithTimeout } from "@/lib/apiUtils";
import { readCache, readStaleCache, writeCache, isoNow } from "@/lib/marketTrendsCache";

/**
 * /api/market-trends/wikipedia — Wikipedia "most viewed pages" today.
 *
 * Why Wikipedia?
 *   When something blows up culturally — a festival, a movement, a
 *   trending aesthetic, a viral animal, a new movie — its Wikipedia
 *   page traffic spikes hours before it reaches stock platforms.
 *   Wikimedia exposes a free, no-key REST API for daily and monthly
 *   pageview rankings.
 *
 * What we return:
 *   The top N most-viewed English Wikipedia articles for the most
 *   recent fully-indexed day. Stripped of obvious low-value entries
 *   (Main_Page, Special:*, Wikipedia:* meta pages).
 *
 * Quota discipline:
 *   - User-triggered only.
 *   - 24-hour module-level cache.
 *   - Wikimedia REST API has no key requirement, no per-IP quota
 *     beyond polite-use headers; we still include a UA per their
 *     etiquette policy.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 8000;
const MAX_RETURNED = 30;
const ALLOWED_PROJECTS = new Set(["en", "es", "de", "fr", "ja", "pt"]);
const DEFAULT_PROJECT = "en";

// Pages that aren't useful as creator-facing trend signals. Wikipedia's
// main-namespace top-list is dominated by these and they crowd out the
// signal we actually want.
const TITLE_BLOCKLIST = new Set([
  "Main_Page",
  "Special:Search",
  "-",
  "Cleopatra",
]);

const TITLE_PREFIX_BLOCKLIST = [
  "Special:",
  "Wikipedia:",
  "Help:",
  "File:",
  "Talk:",
  "User:",
];

export async function GET(request) {
  const csrf = enforceSameOrigin(request);
  if (csrf) return csrf;

  const url = new URL(request.url);
  const requestedProject = (url.searchParams.get("project") || DEFAULT_PROJECT).toLowerCase();
  const project = ALLOWED_PROJECTS.has(requestedProject) ? requestedProject : DEFAULT_PROJECT;

  const cacheKey = project;
  const cached = readCache("wikipedia", cacheKey);
  if (cached) {
    return jsonResponse({
      ok: true,
      cached: true,
      fetchedAt: new Date(cached.fetchedAt).toISOString(),
      source: "wikipedia",
      project,
      items: cached.data,
    });
  }

  // Wikimedia indexes pageviews with ~24h lag. Try yesterday's date
  // first; fall back two days back if yesterday isn't ready yet.
  const items = (await fetchTopForRecentDay(project)) || [];
  if (items.length === 0) {
    const stale = readStaleCache("wikipedia", cacheKey);
    if (stale && stale.data.length > 0) {
      return jsonResponse({
        ok: true,
        cached: true,
        stale: true,
        fetchedAt: new Date(stale.fetchedAt).toISOString(),
        source: "wikipedia",
        project,
        items: stale.data,
      });
    }
    return jsonResponse({
      ok: false,
      cached: false,
      fetchedAt: isoNow(),
      source: "wikipedia",
      project,
      items: [],
      error: "No usable pages returned by upstream",
    });
  }

  writeCache("wikipedia", cacheKey, items);

  return jsonResponse({
    ok: true,
    cached: false,
    fetchedAt: isoNow(),
    source: "wikipedia",
    project,
    items,
  });
}

async function fetchTopForRecentDay(project) {
  // Try yesterday and the day before — Wikimedia publishes the
  // previous day's rollup with a few hours of lag.
  const candidates = [daysAgo(1), daysAgo(2)];
  for (const date of candidates) {
    const items = await tryDate(project, date);
    if (items && items.length > 0) return items;
  }
  return [];
}

async function tryDate(project, date) {
  const upstream = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${encodeURIComponent(project)}.wikipedia/all-access/${date.year}/${date.month}/${date.day}`;
  try {
    const res = await fetchWithTimeout(upstream, {
      headers: {
        "user-agent": "PromptStudio/1.0 (https://github.com/allbookfree/V5New) market-trends",
        accept: "application/json",
      },
    }, FETCH_TIMEOUT_MS);
    if (!res.ok) return [];
    const json = await res.json();
    const articles = json?.items?.[0]?.articles;
    if (!Array.isArray(articles)) return [];
    const out = articles
      .filter(a => isUsefulTitle(a?.article))
      .slice(0, MAX_RETURNED)
      .map(a => ({
        title: humanise(a.article),
        slug: a.article,
        views: typeof a.views === "number" ? a.views : 0,
        rank: typeof a.rank === "number" ? a.rank : null,
        url: `https://${project}.wikipedia.org/wiki/${encodeURIComponent(a.article)}`,
        date: `${date.year}-${date.month}-${date.day}`,
      }));
    return out;
  } catch {
    return [];
  }
}

function isUsefulTitle(t) {
  if (typeof t !== "string" || !t) return false;
  if (TITLE_BLOCKLIST.has(t)) return false;
  for (const prefix of TITLE_PREFIX_BLOCKLIST) {
    if (t.startsWith(prefix)) return false;
  }
  return true;
}

function humanise(slug) {
  if (typeof slug !== "string") return "";
  return slug.replace(/_/g, " ");
}

function daysAgo(n) {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  return { year: yyyy, month: mm, day: dd };
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
