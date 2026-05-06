// Per-IP rate-limit middleware.
//
// Two backends:
//   1. Upstash Redis REST  (production-grade, survives serverless cold-start)
//      — enabled when both UPSTASH_REDIS_REST_URL and
//        UPSTASH_REDIS_REST_TOKEN env vars are set.
//   2. In-memory Map        (default fallback for local dev / single-worker
//      Node hosts).  Resets on cold-start, but that's acceptable for low
//      traffic and avoids any external dep.
//
// AutoTester sweeps providers × marketplaces × modes from a single IP, so the
// per-minute budget needs to comfortably cover a full matrix without spamming
// the user with 429s. 100/min still cuts off any abusive traffic on a per-IP
// basis.

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 100;

const rateLimitMap = new Map();

const UPSTASH_URL = (typeof process !== "undefined" && process.env && process.env.UPSTASH_REDIS_REST_URL) || "";
const UPSTASH_TOKEN = (typeof process !== "undefined" && process.env && process.env.UPSTASH_REDIS_REST_TOKEN) || "";
const UPSTASH_ENABLED = UPSTASH_URL && UPSTASH_TOKEN;

function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}

function tooManyResponse() {
  return {
    limited: true,
    response: new Response(
      JSON.stringify({ error: "Too many requests. Please wait before trying again.", code: "RATE_LIMIT" }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
    ),
  };
}

// In-memory backend (sync logic, exposed as async to keep call-site uniform).
async function rateLimitMemory(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  if (entry.count > MAX_REQUESTS) return tooManyResponse();
  return { limited: false };
}

// Upstash REST backend.  Uses INCR + EXPIRE in a pipeline.  Falls back to
// in-memory on any network/parse error so a temporary Upstash outage never
// blocks the API.
async function rateLimitUpstash(ip) {
  const key = `rl:${ip}:${Math.floor(Date.now() / WINDOW_MS)}`;
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(Math.ceil(WINDOW_MS / 1000) * 2)],
      ]),
      // Keep the call short — rate-limit must not become a latency cliff.
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const json = await res.json();
    // Pipeline returns array; element 0 = INCR result with `result` field.
    const incr = Array.isArray(json) ? json[0] : null;
    const count = Number(incr && incr.result);
    if (!Number.isFinite(count)) throw new Error("bad upstash response");
    if (count > MAX_REQUESTS) return tooManyResponse();
    return { limited: false };
  } catch {
    // Fall back to in-memory so a transient Upstash failure never breaks the
    // API.  This trades strict-correctness for availability — acceptable for
    // a rate-limit which is itself best-effort.
    return rateLimitMemory(ip);
  }
}

// Public API.  Older route handlers used the sync return shape
// `{ limited, response }`; we kept that shape here but the function is now
// async.  Every call-site already does `await import(...).rateLimit(...)`
// inside an async route handler so adding `await` to the call is the only
// migration needed.
export async function rateLimit(request) {
  const ip = clientIp(request);
  if (UPSTASH_ENABLED) return rateLimitUpstash(ip);
  return rateLimitMemory(ip);
}

// Periodic cleanup to prevent memory leaks (in-memory backend only).
if (typeof setInterval !== "undefined") {
  const handle = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
      if (now - entry.windowStart > WINDOW_MS * 2) {
        rateLimitMap.delete(ip);
      }
    }
  }, WINDOW_MS * 5);
  if (typeof handle?.unref === "function") handle.unref();
}
