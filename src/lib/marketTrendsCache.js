// Shared 24-hour module-level cache for the marketplace-data trend
// endpoints under /api/market-trends/* (pixabay, pexels, reddit,
// wikipedia, and the auto-discover aggregator added in Phase 3).
//
// Why module-level instead of Redis / KV?
//   1. The data we cache is genuinely "live enough" — a 24 hour
//      refresh window matches how trend lists actually move on stock
//      platforms (daily rollovers, not minute-by-minute).
//   2. Module-level state survives across requests within a single
//      lambda instance, which on Vercel is the common case during
//      bursts of in-app traffic.
//   3. Cold starts mean one extra upstream fetch — totally fine given
//      free-tier quotas (Pixabay 100 req/60s, Pexels 200 req/hr).
//
// IMPORTANT — quota discipline:
//   These endpoints must NEVER auto-fetch on page load. The /market-
//   trends UI is built around explicit user-triggered "Load" buttons
//   per source. The 24h cache is the second line of defence; the
//   first is that the request never happens unless the user asked
//   for it.

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// One Map per logical "source key" (pixabay, pexels, reddit, wikipedia,
// auto-discover…). Each entry's key inside the map is whatever
// disambiguator the source needs (e.g. "popular:photo:US" for pixabay
// or "InteriorDesign" for reddit).
const buckets = new Map();

function getBucket(sourceKey) {
  let bucket = buckets.get(sourceKey);
  if (!bucket) {
    bucket = new Map();
    buckets.set(sourceKey, bucket);
  }
  return bucket;
}

export function readCache(sourceKey, key) {
  const bucket = getBucket(sourceKey);
  const entry = bucket.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    bucket.delete(key);
    return null;
  }
  return entry;
}

export function writeCache(sourceKey, key, data) {
  const bucket = getBucket(sourceKey);
  bucket.set(key, { fetchedAt: Date.now(), data });
}

// Read the cached entry even if it's expired. Useful for graceful
// degradation: if the upstream fails on a refresh, we'd rather show
// last-known-good data than an empty list.
export function readStaleCache(sourceKey, key) {
  const bucket = getBucket(sourceKey);
  return bucket.get(key) || null;
}

// Helper for endpoints that want a single canonical "fetched-at" wall
// clock string in their response payload.
export function isoNow() {
  return new Date().toISOString();
}

export const CACHE_TTL_HOURS = CACHE_TTL_MS / (60 * 60 * 1000);
