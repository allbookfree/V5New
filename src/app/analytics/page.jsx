"use client";

import { useState, useCallback } from "react";
import { BarChart3, TrendingUp, Image as ImageIcon, Palette, Video, Trash2, RefreshCw, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { getPromptHistory, clearPromptHistory } from "@/lib/promptHistory";
import { useApiKeys } from "@/context/ApiKeyContext";

function loadData() {
  const types = ["image", "vector", "video"];
  const promptCounts = {};
  let total = 0;

  for (const type of types) {
    const history = getPromptHistory(type);
    promptCounts[type] = history.length;
    total += history.length;
  }

  let mostActiveType = "image";
  let maxCount = 0;
  for (const type of types) {
    if (promptCounts[type] > maxCount) {
      maxCount = promptCounts[type];
      mostActiveType = type;
    }
  }

  return {
    total,
    promptCounts,
    mostActiveType
  };
}

export default function AnalyticsPage() {
  const { t, lang } = useLanguage();
  const { getAllKeys } = useApiKeys();
  const [data, setData] = useState(loadData);
  const [confirmReset, setConfirmReset] = useState(false);

  const refresh = useCallback(() => {
    setData(loadData());
  }, []);

  if (!data) return null;

  const { total, promptCounts, mostActiveType } = data;
  const isEmpty = total === 0;

  const typeLabels = { image: t("analytics.image"), vector: t("analytics.vector"), video: t("analytics.video") };
  const typeIcons = { image: ImageIcon, vector: Palette, video: Video };
  const typeColors = { image: "#4f46e5", vector: "#10b981", video: "#f59e0b" };

  const ALL_PROVIDERS = ["gemini", "groq", "mistral", "openrouter", "huggingface"];
  const activeVendors = ALL_PROVIDERS.filter(p => getAllKeys(p).length > 0).length;
  const totalProviders = ALL_PROVIDERS.length;

  const handleReset = () => {
    ["image", "vector", "video"].forEach(type => {
      clearPromptHistory(type);
    });
    setConfirmReset(false);
    refresh();
  };

  const totalDistribution = promptCounts.image + promptCounts.vector + promptCounts.video;

  return (
    <div className="page analytics-page">
      <div className="page-head">
        <div className="page-icon"><BarChart3 size={24} /></div>
        <h1 className="page-title">{t("analytics.title")}</h1>
        <p className="page-desc">{t("analytics.description")}</p>
      </div>

      {isEmpty ? (
        <div className="analytics-empty">
          <div className="analytics-empty-icon">
            <Sparkles size={40} />
          </div>
          <h2 className="analytics-empty-title">{t("analytics.emptyTitle")}</h2>
          <p className="analytics-empty-desc">{t("analytics.emptyDesc")}</p>
          <Link href="/prompt-generator" className="analytics-empty-cta">
            {t("analytics.emptyAction")} <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <>
          <div className="analytics-summary">
            <div className="analytics-card">
              <div className="analytics-card-icon" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent2))" }}>
                <TrendingUp size={18} />
              </div>
              <div className="analytics-card-body">
                <span className="analytics-card-value">{total}</span>
                <span className="analytics-card-label">{t("analytics.totalGenerated")}</span>
              </div>
            </div>
            <div className="analytics-card">
              <div className="analytics-card-icon" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
                <ImageIcon size={18} />
              </div>
              <div className="analytics-card-body">
                <span className="analytics-card-value">{promptCounts.image}</span>
                <span className="analytics-card-label">{t("analytics.imagePrompts")}</span>
              </div>
            </div>
            <div className="analytics-card">
              <div className="analytics-card-icon" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                <Palette size={18} />
              </div>
              <div className="analytics-card-body">
                <span className="analytics-card-value">{promptCounts.vector}</span>
                <span className="analytics-card-label">{t("analytics.vectorPrompts")}</span>
              </div>
            </div>
            <div className="analytics-card">
              <div className="analytics-card-icon" style={{ background: "linear-gradient(135deg, #6366f1, #4f46e5)" }}>
                <Sparkles size={18} />
              </div>
              <div className="analytics-card-body">
                <span className="analytics-card-value">{activeVendors} / {totalProviders}</span>
                <span className="analytics-card-label">{t("analytics.activeAiResource")}</span>
              </div>
            </div>
          </div>

          {totalDistribution > 0 && (
            <div className="analytics-section">
              <h3 className="analytics-section-title">{t("analytics.generatorDistribution")}</h3>
              <div className="analytics-donut-wrap">
                <div className="analytics-donut">
                  <svg viewBox="0 0 120 120" className="analytics-donut-svg">
                    {(() => {
                      const radius = 48;
                      const circumference = 2 * Math.PI * radius;
                      let offset = 0;
                      const segments = [];
                      const types = ["image", "vector", "video"];
                      const colors = [typeColors.image, typeColors.vector, typeColors.video];
                      for (let i = 0; i < types.length; i++) {
                        const pct = promptCounts[types[i]] / totalDistribution;
                        if (pct === 0) continue;
                        const dash = pct * circumference;
                        segments.push(
                          <circle key={types[i]} cx="60" cy="60" r={radius} fill="none" stroke={colors[i]}
                            strokeWidth="16" strokeDasharray={`${dash} ${circumference - dash}`}
                            strokeDashoffset={-offset} strokeLinecap="butt"
                            style={{ transform: "rotate(-90deg)", transformOrigin: "center" }} />
                        );
                        offset += dash;
                      }
                      return segments;
                    })()}
                    <text x="60" y="56" textAnchor="middle" className="analytics-donut-total">{totalDistribution}</text>
                    <text x="60" y="72" textAnchor="middle" className="analytics-donut-label">{t("analytics.prompts")}</text>
                  </svg>
                </div>
                <div className="analytics-donut-legend">
                  {["image", "vector", "video"].map(type => (
                    <div key={type} className="analytics-legend-item">
                      <span className="analytics-legend-dot" style={{ background: typeColors[type] }} />
                      <span className="analytics-legend-label">{typeLabels[type]}</span>
                      <span className="analytics-legend-count">{promptCounts[type]}</span>
                      <span className="analytics-legend-pct">{totalDistribution > 0 ? Math.round((promptCounts[type] / totalDistribution) * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}


          <div className="analytics-actions">
            {!confirmReset ? (
              <button className="analytics-reset-btn" onClick={() => setConfirmReset(true)}>
                <Trash2 size={14} /> {t("analytics.resetStats")}
              </button>
            ) : (
              <div className="analytics-confirm">
                <span>{t("analytics.resetConfirm")}</span>
                <button className="analytics-confirm-yes" onClick={handleReset}>{t("analytics.resetYes")}</button>
                <button className="analytics-confirm-no" onClick={() => setConfirmReset(false)}>{t("analytics.resetNo")}</button>
              </div>
            )}
            <button className="analytics-refresh-btn" onClick={refresh}>
              <RefreshCw size={14} /> {t("analytics.refresh")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
