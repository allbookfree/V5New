/**
 * /api/health — public uptime / readiness probe.
 *
 * Lightweight endpoint suitable for external uptime monitors
 * (UptimeRobot, BetterStack, statuspage.io) and CI smoke tests. It does
 * NOT call any upstream provider, so it won't burn quota and it
 * succeeds even when every provider is rate-limited.
 *
 * GET response shape:
 *   {
 *     status: "ok",
 *     timestamp: "2026-05-03T12:00:00.000Z",
 *     version: "<commit-sha-if-available>",
 *     env:     "production" | "preview" | "development",
 *     region:  "<vercel-region-if-available>"
 *   }
 *
 * Always returns 200; non-200 means the runtime itself is broken.
 */

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  const body = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
      process.env.GIT_COMMIT?.slice(0, 7) ||
      "dev",
    env:
      process.env.VERCEL_ENV ||
      process.env.NODE_ENV ||
      "development",
    region: process.env.VERCEL_REGION || "local",
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store, max-age=0",
    },
  });
}
