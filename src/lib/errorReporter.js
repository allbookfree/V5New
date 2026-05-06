// Lightweight, optional error reporter.
//
// Two delivery modes (env-driven; if neither is set, this module is a no-op):
//
//   1. SENTRY_DSN          — a Sentry public DSN.  We POST to the Sentry
//                            store endpoint using the standard envelope/JSON
//                            format.  Works with self-hosted Sentry too.
//   2. ERROR_WEBHOOK_URL   — any HTTPS endpoint that accepts JSON.  Useful
//                            for piping into Slack incoming webhooks,
//                            BetterStack/Logtail, or a custom collector.
//
// Both endpoints can be set simultaneously; we'll fan out to both.  Failures
// are swallowed — error reporting must never raise its own error.
//
// We deliberately avoid the @sentry/nextjs SDK to keep the bundle small
// (~10 MB) and to avoid surprises during builds.  This 80-line module
// covers the 95% case (uncaught route handler errors, manual reports).

const SENTRY_DSN = (typeof process !== "undefined" && process.env && process.env.SENTRY_DSN) || "";
const ERROR_WEBHOOK_URL = (typeof process !== "undefined" && process.env && process.env.ERROR_WEBHOOK_URL) || "";

const PROJECT = (typeof process !== "undefined" && process.env && process.env.SENTRY_PROJECT) || "promptstudio";
const ENVIRONMENT = (typeof process !== "undefined" && process.env && (process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV)) || "production";

function parseSentryDsn(dsn) {
  // DSN format: https://<key>@<host>/<projectId>
  try {
    const u = new URL(dsn);
    return {
      key: u.username,
      host: u.host,
      projectId: u.pathname.replace(/^\//, ""),
      url: `${u.protocol}//${u.host}/api/${u.pathname.replace(/^\//, "")}/store/`,
    };
  } catch {
    return null;
  }
}

const SENTRY = SENTRY_DSN ? parseSentryDsn(SENTRY_DSN) : null;

async function postSentry(payload) {
  if (!SENTRY) return;
  try {
    const auth = `Sentry sentry_version=7, sentry_key=${SENTRY.key}, sentry_client=promptstudio/1.0`;
    await fetch(SENTRY.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": auth,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
  } catch {}
}

async function postWebhook(payload) {
  if (!ERROR_WEBHOOK_URL) return;
  try {
    await fetch(ERROR_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
  } catch {}
}

export function isReporterEnabled() {
  return Boolean(SENTRY || ERROR_WEBHOOK_URL);
}

// Report a runtime error.  Optional `context` is JSON-serialisable metadata
// such as the route, request id, or user-supplied parameters (already
// sanitised — never pass raw API keys).
export async function reportError(err, context = {}) {
  if (!isReporterEnabled()) return;
  const message = err && err.message ? String(err.message) : String(err);
  const stack = err && err.stack ? String(err.stack) : undefined;
  const now = new Date().toISOString();
  const safeContext = sanitiseContext(context);

  // Sentry-compatible event shape.
  const payload = {
    event_id: cryptoRandomId(),
    timestamp: now,
    platform: "node",
    level: "error",
    environment: ENVIRONMENT,
    server_name: PROJECT,
    message: { formatted: message },
    exception: {
      values: [
        {
          type: err && err.name ? err.name : "Error",
          value: message,
          stacktrace: stack ? { frames: parseStack(stack) } : undefined,
        },
      ],
    },
    extra: safeContext,
  };

  await Promise.all([postSentry(payload), postWebhook(payload)]);
}

function sanitiseContext(ctx) {
  // Strip any field whose name screams "secret" — defensive even though
  // call-sites should already be passing safe values.
  const out = {};
  const denyRe = /key|token|secret|password|authorization/i;
  for (const [k, v] of Object.entries(ctx || {})) {
    if (denyRe.test(k)) continue;
    if (typeof v === "string" && v.length > 1024) {
      out[k] = v.slice(0, 1024) + "...[truncated]";
    } else {
      out[k] = v;
    }
  }
  return out;
}

function parseStack(stack) {
  // Best-effort: turn each line of `Error: msg\n  at Foo (file:line:col)`
  // into Sentry's frames format.
  const lines = String(stack).split("\n").slice(1, 31);
  const re = /at\s+(?:(.+?)\s+\()?([^)]+):(\d+):(\d+)\)?/;
  const frames = [];
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    frames.push({
      function: m[1] || "?",
      filename: m[2],
      lineno: Number(m[3]),
      colno: Number(m[4]),
    });
  }
  return frames.reverse();
}

function cryptoRandomId() {
  // Node 18+: globalThis.crypto.randomUUID().  Fallback in case it's missing.
  try {
    if (globalThis.crypto && globalThis.crypto.randomUUID) {
      return globalThis.crypto.randomUUID().replace(/-/g, "");
    }
  } catch {}
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
