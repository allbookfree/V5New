"use client";

import { useState, useCallback } from "react";
import { History, Search, Copy, Check, Trash2, Sparkles, Image, Palette, Video, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { getPromptHistory, clearPromptHistory, removeFromPromptHistory } from "@/lib/promptHistory";
import { copyToClipboard, copyPromptsAsRows } from "@/lib/promptUtils";

const TYPES = [
  { key: "all", icon: History },
  { key: "image", icon: Image },
  { key: "vector", icon: Palette },
  { key: "video", icon: Video },
];

function readHistoryData() {
  return {
    image: getPromptHistory("image"),
    vector: getPromptHistory("vector"),
    video: getPromptHistory("video"),
  };
}

export default function HistoryPage() {
  const { t } = useLanguage();
  const [activeType, setActiveType] = useState("all");
  const [search, setSearch] = useState("");
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [confirmClear, setConfirmClear] = useState(null);
  const [data, setData] = useState(readHistoryData);

  const loadData = useCallback(() => {
    setData(readHistoryData());
  }, []);

  const handleCopy = async (text, idx) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    }
  };

  const handleCopyAll = async () => {
    const list = getPrompts().map(p => p.text);
    if (list.length === 0) return;
    const ok = await copyPromptsAsRows(list);
    if (ok) {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const handleDelete = (type, index) => {
    removeFromPromptHistory(type, index);
    loadData();
  };

  const handleClearType = (type) => {
    clearPromptHistory(type);
    setConfirmClear(null);
    loadData();
  };

  const handleClearAll = () => {
    ["image", "vector", "video"].forEach(type => clearPromptHistory(type));
    setConfirmClear(null);
    loadData();
  };

  const getPrompts = () => {
    let prompts = [];
    const types = activeType === "all" ? ["image", "vector", "video"] : [activeType];
    types.forEach(type => {
      data[type].forEach((text, idx) => {
        prompts.push({ text, type, originalIndex: idx });
      });
    });
    if (search.trim()) {
      const q = search.toLowerCase();
      prompts = prompts.filter(p => p.text.toLowerCase().includes(q));
    }
    return prompts;
  };

  const prompts = getPrompts();
  const totalAll = data.image.length + data.vector.length + data.video.length;

  const typeLabel = (key) => {
    if (key === "all") return t("history.all");
    return t(`history.${key}`);
  };

  const typeBadgeClass = (type) => {
    const map = { image: "badge-image", vector: "badge-vector", video: "badge-video" };
    return map[type] || "";
  };

  const currentCount = activeType === "all" ? totalAll : (data[activeType]?.length || 0);

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-icon"><History size={24} /></div>
        <h1 className="page-title">{t("history.title")}</h1>
        <p className="page-desc">{t("history.description")}</p>
      </div>

      <div className="history-controls">
        <div className="history-tabs">
          {TYPES.map(({ key, icon: Icon }) => (
            <button
              key={key}
              className={`history-tab ${activeType === key ? "active" : ""}`}
              onClick={() => setActiveType(key)}
            >
              <Icon size={14} />
              <span>{typeLabel(key)}</span>
              <span className="history-tab-count">
                {key === "all" ? totalAll : data[key]?.length || 0}
              </span>
            </button>
          ))}
        </div>

        <div className="history-search">
          <Search size={15} />
          <input
            type="text"
            placeholder={t("history.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {currentCount > 0 && (
        <div className="history-actions-bar">
          <span className="history-count">{t("history.totalPrompts")}: {currentCount}</span>
          {confirmClear === "pending" ? (
            <div className="history-confirm">
              <span><AlertTriangle size={14} />{activeType === "all" ? (t("history.clearAllConfirm") || "Delete ALL history?") : t("history.clearConfirm")}</span>
              <button className="btn btn-danger-sm" onClick={() => activeType === "all" ? handleClearAll() : handleClearType(activeType)}>
                {t("history.clearYes")}
              </button>
              <button className="btn btn-ghost-sm" onClick={() => setConfirmClear(null)}>
                {t("history.clearNo")}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: "13px", height: "auto", minHeight: "30px" }} onClick={handleCopyAll}>
                {copiedAll ? <><Check size={13} /> {t("prompt.copied") || "Copied"}</> : <><Copy size={13} /> {t("prompt.copyAll") || "Copy All"}</>}
              </button>
              <button className="btn btn-ghost-sm" onClick={() => setConfirmClear("pending")}>
                <Trash2 size={13} />
                {activeType === "all" ? (t("history.clearAllHistory") || "Clear All History") : t("history.clearAll")}
              </button>
            </div>
          )}
        </div>
      )}

      {totalAll === 0 ? (
        <div className="card">
          <div className="card-body history-empty">
            <div className="history-empty-icon"><History size={28} /></div>
            <h3>{t("history.emptyTitle")}</h3>
            <p>{t("history.emptyDesc")}</p>
            <Link href="/prompt-generator" className="history-start-btn">
              <Sparkles size={16} />{t("history.emptyAction")}
            </Link>
          </div>
        </div>
      ) : prompts.length === 0 && search.trim() ? (
        <div className="card">
          <div className="card-body history-empty">
            <div className="history-empty-icon"><Search size={28} /></div>
            <h3>{t("history.noResults")}</h3>
          </div>
        </div>
      ) : (
        <div className="history-list">
          {prompts.map((item, i) => {
            const globalKey = `${item.type}-${item.originalIndex}`;
            return (
              <div key={globalKey} className="history-item" style={{ animationDelay: `${Math.min(i, 20) * 30}ms` }}>
                <div className="history-item-header">
                  <span className={`history-type-badge ${typeBadgeClass(item.type)}`}>
                    {typeLabel(item.type)}
                  </span>
                  <div className="history-item-actions">
                    <button
                      className="history-action-btn"
                      onClick={() => handleCopy(item.text, globalKey)}
                      title={t("history.copyPrompt")}
                    >
                      {copiedIdx === globalKey ? <><Check size={13} />{t("history.copied")}</> : <><Copy size={13} />{t("history.copyPrompt")}</>}
                    </button>
                    <button
                      className="history-action-btn history-delete-btn"
                      onClick={() => handleDelete(item.type, item.originalIndex)}
                      title={t("history.deletePrompt")}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <p className="history-item-text">{item.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
