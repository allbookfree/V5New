"use client";

/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, X, AlertCircle, ScanSearch,
  Download, Play, Square, FileImage,
  CheckCircle2, XCircle, Clock, Loader2,
  Image as ImageIcon, Layers, ChevronDown, ChevronUp,
  Sparkles, RotateCcw, FileSpreadsheet, Copy, Check, Video
} from "lucide-react";
import { useApiKeys } from "@/context/ApiKeyContext";
import { useLanguage } from "@/context/LanguageContext";
import { mapApiError } from "@/lib/apiErrors";
import { getRequestInfo } from "@/lib/promptBuilder";
import { METADATA_PROMPTS } from "@/lib/metadataPrompts";
import { VISION_MODELS } from "@/config/models";

function ModelDropdown({ provider, currentModel, onSelect, onClose, alignRight, selectLabel }) {
  const models = VISION_MODELS[provider] || [];
  return (
    <div className={`model-dropdown-popover ${alignRight ? 'align-right' : ''}`}>
      <div className="model-dropdown-header">
         <span>{selectLabel}</span>
         <button className="dropdown-close-btn" onClick={(e) => { e.stopPropagation(); onClose(); }}><X size={14}/></button>
      </div>
      <div className="model-dropdown-list">
        {models.map(m => (
          <button 
            key={m.id} 
            className={`model-option ${currentModel === m.id ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onSelect(m.id); onClose(); }}
          >
            <div className="model-option-info">
              <span className="model-label">{m.label}</span>
              <span className="model-id">{m.id}</span>
            </div>
            {currentModel === m.id && <CheckCircle2 size={16} className="check-icon" />}
          </button>
        ))}
      </div>
    </div>
  );
}

function CopyBtn({ text, label = "" }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="btn-icon" title={`Copy ${label}`} style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, padding: '2px' }}>
      {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
    </button>
  );
}

function TopKeywords({ keywordsText }) {
  if (!keywordsText) return null;
  const parts = keywordsText.split(',').map(s => s.trim()).filter(Boolean);
  return (
    <p className="mgc-keywords">
      {parts.map((kw, i) => (
        <span key={i} style={{
          color: i < 10 ? 'var(--accent-color, #10b981)' : 'inherit',
          fontWeight: i < 10 ? 600 : 'normal',
          opacity: i >= 10 ? 0.85 : 1
        }}>
          {kw}{i < parts.length - 1 ? ", " : ""}
        </span>
      ))}
    </p>
  );
}

function SeoHealth({ result }) {
  if (!result || result.status !== "done") return null;
  const tLen = result.title?.length || 0;
  const titleValid = tLen > 0 && tLen <= 70;
  const kwValid = result.keywordCount >= 25 && result.keywordCount <= 50;

  const kw = result.keywords?.toLowerCase() || "";
  const hasHalal = kw.includes("nobody") || kw.includes("no people") || kw.includes("empty");

  return (
    <div style={{ display: 'flex', gap: '8px', fontSize: '11px', marginTop: '6px', alignItems: 'center' }}>
      <span style={{ color: titleValid ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '2px' }}>
        {titleValid ? <Check size={10} /> : <AlertCircle size={10} />} Title ({tLen}/70)
      </span>
      <span style={{ color: kwValid ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '2px' }}>
        {kwValid ? <Check size={10} /> : <AlertCircle size={10} />} KW ({result.keywordCount})
      </span>
      <span style={{ color: hasHalal ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '2px' }} title="Halal SEO: nobody/no people">
        {hasHalal ? <Check size={10} /> : <AlertCircle size={10} />} Halal
      </span>
    </div>
  );
}

const MAX_FILES = 500;

const STATIC_PROVIDER_LABEL = {
  // Gemini
  "gemini-2.5-flash": "Gemini Flash",
  "gemini-2.5-flash-lite": "Gemini Flash-Lite",
  "gemini-2.5-pro": "Gemini Pro",
  // Groq
  "meta-llama/llama-4-scout-17b-16e-instruct": "Groq Scout",
  "llama-3.3-70b-versatile": "Groq Llama 70B",
  "llama-3.1-8b-instant": "Groq Llama 8B",
  "openai/gpt-oss-120b": "Groq GPT-OSS 120B",
  "openai/gpt-oss-20b": "Groq GPT-OSS 20B",
  "qwen/qwen3-32b": "Groq Qwen3 32B",
  // Mistral
  "mistral-small-latest": "Mistral Small 4",
  "pixtral-12b-latest": "Pixtral 12B",
  "open-mistral-nemo": "Mistral Nemo",
  // HuggingFace
  "Qwen/Qwen2.5-VL-72B-Instruct": "HF Qwen VL 72B",
  "Qwen/Qwen2.5-VL-7B-Instruct": "HF Qwen VL 7B",
  "meta-llama/Llama-3.2-11B-Vision-Instruct": "HF Llama Vision",
  // Cerebras
  "gpt-oss-120b": "Cerebras GPT-OSS",
  "llama3.1-8b": "Cerebras Llama 8B",
  "qwen-3-235b-a22b-instruct-2507": "Cerebras Qwen 235B",
  "zai-glm-4.7": "Cerebras GLM 4.7",
  // NVIDIA NIM
  "meta/llama-4-maverick-17b-128e-instruct": "NIM Maverick",
  "meta/llama-3.2-90b-vision-instruct": "NIM Llama 90B",
  "meta/llama-3.2-11b-vision-instruct": "NIM Llama 11B",
  "nvidia/llama-3.3-nemotron-super-49b-v1": "NIM Nemotron",
  // GitHub Models
  "gpt-4o": "GitHub GPT-4o",
  "gpt-4o-mini": "GitHub GPT-4o Mini",
  "gpt-5": "GitHub GPT-5",
  "gpt-5-mini": "GitHub GPT-5 Mini",
  "gpt-5-nano": "GitHub GPT-5 Nano",
  "o4-mini": "GitHub o4-mini",
  "o3-mini": "GitHub o3-mini",
  "Phi-4": "GitHub Phi-4",
  "Phi-4-multimodal-instruct": "GitHub Phi-4 MM",
  "Phi-4-mini-instruct": "GitHub Phi-4 Mini",
  "Meta-Llama-3.3-70B-Instruct": "GitHub Llama 70B",
};

function formatProviderLabel(provider) {
  if (!provider) return "";
  if (STATIC_PROVIDER_LABEL[provider]) return STATIC_PROVIDER_LABEL[provider];
  if (provider.startsWith("openrouter:")) {
    const modelSlug = provider.replace("openrouter:", "");
    const nice = modelSlug
      .replace(/-/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/\bIt\b/gi, "")
      .replace(/\bVl\b/gi, "VL")
      .replace(/\bVl\b/gi, "VL")
      .replace(/\s+/g, " ")
      .trim();
    return `OR: ${nice}`;
  }
  if (provider.startsWith("hf:")) {
    const modelSlug = provider.replace("hf:", "");
    const nice = modelSlug
      .replace(/-/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/\bVl\b/gi, "VL")
      .replace(/\s+/g, " ")
      .trim();
    return `HF: ${nice}`;
  }
  return provider;
}

const MAX_SIDE_PX = 768;
const COMPRESS_QUALITY = 0.80;
const MAX_ORIGINAL_IMAGE_BYTES = 4 * 1024 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

// Re-encode an image through a canvas at its native resolution. The
// canvas API drops every EXIF tag, GPS coordinate, camera serial, IPTC
// caption, and ICC profile — so this is a privacy hardening pass for
// images we send to upstream vision models on behalf of the user.
function stripExifViaCanvas(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          // PNG inputs keep transparency; everything else gets a white
          // backstop so saved JPEG doesn't render black.
          const isPng = file.type === "image/png";
          if (!isPng) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx.drawImage(img, 0, 0);
          resolve(
            isPng
              ? canvas.toDataURL("image/png")
              : canvas.toDataURL("image/jpeg", 0.95),
          );
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function rasterizeImage(file, { contentType }) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_SIDE_PX || height > MAX_SIDE_PX) {
          if (width >= height) { height = Math.round((height / width) * MAX_SIDE_PX); width = MAX_SIDE_PX; }
          else { width = Math.round((width / height) * MAX_SIDE_PX); height = MAX_SIDE_PX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        const usePng = contentType === "vector" || file.type === "image/png" || file.type === "image/webp" || file.type === "image/svg+xml";
        if (!usePng) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
        }
        if (file.type === "image/svg+xml") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(usePng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", COMPRESS_QUALITY));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Extract a representative frame from a video file using the browser's
// native <video> element + <canvas>. Seeks to the midpoint of the clip
// (or 1 second if duration is unknown) so we avoid black intro frames.
function extractVideoFrame(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.crossOrigin = "anonymous";

    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not load video."));};

    video.onloadedmetadata = () => {
      const seekTo = video.duration > 2 ? video.duration / 2 : 1;
      video.currentTime = Math.min(seekTo, video.duration - 0.1);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        const MAX = 768;
        let { videoWidth: w, videoHeight: h } = video;
        if (w > MAX || h > MAX) {
          if (w >= h) { h = Math.round((h / w) * MAX); w = MAX; }
          else { w = Math.round((w / h) * MAX); h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    video.src = url;
    video.load();
  });
}

async function prepareFileForMetadata(file, contentType) {
  // Video: extract a frame using the browser's video element.
  if (file.type.startsWith("video/")) {
    return extractVideoFrame(file);
  }
  // SVG: vector input, must rasterize to a bitmap for vision models.
  if (file.type === "image/svg+xml") {
    return rasterizeImage(file, { contentType });
  }
  // Large bitmaps: downscale and re-encode (rasterizeImage already drops
  // EXIF as a side-effect of going through canvas).
  if (file.size > MAX_ORIGINAL_IMAGE_BYTES) {
    return rasterizeImage(file, { contentType });
  }
  // Small bitmaps: keep native resolution but still re-encode through
  // canvas to strip EXIF / GPS / IPTC metadata before the bytes leave
  // the user's device.
  try {
    return await stripExifViaCanvas(file);
  } catch {
    // Hard fallback to raw bytes if decoding fails (corrupt image, etc.)
    return readFileAsDataUrl(file);
  }
}

function StatusBadge({ status, t }) {
  const map = {
    pending: { icon: <Clock size={11} />, label: t("metadata.pending"), cls: "badge-pending" },
    processing: { icon: <Loader2 size={11} className="spin" />, label: t("metadata.analyzing"), cls: "badge-processing" },
    done: { icon: <CheckCircle2 size={11} />, label: t("metadata.done"), cls: "badge-done" },
    error: { icon: <XCircle size={11} />, label: t("metadata.error"), cls: "badge-error" },
    skipped: { icon: <X size={11} />, label: t("metadata.skipped"), cls: "badge-skipped" },
  };
  const s = map[status] || map.pending;
  return <span className={`status-badge ${s.cls}`}>{s.icon}{s.label}</span>;
}

function EditableText({ value, multiline, onSave, ariaLabel }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const startEdit = () => { setDraft(value || ""); setEditing(true); };
  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };
  if (editing) {
    return multiline ? (
      <textarea
        autoFocus
        className="field"
        value={draft}
        rows={3}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Escape") { setDraft(value || ""); setEditing(false); } if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commit(); }}
        aria-label={ariaLabel}
        style={{ fontSize: 13, padding: "4px 6px", margin: 0 }}
      />
    ) : (
      <input
        autoFocus
        className="field"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Escape") { setDraft(value || ""); setEditing(false); } if (e.key === "Enter") commit(); }}
        aria-label={ariaLabel}
        style={{ fontSize: 13, padding: "4px 6px", margin: 0 }}
      />
    );
  }
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={startEdit}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startEdit(); } }}
      title="Click to edit"
      style={{ cursor: "text", display: "inline-block", borderBottom: "1px dashed transparent" }}
      onMouseEnter={e => e.currentTarget.style.borderBottomColor = "var(--border)"}
      onMouseLeave={e => e.currentTarget.style.borderBottomColor = "transparent"}
    >
      {value}
    </span>
  );
}

function MetadataCard({ entry, result, index, onRemove, running, expanded, onToggle, onEdit, t }) {
  const status = result?.status || "pending";
  const isDone = status === "done";
  const isProcessing = status === "processing";
  const isError = status === "error";

  return (
    <div className={`mgc ${isProcessing ? "mgc-active" : ""} ${isDone ? "mgc-done" : ""}`}>
      <div className="mgc-thumb-wrap">
        {entry.preview
          ? <img src={entry.preview} alt={entry.file.name} className="mgc-thumb" />
          : <div className="mgc-thumb-placeholder"><FileImage size={20} /></div>
        }
        {isProcessing && (
          <div className="mgc-thumb-overlay">
            <Loader2 size={22} className="spin" style={{ color: "#fff" }} />
          </div>
        )}
        {isDone && (
          <div className="mgc-thumb-check"><CheckCircle2 size={14} /></div>
        )}
        {!running && (
          <button className="mgc-remove" onClick={() => onRemove(entry.id)} aria-label="Remove">
            <X size={10} />
          </button>
        )}
        <span className="mgc-index">{index + 1}</span>
      </div>

      <div className="mgc-body">
        <div className="mgc-header">
          <span className="mgc-filename" title={entry.file.name}>{entry.file.name}</span>
          <StatusBadge status={status} t={t} />
        </div>

        {isDone && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <p className="mgc-title" style={{ margin: 0 }}>
                {onEdit ? (
                  <EditableText value={result.title} ariaLabel="Edit title" onSave={(v) => onEdit(result.id, { title: v })} />
                ) : result.title}
              </p>
              <CopyBtn text={result.title} label="Title" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginTop: '6px' }}>
              <p className="mgc-desc" style={{ margin: 0 }}>
                {onEdit ? (
                  <EditableText value={result.description} multiline ariaLabel="Edit description" onSave={(v) => onEdit(result.id, { description: v })} />
                ) : result.description}
              </p>
              <CopyBtn text={result.description} label="Description" />
            </div>

            <SeoHealth result={result} />

            <div className="mgc-footer">
              <span className="kw-count">{result.keywordCount} {t("metadata.kw")}</span>
              {result.provider && (
                <span className="mgc-provider">{formatProviderLabel(result.provider)}</span>
              )}
              <button className="mgc-expand-btn" onClick={onToggle}>
                {expanded ? <><ChevronUp size={12} />{t("metadata.less")}</> : <><ChevronDown size={12} />{t("metadata.keywords")}</>}
              </button>
            </div>
            {expanded && (
              <div className="mgc-keywords-wrap" style={{ position: 'relative', paddingRight: '20px' }}>
                {onEdit ? (
                  <p className="mgc-keywords">
                    <EditableText
                      value={result.keywords}
                      multiline
                      ariaLabel="Edit keywords"
                      onSave={(v) => {
                        const cleaned = v.split(",").map(s => s.trim()).filter(Boolean).join(", ");
                        onEdit(result.id, { keywords: cleaned, keywordCount: cleaned ? cleaned.split(",").length : 0 });
                      }}
                    />
                  </p>
                ) : (
                  <TopKeywords keywordsText={result.keywords} />
                )}
                <div style={{ position: 'absolute', top: '8px', right: '4px' }}>
                  <CopyBtn text={result.keywords} label="Keywords" />
                </div>
              </div>
            )}
          </>
        )}

        {isProcessing && (
          <div className="mgc-shimmer">
            <div className="shimmer-line w-75" />
            <div className="shimmer-line w-50" />
            <div className="shimmer-line w-90" />
          </div>
        )}

        {isError && (
          <p className="mgc-error">{result.error || t("metadata.analysisFailed")}</p>
        )}

        {status === "pending" && (
          <p className="mgc-waiting">{t("metadata.waiting")}</p>
        )}

        {status === "skipped" && (
          <p className="mgc-waiting">{t("metadata.skippedMsg")}</p>
        )}
      </div>
    </div>
  );
}

export default function MetadataGeneratorPage() {
  const { getAllKeys, selectedVisionModels, setSelectedVisionModel } = useApiKeys();
  const { t, lang } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [contentType, setContentType] = useState("image");
  const [running, setRunning] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(null);
  const [drag, setDrag] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [targetMarket, setTargetMarket] = useState("all");
  const [autoFallback, setAutoFallback] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState(null); // 'gemini', 'groq', etc.
  const stopRef = useRef(false);
  const inputRef = useRef(null);
  const [eta, setEta] = useState("");
  const batchStartRef = useRef(null);
  // Tracks whether the most recently completed call hit a rate limit. Used
  // to trigger a longer cooldown between requests. Refs sidestep the stale-
  // closure bug where reading `results` inside runBatch always saw the
  // pre-batch snapshot and never detected a 429.
  const lastCallRateLimitedRef = useRef(false);

  const filesRef = useRef(files);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
    return () => {
      filesRef.current.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
    };
  }, []);

  const apiKeys = mounted ? getAllKeys("gemini").filter(k => k.trim()) : [];
  const groqKeys = mounted ? getAllKeys("groq").filter(k => k.trim()) : [];
  const mistralKeys = mounted ? getAllKeys("mistral").filter(k => k.trim()) : [];
  const orKeys = mounted ? getAllKeys("openrouter").filter(k => k.trim()) : [];
  const hfKeys = mounted ? getAllKeys("huggingface").filter(k => k.trim()) : [];
  const githubKeys = mounted ? getAllKeys("github").filter(k => k.trim()) : [];
  const nvidiaKeys = mounted ? getAllKeys("nvidia").filter(k => k.trim()) : [];
  const hasApiKey = apiKeys.length > 0 || groqKeys.length > 0 || mistralKeys.length > 0 || orKeys.length > 0 || hfKeys.length > 0 || githubKeys.length > 0 || nvidiaKeys.length > 0;
  const [preferredProvider, setPreferredProvider] = useState("auto");

  // Keep auto mode consistent with toggle — use event handler instead of effect
  // (the sync is handled directly in the toggle onClick handlers below)


  const doneResults = results.filter(r => r.status === "done");
  const completedCount = results.filter(r => ["done", "error", "skipped"].includes(r.status)).length;
  const progress = files.length > 0 ? Math.round((completedCount / files.length) * 100) : 0;

  const addFiles = useCallback((newFiles) => {
    const valid = Array.from(newFiles).filter(f =>
      f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    if (!valid.length) return;
    setFiles(prev => {
      const remaining = MAX_FILES - prev.length;
      const toAdd = valid.slice(0, remaining);
      const entries = toAdd.map(f => ({
        id: `${f.name}-${f.size}-${Math.random()}`,
        file: f,
        preview: URL.createObjectURL(f),
      }));
      setResults(r => [
        ...r,
        ...entries.map(e => ({
          id: e.id,
          filename: e.file.name,
          status: "pending",
          title: "", description: "", keywords: "", keywordCount: 0, error: "",
        })),
      ]);
      return [...prev, ...entries];
    });
  }, []);

  const removeFile = (id) => {
    if (running) return;
    setFiles(prev => {
      const entry = prev.find(f => f.id === id);
      if (entry?.preview) URL.revokeObjectURL(entry.preview);
      return prev.filter(f => f.id !== id);
    });
    setResults(prev => prev.filter(r => r.id !== id));
  };

  const clearAll = () => {
    if (running) return;
    files.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
    setFiles([]); setResults([]); setGlobalError(""); setCurrentIdx(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const updateResult = (id, patch) =>
    setResults(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));

  const processOneFile = async (entry, totalCount) => {
    updateResult(entry.id, { status: "processing", error: "" });
    try {
      const base64 = await prepareFileForMetadata(entry.file, contentType);
      const res = await fetch("/api/generate-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64,
          apiKeys,
          groqKeys,
          mistralKeys,
          orKeys,
          hfKeys,
          githubKeys,
          nvidiaKeys,
          selectedModels: selectedVisionModels,
          preferredProvider: (autoFallback || preferredProvider === "auto") ? "auto" : preferredProvider,
          contentType,
          targetMarket,
        }),
      });
      if (!res.ok) {
        let errMsg = t("metadata.analysisFailed");
        try {
          const text = await res.text();
          if (text.trim().startsWith("{")) errMsg = mapApiError(JSON.parse(text), t);
        } catch { }
        lastCallRateLimitedRef.current = res.status === 429
          || /rate.?limit|429|too many/i.test(String(errMsg));
        updateResult(entry.id, { status: "error", error: errMsg });
      } else {
        lastCallRateLimitedRef.current = false;
        const meta = await res.json();
        updateResult(entry.id, {
          status: "done",
          title: meta.title,
          description: meta.description,
          keywords: meta.keywords,
          keywordCount: meta.keywordCount,
          provider: meta.provider || "gemini-2.5-flash",
        });
      }
    } catch (err) {
      lastCallRateLimitedRef.current = /rate.?limit|429|too many/i.test(String(err?.message || ""));
      updateResult(entry.id, { status: "error", error: err.message || "Network error." });
    }
  };

  const runBatch = async (fileList, { skipDone = false } = {}) => {
    setGlobalError(""); setRunning(true); stopRef.current = false;
    batchStartRef.current = Date.now();
    setEta("");
    let processedSoFar = 0;

    for (let i = 0; i < fileList.length; i++) {
      if (stopRef.current) {
        fileList.slice(i).forEach(f => updateResult(f.id, { status: "skipped" }));
        break;
      }
      const entry = fileList[i];
      if (skipDone) {
        const result = results.find(r => r.id === entry.id);
        if (result?.status === "done") { processedSoFar++; continue; }
      }

      setCurrentIdx(files.indexOf(entry));
      await processOneFile(entry, fileList.length);

      processedSoFar++;
      const elapsed = Date.now() - batchStartRef.current;
      const remaining = fileList.length - processedSoFar;
      if (processedSoFar > 0 && remaining > 0) {
        const avgMs = elapsed / processedSoFar;
        const etaSec = Math.ceil((avgMs * remaining) / 1000);
        setEta(etaSec >= 60 ? `~${Math.ceil(etaSec / 60)}m left` : `~${etaSec}s left`);
      } else {
        setEta("");
      }

      // Adaptive pacing: short jitter while everything's healthy, longer cooldown only after a 429.
      // Previous fixed 12-20s delay made a 50-image batch take ~12 minutes even on premium keys.
      // Using a ref (set inside processOneFile) avoids the stale-closure bug where `results`
      // captured on batch-start never reflected in-flight statuses.
      if (i < fileList.length - 1 && !stopRef.current) {
        const hadRateLimit = lastCallRateLimitedRef.current;
        const delayMs = hadRateLimit
          ? 12000 + Math.floor(Math.random() * 8000)
          : 800 + Math.floor(Math.random() * 700);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
    setRunning(false); setCurrentIdx(null); setEta("");
  };

  const start = async () => {
    if (!hasApiKey) return setGlobalError(t("metadata.noKeysWarning"));
    if (!files.length) return setGlobalError(t("metadata.uploadWarning"));
    await runBatch(files, { skipDone: true });
  };

  const stop = () => { stopRef.current = true; };

  const failedResults = results.filter(r => r.status === "error" || r.status === "skipped");

  const retryFailed = async () => {
    if (!hasApiKey || failedResults.length === 0) return;
    const failedIds = new Set(failedResults.map(r => r.id));
    const failedFiles = files.filter(f => failedIds.has(f.id));
    await runBatch(failedFiles);
  };

  const xlsxRef = useRef(null);
  useEffect(() => {
    import("xlsx-js-style").then(mod => { xlsxRef.current = mod.default || mod; });
  }, []);

  const downloadExcel = async () => {
    if (!doneResults.length) return;
    const XLSX = xlsxRef.current || (await import("xlsx-js-style").then(m => m.default || m));
    const rows = [
      ["FileName", "Title", "Description", "Keywords"],
      ...doneResults.map(r => [r.filename || "", r.title || "", r.description || "", r.keywords || ""]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 30 }, { wch: 40 }, { wch: 60 }, { wch: 80 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Metadata");
    XLSX.writeFile(wb, `metadata_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const downloadCsv = () => {
    if (!doneResults.length) return;
    const escape = (s) => `"${(s || "").replace(/"/g, '""')}"`;
    const header = "FileName,Title,Description,Keywords";
    const rows = doneResults.map(r =>
      [escape(r.filename), escape(r.title), escape(r.description), escape(r.keywords)].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metadata_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div
      className="page mg-page"
      onDrop={e => { e.preventDefault(); setDrag(false); if (!running) addFiles(e.dataTransfer.files); }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDrag(false); }}
    >
      {drag && <div className="mg-drag-overlay"><Upload size={32} /><p>{t("metadata.dropHere")}</p></div>}

      <div className="page-head" style={{ marginBottom: 20 }}>
        <div className="page-icon" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
          <ScanSearch size={24} />
        </div>
        <h1 className="page-title">{t("metadata.title")}</h1>
        <p className="page-desc">{t("metadata.description")}</p>
      </div>

      <div className="mg-bar">
        <div className="ct-selector" style={{ gap: 6 }}>
          <button className={`ct-btn ${contentType === "image" ? "ct-active" : ""}`}
            onClick={() => !running && setContentType("image")} disabled={running}>
            <ImageIcon size={14} /><span>{t("metadata.photo")}</span>
          </button>
          <button className={`ct-btn ${contentType === "vector" ? "ct-active" : ""}`}
            onClick={() => !running && setContentType("vector")} disabled={running}>
            <Layers size={14} /><span>{t("metadata.vector")}</span>
          </button>
          <button className={`ct-btn ${contentType === "video" ? "ct-active" : ""}`}
            onClick={() => !running && setContentType("video")} disabled={running}>
            <Video size={14} /><span>{t("metadata.video")}</span>
          </button>
        </div>

        <label className={`mg-upload-label ${running ? "disabled" : ""}`}>
          <Upload size={14} />
          {contentType === "video" ? t("metadata.addVideos") : t("metadata.addImages")}
          {files.length > 0 && <span className="mg-bar-count">{files.length}</span>}
          <input ref={inputRef} type="file"
            accept={contentType === "video" ? "video/mp4,video/webm,video/quicktime,video/mov" : "image/*"}
            multiple style={{ display: "none" }}
            onChange={e => addFiles(e.target.files)} disabled={running} />
        </label>

        {(running || (files.length > 0 && completedCount > 0)) && (
          <div className="mg-bar-progress">
            <div className="mg-bar-progress-track">
              <div className="mg-bar-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <span>{completedCount}/{files.length}</span>
            {eta && <span className="mg-eta">{eta}</span>}
          </div>
        )}

        <div className="mg-secondary-controls" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', background: 'var(--bg2)', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)', marginTop: '8px' }}>
          <div className="mg-select-wrap" style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>{lang === "bn" ? "🎯 মার্কেটপ্লেস টার্গেটিং" : "🎯 Target Platform"}</label>
            <select className="ct-btn" style={{ fontSize: 13, padding: "6px 12px", width: '100%', height: '36px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px' }} value={targetMarket} onChange={e => setTargetMarket(e.target.value)} disabled={running}>
              <option value="all">{lang === "bn" ? "যেকোনো মার্কেটপ্লেস (ডিফল্ট)" : "General (Default)"}</option>
              <option value="adobe">Adobe Stock</option>
              <option value="shutterstock">Shutterstock</option>
              <option value="freepik">Freepik</option>
              <option value="getty">Getty Images / iStock</option>
              <option value="dreamstime">Dreamstime / Depositphotos</option>
              <option value="vecteezy">Vecteezy</option>
              <option value="pond5">Pond5</option>
              <option value="creativemarket">Creative Market</option>
              <option value="envato">Envato Elements</option>
              <option value="etsy">Etsy</option>
              <option value="wirestock">Wirestock</option>
              <option value="redbubble">Redbubble</option>
            </select>
          </div>

          <div className="mg-toggle-wrap" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: autoFallback ? 'var(--accent-glow)' : 'var(--bg)', padding: '8px 14px', borderRadius: '6px', border: `1px solid ${autoFallback ? 'var(--accent)' : 'var(--border)'}`, transition: 'all 0.3s' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.3 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: autoFallback ? 'var(--accent)' : 'var(--text2)' }}>{lang === "bn" ? "⚡ অটো-ফলব্যাক" : "⚡ Auto-Fallback"}</span>
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>{lang === "bn" ? "লিমিট হলে অটো সুইচ" : "Switch provider on limit"}</span>
            </div>
            <button
               title={lang === "bn" ? "অটো-ফলব্যাক" : "Auto-Fallback"}
               className={`toggle-track ${autoFallback ? 'on' : 'off'}`}
               onClick={() => {
                 if (running) return;
                 const nextAuto = !autoFallback;
                 setAutoFallback(nextAuto);
                 if (nextAuto) {
                   // Turning ON auto mode
                   setPreferredProvider("auto");
                 } else {
                   // Turning OFF auto mode — must pick a real provider
                   if (apiKeys.length) setPreferredProvider("gemini");
                   else if (githubKeys.length) setPreferredProvider("github");
                   else if (nvidiaKeys.length) setPreferredProvider("nvidia");
                   else if (groqKeys.length) setPreferredProvider("groq");
                   else if (mistralKeys.length) setPreferredProvider("mistral");
                   else if (hfKeys.length) setPreferredProvider("huggingface");
                   else if (orKeys.length) setPreferredProvider("openrouter");
                 }
               }}
               style={{ transform: 'scale(0.9)', cursor: running ? 'default' : 'pointer', margin: 0 }}
            >
              <div className={`toggle-thumb ${autoFallback ? 'on' : 'off'}`} />
            </button>
          </div>
        </div>

        {mounted && (
          <div className="mg-provider-selector-v2">
             <button
                className={`ct-btn auto-btn-toggle ${autoFallback || preferredProvider === "auto" ? "active" : ""}`}
                onClick={() => {
                  if (running || !hasApiKey) return;
                  if (autoFallback || preferredProvider === "auto") {
                    // Turn OFF Auto mode
                    setAutoFallback(false);
                    // Select a default provider if none is validly selected
                    if (apiKeys.length) setPreferredProvider("gemini");
                    else if (githubKeys.length) setPreferredProvider("github");
                    else if (nvidiaKeys.length) setPreferredProvider("nvidia");
                    else if (mistralKeys.length) setPreferredProvider("mistral");
                    else if (hfKeys.length) setPreferredProvider("huggingface");
                    else setPreferredProvider("openrouter");
                  } else {
                    // Turn ON Auto mode
                    setAutoFallback(true);
                    setPreferredProvider("auto");
                    setActiveDropdown(null); // Hide any open dropdowns
                  }
                }}
                disabled={running || !hasApiKey}
              >
                <Sparkles size={16} />
                <span>{t("metadata.auto")}</span>
              </button>

            <div className={`provider-pills-wrapper ${(autoFallback || preferredProvider === "auto") ? "auto-is-on" : ""}`}>
              {[
                { id: "gemini", label: "Gemini", hasKey: apiKeys.length > 0 },
                { id: "github", label: "GitHub", hasKey: githubKeys.length > 0 },
                { id: "nvidia", label: "NVIDIA NIM", hasKey: nvidiaKeys.length > 0 },
                { id: "groq", label: "Groq", hasKey: groqKeys.length > 0 },
                { id: "mistral", label: "Mistral", hasKey: mistralKeys.length > 0 },
                { id: "openrouter", label: "OpenRouter", hasKey: orKeys.length > 0 },
                { id: "huggingface", label: "HuggingFace", hasKey: hfKeys.length > 0 },
              ].map(({ id, label, hasKey }) => {
                const currentModel = selectedVisionModels?.[id] || (VISION_MODELS[id]?.[0]?.id);
                const isAuto = autoFallback || preferredProvider === "auto";
                const isSelected = preferredProvider === id && !isAuto;
                
                return (
                  <div key={id} className="provider-pill-container">
                    <button
                      className={`ct-btn provider-pill ${isSelected ? "ct-active" : ""}${!hasKey ? " ct-btn-nokey" : ""}`}
                      title={!hasKey ? t("metadata.noKeyHint") : `Select ${label}`}
                      onClick={() => {
                        if (running || !hasKey || isAuto) return;
                        if (isSelected) {
                          setActiveDropdown(activeDropdown === id ? null : id);
                        } else {
                          setAutoFallback(false);
                          setPreferredProvider(id);
                          setActiveDropdown(null);
                        }
                      }}
                      onContextMenu={(e) => {
                         e.preventDefault();
                         if (hasKey && !isAuto) setActiveDropdown(id);
                      }}
                      disabled={running || isAuto}
                    >
                      <span className="provider-name">{label}</span>
                      {hasKey && !isAuto && <ChevronDown size={12} className={`pill-arrow ${activeDropdown === id ? 'open' : ''}`} />}
                    </button>
                  
                  {activeDropdown === id && (
                    <ModelDropdown 
                      provider={id}
                      currentModel={currentModel}
                      onSelect={(modelId) => {
                        setSelectedVisionModel(id, modelId);
                        setActiveDropdown(null);
                      }}
                      onClose={() => setActiveDropdown(null)}
                      alignRight={id === "huggingface" || id === "openrouter"}
                      selectLabel={t("apiDash.selectModel")}
                    />
                  )}
                </div>
              );
            })}
          </div>
          </div>
        )}

        <div className="mg-bar-actions">
          {!running && files.length > 0 && (
            <button className="btn btn-ghost" style={{ padding: "8px 10px", fontSize: 13 }} onClick={clearAll}>
              <X size={13} />{t("metadata.clear")}
            </button>
          )}
          <button className="btn btn-primary" onClick={start}
            disabled={running || !files.length || !hasApiKey} style={{ padding: "9px 18px" }}>
            <Play size={14} />{t("metadata.start")}
          </button>
          {!running && failedResults.length > 0 && (
            <button className="btn btn-secondary" onClick={retryFailed}
              disabled={!hasApiKey} style={{ padding: "9px 14px" }}>
              <RotateCcw size={14} />{t("metadata.retry")} {failedResults.length}
            </button>
          )}
          <button className="btn btn-danger" onClick={stop} disabled={!running} style={{ padding: "9px 14px" }}>
            <Square size={14} />{t("metadata.stop")}
          </button>
          <button className="btn btn-secondary" onClick={downloadExcel}
            disabled={!doneResults.length} style={{ padding: "9px 14px" }}>
            <Download size={14} />{t("metadata.excel")}
          </button>
          <button className="btn btn-secondary" onClick={downloadCsv}
            disabled={!doneResults.length} 
            style={{ 
              padding: "9px 14px", 
              background: doneResults.length > 0 ? "var(--accent-glow)" : "",
              borderColor: doneResults.length > 0 ? "var(--accent)" : "",
              color: doneResults.length > 0 ? "var(--accent)" : ""
            }}>
            <FileSpreadsheet size={14} />
            {lang === "bn" ? `CSV ডাউনলোড (${doneResults.length})` : `Download CSV (${doneResults.length})`}
          </button>
        </div>
      </div>

      {globalError && (
        <div className="error" style={{ marginBottom: 16 }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>{globalError}</span>
        </div>
      )}

      {mounted && !hasApiKey && (
        <div className="info-box" style={{ marginBottom: 16 }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>{t("metadata.noKeysLong")}</span>
        </div>
      )}

      {files.length === 0 ? (
        <div className="mg-empty-main">
          <div className="mg-empty-icon"><Sparkles size={28} /></div>
          <h3 className="mg-empty-title">{t("metadata.uploadTitle")}</h3>
          <p className="mg-empty-desc">
            {t("metadata.uploadDesc")}
          </p>
          <label className="btn btn-primary mg-empty-btn">
            <Upload size={16} />{t("metadata.browseImages")}
            <input type="file" accept="image/*" multiple style={{ display: "none" }}
              onChange={e => addFiles(e.target.files)} />
          </label>
        </div>
      ) : (
        <div className="mgc-grid">
          {files.map((entry, i) => {
            const result = results.find(r => r.id === entry.id);
            return (
              <MetadataCard
                key={entry.id}
                entry={entry}
                result={result}
                index={i}
                onRemove={removeFile}
                running={running}
                expanded={expandedId === entry.id}
                onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                onEdit={updateResult}
                t={t}
              />
            );
          })}
        </div>
      )}

    </div>
  );
}
