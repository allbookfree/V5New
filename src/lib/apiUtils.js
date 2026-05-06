const MAX_API_KEYS = 10;

export const DEFAULT_REQUEST_TIMEOUT_MS = 60000;
// Server-enforced cap on JSON request bodies. The metadata route accepts a
// base64 image which can legitimately be ~14 MB once encoded, so we leave
// some headroom above MAX_IMAGE_BYTES (10 MB raw → ~14 MB base64). The
// generate-prompts route caps individual fields, so a 1 MB body is plenty.
export const MAX_REQUEST_BODY_BYTES = {
  prompts: 1 * 1024 * 1024, // 1 MB
  metadata: 16 * 1024 * 1024, // 16 MB
  general: 256 * 1024, // 256 KB
};

export const APP_REFERER = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:5000";
export const APP_TITLE = "AI Prompt Studio";

export function jsonError(message, status, code) {
  return Response.json({ error: message, code }, { status });
}

// Same-origin / CSRF enforcement.
//
// Design: Every state-changing API route is invoked from the browser via
// fetch() with an Origin header attached by the user-agent. Cross-site
// requests cannot suppress this header; only top-level navigations and a
// narrow set of safe methods (GET/HEAD without explicit fetch()) can.
//
// Allowlist sources:
//   * Same origin as the request itself (best-effort via host header)
//   * NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_BASE_URL (production canonical)
//   * VERCEL_URL (preview deployments)
//   * Any host listed in API_ALLOWED_ORIGINS (comma-separated, optional)
//
// Returns null when the origin is allowed; returns a 403 Response when not.
//
// In dev (no Origin header on tools like curl, or localhost requests with
// matching host), we accept the request to avoid breaking local testing.
function buildAllowedOrigins(request) {
  const allowed = new Set();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (baseUrl) {
    try {
      allowed.add(new URL(baseUrl).origin);
    } catch {
      // Ignore malformed config; the host-based allowlist below still works.
    }
  }
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    allowed.add(`https://${vercelUrl}`);
  }
  const extra = process.env.API_ALLOWED_ORIGINS;
  if (extra) {
    for (const candidate of extra.split(",")) {
      const trimmed = candidate.trim();
      if (!trimmed) continue;
      try {
        allowed.add(new URL(trimmed).origin);
      } catch {
        // Skip invalid entries silently — operator misconfiguration shouldn't 503 the API.
      }
    }
  }
  // Same-origin fallback derived from the incoming request (covers preview
  // deployments + custom domains where env vars may not be wired up yet).
  try {
    const host = request.headers?.get?.("host");
    if (host) {
      const proto = request.headers.get("x-forwarded-proto") || "https";
      allowed.add(`${proto}://${host}`);
    }
  } catch {
    // Defensive — request shape may differ in tests.
  }
  // In dev, always allow localhost variants regardless of port.
  if (process.env.NODE_ENV !== "production") {
    allowed.add("http://localhost:5000");
    allowed.add("http://localhost:3000");
    allowed.add("http://127.0.0.1:5000");
    allowed.add("http://127.0.0.1:3000");
  }
  return allowed;
}

export function enforceSameOrigin(request) {
  const origin = request.headers?.get?.("origin");
  // No Origin header (server-to-server, curl, native apps) — only allow when
  // running outside production. In production this fails closed, eliminating
  // CSRF + drive-by quota burn from third-party sites that load images/scripts.
  if (!origin) {
    if (process.env.NODE_ENV === "production") {
      return jsonError("Missing Origin header.", 403, "CSRF_NO_ORIGIN");
    }
    return null;
  }
  const allowed = buildAllowedOrigins(request);
  if (!allowed.has(origin)) {
    return jsonError("Origin not allowed.", 403, "CSRF_BAD_ORIGIN");
  }
  return null;
}

// Read a JSON body with a hard size cap to prevent memory blow-ups.
// Throws on parse failure — callers should wrap in try/catch.
export async function readJsonBody(request, maxBytes) {
  const limit = typeof maxBytes === "number" ? maxBytes : MAX_REQUEST_BODY_BYTES.general;
  const contentLength = Number(request.headers?.get?.("content-length") || 0);
  if (contentLength > 0 && contentLength > limit) {
    const err = new Error("Request body too large.");
    err.code = "BODY_TOO_LARGE";
    err.status = 413;
    throw err;
  }
  const text = await request.text();
  if (text.length > limit) {
    const err = new Error("Request body too large.");
    err.code = "BODY_TOO_LARGE";
    err.status = 413;
    throw err;
  }
  if (!text) {
    const err = new Error("Empty request body.");
    err.code = "BODY_EMPTY";
    err.status = 400;
    throw err;
  }
  try {
    return JSON.parse(text);
  } catch {
    const err = new Error("Invalid JSON in request body.");
    err.code = "BODY_INVALID_JSON";
    err.status = 400;
    throw err;
  }
}

export function sanitizeKeys(apiKeys) {
  if (!Array.isArray(apiKeys)) return [];
  const deduped = new Set();
  for (const key of apiKeys) {
    const normalized = typeof key === "string" ? key.trim() : "";
    if (!normalized || normalized.length > 256) continue;
    deduped.add(normalized);
    if (deduped.size >= MAX_API_KEYS) break;
  }
  return [...deduped];
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
