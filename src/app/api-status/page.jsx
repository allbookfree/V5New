"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useApiKeys } from "@/context/ApiKeyContext";
import { useLanguage } from "@/context/LanguageContext";
import ProviderHealthWidget from "@/components/ProviderHealthWidget";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Settings,
  Key,
  Zap,
  Shield,
  Clock,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
} from "lucide-react";

/* ─── Provider Config ─────────────────────────────────────────────── */
const PROVIDERS = [
  { key: "gemini", label: "Gemini", emoji: "🔵", color: "#4285F4", gradient: "linear-gradient(135deg, #4285F4 0%, #34A853 100%)" },
  { key: "groq", label: "Groq", emoji: "🔴", color: "#F55036", gradient: "linear-gradient(135deg, #F55036 0%, #FF8C42 100%)" },
  { key: "mistral", label: "Mistral AI", emoji: "🟠", color: "#FF7000", gradient: "linear-gradient(135deg, #FF7000 0%, #FFB300 100%)" },
  { key: "openrouter", label: "OpenRouter", emoji: "🟣", color: "#7C3AED", gradient: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)" },
  { key: "huggingface", label: "HuggingFace", emoji: "🟡", color: "#FFBD59", gradient: "linear-gradient(135deg, #FFBD59 0%, #FF9800 100%)" },
  { key: "cerebras", label: "Cerebras", emoji: "⚡", color: "#EF4444", gradient: "linear-gradient(135deg, #EF4444 0%, #F87171 100%)" },
  { key: "nvidia", label: "NVIDIA NIM", emoji: "🟢", color: "#22C55E", gradient: "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)" },
  { key: "github", label: "GitHub Models", emoji: "🔘", color: "#6E5494", gradient: "linear-gradient(135deg, #6E5494 0%, #8B949E 100%)" },
];

/* ─── Helpers ─────────────────────────────────────────────────────── */
function maskKey(key) {
  if (!key || key.length < 8) return "•".repeat(key?.length || 6);
  return key.slice(0, 6) + "•".repeat(Math.max(key.length - 10, 4)) + key.slice(-4);
}

function timeAgo(ts, now) {
  if (!ts) return "";
  const diff = now - ts;
  if (diff < 10000) return "just now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

/*
 * ─── REAL API Test ───────────────────────────────────────────────
 * This calls OUR server-side route /api/test-key which makes a
 * REAL generation request (not just listing models).
 * This catches actual rate limits that GET /models would miss.
 */
async function testApiKey(provider, key) {
  try {
    const res = await fetch("/api/test-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, key }),
    });
    const data = await res.json();
    return data; // { status, message?, serverMessage? }
  } catch {
    return { status: "offline", message: "Could not reach server" };
  }
}

/* ─── Status Info (Honest, Simple, Bilingual) ─────────────────────── */
function getStatusInfo(status, serverMessage, t) {
  switch (status) {
    case "working":
      return {
        icon: <CheckCircle2 size={14} />,
        label: t("apiDash.active"),
        message: `✅ ${t("apiDash.activeDesc")}`,
        color: "#10B981",
        bg: "rgba(16, 185, 129, 0.12)",
        border: "rgba(16, 185, 129, 0.3)",
        rowBg: "rgba(16, 185, 129, 0.04)",
      };
    case "rate":
      return {
        icon: <Clock size={14} />,
        label: t("apiDash.limitReached"),
        message: `⏱ ${t("apiDash.limitDesc")}${serverMessage ? `\n📋 ${serverMessage}` : ""}`,
        color: "#F59E0B",
        bg: "rgba(245, 158, 11, 0.12)",
        border: "rgba(245, 158, 11, 0.3)",
        rowBg: "rgba(245, 158, 11, 0.05)",
      };
    case "invalid":
      return {
        icon: <XCircle size={14} />,
        label: t("apiDash.invalid"),
        message: `🔴 ${t("apiDash.invalidDesc")}${serverMessage ? `\n📋 ${serverMessage}` : ""}`,
        color: "#EF4444",
        bg: "rgba(239, 68, 68, 0.12)",
        border: "rgba(239, 68, 68, 0.3)",
        rowBg: "rgba(239, 68, 68, 0.04)",
      };
    case "error":
      return {
        icon: <AlertTriangle size={14} />,
        label: t("apiDash.errorLabel"),
        message: `⚠️ ${t("apiDash.errorLabel")}${serverMessage ? `\n📋 ${serverMessage}` : ""}`,
        color: "#F97316",
        bg: "rgba(249, 115, 22, 0.12)",
        border: "rgba(249, 115, 22, 0.3)",
        rowBg: "rgba(249, 115, 22, 0.04)",
      };
    case "offline":
      return {
        icon: <WifiOff size={14} />,
        label: t("apiDash.offline"),
        message: `📡 ${t("apiDash.offline")}`,
        color: "#6B7280",
        bg: "rgba(107, 114, 128, 0.12)",
        border: "rgba(107, 114, 128, 0.3)",
        rowBg: "rgba(107, 114, 128, 0.04)",
      };
    case "testing":
      return {
        icon: <RefreshCw size={14} className="api-spin" />,
        label: t("apiDash.checking"),
        message: null,
        color: "#6366F1",
        bg: "rgba(99, 102, 241, 0.12)",
        border: "rgba(99, 102, 241, 0.3)",
        rowBg: "rgba(99, 102, 241, 0.04)",
      };
    default:
      return {
        icon: <HelpCircle size={14} />,
        label: t("apiDash.notChecked"),
        message: t("apiDash.notCheckedDesc"),
        color: "var(--text3)",
        bg: "rgba(107, 114, 128, 0.08)",
        border: "rgba(107, 114, 128, 0.15)",
        rowBg: "transparent",
      };
  }
}

function getStatusColor(status) {
  switch (status) {
    case "working": return "#10B981";
    case "invalid": return "#EF4444";
    case "rate": return "#F59E0B";
    case "error": return "#F97316";
    case "testing": return "#6366F1";
    case "offline": return "#6B7280";
    default: return "var(--text3)";
  }
}

/* ─── Health Bar ──────────────────────────────────────────────────── */
function HealthBar({ working, rate, failed, total }) {
  if (total === 0) return null;
  const wPct = (working / total) * 100;
  const rPct = (rate / total) * 100;
  const fPct = (failed / total) * 100;
  return (
    <div style={{ display: "flex", height: "6px", borderRadius: "3px", overflow: "hidden", background: "var(--bg)", width: "100%", gap: "1px" }}>
      {wPct > 0 && <div style={{ width: `${wPct}%`, background: "#10B981", borderRadius: "3px", transition: "width 0.5s ease" }} />}
      {rPct > 0 && <div style={{ width: `${rPct}%`, background: "#F59E0B", borderRadius: "3px", transition: "width 0.5s ease" }} />}
      {fPct > 0 && <div style={{ width: `${fPct}%`, background: "#EF4444", borderRadius: "3px", transition: "width 0.5s ease" }} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function ApiStatusPage() {
  const { keys, getAllKeys } = useApiKeys();
  const { t } = useLanguage();


  const [keyData, setKeyData] = useState({});
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [checkProgress, setCheckProgress] = useState({ done: 0, total: 0 });
  const [lastFullCheck, setLastFullCheck] = useState(null);
  const [timeNow, setTimeNow] = useState(() => Date.now());
  const isCheckingRef = useRef(false);

  const allKeys = PROVIDERS.flatMap((p) =>
    (getAllKeys(p.key) || []).map((k, i) => ({ provider: p, key: k, idx: i, id: `${p.key}:${i}` }))
  );

  const totalKeys = allKeys.length;
  const workingCount = allKeys.filter((k) => keyData[k.id]?.status === "working").length;
  const failedCount = allKeys.filter((k) => ["invalid", "error", "offline"].includes(keyData[k.id]?.status)).length;
  const rateLimitedCount = allKeys.filter((k) => keyData[k.id]?.status === "rate").length;
  const untestedCount = allKeys.filter((k) => !keyData[k.id]?.status).length;
  const hasAnyKeys = totalKeys > 0;
  const testedCount = totalKeys - untestedCount;
  const healthPct = testedCount > 0 ? Math.round((workingCount / testedCount) * 100) : 0;

  useEffect(() => {
    const t = setInterval(() => setTimeNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  /* ─── Manual Check All ──────────────────────────────────────── */
  const runCheck = useCallback(async (keysList) => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsCheckingAll(true);
    setCheckProgress({ done: 0, total: keysList.length });

    const initial = {};
    for (const { id } of keysList) initial[id] = { status: "testing" };
    setKeyData((prev) => ({ ...prev, ...initial }));

    let done = 0;
    for (const { provider, key, id } of keysList) {
      if (!key || !key.trim()) {
        setKeyData((prev) => ({ ...prev, [id]: { status: "invalid", checkedAt: Date.now() } }));
        done++;
        setCheckProgress({ done, total: keysList.length });
        continue;
      }
      const result = await testApiKey(provider.key, key);
      setKeyData((prev) => ({
        ...prev,
        [id]: { status: result.status, serverMessage: result.serverMessage || "", checkedAt: Date.now() },
      }));
      done++;
      setCheckProgress({ done, total: keysList.length });
    }

    setLastFullCheck(Date.now());
    setIsCheckingAll(false);
    isCheckingRef.current = false;
  }, []);

  /* ─── Manual Check Single ───────────────────────────────────── */
  const checkSingleKey = useCallback(async (providerKey, key, id) => {
    setKeyData((prev) => ({ ...prev, [id]: { status: "testing" } }));
    if (!key || !key.trim()) {
      setKeyData((prev) => ({ ...prev, [id]: { status: "invalid", checkedAt: Date.now() } }));
      return;
    }
    const result = await testApiKey(providerKey, key);
    setKeyData((prev) => ({
      ...prev,
      [id]: { status: result.status, serverMessage: result.serverMessage || "", checkedAt: Date.now() },
    }));
  }, []);

  const toggleExpand = (pk) => setExpanded((p) => ({ ...p, [pk]: !p[pk] }));

  return (
    <>
      <style>{`
        @keyframes api-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .api-spin { animation: api-spin 1s linear infinite; }
        @keyframes api-fadeIn { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes api-pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.4); } }
        @keyframes api-pulse-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.35); } 50% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); } }
        .api-dash-root { animation: api-fadeIn 0.4s ease; }
        .api-key-row { transition: background 0.15s; }
        .api-key-row:hover { background: var(--bg2) !important; }
        .api-provider-card { transition: box-shadow 0.25s, transform 0.2s; }
        .api-provider-card:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
        .api-stat-card { transition: transform 0.2s; }
        .api-stat-card:hover { transform: translateY(-3px); }
        .api-check-all { transition: all 0.2s; }
        .api-check-all:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4); }
        .api-test-btn { transition: all 0.15s; }
        .api-test-btn:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
        .api-live-dot { animation: api-pulse-dot 2s ease-in-out infinite; }
        .api-working-row { animation: api-pulse-glow 2.5s ease-in-out infinite; }
        .api-key-num { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 24px; border-radius: 6px; font-size: 11.5px; font-weight: 800; flex-shrink: 0; }
      `}</style>

      <div className="api-dash-root" style={{ minHeight: "100vh", padding: "32px 24px 80px", maxWidth: "900px", margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: 44, height: 44, borderRadius: "12px", background: "linear-gradient(135deg, #6366F1, #8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(99, 102, 241, 0.4)" }}>
              <Activity size={22} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "var(--text1)" }}>{t("apiDash.title")}</h1>
              <p style={{ margin: 0, color: "var(--text3)", fontSize: "13px", marginTop: "3px" }}>{t("apiDash.description")}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: "12px", marginBottom: "24px" }}>
          {[
            { label: t("apiDash.totalKeys"), value: totalKeys, color: "#6366F1", icon: <Key size={16} /> },
            { label: t("apiDash.working"), value: workingCount, color: "#10B981", icon: <Wifi size={16} /> },
            { label: t("apiDash.rateLimited"), value: rateLimitedCount, color: "#F59E0B", icon: <Clock size={16} /> },
            { label: t("apiDash.failed"), value: failedCount, color: "#EF4444", icon: <WifiOff size={16} /> },
          ].map((s) => (
            <div key={s.label} className="api-stat-card" style={{ background: "var(--bg-card, var(--bg2))", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", borderLeft: `4px solid ${s.color}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <span style={{ fontSize: "11px", color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</span>
                <div style={{ color: s.color }}>{s.icon}</div>
              </div>
              <span style={{ fontSize: "30px", fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Live Provider Health (PR-C) */}
        <ProviderHealthWidget />

        {/* Check Button */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            className="api-check-all"
            disabled={isCheckingAll || !hasAnyKeys}
            onClick={() => runCheck(allKeys)}
            style={{
              display: "flex", alignItems: "center", gap: "8px", padding: "12px 28px", borderRadius: "10px", border: "none",
              background: isCheckingAll ? "var(--bg2)" : "linear-gradient(135deg, #6366F1, #8B5CF6)",
              color: isCheckingAll ? "var(--text3)" : "#fff", fontWeight: 700, fontSize: "14px",
              cursor: isCheckingAll || !hasAnyKeys ? "not-allowed" : "pointer",
              opacity: !hasAnyKeys ? 0.5 : 1,
              boxShadow: isCheckingAll ? "none" : "0 4px 16px rgba(99, 102, 241, 0.3)",
            }}
          >
            <RefreshCw size={15} className={isCheckingAll ? "api-spin" : ""} />
            {isCheckingAll ? t("apiDash.testing") : t("apiDash.testAll")}
          </button>

          {isCheckingAll && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "120px" }}>
              <div style={{ flex: 1, height: "8px", borderRadius: "4px", background: "var(--bg2)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${checkProgress.total > 0 ? (checkProgress.done / checkProgress.total) * 100 : 0}%`, background: "linear-gradient(90deg, #6366F1, #10B981)", borderRadius: "4px", transition: "width 0.3s ease" }} />
              </div>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text2)", whiteSpace: "nowrap" }}>{checkProgress.done}/{checkProgress.total}</span>
            </div>
          )}

          {lastFullCheck && !isCheckingAll && (
            <span style={{ fontSize: "11px", color: "var(--text3)", display: "flex", alignItems: "center", gap: "4px" }}>
              <Clock size={11} />
              {t("apiDash.lastCheck")} {timeAgo(lastFullCheck, timeNow)}
            </span>
          )}
        </div>

        {/* Info Banner */}
        {hasAnyKeys && !lastFullCheck && (
          <div style={{ padding: "14px 18px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.06)", border: "1px solid rgba(99, 102, 241, 0.15)", marginBottom: "20px", fontSize: "13px", color: "var(--text2)", lineHeight: 1.6 }}>
            💡 {t("apiDash.infoBanner")}
          </div>
        )}

        {/* No Keys */}
        {!hasAnyKeys && (
          <div style={{ textAlign: "center", padding: "64px 20px", borderRadius: "16px", border: "2px dashed var(--border)", background: "var(--bg2)" }}>
            <Shield size={52} color="var(--text3)" style={{ marginBottom: "16px", opacity: 0.4 }} />
            <h3 style={{ margin: "0 0 8px", color: "var(--text1)", fontSize: "18px", fontWeight: 700 }}>{t("apiDash.noKeysTitle")}</h3>
            <p style={{ margin: "0 0 20px", color: "var(--text3)", fontSize: "14px", maxWidth: "360px", marginLeft: "auto", marginRight: "auto" }}>{t("apiDash.noKeysDesc")}</p>
            <button
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 22px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #6366F1, #8B5CF6)", color: "#fff", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
              onClick={() => { const btn = document.getElementById("sidebar-api-keys-btn"); if (btn) btn.click(); }}
            >
              <Settings size={15} />
              {t("apiDash.settingsBtn")}
            </button>
          </div>
        )}

        {/* Provider Cards */}
        {PROVIDERS.map((provider) => {
          const providerKeys = getAllKeys(provider.key) || [];
          if (providerKeys.length === 0) return null;

          const isExpanded = expanded[provider.key] !== false;
          const statuses = providerKeys.map((_, i) => keyData[`${provider.key}:${i}`]?.status || null);
          const provWorking = statuses.filter((s) => s === "working").length;
          const provFailed = statuses.filter((s) => ["invalid", "error", "offline"].includes(s)).length;
          const provRate = statuses.filter((s) => s === "rate").length;
          const provTested = statuses.filter((s) => s && s !== "testing").length;

          let borderColor = provider.color;
          if (provTested > 0) {
            if (provWorking === providerKeys.length) borderColor = "#10B981";
            else if (provWorking > 0) borderColor = "#F59E0B";
            else borderColor = "#EF4444";
          }

          return (
            <div key={provider.key} className="api-provider-card" style={{ background: "var(--bg-card, var(--bg2))", border: "1px solid var(--border)", borderRadius: "14px", marginBottom: "14px", overflow: "hidden", borderLeft: `4px solid ${borderColor}` }}>
              <div onClick={() => toggleExpand(provider.key)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "16px 20px", cursor: "pointer", borderBottom: isExpanded ? "1px solid var(--border)" : "none" }}>
                <div style={{ width: 36, height: 36, borderRadius: "9px", background: provider.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0, boxShadow: `0 2px 10px ${provider.color}33` }}>
                  {provider.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontWeight: 700, fontSize: "15px", color: "var(--text1)" }}>{provider.label}</span>
                    {provWorking > 0 && <div className="api-live-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 6px rgba(16,185,129,0.6)" }} />}
                  </div>
                  {provTested > 0 && <div style={{ marginTop: "6px", maxWidth: "200px" }}><HealthBar working={provWorking} rate={provRate} failed={provFailed} total={providerKeys.length} /></div>}
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {provWorking > 0 && <span style={{ fontSize: "11px", fontWeight: 700, color: "#10B981", background: "rgba(16,185,129,0.1)", padding: "2px 8px", borderRadius: "12px" }}>✓ {provWorking}</span>}
                  {provRate > 0 && <span style={{ fontSize: "11px", fontWeight: 700, color: "#F59E0B", background: "rgba(245,158,11,0.1)", padding: "2px 8px", borderRadius: "12px" }}>⏱ {provRate}</span>}
                  {provFailed > 0 && <span style={{ fontSize: "11px", fontWeight: 700, color: "#EF4444", background: "rgba(239,68,68,0.1)", padding: "2px 8px", borderRadius: "12px" }}>✗ {provFailed}</span>}
                  <span style={{ color: "var(--text3)", fontSize: "12px", fontWeight: 500 }}>{providerKeys.length} key{providerKeys.length > 1 ? "s" : ""}</span>
                  {isExpanded ? <ChevronUp size={15} color="var(--text3)" /> : <ChevronDown size={15} color="var(--text3)" />}
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: "2px 0" }}>
                  {providerKeys.map((key, i) => {
                    const id = `${provider.key}:${i}`;
                    const data = keyData[id] || {};
                    const status = data.status || "unchecked";
                    const info = getStatusInfo(status, data.serverMessage, t);
                    const isTesting = status === "testing";
                    const isWorking = status === "working";
                    const statusColor = getStatusColor(status);

                    return (
                      <div key={id}>
                        <div
                          className={`api-key-row ${isWorking ? "api-working-row" : ""}`}
                          style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            padding: "14px 20px", borderLeft: `4px solid ${statusColor}`,
                            marginLeft: "6px", background: info.rowBg,
                          }}
                        >
                          <div className="api-key-num" style={{ background: info.bg, color: statusColor, border: `1.5px solid ${info.border}` }}>
                            #{i + 1}
                          </div>
                          <div style={{ width: 11, height: 11, borderRadius: "50%", background: statusColor, flexShrink: 0, boxShadow: isWorking ? `0 0 10px ${statusColor}88` : "none" }} className={isWorking ? "api-live-dot" : ""} />
                          <code style={{
                            flex: 1, fontSize: "12.5px",
                            color: status === "invalid" ? "#EF4444" : status === "rate" ? "#D97706" : "var(--text2)",
                            fontFamily: "'Courier New', monospace", letterSpacing: "0.04em",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            textDecoration: status === "invalid" ? "line-through" : "none",
                            opacity: status === "invalid" ? 0.5 : 1,
                          }}>
                            {key ? maskKey(key) : <span style={{ color: "var(--text3)", fontStyle: "italic" }}>— {t("apiDash.empty")} —</span>}
                          </code>
                          {data.checkedAt && !isTesting && (
                            <span style={{ fontSize: "10px", color: "var(--text3)", flexShrink: 0 }}>{timeAgo(data.checkedAt, timeNow)}</span>
                          )}
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 12px", borderRadius: "20px", fontSize: "11.5px", fontWeight: 700, background: info.bg, color: statusColor, border: `1px solid ${info.border}`, flexShrink: 0 }}>
                            {info.icon} {info.label}
                          </span>
                          <button
                            className="api-test-btn" disabled={isTesting || !key}
                            onClick={() => checkSingleKey(provider.key, key, id)}
                            title={`Test Key #${i + 1}`}
                            style={{ padding: "5px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text2)", fontSize: "12px", fontWeight: 700, cursor: isTesting || !key ? "not-allowed" : "pointer", flexShrink: 0, opacity: !key ? 0.3 : 1, display: "flex", alignItems: "center", gap: "4px" }}
                          >
                            {isTesting ? <RefreshCw size={12} className="api-spin" /> : <><Zap size={11} />Test</>}
                          </button>
                        </div>

                        {info.message && !isTesting && data.checkedAt && (
                          <div style={{
                            fontSize: "12px", padding: "8px 14px 8px 18px",
                            margin: "0 16px 2px 52px", borderRadius: "8px",
                            background: info.rowBg, color: statusColor,
                            borderLeft: `3px solid ${statusColor}`,
                            lineHeight: 1.6, fontWeight: 500, whiteSpace: "pre-line",
                          }}>
                            {info.message}
                          </div>
                        )}
                        {i < providerKeys.length - 1 && <div style={{ height: "1px", background: "var(--border)", margin: "2px 20px 2px 52px" }} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Legend */}
        {hasAnyKeys && (
          <div style={{ marginTop: "28px", padding: "18px 20px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--bg-card, var(--bg2))" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "12px" }}>
              {t("apiDash.statusGuide")}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 28px" }}>
              {[
                { emoji: "🟢", label: t("apiDash.active"), desc: t("apiDash.activeDesc") },
                { emoji: "🟡", label: t("apiDash.limitReached"), desc: t("apiDash.limitDesc") },
                { emoji: "🔴", label: t("apiDash.invalid"), desc: t("apiDash.invalidDesc") },
                { emoji: "⚪", label: t("apiDash.notChecked"), desc: t("apiDash.notCheckedDesc") },
              ].map((item) => (
                <div key={item.emoji} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                  <span style={{ fontSize: "16px", lineHeight: 1 }}>{item.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "12px", color: "var(--text1)" }}>{item.label}</div>
                    <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "1px" }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
