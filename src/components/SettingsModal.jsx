"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { X, KeyRound, Eye, EyeOff, Save, Shield, ExternalLink, Check, Lock, Loader2, AlertTriangle, Plus, Trash2, CheckCircle, ChevronDown, RotateCcw, BookOpen, Copy, Upload, Download, FileJson, FileText, ChevronRight } from "lucide-react";
import { useApiKeys } from "@/context/ApiKeyContext";
import { useLanguage } from "@/context/LanguageContext";
import { PROVIDER_MODELS } from "@/config/providerModels";

// Keep in sync with MAX_API_KEYS in src/lib/apiUtils.js — the server silently
// drops keys past this limit, so the UI must enforce the same cap.
const MAX_KEYS_PER_PROVIDER = 10;

const PROVIDERS = [
  { key: "gemini", label: "Gemini", placeholder: "AIza...", color: "#4f46e5", url: "https://aistudio.google.com/app/apikey" },
  { key: "groq", label: "Groq", placeholder: "gsk_...", color: "#f97316", url: "https://console.groq.com/keys" },
  { key: "mistral", label: "Mistral", placeholder: "sk-...", color: "#8b5cf6", url: "https://console.mistral.ai/api-keys" },
  { key: "openrouter", label: "OpenRouter", placeholder: "sk-or-...", color: "#06b6d4", url: "https://openrouter.ai/settings/keys", badge: "Vision · Free", badgeColor: "#0891b2", hintKey: "settings.orHint" },
  { key: "huggingface", label: "HuggingFace", placeholder: "hf_...", color: "#ffbf00", url: "https://huggingface.co/settings/tokens", badge: "Vision · Free", badgeColor: "#d97706", hintKey: "settings.hfHint" },
  { key: "cerebras", label: "Cerebras", placeholder: "csk-...", color: "#ef4444", url: "https://cloud.cerebras.ai/", badge: "Free · Fast", badgeColor: "#dc2626", hintKey: "settings.cerebrasHint" },
  { key: "nvidia", label: "NVIDIA NIM", placeholder: "nvapi-...", color: "#22c55e", url: "https://build.nvidia.com/", badge: "Free credits", badgeColor: "#16a34a", hintKey: "settings.nvidiaHint" },
  { key: "github", label: "GitHub Models", placeholder: "ghp_...", color: "#000000", url: "https://github.com/settings/tokens/new", badge: "GPT-4o · Free", badgeColor: "#000000", hintKey: "settings.githubHint" },
  // ── Stock-image data providers (used by /market-trends, not LLM calls) ──
  { key: "pixabay", label: "Pixabay", placeholder: "32-char hex...", color: "#16a34a", url: "https://pixabay.com/api/docs/", badge: "Market Trends", badgeColor: "#15803d", group: "data" },
  { key: "pexels", label: "Pexels", placeholder: "56-char...", color: "#0ea5e9", url: "https://www.pexels.com/api/new/", badge: "Market Trends", badgeColor: "#0369a1", group: "data" },
];

const APPS_SCRIPT_CODE = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "append") {
      var sheetName = data.sheetName || "Results";
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(["Provider", "Marketplace", "Mode", "Model", "Prompt No.", "Prompt Text", "Status", "Time (s)", "Error Details"]);
        sheet.getRange(1, 1, 1, 9).setFontWeight("bold").setBackground("#6366F1").setFontColor("#ffffff").setHorizontalAlignment("center");
        try { sheet.getRange(1, 1, 1, 9).createFilter(); } catch(e) {} // Auto-filter only for the 9 columns
        sheet.setFrozenRows(1);
        sheet.setColumnWidth(1, 120);
        sheet.setColumnWidth(2, 100);
        sheet.setColumnWidth(3, 100);
        sheet.setColumnWidth(4, 160);
        sheet.setColumnWidth(5, 90);
        sheet.setColumnWidth(6, 450); 
        sheet.setColumnWidth(7, 90);
        sheet.setColumnWidth(8, 90);
        sheet.setColumnWidth(9, 250);
      }

      var rows = data.rows || [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var startRow = sheet.getLastRow() + 1;
        var numRows = (r.prompts && r.prompts.length > 0) ? r.prompts.length : 1;
        
        if (!r.prompts || r.prompts.length === 0) {
          sheet.appendRow([r.provider || "", r.marketplace || "", r.mode || "", r.modelLabel || "", "-", "N/A", r.status || "", r.time || "", r.error || "No prompts"]);
        } else {
          for (var p = 0; p < r.prompts.length; p++) {
            sheet.appendRow([
              r.provider || "", r.marketplace || "", r.mode || "", r.modelLabel || "", String(p + 1), r.prompts[p] || "",
              r.status || "", r.time || "", r.error || ""
            ]);
          }
        }
        
        if (numRows > 1) {
          var mergeCols = [1, 2, 3, 4, 7, 8, 9];
          for (var m = 0; m < mergeCols.length; m++) {
            sheet.getRange(startRow, mergeCols[m], numRows, 1).merge().setVerticalAlignment("middle").setHorizontalAlignment("center");
          }
        }
        
        sheet.getRange(startRow, 5, numRows, 1).setVerticalAlignment("middle").setHorizontalAlignment("center");
        sheet.getRange(startRow, 6, numRows, 1).setVerticalAlignment("middle").setWrap(false); // Text clipping mode
        
        // Add Colors for Status
        var statusColor = (r.status === "Success") ? "#10b981" : "#ef4444";
        sheet.getRange(startRow, 7, numRows, 1).setFontColor(statusColor).setFontWeight("bold");
        
        // Insert Gap Row Space
        sheet.appendRow([" ", "", "", "", "", "", "", "", ""]);
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    } else if (action === "clear") {
      var sheetName = data.sheetName || "Results";
      var sheet = ss.getSheetByName(sheetName);
      if (sheet && sheet.getLastRow() > 1) { sheet.deleteRows(2, sheet.getLastRow() - 1); }
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    } else if (action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Connected!" })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

function normalizeKey(val) {
  if (Array.isArray(val)) return val.length > 0 ? val : [""];
  if (typeof val === "string" && val) return [val];
  return [""];
}

// Auto-detect provider from key prefix.  Order matters: more specific
// prefixes (sk-or-, csk-) must be checked before generic ones (sk-).
function detectProviderFromKey(key) {
  const k = key.trim();
  if (k.startsWith("AIza")) return "gemini";
  if (k.startsWith("gsk_")) return "groq";
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("hf_")) return "huggingface";
  if (k.startsWith("csk-")) return "cerebras";
  if (k.startsWith("nvapi-")) return "nvidia";
  if (k.startsWith("ghp_") || k.startsWith("github_pat_")) return "github";
  if (k.startsWith("sk-")) return "mistral";
  return null;
}

// Parse uploaded file content into { provider: [keys] }
function parseImportFile(text, fileType) {
  const result = { gemini: [], groq: [], mistral: [], openrouter: [], huggingface: [], cerebras: [], nvidia: [], github: [], pixabay: [], pexels: [] };
  try {
    if (fileType === "json") {
      const parsed = JSON.parse(text);
      for (const [provider, value] of Object.entries(parsed)) {
        const pKey = provider.toLowerCase();
        if (result.hasOwnProperty(pKey)) {
          const keys = Array.isArray(value) ? value : [value];
          result[pKey] = keys.map(k => String(k).trim()).filter(Boolean);
        }
      }
    } else {
      // CSV or plain text
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        // Skip header line
        if (line.toLowerCase().startsWith("provider")) continue;
        const parts = line.split(",").map(p => p.trim());
        if (parts.length >= 2) {
          // CSV format: provider, key
          const pKey = parts[0].toLowerCase();
          const apiKey = parts[1];
          if (result.hasOwnProperty(pKey) && apiKey) result[pKey].push(apiKey);
        } else {
          // Plain text: auto-detect by prefix
          const apiKey = parts[0];
          const pKey = detectProviderFromKey(apiKey);
          if (pKey && apiKey) result[pKey].push(apiKey);
        }
      }
    }
  } catch (e) {
    return null;
  }
  return result;
}

export default function SettingsModal({ isOpen, onClose }) {
  const { keys, saveKeys, testKey, testResult, setTestResult, testing, storageMode, updateStorageMode, selectedModels, setSelectedModel, sheetsUrl, updateSheetsUrl } = useApiKeys();
  const { t, lang } = useLanguage();
  const [vis, setVis] = useState({});
  const [saved, setSaved] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [showSheetsGuide, setShowSheetsGuide] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [importApplied, setImportApplied] = useState(false);
  const fileInputRef = useRef(null);

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 4000);
  };

  const handleFileParse = (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    const isJson = ext === "json";
    const isCsv = ext === "csv" || ext === "txt";
    if (!isJson && !isCsv) {
      setImportError("❌ Only .json, .csv, or .txt files are supported.");
      setImportPreview(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const parsed = parseImportFile(text, isJson ? "json" : "csv");
      if (!parsed) {
        setImportError("❌ Could not parse file. Please check the format.");
        setImportPreview(null);
        return;
      }
      const totalKeys = Object.values(parsed).reduce((acc, arr) => acc + arr.length, 0);
      if (totalKeys === 0) {
        setImportError("⚠️ No valid keys found in file. Check provider names or key prefixes.");
        setImportPreview(null);
        return;
      }
      setImportError("");
      setImportPreview(parsed);
      setImportApplied(false);
    };
    reader.readAsText(file);
  };

  const handleApplyImport = () => {
    if (!importPreview) return;
    const merged = { ...keys };
    for (const [provider, newKeys] of Object.entries(importPreview)) {
      if (newKeys.length > 0) {
        const existing = normalizeKey(keys[provider]).filter(Boolean);
        const combined = [...new Set([...existing, ...newKeys])];
        merged[provider] = combined;
      }
    }
    saveKeys(merged);
    setImportApplied(true);
    setImportPreview(null);
    showToast(`✅ Keys imported successfully!`, "success");
    setTimeout(() => { setShowImport(false); setImportApplied(false); }, 1500);
  };

  const handleDropZoneDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileParse(file);
  };



  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const form = {
    gemini: normalizeKey(keys.gemini),
    groq: normalizeKey(keys.groq),
    mistral: normalizeKey(keys.mistral),
    openrouter: normalizeKey(keys.openrouter),
    huggingface: normalizeKey(keys.huggingface),
    cerebras: normalizeKey(keys.cerebras),
    nvidia: normalizeKey(keys.nvidia),
    github: normalizeKey(keys.github),
    pixabay: normalizeKey(keys.pixabay),
    pexels: normalizeKey(keys.pexels),
  };

  const handleSave = () => { saveKeys(form); setSaved(true); setTimeout(() => { setSaved(false); onClose(); }, 800); };
  const handleResetAll = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch { }
    window.location.reload();
  };
  const addKey = (provider) => {
    const current = [...(form[provider] || [""])];
    if (current.length >= MAX_KEYS_PER_PROVIDER) {
      showToast(t("settings.maxKeysReached") || `Maximum ${MAX_KEYS_PER_PROVIDER} keys per provider`, "error");
      return;
    }
    saveKeys({ ...keys, [provider]: [...current, ""] });
  };
  const updateKey = (provider, index, value) => {
    const current = [...(form[provider] || [""])];
    current[index] = value;
    saveKeys({ ...keys, [provider]: current });
    const id = `${provider}-${index}`;
    setTestResult(prev => { const next = { ...prev }; delete next[id]; return next; });
  };
  const removeKey = (provider, index) => { const current = form[provider] || [""]; if (current.length <= 1) return; saveKeys({ ...keys, [provider]: current.filter((_, i) => i !== index) }); };
  const getStatus = (provider, index) => testResult[`${provider}-${index}`];

  return (
    <>
      <div className="modal-bg" onClick={onClose} style={{ zIndex: 9999 }}>
        <div className="modal-wrap" onClick={(e) => e.stopPropagation()} ref={modalRef} tabIndex={-1}>
          <div className="modal-box">
            <div className="modal-head">
              <div className="modal-config-header">
                <div className="modal-config-icon"><Shield size={20} /></div>
                <div>
                  <h2 className="modal-config-title">{t("settings.title")}</h2>
                  <div className="modal-config-subtitle">
                    <Lock size={10} />
                    <span>{t("settings.subtitle")}</span>
                </div>
              </div>
            </div>
            <button id="settings-close-btn" className="btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>

          <div className="modal-body">
            <div className="modal-warning">
              <p className="modal-warning-text">
                <AlertTriangle size={14} />
                {t("settings.warning")}
              </p>
              <label className="modal-warning-label">
                <input
                  type="checkbox"
                  checked={storageMode === "session"}
                  onChange={(e) => updateStorageMode(e.target.checked ? "session" : "local")}
                />
                {t("settings.sessionMode")}
              </label>
            </div>

            {/* ── Bulk Import / Export Section ── */}
            <div style={{ marginBottom: '16px', borderRadius: '12px', border: `1px solid ${showImport ? 'var(--accent)' : 'var(--border)'}`, overflow: 'hidden', transition: 'border-color 0.2s' }}>
              <button
                onClick={() => { setShowImport(!showImport); setImportPreview(null); setImportError(""); }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: showImport ? 'color-mix(in srgb, var(--accent) 8%, var(--bg))' : 'var(--bg)', border: 'none', cursor: 'pointer', color: 'var(--text)', borderRadius: showImport ? '12px 12px 0 0' : '12px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Upload size={14} color="var(--accent)" />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>{t("settings.bulkTitle")}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{t("settings.bulkDesc")}</div>
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text2)" style={{ transform: showImport ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
              </button>

              {showImport && (
                <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                  {/* Step 1 — Download Template */}
                  <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: 'linear-gradient(90deg,#6366f112,#06b6d40e)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>1</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{t("settings.bulkStep1Title")}</div>
                        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>{t("settings.bulkStep1Desc")}</div>
                      </div>
                    </div>
                    <div style={{ padding: '12px', display: 'flex', gap: 8, flexWrap: 'wrap', background: 'var(--bg)' }}>
                      {[
                        {
                          label: t("settings.bulkJsonLabel"), ext: 'json', color: '#6366f1',
                          hint: t("settings.bulkJsonHint"),
                          content: JSON.stringify({
                            gemini: ["YOUR_GEMINI_KEY_1", "YOUR_GEMINI_KEY_2"],
                            groq: ["YOUR_GROQ_KEY_1", "YOUR_GROQ_KEY_2"],
                            mistral: ["YOUR_MISTRAL_KEY_1", "YOUR_MISTRAL_KEY_2"],
                            openrouter: ["YOUR_OPENROUTER_KEY_1", "YOUR_OPENROUTER_KEY_2"],
                            huggingface: ["YOUR_HF_KEY_1", "YOUR_HF_KEY_2"],
                            cerebras: ["YOUR_CEREBRAS_KEY_1"],
                            nvidia: ["YOUR_NVIDIA_KEY_1"],
                            github: ["YOUR_GITHUB_TOKEN_1"],
                          }, null, 2), mime: 'application/json'
                        },
                        {
                          label: t("settings.bulkCsvLabel"), ext: 'csv', color: '#06b6d4',
                          hint: t("settings.bulkCsvHint"),
                          content: `provider,key\ngemini,YOUR_GEMINI_KEY_1\ngemini,YOUR_GEMINI_KEY_2\ngroq,YOUR_GROQ_KEY_1\ngroq,YOUR_GROQ_KEY_2\nmistral,YOUR_MISTRAL_KEY_1\nopenrouter,YOUR_OPENROUTER_KEY_1\nhuggingface,YOUR_HF_KEY_1\ncerebras,YOUR_CEREBRAS_KEY_1\nnvidia,YOUR_NVIDIA_KEY_1\ngithub,YOUR_GITHUB_TOKEN_1`,
                          mime: 'text/csv'
                        },
                        {
                          label: t("settings.bulkTxtLabel"), ext: 'txt', color: '#10b981',
                          hint: t("settings.bulkTxtHint"),
                          content: `# One API Key per line.\n# The system auto-detects which provider each key belongs to.\n#\n# AIzaSy...  →  Gemini\n# gsk_       →  Groq\n# sk-or-     →  OpenRouter\n# hf_        →  HuggingFace\n# sk-        →  Mistral\n# csk-       →  Cerebras\n# nvapi-     →  NVIDIA NIM\n# ghp_       →  GitHub Models\n\nYOUR_GEMINI_KEY_1\nYOUR_GROQ_KEY_1`,
                          mime: 'text/plain'
                        },
                      ].map(tpl => (
                        <button key={tpl.ext}
                          onClick={() => {
                            const blob = new Blob([tpl.content], { type: tpl.mime });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url; a.download = `api-keys-template.${tpl.ext}`; a.click();
                            URL.revokeObjectURL(url);
                          }}
                          style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '11px 14px', borderRadius: 9, background: `${tpl.color}0d`, border: `1px solid ${tpl.color}35`, cursor: 'pointer', flex: 1, minWidth: 130, transition: 'all 0.15s', textAlign: 'left' }}
                          onMouseEnter={e => e.currentTarget.style.background = `${tpl.color}1c`}
                          onMouseLeave={e => e.currentTarget.style.background = `${tpl.color}0d`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileJson size={14} color={tpl.color} />
                            <span style={{ fontWeight: 700, fontSize: 12, color: tpl.color }}>{tpl.label}</span>
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--text2)', lineHeight: 1.4 }}>{tpl.hint}</span>
                        </button>
                      ))}
                    </div>
                    <div style={{ padding: '8px 14px', background: 'color-mix(in srgb,#f59e0b 6%,var(--bg))', borderTop: '1px dashed #f59e0b40', fontSize: 11, color: '#92400e', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
                      <span><strong>{t("settings.bulkStep1TipHow")}</strong> {t("settings.bulkStep1Tip")}</span>
                    </div>
                  </div>

                  {/* Step 2 — Upload */}
                  <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: 'linear-gradient(90deg,#10b98112,#06b6d40e)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ background: '#10b981', color: '#fff', borderRadius: '50%', width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>2</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{t("settings.bulkStep2Title")}</div>
                        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>{t("settings.bulkStep2Desc")}</div>
                      </div>
                    </div>
                    <div style={{ padding: '12px', background: 'var(--bg)' }}>
                      <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDropZoneDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{ border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: '28px 16px', textAlign: 'center', cursor: 'pointer', background: isDragging ? 'color-mix(in srgb,var(--accent) 8%,var(--bg))' : 'var(--bg2)', transition: 'all 0.2s' }}
                      >
                        <div style={{ fontSize: 32, marginBottom: 8 }}>{isDragging ? '📂' : '📁'}</div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: isDragging ? 'var(--accent)' : 'var(--text)' }}>{isDragging ? t("settings.bulkDropRelease") : t("settings.bulkDropText")}</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', margin: '6px 0 10px' }}>{t("settings.bulkDropOr")}</div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                          <Upload size={13} /> {t("settings.bulkDropBtn")}
                        </div>
                        <div style={{ marginTop: 10, display: 'flex', gap: 4, justifyContent: 'center' }}>
                          {[['json','#6366f1'],['csv','#06b6d4'],['txt','#10b981']].map(([ext,c]) => (
                            <span key={ext} style={{ background:`${c}15`,border:`1px solid ${c}30`,color:c,borderRadius:4,padding:'2px 8px',fontSize:10,fontWeight:700 }}>.{ext}</span>
                          ))}
                        </div>
                      </div>
                      <input ref={fileInputRef} type="file" accept=".json,.csv,.txt" style={{ display:'none' }} onChange={(e) => handleFileParse(e.target.files[0])} />
                      <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'color-mix(in srgb,#3b82f6 6%,var(--bg))', border: '1px solid #3b82f620', fontSize: 11, color: 'var(--text2)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 13, flexShrink: 0 }}>🔒</span>
                        <span><strong style={{ color: 'var(--text)' }}>{t("settings.bulkSafeNote")}</strong> {t("settings.bulkSafeNoteDesc")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Export current keys */}
                  <div style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', background: 'linear-gradient(90deg,#8b5cf612,#6366f10e)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Download size={14} color="#8b5cf6" />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{t("settings.bulkExportTitle")}</div>
                          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>{t("settings.bulkExportDesc")}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const exportData = {};
                          let hasKeys = false;
                          for (const p of PROVIDERS) {
                            const pKeys = (keys[p.key] || []).filter(k => k && k.trim());
                            if (pKeys.length > 0) {
                              exportData[p.key] = pKeys;
                              hasKeys = true;
                            }
                          }
                          if (!hasKeys) {
                            showToast(t("settings.bulkExportEmpty"), "error");
                            return;
                          }
                          const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url; a.download = 'api-keys.json'; a.click();
                          URL.revokeObjectURL(url);
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#8b5cf615', border: '1px solid #8b5cf635', cursor: 'pointer', color: '#8b5cf6', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
                      >
                        <Download size={13} /> {t("settings.bulkExportBtn")}
                      </button>
                    </div>
                  </div>

                  {/* Error */}
                  {importError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#b91c1c' }}>
                      <AlertTriangle size={14} />{importError}
                    </div>
                  )}

                  {/* Preview */}
                  {importPreview && (() => {
                    const totalKeys = Object.values(importPreview).reduce((a, b) => a + b.length, 0);
                    return (
                      <div style={{ borderRadius: 10, border: '1px solid #10b98140', overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', background: 'linear-gradient(90deg, #10b98112, #06b6d410)', borderBottom: '1px solid #10b98125', fontSize: 12, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle size={14} /> Ready to Import — {totalKeys} key{totalKeys > 1 ? 's' : ''} detected
                        </div>
                        <div style={{ padding: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, background: 'var(--bg)' }}>
                          {PROVIDERS.map(p => {
                            const pKeys = importPreview[p.key] || [];
                            return (
                              <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: pKeys.length > 0 ? `${p.color}0a` : 'var(--bg2)', border: `1px solid ${pKeys.length > 0 ? p.color + '30' : 'var(--border)'}`, opacity: pKeys.length > 0 ? 1 : 0.45 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: 11, color: pKeys.length > 0 ? p.color : 'var(--text2)' }}>{p.label}</div>
                                  <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 1 }}>{pKeys.length > 0 ? `${pKeys.length} key${pKeys.length > 1 ? 's' : ''}` : 'No keys'}</div>
                                </div>
                                {pKeys.length > 0 && <CheckCircle size={12} color="#10b981" />}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, background: 'var(--bg2)' }}>
                          <button onClick={handleApplyImport} className="btn btn-primary" style={{ fontSize: 12, padding: '8px 16px', flex: 1 }}>
                            <Check size={14} /> {t("settings.bulkApply")}
                          </button>
                          <button onClick={() => { setImportPreview(null); setImportError(""); if(fileInputRef.current) fileInputRef.current.value = ""; }} className="btn btn-secondary" style={{ fontSize: 12, padding: '8px 14px' }}>
                            {t("settings.bulkDiscard")}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="modal-providers">
              {PROVIDERS.map((p, idx) => (
                <Fragment key={p.key}>
                  {/* Inject a section header before the first "data" group
                      provider so users can see at a glance that Pixabay
                      and Pexels are stock-image data feeds, not LLMs. */}
                  {p.group === "data" && (PROVIDERS[idx - 1]?.group !== "data") && (
                    <div className="modal-provider" style={{ background: "transparent", border: "1px dashed var(--border)", padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 12, color: "var(--text2)", textTransform: "uppercase", letterSpacing: 0.4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a" }} />
                        {lang === "bn" ? "মার্কেট ট্রেন্ডস ডেটা সোর্স" : "Market Trends data sources"}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, color: "var(--text2)" }}>
                        {lang === "bn"
                          ? "এই keys শুধুমাত্র /market-trends পেজে real-time stock photo / vector signal আনার জন্য — কোনো AI / LLM call হয় না।"
                          : "These keys are used only by the /market-trends page to surface real-time stock photo / vector demand signals. They are never used for AI / LLM calls."}
                      </div>
                    </div>
                  )}
                <div className="modal-provider">
                  <div className="modal-provider-header">
                    <div className="modal-provider-info">
                      <span className="modal-provider-dot" style={{ background: p.color }} />
                      <span className="modal-provider-name">{p.label}</span>
                      {p.badge && <span className="badge" style={{ fontSize: 10, padding: "3px 8px", background: `${p.badgeColor}18`, borderColor: `${p.badgeColor}40`, color: p.badgeColor }}>{p.badge}</span>}
                      {(() => {
                        const n = (form[p.key] || [""]).length;
                        const label = lang === "bn" ? `${n} টি কী` : `${n} ${n === 1 ? "key" : "keys"}`;
                        return <span className="badge" style={{ fontSize: 10, padding: "3px 10px" }}>{label}</span>;
                      })()}
                    </div>
                    <a href={p.url} target="_blank" rel="noopener" className="modal-provider-link">{t("settings.getKey")} <ExternalLink size={11} /></a>
                  </div>

                  {PROVIDER_MODELS[p.key] && (
                    <div className="modal-model-selector">
                      <span className="modal-model-label">{t("settings.modelVersion")}</span>
                      <div className="modal-model-select-wrap">
                        <select
                          id={`settings-model-select-${p.key}`}
                          className="field modal-model-select"
                          value={selectedModels?.[p.key] || PROVIDER_MODELS[p.key][0].value}
                          onChange={(e) => setSelectedModel(p.key, e.target.value)}
                        >
                          {PROVIDER_MODELS[p.key].map(m => (
                            <option key={m.value} value={m.value}>{m.label} — {m.info}</option>
                          ))}
                        </select>
                        <ChevronDown size={13} className="modal-model-chevron" />
                      </div>
                    </div>
                  )}

                  <div className="modal-key-list">
                    {(form[p.key] || [""]).map((keyValue, idx) => (
                      <div key={idx} className="modal-key-row">
                        <div className="modal-key-field">
                          <KeyRound size={14} className="modal-key-icon" />
                          <input
                            type={vis[`${p.key}-${idx}`] ? "text" : "password"}
                            className="field"
                            placeholder={`${p.placeholder} #${idx + 1}`}
                            value={keyValue || ""}
                            onChange={(e) => updateKey(p.key, idx, e.target.value)}
                          />
                          <button
                            className="btn-icon modal-key-toggle"
                            onClick={() => setVis({ ...vis, [`${p.key}-${idx}`]: !vis[`${p.key}-${idx}`] })}
                            aria-label={vis[`${p.key}-${idx}`] ? "Hide key" : "Show key"}
                          >
                            {vis[`${p.key}-${idx}`] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                          <button
                            className="btn-icon modal-key-copy"
                            onClick={() => {
                              if (keyValue) {
                                navigator.clipboard.writeText(keyValue);
                                showToast("✅ API Key copied to clipboard", "success");
                              }
                            }}
                            aria-label="Copy key"
                            title="Copy API Key"
                            disabled={!keyValue}
                            style={{ opacity: keyValue ? 1 : 0.4 }}
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                        <button
                          onClick={() => testKey(`${p.key}-${idx}`, keyValue, p.key)}
                          disabled={testing[`${p.key}-${idx}`] || !keyValue}
                          className="btn btn-secondary modal-test-btn"
                        >
                          {testing[`${p.key}-${idx}`] ? <Loader2 size={12} style={{ animation: "spin 0.6s linear infinite" }} /> : t("settings.test")}
                        </button>
                        {getStatus(p.key, idx) && (
                          <span className="modal-key-status" style={{ color: getStatus(p.key, idx).success ? "var(--success)" : "var(--error)" }}>
                            {getStatus(p.key, idx).success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                          </span>
                        )}
                        {form[p.key]?.length > 1 && (
                          <button onClick={() => removeKey(p.key, idx)} className="btn-icon modal-key-remove" aria-label="Remove key">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const reached = (form[p.key] || []).length >= MAX_KEYS_PER_PROVIDER;
                    return (
                      <button
                        onClick={() => addKey(p.key)}
                        className="btn-ghost modal-add-key"
                        disabled={reached}
                        title={reached ? `Maximum ${MAX_KEYS_PER_PROVIDER} keys per provider` : undefined}
                        style={reached ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
                      >
                        <Plus size={14} /> {t("settings.addKey")}
                        {reached && <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.85 }}>· max {MAX_KEYS_PER_PROVIDER}</span>}
                      </button>
                    );
                  })()}
                  {p.hintKey && (
                    <p className="modal-hint">{t(p.hintKey)}</p>
                  )}
                </div>
                </Fragment>
              ))}
            </div>

            <div className="modal-info">
              <p className="modal-info-text"><CheckCircle size={15} /><strong>{t("settings.autoFailover")}</strong> {t("settings.autoFailoverDesc")}</p>
            </div>

            <div className="modal-reset-section" style={{ marginTop: '16px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="modal-reset-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#10b981' }}>☁️ <strong>Google Sheets Integration</strong></span>
                <button 
                  onClick={() => setShowSheetsGuide(!showSheetsGuide)} 
                  className="btn-ghost" 
                  style={{ fontSize: '11px', padding: '4px 8px', color: 'var(--text2)', border: '1px solid var(--border)' }}
                >
                  <BookOpen size={12} style={{ marginRight: '4px' }} />
                  {showSheetsGuide ? "Hide Setup Guide" : "How to Setup?"}
                </button>
              </div>
              <p className="modal-reset-desc">Paste your Apps Script Web App URL to enable AutoTester to sync results directly to your Google Sheet.</p>
              
              {showSheetsGuide && (
                <div style={{ background: 'var(--bg2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text)', marginBottom: '12px', animation: 'fadeIn 0.2s ease' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'var(--accent)' }}>Step-by-Step Setup Guide</h4>
                  <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>Open <a href="https://sheets.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>Google Sheets</a> and create a <b>Blank spreadsheet</b>.</li>
                    <li>From the top menu, click: <b>Extensions</b> &gt; <b>Apps Script</b>.</li>
                    <li>Delete any existing code. Copy and paste the code below into the editor:
                      <div style={{ background: '#0f172a', padding: '12px', borderRadius: '6px', position: 'relative', marginTop: '6px', border: '1px solid #334155' }}>
                        <pre style={{ margin: 0, color: '#e2e8f0', fontSize: '11px', maxHeight: '150px', overflowY: 'auto' }}>
                          {APPS_SCRIPT_CODE}
                        </pre>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(APPS_SCRIPT_CODE);
                            setScriptCopied(true);
                            setTimeout(() => setScriptCopied(false), 2000);
                          }}
                          style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}
                        >
                          {scriptCopied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                          {scriptCopied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </li>
                    <li>Press <b>Ctrl+S</b> to save. (Or click the save icon)</li>
                    <li>Click the blue <b>Deploy</b> button (top right) &gt; <b>New deployment</b>.</li>
                    <li>Click the Gear icon ⚙️ next to &quot;Select type&quot; and choose <b>Web app</b>.</li>
                    <li>Set &quot;Who has access&quot; to <b style={{ color: '#ef4444' }}>Anyone</b> and click Deploy.</li>
                    <li>(If asked, authorize with your Google account. Click &quot;Advanced&quot; &gt; &quot;Go to Prompts Studio...&quot;).</li>
                    <li>Copy the generated <b>Web App URL</b> and paste it in the box below! ✅</li>
                  </ol>
                </div>
              )}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                <input 
                  type="text" 
                  placeholder="https://script.google.com/macros/s/.../exec" 
                  className="field" 
                  value={sheetsUrl || ""}
                  onChange={(e) => updateSheetsUrl(e.target.value)}
                  style={{ fontSize: '12px', fontFamily: 'monospace' }} 
                />
                <button 
                  className="btn btn-secondary" 
                  style={{ alignSelf: 'flex-start', fontSize: '12px', padding: '6px 12px' }}
                  onClick={async () => {
                    if (!sheetsUrl) {
                      showToast("Please enter a URL first.", "error");
                      return;
                    }
                    try {
                      const res = await fetch(sheetsUrl, {
                        method: "POST",
                        body: JSON.stringify({ action: "ping" }),
                        headers: { "Content-Type": "text/plain;charset=utf-8" },
                      });
                      const data = await res.json();
                      if (data.success) {
                        showToast("✅ Successfully connected! " + data.message, "success");
                      } else {
                        showToast("❌ Error: " + data.message, "error");
                      }
                    } catch (err) {
                      showToast("❌ Connection failed. Check the URL and try again.", "error");
                    }
                  }}
                >
                  🔗 Test Connection
                </button>
              </div>
            </div>



            <div className="modal-reset-section" style={{ marginTop: '16px' }}>
              <div className="modal-reset-header">
                <RotateCcw size={16} />
                <strong>{t("settings.resetTitle")}</strong>
              </div>
              <p className="modal-reset-desc">{t("settings.resetDesc")}</p>
              <p className="modal-reset-items">{t("settings.resetItems")}</p>
              {resetDone ? (
                <div className="modal-reset-success">
                  <CheckCircle size={16} /> {t("settings.resetSuccess")}
                </div>
              ) : resetConfirm ? (
                <div className="modal-reset-confirm">
                  <p className="modal-reset-warning"><AlertTriangle size={14} /> {t("settings.resetConfirm")}</p>
                  <div className="modal-reset-actions">
                    <button className="btn btn-danger" onClick={handleResetAll}><Trash2 size={14} /> {t("settings.resetConfirmBtn")}</button>
                    <button className="btn btn-secondary" onClick={() => setResetConfirm(false)}>{t("settings.resetCancelBtn")}</button>
                  </div>
                </div>
              ) : (
                <button className="btn btn-danger-outline" onClick={() => setResetConfirm(true)}>
                  <Trash2 size={14} /> {t("settings.resetBtn")}
                </button>
              )}
            </div>
          </div>

          <div className="modal-foot">
            <button className="btn btn-secondary" onClick={onClose}>{t("settings.cancel")}</button>
            <button className="btn btn-primary" onClick={handleSave}>{saved ? <><Check size={16} />{t("prompt.saved")}</> : <><Save size={16} />{t("prompt.save")}</>}</button>
          </div>
        </div>
      </div>
    </div>
    
      {toast.show && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: toast.type === 'error' ? '#fef2f2' : '#ecfdf5', border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#a7f3d0'}`, padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 99999, boxShadow: '0 20px 40px rgba(0,0,0,0.15)', animation: 'slideUpBounce 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
          {toast.type === 'error' ? <AlertTriangle size={20} color="#ef4444" /> : <CheckCircle size={20} color="#10b981" />}
          <span style={{ color: toast.type === 'error' ? '#b91c1c' : '#047857', fontWeight: 600, fontSize: '14px' }}>{toast.message}</span>
        </div>
      )}
    </>
  );
}
