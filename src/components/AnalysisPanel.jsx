"use client";

import { useState, useMemo } from "react";
import { useApiKeys } from "@/context/ApiKeyContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  Brain, Loader2, AlertTriangle, ChevronDown, ChevronUp,
  ShoppingBag, ExternalLink, KeyRound,
} from "lucide-react";

/**
 * AnalysisPanel — per-trend AI live analysis (sales-graded).
 *
 * Shows a small "AI Analyze" button. On click:
 *   1. Reads the user's Gemini key from ApiKeyContext.
 *   2. POSTs { query, apiKeys } to /api/market-trends/analyze.
 *   3. Renders a structured verdict panel:
 *        - Verdict badge (stock-friendly / niche / overcrowded / fad / unknown)
 *        - Plain-English summary
 *        - Per-platform "is it trending right now?" list
 *        - Top 5 long-tail keywords (chips)
 *        - Recommended marketplace + format
 *        - Color palette swatches + mood tags
 *        - Warnings (oversupply / IP / cultural sensitivity)
 *        - Cited grounding sources (collapsible)
 *
 * Two layout modes:
 *   - default: full-width below a card
 *   - compact: tighter padding, smaller text — used inside the
 *     marketplace ItemCard where vertical space is tight.
 *
 * Strict no-auto-call: nothing happens until the user clicks Analyze.
 */

export default function AnalysisPanel({ query, compact = false }) {
  const { lang } = useLanguage();
  const { getAllKeys } = useApiKeys();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [cached, setCached] = useState(false);

  const labels = useMemo(() => buildLabels(lang), [lang]);

  const runAnalysis = async () => {
    if (loading) return;
    setOpen(true);
    setLoading(true);
    setError(null);
    setAnalysis(null);

    const apiKeys = getAllKeys("gemini").filter(Boolean);
    if (apiKeys.length === 0) {
      setLoading(false);
      setError(labels.noKey);
      return;
    }
    if (!query || !query.trim()) {
      setLoading(false);
      setError(labels.noQuery);
      return;
    }

    try {
      const res = await fetch("/api/market-trends/analyze", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, apiKeys }),
      });
      const json = await res.json();
      if (json.ok && json.analysis) {
        setAnalysis(json.analysis);
        setCached(!!json.cached);
      } else {
        setError(json.error || labels.fallbackError);
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const headerOnly = compact && !open;

  return (
    <div
      style={{
        marginTop: compact ? 4 : 8,
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (analysis || error) {
            setOpen((o) => !o);
          } else {
            runAnalysis();
          }
        }}
        disabled={loading}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: compact ? "4px 8px" : "6px 12px",
          borderRadius: 6,
          border: "1px solid #a855f7",
          background: open ? "rgba(168,85,247,0.12)" : "rgba(168,85,247,0.06)",
          color: "#a855f7",
          fontSize: compact ? 10 : 11,
          fontWeight: 700,
          cursor: loading ? "wait" : "pointer",
        }}
        title={query || ""}
      >
        {loading ? (
          <Loader2 size={compact ? 10 : 12} style={{ animation: "spin 1s linear infinite" }} />
        ) : (
          <Brain size={compact ? 10 : 12} />
        )}
        {loading ? labels.analyzing : analysis || error ? (open ? labels.hide : labels.show) : labels.analyze}
        {(analysis || error) && (open ? <ChevronUp size={compact ? 10 : 12} /> : <ChevronDown size={compact ? 10 : 12} />)}
      </button>

      {!headerOnly && open && (loading || error || analysis) && (
        <div
          style={{
            marginTop: 6,
            padding: compact ? "8px 10px" : "10px 14px",
            border: "1px solid rgba(168,85,247,0.35)",
            background: "rgba(168,85,247,0.04)",
            borderRadius: 8,
            fontSize: compact ? 10 : 11,
            color: "var(--text)",
            lineHeight: 1.5,
          }}
        >
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#a855f7" }}>
              <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
              {labels.analyzing}
            </div>
          )}

          {error && !loading && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 6,
                color: "#ef4444",
                fontSize: compact ? 10 : 11,
              }}
            >
              {error.includes("Gemini") || error.includes("Live Analysis") ? (
                <KeyRound size={12} style={{ marginTop: 1, flexShrink: 0 }} />
              ) : (
                <AlertTriangle size={12} style={{ marginTop: 1, flexShrink: 0 }} />
              )}
              <span>{error}</span>
            </div>
          )}

          {analysis && !loading && !error && (
            <AnalysisBody analysis={analysis} cached={cached} compact={compact} labels={labels} />
          )}
        </div>
      )}
    </div>
  );
}

function AnalysisBody({ analysis, cached, compact, labels }) {
  const verdict = analysis.verdict || "unknown";
  const verdictCfg = VERDICT_STYLES[verdict] || VERDICT_STYLES.unknown;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 6 : 10 }}>
      {/* Verdict + summary */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 9px",
              borderRadius: 999,
              background: verdictCfg.bg,
              color: verdictCfg.color,
              border: `1px solid ${verdictCfg.color}40`,
              fontWeight: 800,
              fontSize: compact ? 10 : 11,
              textTransform: "capitalize",
            }}
          >
            {verdictCfg.icon} {labels[`verdict_${verdict}`] || verdict}
          </span>
          {cached && (
            <span style={{ fontSize: 9, color: "var(--text4)" }}>
              {labels.fromCache}
            </span>
          )}
        </div>
        {analysis.summary && (
          <p style={{ margin: 0, color: "var(--text2)" }}>{analysis.summary}</p>
        )}
      </div>

      {/* Recommended marketplace + format */}
      {(analysis.recommendedMarketplace || analysis.recommendedFormat) && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            alignItems: "center",
            color: "var(--text2)",
          }}
        >
          <ShoppingBag size={11} color="#10b981" />
          <span>{labels.recommendation}:</span>
          {analysis.recommendedMarketplace && (
            <strong style={{ color: "#10b981" }}>{analysis.recommendedMarketplace}</strong>
          )}
          {analysis.recommendedFormat && (
            <span
              style={{
                padding: "1px 7px",
                borderRadius: 4,
                background: "rgba(16,185,129,0.12)",
                color: "#10b981",
                fontWeight: 700,
                fontSize: compact ? 9 : 10,
                textTransform: "uppercase",
              }}
            >
              {analysis.recommendedFormat}
            </span>
          )}
        </div>
      )}

      {/* Per-platform verdicts */}
      {Array.isArray(analysis.platforms) && analysis.platforms.length > 0 && (
        <div>
          <div
            style={{
              fontSize: compact ? 9 : 10,
              fontWeight: 800,
              color: "var(--text3)",
              textTransform: "uppercase",
              letterSpacing: 0.4,
              marginBottom: 4,
            }}
          >
            {labels.platforms}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {analysis.platforms.map((p, i) => (
              <div
                key={`${p.name}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 6,
                  fontSize: compact ? 10 : 11,
                  color: "var(--text2)",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    marginTop: 4,
                    borderRadius: "50%",
                    background: p.trending ? "#10b981" : "#ef4444",
                    flexShrink: 0,
                  }}
                />
                <span>
                  <strong style={{ color: "var(--text)" }}>{p.name}</strong>
                  {p.note ? <> — {p.note}</> : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top keywords */}
      {Array.isArray(analysis.topKeywords) && analysis.topKeywords.length > 0 && (
        <div>
          <div
            style={{
              fontSize: compact ? 9 : 10,
              fontWeight: 800,
              color: "var(--text3)",
              textTransform: "uppercase",
              letterSpacing: 0.4,
              marginBottom: 4,
            }}
          >
            {labels.keywords}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {analysis.topKeywords.map((k, i) => (
              <span
                key={`kw-${i}`}
                style={{
                  padding: "2px 7px",
                  borderRadius: 4,
                  background: "rgba(99,102,241,0.12)",
                  color: "#6366f1",
                  fontSize: compact ? 9 : 10,
                  fontWeight: 700,
                }}
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Color palette + mood */}
      {(Array.isArray(analysis.colorPalette) && analysis.colorPalette.length > 0) ||
      (Array.isArray(analysis.moodTags) && analysis.moodTags.length > 0) ? (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {Array.isArray(analysis.colorPalette) && analysis.colorPalette.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: compact ? 9 : 10,
                  fontWeight: 800,
                  color: "var(--text3)",
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  marginBottom: 4,
                }}
              >
                {labels.palette}
              </div>
              <div style={{ display: "flex", gap: 3 }}>
                {analysis.colorPalette.slice(0, 6).map((c, i) => (
                  <span
                    key={`c-${i}`}
                    title={c}
                    style={{
                      width: compact ? 16 : 20,
                      height: compact ? 16 : 20,
                      borderRadius: 4,
                      background: c,
                      border: "1px solid var(--border)",
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          {Array.isArray(analysis.moodTags) && analysis.moodTags.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: compact ? 9 : 10,
                  fontWeight: 800,
                  color: "var(--text3)",
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  marginBottom: 4,
                }}
              >
                {labels.mood}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {analysis.moodTags.map((m, i) => (
                  <span
                    key={`m-${i}`}
                    style={{
                      padding: "2px 7px",
                      borderRadius: 4,
                      background: "rgba(245,158,11,0.12)",
                      color: "#f59e0b",
                      fontSize: compact ? 9 : 10,
                      fontWeight: 700,
                    }}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Warnings */}
      {Array.isArray(analysis.warnings) && analysis.warnings.length > 0 && (
        <div
          style={{
            padding: compact ? "5px 8px" : "7px 10px",
            borderRadius: 6,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
          }}
        >
          <div
            style={{
              fontSize: compact ? 9 : 10,
              fontWeight: 800,
              color: "#ef4444",
              textTransform: "uppercase",
              letterSpacing: 0.4,
              marginBottom: 3,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <AlertTriangle size={10} /> {labels.warnings}
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: compact ? 10 : 11, color: "var(--text2)" }}>
            {analysis.warnings.map((w, i) => (
              <li key={`w-${i}`}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Sources */}
      {Array.isArray(analysis.sources) && analysis.sources.length > 0 && (
        <details>
          <summary
            style={{
              fontSize: compact ? 9 : 10,
              fontWeight: 800,
              color: "var(--text3)",
              textTransform: "uppercase",
              letterSpacing: 0.4,
              cursor: "pointer",
            }}
          >
            {labels.sources} ({analysis.sources.length})
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4 }}>
            {analysis.sources.slice(0, 8).map((s, i) => (
              <a
                key={`s-${i}`}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: compact ? 10 : 11,
                  color: "#6366f1",
                  textDecoration: "none",
                }}
              >
                <ExternalLink size={9} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.title || s.url}
                </span>
              </a>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

const VERDICT_STYLES = {
  "stock-friendly": { bg: "rgba(16,185,129,0.12)", color: "#10b981", icon: "✓" },
  "niche": { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", icon: "◌" },
  "overcrowded": { bg: "rgba(239,68,68,0.12)", color: "#ef4444", icon: "⚠" },
  "passing-fad": { bg: "rgba(107,114,128,0.12)", color: "#6b7280", icon: "↘" },
  "not-suitable": { bg: "rgba(239,68,68,0.12)", color: "#ef4444", icon: "✕" },
  "unknown": { bg: "rgba(107,114,128,0.12)", color: "#6b7280", icon: "?" },
};

function buildLabels(lang) {
  const isBn = lang === "bn";
  return {
    analyze: isBn ? "AI বিশ্লেষণ" : "AI Analyze",
    show: isBn ? "ফলাফল দেখুন" : "Show analysis",
    hide: isBn ? "লুকান" : "Hide",
    analyzing: isBn ? "বিশ্লেষণ চলছে..." : "Analyzing...",
    fromCache: isBn ? "(২৪ ঘণ্টার ক্যাশ থেকে)" : "(from 24h cache)",
    noKey: isBn
      ? "Live Analysis-এর জন্য Gemini API key দরকার। Sidebar → API Keys → Gemini-এ key যোগ করুন।"
      : "Live Analysis needs a Gemini API key. Add one in Sidebar → API Keys → Gemini.",
    noQuery: isBn ? "বিশ্লেষণের জন্য কোনো keyword নেই।" : "No keyword to analyze.",
    fallbackError: isBn ? "বিশ্লেষণ ব্যর্থ হয়েছে।" : "Analysis failed.",
    recommendation: isBn ? "সুপারিশ" : "Recommendation",
    platforms: isBn ? "প্ল্যাটফর্মে এখন বিক্রি হচ্ছে?" : "Selling on each platform right now?",
    keywords: isBn ? "Top long-tail keywords" : "Top long-tail keywords",
    palette: isBn ? "এখন বিক্রি হওয়া রঙ" : "Selling palette",
    mood: isBn ? "Mood / aesthetic" : "Mood / aesthetic",
    warnings: isBn ? "সতর্কতা" : "Warnings",
    sources: isBn ? "Grounding sources" : "Grounding sources",
    "verdict_stock-friendly": isBn ? "Stock-friendly" : "Stock-friendly",
    verdict_niche: isBn ? "Niche" : "Niche",
    verdict_overcrowded: isBn ? "Oversupplied" : "Oversupplied",
    "verdict_passing-fad": isBn ? "Passing fad" : "Passing fad",
    "verdict_not-suitable": isBn ? "Not suitable" : "Not suitable",
    verdict_unknown: isBn ? "Inconclusive" : "Inconclusive",
  };
}
