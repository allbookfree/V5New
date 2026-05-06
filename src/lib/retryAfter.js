// Normalize a Retry-After style header value to a non-negative integer
// number of seconds *from now*. Different providers send wildly different
// formats and the client side previously had to guess, which produced
// either zero-second backoffs or many-day backoffs depending on provider:
//   - Standard "Retry-After: 30"           → 30  (delta seconds)
//   - HTTP date "Retry-After: <RFC1123>"   → seconds from now
//   - Groq "x-ratelimit-reset: 1733512345" → epoch seconds → delta
//   - Groq "x-ratelimit-reset: 1733512345.123" → fractional epoch
//   - OpenRouter "x-ratelimit-reset: 30s"  → 30
//   - Some return "x-ratelimit-reset-tokens: 0" → 0
// We always return seconds-from-now; never an epoch, never a date string.
// Returns null if the header is absent / unparsable.
export function normalizeRetryAfter(headerValue, nowMs = Date.now()) {
  if (headerValue == null) return null;
  const raw = String(headerValue).trim();
  if (!raw) return null;
  // Strip a trailing "s" / "ms" if the provider sent a duration suffix.
  const stripped = raw.replace(/\s*(milliseconds|millis|ms|seconds|secs|s)\s*$/i, "");
  const num = Number(stripped);
  if (Number.isFinite(num)) {
    // Heuristic: any value comfortably larger than 10 years of seconds
    // is almost certainly an epoch timestamp. Convert to delta.
    // 10 years ≈ 315M seconds; epoch seconds in 2026 ≈ 1.8B.
    if (num > 1_000_000_000) {
      const epochMs = num < 1e12 ? num * 1000 : num; // s → ms when needed
      const delta = Math.max(0, Math.round((epochMs - nowMs) / 1000));
      return delta;
    }
    return Math.max(0, Math.round(num));
  }
  // Try parsing as HTTP date.
  const t = Date.parse(raw);
  if (Number.isFinite(t)) {
    return Math.max(0, Math.round((t - nowMs) / 1000));
  }
  return null;
}
