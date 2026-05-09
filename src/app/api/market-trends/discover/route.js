import { enforceSameOrigin } from "@/lib/apiUtils";
import { readCache, readStaleCache, writeCache, isoNow } from "@/lib/marketTrendsCache";
import { scoreStockRelevance } from "@/lib/marketTrendsRelevance";

/**
 * /api/market-trends/discover — top sales-relevant niches aggregated
 * across the sources we've already loaded.
 *
 * Sources used (sales-weighted):
 *     - /api/market-trends/pixabay   (real download counts → strongest signal)
 *     - /api/market-trends/pexels    (editorial curation → photo industry signal)
 *     - /api/market-trends/reddit    (early aesthetic signal, 6–12 weeks ahead)
 *
 * Sources INTENTIONALLY excluded:
 *     - /api/market-trends           (Google Trends — dominated by
 *                                      news / sports / politics, not sales)
 *     - /api/market-trends/wikipedia (cultural / festival / viral signal
 *                                      — useful context, not a sales signal)
 *
 *   …extracts a single "title" string per item, dedupes on
 *   normalised title, scores each remaining title with
 *   `scoreStockRelevance` plus a per-source sales weight, and returns
 *   the top 20.
 *
 *   Each returned item carries a `provenance` array listing the
 *   sources that voted for it, so the UI can show "Spotted on Reddit
 *   + Pixabay" as a confidence badge.
 *
 * What it does NOT do:
 *   It will NOT fetch any upstream API. If a source's 24h cache
 *   bucket is empty, that source simply isn't represented in this
 *   batch — by design, so a user clicking Discover doesn't silently
 *   trigger five upstream calls. The UI is expected to surface a
 *   "load source X first" hint when a contributor is missing.
 *
 * Quota discipline:
 *   - User-triggered. The /market-trends UI exposes a single
 *     "Auto-Discover Top 20 Niches" button that calls this endpoint.
 *   - 6-hour cache on the aggregated result so re-clicking inside the
 *     same window is free.
 *   - No upstream fetches.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RETURNED = 20;
const MIN_RELEVANCE = 3;

export async function GET(request) {
  const csrf = enforceSameOrigin(request);
  if (csrf) return csrf;

  const cached = readCache("discover", "top20");
  // Discover's own cache is intentionally short-lived (6h) because the
  // underlying source caches refresh independently and we'd rather
  // re-aggregate than serve a stale combined ranking. We re-implement
  // the TTL here instead of using the standard 24h.
  if (cached && Date.now() - cached.fetchedAt < 6 * 60 * 60 * 1000) {
    return jsonResponse({
      ok: true,
      cached: true,
      fetchedAt: new Date(cached.fetchedAt).toISOString(),
      ...cached.data,
    });
  }

  const contributors = collectContributors();
  const items = aggregate(contributors);
  const top = items.slice(0, MAX_RETURNED);

  if (top.length === 0) {
    // Nothing cached yet from any source. Fall back to a stale
    // discover entry if we ever computed one before.
    const stale = readStaleCache("discover", "top20");
    if (stale && stale.data?.items?.length > 0) {
      return jsonResponse({
        ok: true,
        cached: true,
        stale: true,
        fetchedAt: new Date(stale.fetchedAt).toISOString(),
        ...stale.data,
      });
    }
    return jsonResponse({
      ok: false,
      cached: false,
      fetchedAt: isoNow(),
      contributors,
      items: [],
      error: "No source data is cached yet. Click Load on at least one source first.",
    });
  }

  const payload = { contributors, items: top };
  writeCache("discover", "top20", payload);

  return jsonResponse({
    ok: true,
    cached: false,
    fetchedAt: isoNow(),
    ...payload,
  });
}

function collectContributors() {
  // Only sales-relevant sources count toward Discover. Wikipedia +
  // Google Trends are kept in the UI as "Context" but excluded here.
  const sources = ["pixabay", "pexels", "reddit"];
  return sources.map((s) => ({
    source: s,
    cached: !!readSourceCache(s),
  }));
}

// ─── Aggregation ──────────────────────────────────────────────────
//
// We pull whatever cached payload exists per source, normalise each
// to a flat list of { title, image?, url?, sourceItem }, then run
// the deduper which keeps a per-title combined score and provenance.

function aggregate() {
  // Only sales-relevant signals: Pixabay (real downloads), Pexels
  // (editorial), and Reddit (aesthetic early-warning). Wikipedia and
  // Google Trends are deliberately excluded from the ranking.
  const buckets = [
    extractPixabay(),
    extractPexels(),
    extractReddit(),
  ];

  const map = new Map(); // normalisedKey -> aggregated entry

  for (const bucket of buckets) {
    for (const item of bucket) {
      const key = normaliseKey(item.title);
      if (!key) continue;
      const existing = map.get(key);
      if (existing) {
        existing.score += item.weight;
        existing.provenance.push(item.source);
        if (!existing.image && item.image) existing.image = item.image;
        if (!existing.url && item.url) existing.url = item.url;
      } else {
        const relevance = scoreStockRelevance(item.title, []);
        if (relevance < MIN_RELEVANCE) continue;
        map.set(key, {
          title: item.title,
          score: item.weight + relevance,
          relevance,
          provenance: [item.source],
          image: item.image || null,
          url: item.url || null,
          sample: item.sample || null,
        });
      }
    }
  }

  return [...map.values()].sort((a, b) => b.score - a.score);
}

function normaliseKey(title) {
  if (typeof title !== "string") return "";
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Per-source extractors ────────────────────────────────────────
//
// Each extractor reads from the same module-level cache the source's
// own route writes to. We must pass the SAME cache key the source
// route uses — see each source's route.js for the convention.

function readSourceCache(source) {
  // Source routes write under bucket="<source>" with various entry keys.
  // For this aggregator we accept any cached entry per bucket — pick
  // the freshest one.
  switch (source) {
    case "reddit":
      return readFreshest("reddit");
    case "pixabay":
      return readFreshest("pixabay");
    case "pexels":
      return readFreshest("pexels");
    default:
      return null;
  }
}

// readFreshest — fish out whichever cached entry has the most-recent
// fetchedAt across all keys in a bucket. The cache module doesn't
// expose iteration directly, so we inspect via getOwnPropertyNames on
// its internal Map. We instead re-derive by reading well-known keys
// and falling back. To stay simple, the aggregator just calls the
// known-default keys for each source.

function readWith(source, key) {
  const entry = readCache(source, key) || readStaleCache(source, key);
  return entry || null;
}

function readFreshest(source) {
  // Try each well-known cache key per source; return whichever has data.
  const candidates = WELL_KNOWN_KEYS[source] || [];
  let best = null;
  for (const k of candidates) {
    const entry = readWith(source, k);
    if (entry && (!best || entry.fetchedAt > best.fetchedAt)) {
      best = entry;
    }
  }
  return best;
}

// Default keys each source route writes under when called with default
// query params. Keep in sync with the route files.
const WELL_KNOWN_KEYS = {
  reddit: [
    // The reddit route sorts subs case-sensitively (uppercase first)
    // before joining; the default sub list yields this composite key.
    "DesignPorn,Etsy,InteriorDesign,Minimalism,cottagecore:week",
    "DesignPorn,Etsy,InteriorDesign,Minimalism,cottagecore:day",
    "DesignPorn,Etsy,InteriorDesign,Minimalism,cottagecore:month",
  ],
  pixabay: ["all:all", "all:photo", "all:vector"],
  pexels: ["curated-photo", "popular-video"],
};

function extractReddit() {
  const entry = readFreshest("reddit");
  if (!entry?.data) return [];
  return entry.data.map((p) => ({
    title: typeof p.title === "string" ? p.title : "",
    image: p.image || null,
    url: p.url || null,
    // Reddit is a 6–12 week early-warning signal, valuable but less
    // direct than real download counts. Weight 2.
    weight: 2,
    source: "reddit",
    sample: p,
  })).filter(x => x.title);
}

function extractPixabay() {
  const entry = readFreshest("pixabay");
  if (!entry?.data) return [];
  return entry.data.map((p) => {
    // Boost the weight by the (log10 of) actual download count so
    // "5K downloads" outranks "50 downloads" inside the Pixabay
    // bucket. Caps the total Pixabay contribution at ~6 to keep one
    // viral asset from dominating the entire ranking.
    const downloads = typeof p.downloads === "number" ? p.downloads : 0;
    const downloadBoost = downloads > 0 ? Math.min(3, Math.log10(downloads + 1)) : 0;
    return {
      title: typeof p.title === "string" && p.title ? p.title : (p.tags?.[0] || ""),
      image: p.preview || p.image || null,
      url: p.url || null,
      // Strongest signal — Pixabay carries actual download counts.
      weight: 3 + downloadBoost,
      source: "pixabay",
      sample: p,
    };
  }).filter(x => x.title);
}

function extractPexels() {
  const entry = readFreshest("pexels");
  if (!entry?.data) return [];
  return entry.data.map((p) => ({
    title: typeof p.title === "string" && p.title !== "Curated photo" ? p.title : (p.alt || ""),
    image: p.preview || p.image || null,
    url: p.url || null,
    weight: 2,
    source: "pexels",
    sample: p,
  })).filter(x => x.title);
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
