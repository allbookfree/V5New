"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useApiKeys } from "@/context/ApiKeyContext";
import { filterByFormat } from "@/lib/marketTrendsFormats";
import {
  Camera, Image as ImageIcon, Palette, Video, MessageSquare, BookOpen,
  RefreshCw, AlertCircle, KeyRound, Settings, Sparkles, TrendingUp,
} from "lucide-react";

import AnalysisPanel from "./AnalysisPanel";

// ─── Source config ──────────────────────────────────────────────────
//
// Each source is a row in the section. The endpoint is fetched ONLY
// when the user clicks the per-source "Load" button — never on mount.
// 24h server-side cache means most clicks return instantly with
// `cached:true`.
//
// `tier`:
//   - "sales"   = direct demand signal (real download counts /
//                  editorial curation / aesthetic early-warning).
//                  These are what creators should actually act on.
//   - "context" = cultural / news barometer (what's culturally hot,
//                  but not directly a stock-sales indicator).
//
// `needsKey` controls whether we must send a key from the user's
// API Keys panel; if missing we show "Add API key in Settings".

const SOURCES = [
  {
    id: "pixabay",
    icon: Camera,
    color: "#10b981",
    endpoint: "/api/market-trends/pixabay",
    descKey: "pixabayDesc",
    needsKey: true,
    tier: "sales",
    method: "POST",
    keyProvider: "pixabay",
  },
  {
    id: "pexels",
    icon: Camera,
    color: "#3b82f6",
    endpoint: "/api/market-trends/pexels",
    descKey: "pexelsDesc",
    needsKey: true,
    tier: "sales",
    method: "POST",
    keyProvider: "pexels",
  },
  {
    id: "reddit",
    icon: MessageSquare,
    color: "#f97316",
    endpoint: "/api/market-trends/reddit",
    descKey: "redditDesc",
    needsKey: false,
    tier: "sales",
    method: "GET",
  },
  {
    id: "wikipedia",
    icon: BookOpen,
    color: "#a855f7",
    endpoint: "/api/market-trends/wikipedia",
    descKey: "wikipediaDesc",
    needsKey: false,
    tier: "context",
    method: "GET",
  },
];

function emptyState() {
  return { loading: false, items: [], fetchedAt: null, cached: false, stale: false, error: null, configured: true };
}

export default function MarketplaceTrendsSection({
  generatorHrefFor,
  formatTab = "all",
  onOpenSettings,
}) {
  const { lang } = useLanguage();
  const { getAllKeys } = useApiKeys();

  const labels = useMemo(() => buildLabels(lang), [lang]);

  const [state, setState] = useState(() => {
    const init = {};
    for (const s of SOURCES) init[s.id] = emptyState();
    return init;
  });

  const setSource = (id, patch) =>
    setState((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const loadSource = async (source) => {
    setSource(source.id, { loading: true, error: null });
    try {
      let res;
      if (source.method === "POST") {
        const keys = source.keyProvider ? getAllKeys(source.keyProvider).filter(Boolean) : [];
        if (source.needsKey && keys.length === 0) {
          // Don't even hit the server — show the "Add key" CTA.
          setSource(source.id, {
            loading: false,
            configured: false,
            items: [],
            fetchedAt: null,
            error: null,
          });
          return;
        }
        res = await fetch(source.endpoint, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKeys: keys }),
        });
      } else {
        res = await fetch(source.endpoint, { credentials: "same-origin" });
      }
      const json = await res.json();
      setSource(source.id, {
        loading: false,
        items: Array.isArray(json.items) ? json.items : [],
        fetchedAt: json.fetchedAt || null,
        cached: !!json.cached,
        stale: !!json.stale,
        configured: json.configured !== false,
        error: json.ok === false ? (json.error || "Upstream returned no items") : null,
      });
    } catch (e) {
      setSource(source.id, {
        loading: false,
        error: String(e?.message || e),
      });
    }
  };

  // Prefer sales-tier sources first, then context-tier — matches the
  // user's feedback that we should foreground "what's actually selling"
  // and demote pure cultural / news signals.
  const orderedSources = useMemo(
    () => [
      ...SOURCES.filter((s) => s.tier === "sales"),
      ...SOURCES.filter((s) => s.tier === "context"),
    ],
    []
  );

  const pixabayState = state.pixabay;
  const nicheGap = useMemo(
    () => (pixabayState.items.length > 0 ? computeNicheGap(pixabayState.items) : null),
    [pixabayState.items]
  );

  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Camera size={16} color="#10b981" />
          <h2 style={sectionTitleStyle}>{labels.title}</h2>
        </div>
      </div>
      <p style={sectionDescStyle}>{labels.desc}</p>

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {orderedSources.map((source) => {
          const s = state[source.id];
          const items = filterByFormat(s.items, formatTab);
          const Icon = source.icon;
          const status = s.loading
            ? "loading"
            : s.error
            ? "error"
            : !s.configured
            ? "missing"
            : s.fetchedAt
            ? s.stale
              ? "stale"
              : s.cached
              ? "cached"
              : "fresh"
            : "idle";
          const desc = labels[source.descKey] || "";

          return (
            <div
              key={source.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                background: "var(--card)",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderBottom: items.length > 0 ? "1px dashed var(--border)" : "none",
                  background: `linear-gradient(135deg, ${source.color}10, transparent)`,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: `${source.color}1f`,
                    color: source.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 800,
                        color: "var(--text)",
                        textTransform: "capitalize",
                      }}
                    >
                      {source.id}
                    </h3>
                    {source.tier === "sales" ? (
                      <span style={tierTag("#10b981")}>
                        <TrendingUp size={9} /> {labels.tierSales}
                      </span>
                    ) : (
                      <span style={tierTag("#a855f7")}>
                        <Sparkles size={9} /> {labels.tierContext}
                      </span>
                    )}
                    <StatusPill status={status} labels={labels} />
                  </div>
                  <p
                    style={{
                      margin: "2px 0 0",
                      fontSize: 11,
                      color: "var(--text3)",
                      lineHeight: 1.4,
                    }}
                  >
                    {desc}
                  </p>
                </div>
                {!s.configured && source.needsKey ? (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 8,
                      border: "1px solid #f59e0b",
                      background: "#f59e0b",
                      color: "white",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <Settings size={11} />
                    {labels.addKeyButton}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => loadSource(source)}
                    disabled={s.loading}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 8,
                      border: `1px solid ${source.color}`,
                      background: s.fetchedAt ? "var(--card)" : source.color,
                      color: s.fetchedAt ? source.color : "white",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: s.loading ? "wait" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <RefreshCw
                      size={11}
                      style={{ animation: s.loading ? "spin 1s linear infinite" : undefined }}
                    />
                    {s.loading ? labels.loading : s.fetchedAt ? labels.reload : labels.load}
                  </button>
                )}
              </div>

              {/* Body */}
              {s.error && (
                <div
                  style={{
                    padding: "10px 14px",
                    fontSize: 11,
                    background: "rgba(239,68,68,0.08)",
                    color: "#ef4444",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 6,
                  }}
                >
                  <AlertCircle size={12} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span>
                    {labels.errorPrefix}: {s.error}
                  </span>
                </div>
              )}

              {!s.configured && source.needsKey && !s.loading && !s.error && (
                <div
                  style={{
                    padding: "12px 14px",
                    fontSize: 12,
                    background: "rgba(245,158,11,0.08)",
                    color: "var(--text)",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <KeyRound size={12} color="#f59e0b" />
                    <strong>{labels.keyMissingTitle}</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text2)", lineHeight: 1.5 }}>
                    {labels.keyMissingDesc}
                  </p>
                </div>
              )}

              {/* Pixabay-only niche gap insight */}
              {source.id === "pixabay" && nicheGap && nicheGap.items.length > 0 && (
                <div
                  style={{
                    padding: "10px 14px",
                    background:
                      "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: "#10b981",
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                      marginBottom: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <TrendingUp size={11} /> {labels.nicheGapTitle}
                  </div>
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontSize: 11,
                      color: "var(--text3)",
                      lineHeight: 1.5,
                    }}
                  >
                    {labels.nicheGapDesc}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    {nicheGap.items.slice(0, 6).map((g, i) => (
                      <Link
                        key={`gap-${i}`}
                        href={generatorHrefFor(g.title, "image")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "5px 10px",
                          borderRadius: 999,
                          background: "rgba(16,185,129,0.12)",
                          color: "#10b981",
                          fontSize: 11,
                          fontWeight: 700,
                          textDecoration: "none",
                          border: "1px solid rgba(16,185,129,0.3)",
                        }}
                        title={`${labels.nicheGapRatio}: ${g.ratio.toFixed(2)} (${formatNumber(g.downloads)} dl / ${formatNumber(g.views)} views)`}
                      >
                        <TrendingUp size={10} /> {g.title} <span style={{ fontSize: 10, opacity: 0.7 }}>·{g.ratio.toFixed(2)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {s.fetchedAt && items.length > 0 && (
                <>
                  <div
                    style={{
                      padding: "8px 14px",
                      fontSize: 10,
                      color: "var(--text4)",
                      display: "flex",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    <span>
                      {items.length} {labels.items}
                      {formatTab !== "all" && (
                        <span style={{ marginLeft: 6, opacity: 0.7 }}>
                          ({labels.filteredFor.replace("{format}", labels[`format_${formatTab}`] || formatTab)})
                        </span>
                      )}
                    </span>
                    <span>
                      {labels.fetchedAt}:{" "}
                      {new Date(s.fetchedAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-US")}
                    </span>
                  </div>
                  <div
                    style={{
                      padding: "0 14px 14px",
                      display: "grid",
                      gap: 10,
                      gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    }}
                  >
                    {items.slice(0, 24).map((it, i) => (
                      <ItemCard
                        key={`${it.url || it.title}-${i}`}
                        item={it}
                        sourceColor={source.color}
                        labels={labels}
                        generatorHrefFor={generatorHrefFor}
                      />
                    ))}
                  </div>
                </>
              )}

              {s.fetchedAt && items.length === 0 && s.items.length > 0 && (
                <div
                  style={{
                    padding: "12px 14px",
                    fontSize: 11,
                    color: "var(--text4)",
                    textAlign: "center",
                  }}
                >
                  {labels.noItemsForFormat.replace("{format}", labels[`format_${formatTab}`] || formatTab)}
                </div>
              )}

              {!s.fetchedAt && !s.error && !s.loading && (s.configured || !source.needsKey) && (
                <div
                  style={{
                    padding: "10px 14px",
                    fontSize: 11,
                    color: "var(--text4)",
                    textAlign: "center",
                  }}
                >
                  {labels.notLoaded}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function buildLabels(lang) {
  return {
    title: lang === "bn"
      ? "Real Marketplace Trends — সরাসরি লাইভ ডেটা"
      : "Real Marketplace Trends — live data",
    desc: lang === "bn"
      ? "Pixabay (real downloads), Pexels (editor-curated), Reddit (early aesthetic) এবং Wikipedia (cultural context) — ব্যবহারকারী 'Load' বাটন না চাপলে কোনো API call হবে না (quota-conscious)। প্রতি source ২৪ ঘণ্টা cached থাকে।"
      : "Pixabay (real downloads), Pexels (editor-curated), Reddit (early aesthetic), and Wikipedia (cultural context) — no API call until you click Load (quota-conscious). Each source is cached for 24h.",
    pixabayDesc: lang === "bn"
      ? "Pixabay-এর সবচেয়ে বেশি ডাউনলোড হওয়া স্টক ছবি / ভেক্টর — প্রতি asset-এ আসল download / view count, সরাসরি বিক্রির signal।"
      : "Pixabay's most-downloaded stock photos / vectors — real download / view counts per asset, the strongest direct demand signal.",
    pexelsDesc: lang === "bn"
      ? "Pexels editor-curated প্রতিদিনের ছবি ও জনপ্রিয় ভিডিও — photo industry এখন কী trending মনে করছে।"
      : "Pexels editor-curated daily photos and popular videos — what the photo industry currently considers trending.",
    redditDesc: lang === "bn"
      ? "r/cottagecore, r/InteriorDesign, r/Etsy ইত্যাদি — stock platform-এ আসার ৬-১২ সপ্তাহ আগের aesthetic / lifestyle signal।"
      : "r/cottagecore, r/InteriorDesign, r/Etsy and friends — aesthetic / lifestyle signal that lands on stock platforms 6–12 weeks later.",
    wikipediaDesc: lang === "bn"
      ? "Wikipedia-এর সবচেয়ে বেশি দেখা পেজ আজ — culture / festival / viral signal (সরাসরি বিক্রির signal না — context only)।"
      : "Wikipedia's most-viewed pages today — culture / festival / viral signal (not a direct sales signal — context only).",
    load: lang === "bn" ? "লোড করুন" : "Load",
    reload: lang === "bn" ? "পুনরায় লোড" : "Reload",
    loading: lang === "bn" ? "লোড হচ্ছে..." : "Loading...",
    cached: lang === "bn" ? "ক্যাশ থেকে" : "from cache",
    fresh: lang === "bn" ? "তাজা" : "fresh",
    stale: lang === "bn" ? "পুরোনো ক্যাশ" : "stale cache",
    notConfigured: lang === "bn" ? "API key যোগ করুন" : "Add API key",
    addKeyButton: lang === "bn" ? "Settings-এ key যোগ" : "Add key in Settings",
    keyMissingTitle: lang === "bn" ? "API key যোগ করতে হবে" : "API key required",
    keyMissingDesc: lang === "bn"
      ? "Sidebar → API Keys-এ গিয়ে এই source-এর জন্য একটা ফ্রি key paste করুন। Pixabay: https://pixabay.com/api/docs/  |  Pexels: https://www.pexels.com/api/new/"
      : "Open the API Keys panel from the sidebar and paste a free key for this source. Pixabay: https://pixabay.com/api/docs/  |  Pexels: https://www.pexels.com/api/new/",
    errorPrefix: lang === "bn" ? "ত্রুটি" : "Error",
    items: lang === "bn" ? "টা আইটেম" : "items",
    notLoaded: lang === "bn" ? "এখনও লোড হয়নি — Load ক্লিক করুন" : "Not loaded yet — click Load",
    fetchedAt: lang === "bn" ? "শেষ লোড" : "Last fetched",
    image: lang === "bn" ? "ছবি" : "Image",
    vector: lang === "bn" ? "ভেক্টর" : "Vector",
    video: lang === "bn" ? "ভিডিও" : "Video",
    pod: lang === "bn" ? "POD" : "POD",
    views: lang === "bn" ? "ভিউ" : "views",
    downloads: lang === "bn" ? "ডাউনলোড" : "downloads",
    open: lang === "bn" ? "Source-এ দেখুন" : "View on source",
    analyze: lang === "bn" ? "AI Analyze" : "AI Analyze",
    tierSales: lang === "bn" ? "Sales signal" : "Sales signal",
    tierContext: lang === "bn" ? "Context only" : "Context only",
    nicheGapTitle: lang === "bn" ? "সম্ভাব্য niche-gap (high download / view ratio)" : "Likely niche gaps (high download / view ratio)",
    nicheGapDesc: lang === "bn"
      ? "এই keywords-এ download কাউন্ট viewing-এর তুলনায় বেশি — মানে ভিউ করতে দেখলেই মানুষ ডাউনলোড করছে = অপেক্ষাকৃত কম supply, সরাসরি কেনার আগ্রহ। এই শব্দগুলোয় আপনার কনটেন্ট তৈরির high-value সুযোগ।"
      : "On these keywords, downloads outpace views — viewers convert to downloaders = lower supply, real buying intent. These are high-value gaps to make content for.",
    nicheGapRatio: lang === "bn" ? "ডাউনলোড / ভিউ অনুপাত" : "Download / view ratio",
    filteredFor: lang === "bn" ? "{format}-এর জন্য ফিল্টার করা" : "filtered for {format}",
    noItemsForFormat: lang === "bn"
      ? "{format} format-এর জন্য কোনো আইটেম মিলেনি — অন্য tab চেষ্টা করুন।"
      : "No items match the {format} format — try another tab.",
    format_image: lang === "bn" ? "ছবি" : "image",
    format_vector: lang === "bn" ? "ভেক্টর" : "vector",
    format_video: lang === "bn" ? "ভিডিও" : "video",
    format_pod: lang === "bn" ? "POD" : "POD",
  };
}

function tierTag(color) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    padding: "2px 7px",
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 700,
    background: `${color}1c`,
    color,
    border: `1px solid ${color}40`,
  };
}

function StatusPill({ status, labels }) {
  const map = {
    loading: { bg: "rgba(99,102,241,0.15)", color: "#6366f1", text: labels.loading },
    error: { bg: "rgba(239,68,68,0.15)", color: "#ef4444", text: labels.errorPrefix },
    missing: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b", text: labels.notConfigured, icon: KeyRound },
    cached: { bg: "rgba(16,185,129,0.15)", color: "#10b981", text: labels.cached },
    fresh: { bg: "rgba(34,197,94,0.15)", color: "#22c55e", text: labels.fresh },
    stale: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b", text: labels.stale },
    idle: null,
  };
  const cfg = map[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 7px",
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 700,
        background: cfg.bg,
        color: cfg.color,
      }}
    >
      {Icon ? <Icon size={9} /> : null}
      {cfg.text}
    </span>
  );
}

function ItemCard({ item, sourceColor, labels, generatorHrefFor }) {
  const titleForSeed = (item.title || item.tags?.[0] || item.alt || "").trim();
  const stats = [];
  if (typeof item.downloads === "number") stats.push(`${formatNumber(item.downloads)} ${labels.downloads}`);
  if (typeof item.views === "number" && item.views > 0) stats.push(`${formatNumber(item.views)} ${labels.views}`);
  if (typeof item.score === "number" && item.score > 0) stats.push(`▲ ${formatNumber(item.score)}`);

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
          src={item.preview || item.image}
          alt={item.alt || item.title || ""}
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
          <ImageIcon size={28} />
        </div>
      )}
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
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
          {titleForSeed || "—"}
        </div>
        {stats.length > 0 && (
          <div style={{ fontSize: 10, color: sourceColor, fontWeight: 600 }}>{stats.join(" · ")}</div>
        )}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: "auto" }}>
          <Link href={generatorHrefFor(titleForSeed, "image")} style={chipStyle("#6366f1")}>
            <ImageIcon size={10} /> {labels.image}
          </Link>
          <Link href={generatorHrefFor(titleForSeed, "vector")} style={chipStyle("#06b6d4")}>
            <Palette size={10} /> {labels.vector}
          </Link>
          <Link href={generatorHrefFor(titleForSeed, "video")} style={chipStyle("#f97316")}>
            <Video size={10} /> {labels.video}
          </Link>
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" style={chipStyle("#6b7280")}>
              {labels.open}
            </a>
          )}
        </div>
        <AnalysisPanel query={titleForSeed} compact />
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

function formatNumber(n) {
  if (typeof n !== "number") return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Niche-gap helper ───────────────────────────────────────────────
//
// On Pixabay, the real demand signal is the (downloads / views) ratio.
// A high ratio means viewers immediately download — i.e. someone with
// the same taste as the searcher is willing to take it home. A low
// ratio means people look but don't take it (maybe oversupplied or
// undifferentiated).
//
// We rank items with views >= 200 (filters out brand-new uploads with
// no statistics) and downloads >= 50, sorted by ratio descending.
// Returns { items: [{ title, ratio, downloads, views }] }.

function computeNicheGap(items) {
  if (!Array.isArray(items)) return { items: [] };
  const candidates = items
    .filter(
      (it) =>
        typeof it.views === "number" &&
        it.views >= 200 &&
        typeof it.downloads === "number" &&
        it.downloads >= 50 &&
        typeof it.title === "string" &&
        it.title.trim().length > 0
    )
    .map((it) => ({
      title: it.title,
      downloads: it.downloads,
      views: it.views,
      ratio: it.downloads / it.views,
    }))
    .sort((a, b) => b.ratio - a.ratio);

  // Dedupe by lowercase title to avoid showing the same niche twice.
  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    const key = c.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
    if (unique.length >= 12) break;
  }
  return { items: unique };
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
