"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import {
  Camera, Image as ImageIcon, Palette, Video, MessageSquare, BookOpen,
  RefreshCw, AlertCircle, KeyRound,
} from "lucide-react";

// ─── Source config ──────────────────────────────────────────────────
//
// Each source is a row in the section. The endpoint is fetched ONLY
// when the user clicks the per-source "Load" button — never on mount.
// 24h server-side cache means most clicks return instantly with
// `cached:true`.

const SOURCES = [
  {
    id: "pixabay",
    icon: Camera,
    color: "#10b981",
    endpoint: "/api/market-trends/pixabay",
    descKey: "pixabayDesc",
    needsKey: true,
  },
  {
    id: "pexels",
    icon: Camera,
    color: "#3b82f6",
    endpoint: "/api/market-trends/pexels",
    descKey: "pexelsDesc",
    needsKey: true,
  },
  {
    id: "reddit",
    icon: MessageSquare,
    color: "#f97316",
    endpoint: "/api/market-trends/reddit",
    descKey: "redditDesc",
    needsKey: false,
  },
  {
    id: "wikipedia",
    icon: BookOpen,
    color: "#a855f7",
    endpoint: "/api/market-trends/wikipedia",
    descKey: "wikipediaDesc",
    needsKey: false,
  },
];

function emptyState() {
  return { loading: false, items: [], fetchedAt: null, cached: false, stale: false, error: null, configured: true };
}

export default function MarketplaceTrendsSection({ generatorHrefFor }) {
  const { lang } = useLanguage();

  const labels = {
    title: lang === "bn" ? "Real Marketplace Trends — সরাসরি লাইভ ডেটা" : "Real Marketplace Trends — live data",
    desc: lang === "bn"
      ? "Pixabay, Pexels, Reddit, Wikipedia থেকে সরাসরি ডেটা — ব্যবহারকারী 'Load' বাটন না চাপলে কোনো API call হবে না (quota-conscious)। প্রতি source ২৪ ঘণ্টা পর্যন্ত cached থাকে।"
      : "Live data from Pixabay, Pexels, Reddit, Wikipedia — no API call until you click Load (quota-conscious). Each source is cached for up to 24 hours server-side.",
    pixabayDesc: lang === "bn"
      ? "Pixabay-এর সবচেয়ে বেশি ডাউনলোড হওয়া স্টক ছবি / ভেক্টর — real download counts।"
      : "Pixabay's most-downloaded stock photos / vectors — real download counts.",
    pexelsDesc: lang === "bn"
      ? "Pexels editor-curated প্রতিদিনের ছবি ও জনপ্রিয় ভিডিও।"
      : "Pexels editor-curated daily photos and popular videos.",
    redditDesc: lang === "bn"
      ? "r/cottagecore, r/InteriorDesign ইত্যাদি — ৬-১২ সপ্তাহ আগের aesthetic signal।"
      : "r/cottagecore, r/InteriorDesign and friends — 6-12 week-ahead aesthetic signal.",
    wikipediaDesc: lang === "bn"
      ? "Wikipedia-এর সবচেয়ে বেশি দেখা পেজ আজ — culture / festival / viral signal।"
      : "Wikipedia's most-viewed pages today — culture / festival / viral signal.",
    load: lang === "bn" ? "লোড করুন" : "Load",
    reload: lang === "bn" ? "পুনরায় লোড" : "Reload",
    loading: lang === "bn" ? "লোড হচ্ছে..." : "Loading...",
    cached: lang === "bn" ? "ক্যাশ থেকে" : "from cache",
    fresh: lang === "bn" ? "তাজা" : "fresh",
    stale: lang === "bn" ? "পুরোনো ক্যাশ" : "stale cache",
    notConfigured: lang === "bn" ? "API key যোগ করুন" : "Add API key",
    errorPrefix: lang === "bn" ? "ত্রুটি" : "Error",
    items: lang === "bn" ? "টা আইটেম" : "items",
    notLoaded: lang === "bn" ? "এখনও লোড হয়নি — Load ক্লিক করুন" : "Not loaded yet — click Load",
    fetchedAt: lang === "bn" ? "শেষ লোড" : "Last fetched",
    image: lang === "bn" ? "ছবি" : "Image",
    vector: lang === "bn" ? "ভেক্টর" : "Vector",
    video: lang === "bn" ? "ভিডিও" : "Video",
    views: lang === "bn" ? "ভিউ" : "views",
    downloads: lang === "bn" ? "ডাউনলোড" : "downloads",
    open: lang === "bn" ? "Source-এ দেখুন" : "View on source",
  };

  const [state, setState] = useState(() => {
    const init = {};
    for (const s of SOURCES) init[s.id] = emptyState();
    return init;
  });

  const setSource = (id, patch) => setState(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const loadSource = async (source) => {
    setSource(source.id, { loading: true, error: null });
    try {
      const res = await fetch(source.endpoint, { credentials: "same-origin" });
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

  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Camera size={16} color="#10b981" />
          <h2 style={sectionTitleStyle}>{labels.title}</h2>
        </div>
      </div>
      <p style={sectionDescStyle}>{labels.desc}</p>

      <div style={{
        display: "grid", gap: 12, marginTop: 12,
      }}>
        {SOURCES.map(source => {
          const s = state[source.id];
          const Icon = source.icon;
          const status = s.loading ? "loading"
            : s.error ? "error"
            : !s.configured ? "missing"
            : s.fetchedAt ? (s.stale ? "stale" : (s.cached ? "cached" : "fresh"))
            : "idle";
          const desc = labels[source.descKey] || "";

          return (
            <div key={source.id} style={{
              border: "1px solid var(--border)", borderRadius: 10,
              background: "var(--card)", overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px",
                borderBottom: s.items.length > 0 ? "1px dashed var(--border)" : "none",
                background: `linear-gradient(135deg, ${source.color}10, transparent)`,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: `${source.color}1f`, color: source.color,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h3 style={{
                      margin: 0, fontSize: 13, fontWeight: 800, color: "var(--text)",
                      textTransform: "capitalize",
                    }}>{source.id}</h3>
                    <StatusPill status={status} labels={labels} />
                  </div>
                  <p style={{
                    margin: "2px 0 0", fontSize: 11, color: "var(--text3)", lineHeight: 1.4,
                  }}>{desc}</p>
                </div>
                <button type="button"
                  onClick={() => loadSource(source)}
                  disabled={s.loading || (!s.configured && source.needsKey)}
                  style={{
                    padding: "7px 14px", borderRadius: 8,
                    border: `1px solid ${source.color}`,
                    background: s.fetchedAt ? "var(--card)" : source.color,
                    color: s.fetchedAt ? source.color : "white",
                    fontSize: 11, fontWeight: 700, cursor: s.loading ? "wait" : "pointer",
                    opacity: (!s.configured && source.needsKey) ? 0.5 : 1,
                    display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0,
                  }}>
                  <RefreshCw size={11} style={{ animation: s.loading ? "spin 1s linear infinite" : undefined }} />
                  {s.loading ? labels.loading : (s.fetchedAt ? labels.reload : labels.load)}
                </button>
              </div>

              {/* Body */}
              {s.error && (
                <div style={{
                  padding: "10px 14px", fontSize: 11,
                  background: "rgba(239,68,68,0.08)", color: "#ef4444",
                  display: "flex", alignItems: "flex-start", gap: 6,
                }}>
                  <AlertCircle size={12} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span>{labels.errorPrefix}: {s.error}</span>
                </div>
              )}

              {s.fetchedAt && s.items.length > 0 && (
                <>
                  <div style={{
                    padding: "8px 14px", fontSize: 10, color: "var(--text4)",
                    display: "flex", justifyContent: "space-between",
                  }}>
                    <span>{s.items.length} {labels.items}</span>
                    <span>{labels.fetchedAt}: {new Date(s.fetchedAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-US")}</span>
                  </div>
                  <div style={{
                    padding: "0 14px 14px",
                    display: "grid", gap: 10,
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  }}>
                    {s.items.slice(0, 24).map((it, i) => (
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

              {!s.fetchedAt && !s.error && !s.loading && (
                <div style={{
                  padding: "10px 14px", fontSize: 11, color: "var(--text4)",
                  textAlign: "center",
                }}>
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
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 7px", borderRadius: 4,
      fontSize: 9, fontWeight: 700,
      background: cfg.bg, color: cfg.color,
    }}>
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
    <div style={{
      border: "1px solid var(--border)", borderRadius: 8,
      background: "var(--bg)",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.preview || item.image} alt={item.alt || item.title || ""}
          loading="lazy" referrerPolicy="no-referrer"
          style={{
            width: "100%", aspectRatio: "4 / 3", objectFit: "cover",
            background: "var(--bg2)", display: "block",
          }}
          onError={(e) => { e.currentTarget.style.display = "none"; }} />
      ) : (
        <div style={{
          width: "100%", aspectRatio: "4 / 3",
          background: "var(--bg2)", display: "flex",
          alignItems: "center", justifyContent: "center",
          color: "var(--text4)",
        }}>
          <ImageIcon size={28} />
        </div>
      )}
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: "var(--text)", lineHeight: 1.3,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>{titleForSeed || "—"}</div>
        {stats.length > 0 && (
          <div style={{ fontSize: 10, color: sourceColor, fontWeight: 600 }}>
            {stats.join(" · ")}
          </div>
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
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              style={chipStyle("#6b7280")}>
              {labels.open}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function chipStyle(color) {
  return {
    display: "inline-flex", alignItems: "center", gap: 3,
    padding: "4px 8px", borderRadius: 6,
    background: `${color}1c`, color,
    fontSize: 10, fontWeight: 700, textDecoration: "none",
  };
}

function formatNumber(n) {
  if (typeof n !== "number") return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const sectionStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: "16px 18px",
  marginBottom: 18,
};

const sectionHeaderStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  marginBottom: 4, flexWrap: "wrap", gap: 8,
};

const sectionTitleStyle = {
  margin: 0, fontSize: 15, fontWeight: 800, color: "var(--text)",
};

const sectionDescStyle = {
  margin: "4px 0 0", fontSize: 12, color: "var(--text2)", lineHeight: 1.5,
};
