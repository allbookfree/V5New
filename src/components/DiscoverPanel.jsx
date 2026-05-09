"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { filterByFormat } from "@/lib/marketTrendsFormats";
import {
  Wand2, RefreshCw, AlertCircle, Image as ImageIcon, Palette, Video,
  ExternalLink, Sparkles,
} from "lucide-react";
import AnalysisPanel from "./AnalysisPanel";

/**
 * DiscoverPanel — Auto-Discover Top 20 sales-relevant niches.
 *
 * Aggregates ONLY sales-tier sources (Pixabay + Pexels + Reddit) that
 * the user has already loaded via /api/market-trends/<source>. The
 * server endpoint is /api/market-trends/discover; it never triggers
 * upstream fetches itself (quota-conscious by design).
 *
 * Wikipedia and Google Trends are deliberately excluded because the
 * user clarified they're context noise, not sales signals.
 *
 * The component is purely user-triggered — clicking the button hits
 * the aggregator endpoint, which reads the cached source payloads and
 * returns a deduplicated, sales-weighted top-20 list.
 *
 * Each result carries a `provenance` array showing which sources
 * voted for it, so the user sees "spotted on Pixabay + Reddit"
 * confidence at a glance.
 */

export default function DiscoverPanel({ generatorHrefFor, formatTab = "all" }) {
  const { lang } = useLanguage();
  const labels = useMemo(() => buildLabels(lang), [lang]);

  const [state, setState] = useState({
    loading: false,
    items: [],
    contributors: [],
    fetchedAt: null,
    cached: false,
    stale: false,
    error: null,
    hasFetched: false,
  });

  const runDiscover = async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch("/api/market-trends/discover", { credentials: "same-origin" });
      const json = await res.json();
      setState({
        loading: false,
        items: Array.isArray(json.items) ? json.items : [],
        contributors: Array.isArray(json.contributors) ? json.contributors : [],
        fetchedAt: json.fetchedAt || null,
        cached: !!json.cached,
        stale: !!json.stale,
        error: json.ok === false ? (json.error || labels.fallbackError) : null,
        hasFetched: true,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: String(e?.message || e),
        hasFetched: true,
      }));
    }
  };

  const filtered = useMemo(
    () => filterByFormat(state.items, formatTab),
    [state.items, formatTab]
  );

  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Wand2 size={16} color="#a855f7" />
          <h2 style={sectionTitleStyle}>{labels.title}</h2>
        </div>
        <button
          type="button"
          onClick={runDiscover}
          disabled={state.loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "7px 14px",
            borderRadius: 8,
            border: "1px solid #a855f7",
            background: state.fetchedAt ? "var(--card)" : "#a855f7",
            color: state.fetchedAt ? "#a855f7" : "white",
            fontSize: 11,
            fontWeight: 700,
            cursor: state.loading ? "wait" : "pointer",
          }}
        >
          <RefreshCw
            size={11}
            style={{ animation: state.loading ? "spin 1s linear infinite" : undefined }}
          />
          {state.loading ? labels.discovering : state.fetchedAt ? labels.rediscover : labels.discover}
        </button>
      </div>
      <p style={sectionDescStyle}>{labels.desc}</p>

      {/* Contributor chips */}
      {state.hasFetched && state.contributors.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          <span style={{ fontSize: 10, color: "var(--text4)", fontWeight: 700, alignSelf: "center" }}>
            {labels.sourcesUsed}:
          </span>
          {state.contributors.map((c) => (
            <span
              key={c.source}
              style={{
                padding: "2px 8px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
                background: c.cached ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.10)",
                color: c.cached ? "#10b981" : "#ef4444",
                border: `1px solid ${c.cached ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.25)"}`,
              }}
            >
              {c.cached ? "✓" : "○"} {c.source}
            </span>
          ))}
        </div>
      )}

      {state.error && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 14px",
            fontSize: 12,
            background: "rgba(239,68,68,0.08)",
            color: "#ef4444",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8,
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
          }}
        >
          <AlertCircle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>{state.error}</span>
        </div>
      )}

      {state.fetchedAt && (
        <p style={{ marginTop: 10, fontSize: 10, color: "var(--text4)" }}>
          {labels.fetchedAt}: {new Date(state.fetchedAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-US")}
          {state.cached && <> · {labels.fromCache}</>}
          {state.stale && <> · {labels.staleNote}</>}
          {formatTab !== "all" && (
            <> · {labels.filteredFor.replace("{format}", labels[`format_${formatTab}`] || formatTab)}</>
          )}
        </p>
      )}

      {!state.hasFetched && !state.loading && (
        <div
          style={{
            marginTop: 12,
            padding: "12px 14px",
            fontSize: 11,
            color: "var(--text3)",
            textAlign: "center",
            border: "1px dashed var(--border)",
            borderRadius: 8,
          }}
        >
          {labels.notLoaded}
        </div>
      )}

      {filtered.length > 0 && (
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          }}
        >
          {filtered.map((item, i) => (
            <DiscoverCard
              key={`${item.title}-${i}`}
              item={item}
              rank={i + 1}
              labels={labels}
              generatorHrefFor={generatorHrefFor}
            />
          ))}
        </div>
      )}

      {state.hasFetched && state.items.length > 0 && filtered.length === 0 && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            fontSize: 11,
            color: "var(--text4)",
            textAlign: "center",
          }}
        >
          {labels.noItemsForFormat.replace("{format}", labels[`format_${formatTab}`] || formatTab)}
        </div>
      )}
    </section>
  );
}

function DiscoverCard({ item, rank, labels, generatorHrefFor }) {
  const provenance = Array.isArray(item.provenance) ? item.provenance : [];
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt={item.title || ""}
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{
            width: "100%",
            aspectRatio: "4 / 3",
            objectFit: "cover",
            background: "var(--bg2)",
            display: "block",
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            aspectRatio: "4 / 3",
            background: "var(--bg2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text4)",
          }}
        >
          <Sparkles size={24} />
        </div>
      )}
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <span
            style={{
              padding: "1px 6px",
              borderRadius: 4,
              background: "rgba(168,85,247,0.15)",
              color: "#a855f7",
              fontSize: 10,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            #{rank}
          </span>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text)",
              lineHeight: 1.3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.title || "—"}
          </div>
        </div>
        {provenance.length > 0 && (
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {dedupe(provenance).map((src) => (
              <span
                key={src}
                style={{
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "rgba(99,102,241,0.10)",
                  color: "#6366f1",
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                {src}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: "auto" }}>
          <Link href={generatorHrefFor(item.title, "image")} style={chipStyle("#6366f1")}>
            <ImageIcon size={10} /> {labels.image}
          </Link>
          <Link href={generatorHrefFor(item.title, "vector")} style={chipStyle("#06b6d4")}>
            <Palette size={10} /> {labels.vector}
          </Link>
          <Link href={generatorHrefFor(item.title, "video")} style={chipStyle("#f97316")}>
            <Video size={10} /> {labels.video}
          </Link>
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" style={chipStyle("#6b7280")}>
              <ExternalLink size={9} />
            </a>
          )}
        </div>
        <AnalysisPanel query={item.title} compact />
      </div>
    </div>
  );
}

function chipStyle(color) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    padding: "4px 8px",
    borderRadius: 6,
    background: `${color}1c`,
    color,
    fontSize: 10,
    fontWeight: 700,
    textDecoration: "none",
  };
}

function dedupe(arr) {
  return Array.from(new Set(arr));
}

function buildLabels(lang) {
  const isBn = lang === "bn";
  return {
    title: isBn ? "Auto-Discover — Top 20 Sales niches" : "Auto-Discover — Top 20 Sales niches",
    desc: isBn
      ? "Pixabay (real downloads) + Pexels (curated) + Reddit (early aesthetic) — যা ইতিমধ্যে cache-এ আছে তা থেকেই top 20 বের করব। কোনো নতুন API call হবে না। Wikipedia এবং Google Trends বাদ — sales signal না।"
      : "Aggregates Pixabay (real downloads) + Pexels (curated) + Reddit (early aesthetic) from already-cached payloads. No new API calls. Wikipedia and Google Trends are excluded — they aren't sales signals.",
    discover: isBn ? "Top 20 খুঁজুন" : "Discover Top 20",
    rediscover: isBn ? "আবার খুঁজুন" : "Re-discover",
    discovering: isBn ? "মার্জ হচ্ছে..." : "Aggregating...",
    sourcesUsed: isBn ? "ব্যবহৃত sources" : "Sources used",
    fromCache: isBn ? "(৬ ঘণ্টার ক্যাশ থেকে)" : "(from 6h cache)",
    staleNote: isBn ? "(stale fallback)" : "(stale fallback)",
    notLoaded: isBn
      ? "এখনও Discover করা হয়নি — উপরের কোনো sales source (Pixabay / Pexels / Reddit) প্রথমে Load করুন, তারপর এই বাটন চাপুন।"
      : "Not run yet — load at least one sales source (Pixabay / Pexels / Reddit) above first, then click the button.",
    fetchedAt: isBn ? "শেষ আপডেট" : "Last updated",
    fallbackError: isBn ? "Discover ব্যর্থ" : "Discover failed",
    image: isBn ? "ছবি" : "Image",
    vector: isBn ? "ভেক্টর" : "Vector",
    video: isBn ? "ভিডিও" : "Video",
    filteredFor: isBn ? "{format}-এর জন্য ফিল্টার করা" : "filtered for {format}",
    noItemsForFormat: isBn
      ? "{format} ফরম্যাটে কোনো niche মিলেনি — অন্য tab চেষ্টা করুন।"
      : "No niches match the {format} format — try another tab.",
    format_image: isBn ? "ছবি" : "image",
    format_vector: isBn ? "ভেক্টর" : "vector",
    format_video: isBn ? "ভিডিও" : "video",
    format_pod: isBn ? "POD" : "POD",
  };
}

const sectionStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: "16px 18px",
  marginBottom: 18,
};

const sectionHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 4,
  flexWrap: "wrap",
  gap: 8,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: "var(--text)",
};

const sectionDescStyle = {
  margin: 0,
  fontSize: 12,
  color: "var(--text3)",
  lineHeight: 1.5,
};
