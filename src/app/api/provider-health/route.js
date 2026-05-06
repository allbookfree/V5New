import { snapshot } from "@/lib/providerHealth";
import { enforceSameOrigin } from "@/lib/apiUtils";

// Read-only endpoint exposing the in-memory provider/model health snapshot
// (success / fail / rate_limit counts and a recency-weighted score).  Used by
// the API Status page to show live "🟢 healthy / 🟡 degraded / 🔴 unhealthy"
// badges next to each provider.  In a serverless deployment this resets on
// cold start; clients should treat the absence of data as "no recent
// activity" rather than as a failure.
//
// Same-origin restricted: even though the data is non-secret, this snapshot
// reveals our internal provider mix and current health, which competitors can
// scrape to track our infrastructure.  Restricting to same-origin keeps it
// available to the in-app status page without leaking telemetry to third
// parties.
//
// Note: stays on the Node runtime intentionally — the writer paths
// (generate-prompts) record into the same module-level state, and Vercel
// keeps Node lambda + Edge function state separate.  Co-locating reader and
// writers on the same runtime is required for the in-memory store to work.

export async function GET(request) {
  const csrf = enforceSameOrigin(request);
  if (csrf) return csrf;

  try {
    const data = snapshot();
    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
