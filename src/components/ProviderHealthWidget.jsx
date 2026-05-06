"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";

// Maps a model id to a human-friendly provider label.  We keep this
// client-side because the health endpoint returns raw model ids and we want
// the API Status page to show provider-grouped rows.
function providerOf(modelId) {
  if (!modelId) return "unknown";
  const id = String(modelId).toLowerCase();
  // Provider-prefixed labels emitted by handlers (e.g. "cerebras:gpt-oss-120b")
  if (id.startsWith("cerebras")) return "Cerebras";
  if (id.startsWith("nvidia")) return "NVIDIA NIM";
  if (id.startsWith("gemini") || id.includes("google")) return "Gemini";
  if (id.startsWith("llama-") || id.startsWith("meta-llama") || id.includes("groq") || id.startsWith("openai/gpt-oss")) return "Groq";
  if (id.startsWith("mistral") || id.includes("ministral")) return "Mistral";
  if (id.includes("/") || id.startsWith("or-") || id.startsWith("openrouter")) return "OpenRouter";
  if (id.startsWith("hf-") || id.startsWith("huggingface")) return "HuggingFace";
  return "Other";
}

function bandFor(score) {
  if (score >= 1.0) return { label: "healthy", color: "#10B981", emoji: "🟢" };
  if (score >= -0.5) return { label: "neutral", color: "#9CA3AF", emoji: "⚪" };
  if (score >= -2) return { label: "degraded", color: "#F59E0B", emoji: "🟡" };
  return { label: "unhealthy", color: "#EF4444", emoji: "🔴" };
}

// Aggregates a per-model health snapshot into per-provider rows.  We surface
// the worst score per provider so users immediately see which provider is
// struggling and the count of recent failures vs successes feeding into it.
function aggregate(snap) {
  const out = new Map();
  for (const [model, stats] of Object.entries(snap || {})) {
    const provider = providerOf(model);
    const cur = out.get(provider) || { provider, success: 0, fail: 0, rateLimit: 0, worstScore: Infinity, models: 0 };
    cur.success += stats.success || 0;
    cur.fail += stats.fail || 0;
    cur.rateLimit += stats.rateLimit || 0;
    cur.worstScore = Math.min(cur.worstScore, Number.isFinite(stats.score) ? stats.score : 0);
    cur.models += 1;
    out.set(provider, cur);
  }
  return Array.from(out.values()).sort((a, b) => a.provider.localeCompare(b.provider));
}

export default function ProviderHealthWidget() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/provider-health", { cache: "no-store" });
      const j = await r.json();
      if (j && j.ok) {
        setData(j.data || {});
        setFetchedAt(Date.now());
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    // Defer to a microtask so we don't call setState synchronously inside
    // the effect body (and to allow the component to mount fully first).
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await load();
    })();
    return () => { cancelled = true; };
  }, []);

  const rows = aggregate(data);
  const empty = rows.length === 0;

  return (
    <div
      style={{
        background: "var(--bg-card, var(--bg2))",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 18,
        marginBottom: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Activity size={16} color="#6366F1" />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text1)" }}>
            Live Provider Health
          </h3>
          <span style={{ fontSize: 11, color: "var(--text3)" }}>
            Last 10 minutes
          </span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          aria-label="Refresh provider health"
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "5px 9px",
            color: "var(--text2)",
            cursor: loading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
          }}
        >
          <RefreshCw size={12} style={{ animation: loading ? "api-spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {empty ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text3)", lineHeight: 1.5 }}>
          No recent activity yet.  Generate prompts and the system will begin tracking which models succeed, hit rate-limits, or fail — fallback queues are reordered automatically.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((r) => {
            const band = bandFor(r.worstScore);
            return (
              <div
                key={r.provider}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg2)",
                }}
              >
                <span style={{ fontSize: 18 }} aria-hidden="true">{band.emoji}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text1)" }}>{r.provider}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>
                    {r.models} model{r.models === 1 ? "" : "s"} · {r.success} ok · {r.fail} fail · {r.rateLimit} rate-limit
                  </div>
                </div>
                <span style={{ fontSize: 11, color: band.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.05 }}>
                  {band.label}
                </span>
              </div>
            );
          })}
          {fetchedAt > 0 && (
            <div style={{ fontSize: 11, color: "var(--text3)", textAlign: "right", marginTop: 4 }}>
              Updated {new Date(fetchedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
