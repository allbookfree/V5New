/* eslint-disable react-hooks/purity, react-hooks/immutability, react-hooks/set-state-in-effect */
"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Play, Square, Download, CheckCircle, XCircle, AlertTriangle, Activity, Trash2, Clock } from "lucide-react";
import ErrorBoundary from "./ErrorBoundary";
import { useApiKeys } from "@/context/ApiKeyContext";
import { parseNumberedPrompts } from "@/lib/promptUtils";
import { getRandomSeeds } from "@/lib/subjectPool";
import { PROVIDERS_UI } from "@/config/models";
import { PROVIDER_MODELS } from "@/config/providerModels";
import { getModelKey, groupMatrixByModel, initModelProgress, loadModelQueue, saveModelQueue, clearModelQueue, getModelSummary } from "@/lib/modelQueueManager";

// Keep in sync with the marketplaces shown in PromptGenerator.jsx so the
// benchmark exercises every marketplace the production UI exposes.
const MARKETPLACES = [
  "all",
  // Direct API / scraping-free marketplaces
  "adobe",
  "freepik",
  "dreamstime",
  "vecteezy",
  "etsy",
  "wirestock",
  "redbubble",
  "123rf",
  "pixta",
  "society6",
  "pixabay",
  // Manual-touch marketplaces
  "shutterstock",
  "getty",
  "depositphotos",
  "pond5",
  "creativemarket",
  "envato",
  "amazon-kdp",
];

// Keep in sync with SPECIAL_MODES_BY_TYPE in PromptGenerator.jsx so the
// benchmark always exercises every generation mode the website exposes.
// `auto` and `engineer` are universal modes prepended to every list.
const SPECIAL_MODES_BY_TYPE = {
  image: [
    "surreal",
    "background-texture",
    "wall-art",
    "mockup",
    "collection",
    "print-on-demand",
    "seasonal",
  ],
  vector: [
    "glyph-icons",
    "t-shirt-graphic",
    "character-mascot",
    "icon-pack",
    "icon-bundle",
    "web-ui-icons",
    "pattern",
    "sticker-pack",
    "clipart-bundle",
    "logo-element",
    "infographic",
    "social-template",
    "background-texture",
    "brand-icons",
    "collection",
  ],
  video: [
    "aerial-drone",
    "macro-cinematic",
    "product-showcase",
    "b-roll",
    "loopable",
    "vertical",
    "time-lapse",
    "slow-motion",
    "motion-graphics",
    "collection",
  ],
};

const getModesForType = (type) => ["auto", "engineer", ...(SPECIAL_MODES_BY_TYPE[type] || [])];

const MODE_LABELS = {
  auto: "Auto",
  engineer: "Engineer",
  // image
  "surreal": "Surreal",
  "background-texture": "BG/Texture",
  "wall-art": "Wall Art",
  "mockup": "Mockup",
  "collection": "Collection",
  "print-on-demand": "Print-on-Demand",
  "seasonal": "Seasonal",
  // vector
  "glyph-icons": "Glyph Icons",
  "t-shirt-graphic": "T-Shirt Graphic",
  "character-mascot": "Character Mascot",
  "icon-pack": "Icon Pack",
  "icon-bundle": "Glyph Bundle",
  "web-ui-icons": "Web UI Icons",
  "pattern": "Pattern",
  "sticker-pack": "Sticker",
  "clipart-bundle": "Clipart",
  "logo-element": "Logo Element",
  "infographic": "Infographic",
  "social-template": "Social",
  "brand-icons": "Brand Icons",
  // video
  "aerial-drone": "Aerial / Drone",
  "macro-cinematic": "Macro Cinematic",
  "product-showcase": "Product Showcase",
  "b-roll": "B-roll",
  "loopable": "Loopable",
  "vertical": "Vertical (9:16)",
  "time-lapse": "Time-lapse",
  "slow-motion": "Slow-motion",
  "motion-graphics": "Motion graphics",
};

// Modes that have a dedicated `.btn-<value>` class baked into the legacy
// CSS — used by Live Visual Automation to highlight the right button.
const LEGACY_MODE_BUTTON_CLASSES = new Set([
  "auto", "engineer", "icon-pack", "pattern", "sticker-pack", "mockup",
  "social-template", "infographic", "surreal", "background-texture",
  "web-ui-icons", "clipart-bundle", "logo-element", "wall-art", "collection",
]);

// Union of every mode the AutoTester knows about. Used as the default
// `selectedModes` so toggling type pre-selects everything that applies.
const ALL_MODES = Array.from(new Set([
  "auto", "engineer",
  ...SPECIAL_MODES_BY_TYPE.image,
  ...SPECIAL_MODES_BY_TYPE.vector,
  ...SPECIAL_MODES_BY_TYPE.video,
]));
const HEARTBEAT_MS = 15000;
const STALL_STEP_MS = 8 * 60 * 1000;
const INITIAL_COOLDOWN_MS = 5 * 60 * 1000;   // 5 minutes — adaptive start (most rate limits reset quickly)
const MAX_COOLDOWN_MS = 60 * 60 * 1000;      // 1 hour maximum cooldown cap
const PROVIDER_COOLDOWN_MS = MAX_COOLDOWN_MS; // Circuit breaker fallback (extreme failures only)
const MAX_DEFER_RETRIES = 3;
const CIRCUIT_BREAKER_FAILURES = 4;

export default function AutoTester({ type, setMainPrompts, setMainLoading, setMainGenStep, setMainModelUsed, setModel, setTargetMarket }) {
  const { getAllKeys, keys, setSelectedModel, sheetsUrl } = useApiKeys();
  
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "", subLabel: "" });
  const [showTester, setShowTester] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeKeyInfo, setActiveKeyInfo] = useState("");
  const [selectedProviders, setSelectedProviders] = useState(Object.keys(PROVIDER_MODELS));
  const [selectedModels, setSelectedModels] = useState(() => Object.values(PROVIDER_MODELS).flat().map(m => m.value));
  const [selectedMarketplaces, setSelectedMarketplaces] = useState(MARKETPLACES);
  const [selectedModes, setSelectedModes] = useState(ALL_MODES);
  const [isLeaderboardExpanded, setIsLeaderboardExpanded] = useState(false);
  
  const [autoSyncSheets, setAutoSyncSheets] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("auto_tester_sheets_sync") === "true";
  });
  
  const [enablePreFlight, setEnablePreFlight] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("auto_tester_preflight") === "true";
  });
  
  const [enableAudioAlerts, setEnableAudioAlerts] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("auto_tester_audio") !== "false";
  });

  const playAudioAlert = useCallback((type) => {
    if (!enableAudioAlerts) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch(e) {}
  }, [enableAudioAlerts]);

  const [isSyncing, setIsSyncing] = useState(false);
  const [showSheetsClearConfirm, setShowSheetsClearConfirm] = useState(false);
  const [isDeletingSheets, setIsDeletingSheets] = useState(false);
  
  // UPS 4.0: Live Health Status for API Keys
  // { providerKey: [ { status: 'active'|'cooldown'|'exhausted', label: 'Master'|'Backup N' } ] }
  const [liveKeyStatuses, setLiveKeyStatuses] = useState({});
  const [modelQueueStatus, setModelQueueStatus] = useState({});
  const skipProviderRef = useRef(false);

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 4000);
  };

  const abortControllerRef = useRef(null);
  const isRunningRef = useRef(false);
  const runIdRef = useRef("");
  const currentStepStartedAtRef = useRef(0);
  const currentStepLabelRef = useRef("");
  const silentAudioRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // 1-second completely silent WAV file
      const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
      audio.loop = true;
      audio.volume = 0.01;
      silentAudioRef.current = audio;
    }
    return () => {
      if (silentAudioRef.current) {
        silentAudioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    if (isRunning && silentAudioRef.current) {
      // Browsers require user interaction before playing audio, 
      // but since startTest is triggered by a click, this is perfectly allowed.
      silentAudioRef.current.play().catch(e => console.warn("Silent wake-lock audio blocked:", e));
    } else if (!isRunning && silentAudioRef.current) {
      silentAudioRef.current.pause();
    }
  }, [isRunning]);

  const analytics = useMemo(() => {
    if (results.length === 0) return [];
    const stats = {};
    results.forEach(r => {
        if (!stats[r.modelValue]) {
            stats[r.modelValue] = { label: r.modelLabel, provider: r.provider, success: 0, error: 0, totalTime: 0, timeCount: 0 };
        }
        if (r.status === 'Success') {
            stats[r.modelValue].success++;
            stats[r.modelValue].totalTime += parseFloat(r.time || 0);
            stats[r.modelValue].timeCount++;
        } else if (r.status === 'Error') {
            stats[r.modelValue].error++;
        } else if (r.status === 'Skipped') {
            stats[r.modelValue].skipped = (stats[r.modelValue].skipped || 0) + 1;
        }
    });
    
    return Object.values(stats).map(s => {
       const total = s.success + s.error + (s.skipped || 0);
       return {
         ...s,
         total,
         successRate: total > 0 ? (s.success / total) * 100 : 0,
         avgTime: s.timeCount > 0 ? (s.totalTime / s.timeCount).toFixed(1) : 0
       };
    }).sort((a,b) => {
       if (b.successRate !== a.successRate) return b.successRate - a.successRate;
       return a.avgTime - b.avgTime;
    });
  }, [results]);

  useEffect(() => {
    if (!isRunning) {
      let pastSeconds = 0;
      if (results && results.length > 0) {
        results.forEach(r => {
          pastSeconds += (parseFloat(r.time || 0) + 15);
        });
      }
      setElapsedSeconds(Math.round(pastSeconds));
    }
  }, [isRunning, results]);

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  // Clean up running tasks if the component is unmounted
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const LOCAL_STORAGE_KEY = `auto_tester_results_${type}`;
  const LOCAL_STORAGE_BACKUP_KEY = `${LOCAL_STORAGE_KEY}_backup`;
  const SESSION_STORAGE_KEY = `${LOCAL_STORAGE_KEY}_session`;
  const RUN_CHECKPOINT_KEY = `${LOCAL_STORAGE_KEY}_checkpoint`;

  const readPersistentState = useCallback(() => {
    const candidates = [
      localStorage.getItem(LOCAL_STORAGE_KEY),
      localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY),
      sessionStorage.getItem(SESSION_STORAGE_KEY),
    ].filter(Boolean);

    for (const raw of candidates) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.results)) return parsed;
      } catch (e) {}
    }
    return null;
  }, [LOCAL_STORAGE_KEY, LOCAL_STORAGE_BACKUP_KEY, SESSION_STORAGE_KEY]);

  const writePersistentState = useCallback((payload) => {
    const data = JSON.stringify(payload);
    localStorage.setItem(LOCAL_STORAGE_KEY, data);
    localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, data);
    sessionStorage.setItem(SESSION_STORAGE_KEY, data);
  }, [LOCAL_STORAGE_KEY, LOCAL_STORAGE_BACKUP_KEY, SESSION_STORAGE_KEY]);

  const saveRunCheckpoint = useCallback((checkpoint) => {
    try {
      localStorage.setItem(RUN_CHECKPOINT_KEY, JSON.stringify(checkpoint));
    } catch (e) {}
  }, [RUN_CHECKPOINT_KEY]);

  const readRunCheckpoint = useCallback(() => {
    try {
      const raw = localStorage.getItem(RUN_CHECKPOINT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.matrix)) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }, [RUN_CHECKPOINT_KEY]);

  const clearRunCheckpoint = useCallback(() => {
    try {
      localStorage.removeItem(RUN_CHECKPOINT_KEY);
    } catch (e) {}
  }, [RUN_CHECKPOINT_KEY]);

  useEffect(() => {
    if (!isRunning) return;
    const heartbeat = setInterval(() => {
      try {
        const checkpoint = readRunCheckpoint();
        if (!checkpoint?.isRunning) return;
        saveRunCheckpoint({ ...checkpoint, heartbeatAt: Date.now(), updatedAt: Date.now() });
      } catch (e) {}
    }, HEARTBEAT_MS);
    return () => clearInterval(heartbeat);
  }, [isRunning, readRunCheckpoint, saveRunCheckpoint]);

  // Load saved state on mount
  useEffect(() => {
    try {
      const parsed = readPersistentState();
      if (parsed && Array.isArray(parsed.results) && parsed.results.length > 0) {
        setResults(parsed.results);
        if (parsed.progress) {
          setProgress(parsed.progress);
        }
        if (parsed.runId) {
          runIdRef.current = parsed.runId;
        }
      }

      const pendingCheckpoint = readRunCheckpoint();
      if (pendingCheckpoint?.isRunning) {
        const restoredResults = Array.isArray(pendingCheckpoint.results) ? pendingCheckpoint.results : [];
        setResults(restoredResults);
        if (pendingCheckpoint.progress) setProgress(pendingCheckpoint.progress);
        if (pendingCheckpoint.runId) runIdRef.current = pendingCheckpoint.runId;
        setShowTester(true);
        showToast("Recovered unfinished benchmark run. Auto-resuming...", "success");

        setTimeout(() => {
          startTest(
            pendingCheckpoint.isVisualMode || false,
            pendingCheckpoint.isExpressMode || false,
            pendingCheckpoint.matrix,
            restoredResults,
            pendingCheckpoint.currentIndex || 0
          );
        }, 600);
      }
    } catch (e) {}
  // startTest is intentionally omitted to avoid infinite resume loops.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, LOCAL_STORAGE_KEY, readPersistentState, readRunCheckpoint]);

  const saveStateToStorage = (r, p) => {
    try {
      writePersistentState({ results: r, progress: p, runId: runIdRef.current });
    } catch(e) {
      if ((e.name === 'QuotaExceededError' || e.message.includes('quota')) && !toast.show) {
        showToast("Storage almost full! Please download Excel and clear logs.", "error");
      }
    }
  };
  
  // Create test matrix excluding section-incompatible modes
  const getMatrix = (isExpressMode = false) => {
    const modes = getModesForType(type);
      
    const matrix = [];
    
    // Providers loop
    for (const provider of Object.keys(PROVIDER_MODELS)) {
      if (!selectedProviders.includes(provider)) continue;
      const providerApiKeys = getAllKeys(provider).filter(k => k.trim());
      if (providerApiKeys.length === 0) continue; // Skip providers with no keys
      
      const pUi = PROVIDERS_UI.find(p => p.apiKey === provider);
      const providerLabel = pUi ? pUi.label : provider;
      
      // Models loop
      const targetModels = isExpressMode ? [PROVIDER_MODELS[provider][0]] : PROVIDER_MODELS[provider];
      for (const model of targetModels) {
        if (!selectedModels.includes(model.value)) continue;
        // Marketplaces loop
        for (const marketplace of MARKETPLACES) {
          if (!selectedMarketplaces.includes(marketplace)) continue;
          if (isExpressMode && marketplace !== "all") continue;
          
          // Modes loop
          for (const mode of modes) {
            if (!selectedModes.includes(mode)) continue;
            if (isExpressMode && mode !== "auto") continue;
            
            matrix.push({
              provider: providerLabel,
              providerKey: provider,
              modelLabel: model.label,
              modelValue: model.value,
              marketplace,
              mode,
            });
          }
        }
      }
    }
    return matrix;
  };

  const downloadExcel = async () => {
    if (results.length === 0) return;

    const XLSX = await import("xlsx-js-style").then(m => m.default || m);
    const wb = XLSX.utils.book_new();

    const providersMap = {};
    results.forEach(r => {
      const p = r.provider || "Unknown";
      if (!providersMap[p]) providersMap[p] = [];
      providersMap[p].push(r);
    });

    Object.keys(providersMap).forEach(p => {
      const pResults = providersMap[p];
      
      const aoa = [];
      const merges = [];
      let currentRow = 1; // Since row 0 is the header
      
      // Professional Header Styling
      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
        fill: { fgColor: { rgb: "6366F1" } }, // Indigo color
        alignment: { vertical: "center", horizontal: "center" }
      };
      
      const header = ["Provider", "Marketplace", "Mode", "Model", "Prompt No.", "✨ Prompt Text (Click to read)", "Status", "Time (s)", "Error Details"]
         .map(v => ({ v, s: headerStyle }));
      aoa.push(header);
      
      // General Cell Styles - Text Wrapping OFF for prompts to keep them single line (Clipping)
      const centerStyle = { alignment: { vertical: "center", horizontal: "center" } };
      const leftStyle = { alignment: { vertical: "center", horizontal: "left" } }; // Wrap removed for pristine clipped look
      const successStyle = { font: { color: { rgb: "10B981" }, bold: true }, alignment: { vertical: "center", horizontal: "center" } };
      const errorStyle = { font: { color: { rgb: "EF4444" }, bold: true }, alignment: { vertical: "center", horizontal: "center" } };
      const skippedStyle = { font: { color: { rgb: "F59E0B" }, bold: true }, alignment: { vertical: "center", horizontal: "center" } };

      pResults.forEach(r => {
        const numPrompts = (r.prompts && r.prompts.length > 0) ? r.prompts.length : 1;
        const statusS = r.status === "Success" ? successStyle : r.status === "Skipped" ? skippedStyle : errorStyle;

        if (!r.prompts || r.prompts.length === 0) {
          // Failed or no prompts case
          aoa.push([
            { v: r.provider || "", s: centerStyle },
            { v: r.marketplace || "", s: centerStyle },
            { v: r.mode || "", s: centerStyle },
            { v: r.modelLabel || "", s: centerStyle },
            { v: "-", s: centerStyle },
            { v: "N/A", s: leftStyle },
            { v: r.status || "", s: statusS },
            { v: r.time ? r.time + "s" : "", s: centerStyle },
            { v: r.error || "No prompts generated", s: leftStyle }
          ]);
        } else {
          // Success case: Unroll prompts into vertical rows
          r.prompts.forEach((promptText, idx) => {
            aoa.push([
              { v: r.provider || "", s: centerStyle },
              { v: r.marketplace || "", s: centerStyle },
              { v: r.mode || "", s: centerStyle },
              { v: r.modelLabel || "", s: centerStyle },
              { v: String(idx + 1), s: centerStyle },
              { v: promptText || "", s: leftStyle },
              { v: r.status || "", s: statusS }, 
              { v: r.time ? r.time + "s" : "", s: centerStyle },
              { v: r.error || "", s: leftStyle }
            ]);
          });
        }

        // Apply Merges for a Professional Grouped Look
        if (numPrompts > 1) {
          // Merge columns 0, 1, 2, 3, 6, 7, 8 vertically
          [0, 1, 2, 3, 6, 7, 8].forEach(colIndex => {
            merges.push({
              s: { r: currentRow, c: colIndex }, 
              e: { r: currentRow + numPrompts - 1, c: colIndex } 
            });
          });
        }
        
        currentRow += numPrompts;
        
        // ADD A BEAUTIFUL GAP ROW AFTER EVERY TEST BLOCK
        aoa.push([]); // Empty array creates a blank row
        currentRow += 1;
      });
      
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      
      // Add Auto-Filter to the Header
      ws['!autofilter'] = { ref: "A1:I" + aoa.length };
      
      // Apply the computed merges to the worksheet
      if (merges.length > 0) {
        ws['!merges'] = merges;
      }
      
      // Set optimized column widths (Fit to screen)
      const wscols = [
        {wch: 15},  // Provider
        {wch: 15},  // Marketplace
        {wch: 15},  // Mode
        {wch: 25},  // Model
        {wch: 12},  // Prompt No.
        {wch: 60},  // Prompt Text
        {wch: 12},  // Status
        {wch: 10},  // Time
        {wch: 30}   // Error Details
      ];
      ws['!cols'] = wscols;

      XLSX.utils.book_append_sheet(wb, ws, p.substring(0, 31));  
    });
    
    XLSX.writeFile(wb, `Prompts_Studio_Benchmark_${Math.floor(Date.now()/1000)}.xlsx`);
  };

  const retryFailedTests = () => {
    // Retry both Error and Skipped items
    const failedResults = results.filter(r => r.status === "Error" || r.status === "Skipped");
    if (failedResults.length === 0) return;
    
    const goodResults = results.filter(r => r.status !== "Error" && r.status !== "Skipped");
    
    const retryMatrix = failedResults.map(r => ({
      provider: r.provider,
      providerKey: r.providerKey,
      modelLabel: r.modelLabel,
      modelValue: r.modelValue,
      marketplace: r.marketplace,
      mode: r.mode,
    }));
    
    startTest(false, false, retryMatrix, goodResults);
  };

  const startTest = async (isVisualMode = false, isExpressMode = false, customMatrix = null, initialResults = null, resumeIndex = null) => {
    // Guard against double-click / double execution
    if (isRunningRef.current) return;
    
    const matrix = customMatrix || getMatrix(isExpressMode);
    if (matrix.length === 0) {
      showToast("No API keys found. Please add API keys in settings to run.", "error");
      return;
    }
    
    isRunningRef.current = true;
    setIsRunning(true);
    setActiveKeyInfo("");
    abortControllerRef.current = new AbortController();
    let currentResults = initialResults !== null ? [...initialResults] : [...results];
    let startIndex = resumeIndex !== null ? resumeIndex : (initialResults !== null ? 0 : currentResults.length);
    
    // Assign a unique Run ID if starting fresh
    if (!runIdRef.current || currentResults.length === 0) {
      const d = new Date();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const dateStr = `${d.getDate()}-${monthNames[d.getMonth()]}`;
      const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(' ', '_').replace(':', '-');
      runIdRef.current = `Results_${dateStr}_${timeStr}`;
    }
    
    // If the test was already complete or cleared, start from 0
    if (resumeIndex === null && initialResults === null && startIndex >= matrix.length) {
      startIndex = 0;
      currentResults = [];
      setResults([]);
    }
    
    saveRunCheckpoint({
      isRunning: true,
      matrix,
      currentIndex: startIndex,
      results: currentResults,
      progress: { current: startIndex, total: matrix.length, label: "Initializing Intelligent AutoTester..." },
      runId: runIdRef.current,
      isVisualMode,
      isExpressMode,
      heartbeatAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    setProgress({ current: startIndex, total: matrix.length, label: "Initializing Intelligent AutoTester..." });
    
    // --- UPS 6.0: Human-Like Anti-Bot Intelligence ---
    const humanWait = async (min = 2, max = 5, message = "Simulating human logic...") => {
      const waitTime = Math.floor(Math.random() * (max - min + 1) + min);
      for (let s = waitTime; s > 0; s--) {
         if (abortControllerRef.current?.signal.aborted) break;
         setProgress(prev => ({ ...prev, subLabel: `🛡️ ${message} (${s}s)` }));
         await new Promise(r => setTimeout(r, 1000));
      }
      setProgress(prev => ({ ...prev, subLabel: "" }));
    };

    const waitWithBackoffJitter = async (attempt, baseMs = 2500, maxMs = 45000, message = "Applying smart retry backoff...") => {
      const exp = Math.min(maxMs, baseMs * (2 ** Math.max(0, attempt - 1)));
      const jitter = Math.floor(Math.random() * Math.max(500, Math.floor(exp * 0.4)));
      const totalMs = Math.min(maxMs, exp + jitter);
      const seconds = Math.max(1, Math.ceil(totalMs / 1000));
      await humanWait(seconds, seconds + 1, message);
    };
    
    // --- Simplified Sequential Failure Tracker (UPS 5.0) ---
    // keyStates: { providerKey: { apiKey: 'active'|'exhausted'|'auth_failed' } }
    const keyStates = {};
    const activeKeyPointers = {}; // { providerKey: currentKeyIdx }
    // Track auth-failed keys separately — these should NEVER be retried
    const authFailedKeys = {}; // { providerKey: Set<apiKey> }

    const getKeyStatus = (providerKey, k) => {
      if (!keyStates[providerKey]) return "active";
      return keyStates[providerKey][k] || "active";
    };

    const bannedProviders = new Set(); // Tracks providers completely shut down after extreme failures
    const providerExhaustedSet = new Set(); // Tracks providers whose keys were ALL rate-limited — prevents wasteful key resets
    const providerCooldownUntil = {};
    const providerFailureStreak = {};

    const refreshHealth = () => {
      const health = {};
      Object.keys(PROVIDER_MODELS).forEach(p => {
        const all = getAllKeys(p).filter(k => k.trim());
        const inCooldown = (providerCooldownUntil[p] || 0) > Date.now();
        health[p] = all.map((k, idx) => ({
          label: `Key ${idx + 1}`,
          status: inCooldown ? "cooldown" : getKeyStatus(p, k)
        }));
      });
      setLiveKeyStatuses(health);
    };

    const markKeyFailed = (providerKey, k, reason = "quota") => {
      if (!keyStates[providerKey]) keyStates[providerKey] = {};
      keyStates[providerKey][k] = reason === "auth" ? "auth_failed" : "exhausted";
      
      // Track auth-failed keys permanently
      if (reason === "auth") {
        if (!authFailedKeys[providerKey]) authFailedKeys[providerKey] = new Set();
        authFailedKeys[providerKey].add(k);
      }
      
      // Move pointer to next key
      const currentIdx = activeKeyPointers[providerKey] || 0;
      activeKeyPointers[providerKey] = currentIdx + 1;
      
      refreshHealth();
      
      // Check if ALL keys for this provider are now exhausted
      const allKeys = getAllKeys(providerKey).filter(k => k.trim());
      if (activeKeyPointers[providerKey] >= allKeys.length) {
        // Only permanently ban if ALL keys are auth-failed
        const authFailed = authFailedKeys[providerKey] || new Set();
        if (allKeys.every(k => authFailed.has(k))) {
          bannedProviders.add(providerKey);
        }
      }
    };

    // Reset key pointers for a provider, skipping only auth-failed keys
    const resetProviderKeys = (providerKey) => {
      const allKeys = getAllKeys(providerKey).filter(k => k.trim());
      const authFailed = authFailedKeys[providerKey] || new Set();
      // Find first non-auth-failed key index
      let firstGoodIdx = 0;
      while (firstGoodIdx < allKeys.length && authFailed.has(allKeys[firstGoodIdx])) {
        firstGoodIdx++;
      }
      activeKeyPointers[providerKey] = firstGoodIdx;
      // Clear non-auth states
      if (keyStates[providerKey]) {
        Object.keys(keyStates[providerKey]).forEach(k => {
          if (keyStates[providerKey][k] !== "auth_failed") {
            delete keyStates[providerKey][k];
          }
        });
      }
    };

    refreshHealth(); // Initial state load
    const providerOrder = selectedProviders.filter(p => PROVIDER_MODELS[p]);

    // --- Smart Model Queue: group matrix by (provider, model) for model-level task tracking ---
    const modelGroups = groupMatrixByModel(matrix);
    const modelProgress = initModelProgress(modelGroups);

    // Restore persisted model progress on resume
    if (resumeIndex !== null) {
      const saved = loadModelQueue(type);
      if (saved) {
        Object.entries(saved).forEach(([mk, savedMp]) => {
          if (modelProgress[mk]) {
            modelProgress[mk].completed = savedMp.completed || 0;
            modelProgress[mk].retryCount = savedMp.retryCount || 0;
            // Keep paused/in_progress models as "paused" so recovery pass picks them up
            // cooldownUntil = 0 means recovery proceeds immediately (cooldown elapsed during reload)
            if (savedMp.status === "paused" || savedMp.status === "in_progress") {
              modelProgress[mk].status = "paused";
              modelProgress[mk].cooldownUntil = 0;
            } else if (savedMp.status === "completed" || savedMp.status === "failed") {
              modelProgress[mk].status = savedMp.status;
            }
          }
        });
      }
    }
    setModelQueueStatus({ ...modelProgress });

    const getAdaptiveCooldown = (retryCount = 0) => Math.min(INITIAL_COOLDOWN_MS * Math.pow(2, retryCount), MAX_COOLDOWN_MS);

    // buildFallbackStep has been removed for Strict Provider-Task Affinity
    
    for (let i = startIndex; i < matrix.length; i++) {
      if (abortControllerRef.current?.signal.aborted) {
        setProgress(prev => ({ ...prev, label: "Test aborted by user." }));
        break;
      }
      
      const step = matrix[i];
      
      // --- Model Queue Check: Skip if this model is already paused ---
      const stepMk = getModelKey(step.providerKey, step.modelValue);
      const stepModelGroup = modelGroups.find(g => g.key === stepMk);
      if (modelProgress[stepMk]?.status === "paused") {
        // Don't process — task is reserved for this model's recovery pass
        if (!currentResults.some(r => r.providerKey === step.providerKey && r.modelValue === step.modelValue && r.marketplace === step.marketplace && r.mode === step.mode)) {
          currentResults.push({
            ...step,
            status: "Queued",
            time: 0,
            prompts: [],
            error: `📋 Reserved for ${step.modelLabel} — model paused, will resume after cooldown`
          });
          setResults([...currentResults]);
        }
        setProgress(prev => ({
          ...prev,
          current: i + 1,
          total: matrix.length,
          label: `${step.modelLabel} reserved`,
          subLabel: `⏸️ Model paused. Tasks reserved for recovery...`
        }));
        continue;
      }
      
      const cooldownUntil = providerCooldownUntil[step.providerKey] || 0;
      if (cooldownUntil > Date.now()) {
        // Provider cooldown: pause this model and skip to end of model group
        if (modelProgress[stepMk] && modelProgress[stepMk].status !== "completed") {
          modelProgress[stepMk].status = "paused";
          modelProgress[stepMk].cooldownUntil = cooldownUntil;
          setModelQueueStatus({ ...modelProgress });
        }
        if (stepModelGroup) {
          for (let skip = i; skip <= stepModelGroup.endIdx; skip++) {
            if (!currentResults.some(r => r.providerKey === matrix[skip].providerKey && r.modelValue === matrix[skip].modelValue && r.marketplace === matrix[skip].marketplace && r.mode === matrix[skip].mode)) {
              currentResults.push({
                ...matrix[skip],
                status: "Queued",
                time: 0,
                prompts: [],
                error: `📋 Reserved for ${step.modelLabel} — provider cooling down`
              });
            }
          }
          setResults([...currentResults]);
          i = stepModelGroup.endIdx; // Skip entire model group
        }
        setProgress(prev => ({
          ...prev,
          current: i + 1,
          total: matrix.length,
          label: `${step.provider} cooling down`,
          subLabel: `⏳ ${step.modelLabel} tasks reserved. Processing healthy models...`
        }));
        continue;
      }
      
      // Mark model as in_progress
      if (modelProgress[stepMk] && modelProgress[stepMk].status === "pending") {
        modelProgress[stepMk].status = "in_progress";
        setModelQueueStatus({ ...modelProgress });
      }

      const startMs = Date.now();
      currentStepStartedAtRef.current = startMs;
      currentStepLabelRef.current = `${step.provider} - ${step.marketplace} - ${step.modelLabel}`;
      
      // --- Precision Step Recovery Logic (UPS 7.0) ---
      // Clone step to allow local mutation for survivor switch without affecting original matrix
      let activeStep = { ...matrix[i] }; 
      let stepAttemptLogs = [];
      let success = false;
      let generationResult = {
        ...activeStep,
        status: "Running",
        time: 0,
        prompts: [],
        error: ""
      };

      // Main Provider Loop for THIS specific step i
      let providerChainExhausted = false;
      while (!providerChainExhausted && !success && !abortControllerRef.current?.signal.aborted) {
        if (Date.now() - currentStepStartedAtRef.current > STALL_STEP_MS) {
          stepAttemptLogs.push(`⛑️ [Watchdog] ${currentStepLabelRef.current} stalled for over ${Math.floor(STALL_STEP_MS / 60000)} minutes. Marking as failed to keep run alive.`);
          generationResult.status = "Error";
          generationResult.error = stepAttemptLogs.join("\n");
          providerChainExhausted = true;
          break;
        }
        
        // --- Smart Check: Is Current Provider Exhausted? ---
        const allKeysForProvider = getAllKeys(activeStep.providerKey).filter(k => k.trim());
        const currentPointerIdx = activeKeyPointers[activeStep.providerKey] || 0;

        if (currentPointerIdx >= allKeysForProvider.length) {
          providerCooldownUntil[activeStep.providerKey] = Math.max(
            providerCooldownUntil[activeStep.providerKey] || 0,
            Date.now() + INITIAL_COOLDOWN_MS
          );
          
          stepAttemptLogs.push(`🚫 [Provider Exhausted] ${activeStep.provider} has no available keys. Moving to model-level recovery.`);
          setProgress(prev => ({ ...prev, subLabel: `🚫 ${activeStep.provider} exhausted. Will resume in recovery pass (~${Math.ceil(INITIAL_COOLDOWN_MS / 60000)}m)` }));
          
          providerChainExhausted = true;

          // 🧠 Smart Global Sleep: only if ALL keys are rate-limited (not auth-failed)
          // Check if any provider still has unexpired keys via pointer
          const anyKeyAvailable = providerOrder.some(p => {
            if (bannedProviders.has(p)) return false;
            const allK = getAllKeys(p).filter(k => k.trim());
            const ptr = activeKeyPointers[p] || 0;
            return ptr < allK.length;
          });

          if (!anyKeyAvailable) {
            // Only reset keys that failed due to quota/rate-limit, NOT auth errors
            const hasResetableKeys = Object.entries(keyStates).some(([p, states]) =>
              Object.values(states).some(s => s === "exhausted")
            );

            if (hasResetableKeys) {
              setProgress(prev => ({ ...prev, subLabel: `💤 Rate limits reached. Smart pause for 3 min, then auto-resuming...` }));
              await new Promise(r => setTimeout(r, 3 * 60 * 1000));

              // Reset stall timer so it doesn't falsely expire during sleep
              currentStepStartedAtRef.current = Date.now();

              // Reset ONLY rate-limited (quota-exhausted) key states — preserve auth-failed bans
              Object.keys(keyStates).forEach(p => {
                if (!bannedProviders.has(p)) {
                  resetProviderKeys(p);
                }
              });
              refreshHealth();
              providerChainExhausted = false;
            }
          }
          continue;
        }

        // providerChainExhausted is already handled above with continue/break
        // No additional dead-code block needed here
        
        const mainLabel = `${activeStep.provider} - ${activeStep.marketplace} - ${activeStep.modelLabel}`;
        setProgress(prev => ({ 
          ...prev,
          current: i + 1, 
          total: matrix.length, 
          label: mainLabel,
          subLabel: ""
        }));
      
        if (isVisualMode) {
          // Visual UI manipulation logic
          // (Keeping existing visual logic but using activeStep)
          const settingsBtn = document.getElementById("sidebar-api-keys-btn");
          if (settingsBtn) {
            settingsBtn.scrollIntoView({behavior: "smooth", block: "center"});
            settingsBtn.classList.add("visual-focus");
            await new Promise(r => setTimeout(r, 800));
            settingsBtn.click();
            await new Promise(r => setTimeout(r, 800));
            settingsBtn.classList.remove("visual-focus");
            
            const innerSelect = document.getElementById(`settings-model-select-${activeStep.providerKey}`);
            if (innerSelect) {
              innerSelect.scrollIntoView({ behavior: "smooth", block: "center" });
              innerSelect.classList.add("visual-focus");
              await new Promise(r => setTimeout(r, 800));
              if (setSelectedModel) setSelectedModel(activeStep.providerKey, activeStep.modelValue);
              await new Promise(r => setTimeout(r, 800));
              innerSelect.classList.remove("visual-focus");
            }
            
            const closeBtn = document.getElementById("settings-close-btn");
            if (closeBtn) {
              closeBtn.classList.add("visual-click");
              await new Promise(r => setTimeout(r, 400));
              closeBtn.click();
              await new Promise(r => setTimeout(r, 800));
            }
          }
          
          const modelSelect = document.getElementById("model-select");
          if (modelSelect) {
            modelSelect.scrollIntoView({ behavior: "smooth", block: "center" });
            modelSelect.classList.add("visual-focus");
            await new Promise(r => setTimeout(r, 800));
            if (setModel) setModel(activeStep.providerKey);
            await new Promise(r => setTimeout(r, 600));
            modelSelect.classList.remove("visual-focus");
          }
          
          const marketSelect = document.getElementById("market-select");
          if (marketSelect) {
            marketSelect.scrollIntoView({ behavior: "smooth", block: "center" });
            marketSelect.classList.add("visual-focus");
            await new Promise(r => setTimeout(r, 800));
            if (setTargetMarket) setTargetMarket(activeStep.marketplace);
            await new Promise(r => setTimeout(r, 600));
            marketSelect.classList.remove("visual-focus");
          }
          
          // For "auto" / "engineer" the legacy `.btn-auto` / `.btn-engineer`
          // classes still apply.  All other modes are special modes that
          // share `.btn-special-mode` in PromptGenerator, so we target them
          // via the `data-mode` attribute. If a legacy `.btn-<mode>` class
          // happens to exist we still try that first as a backwards-compatible
          // fallback for older builds.
          let btnClass;
          if (activeStep.mode === "auto") {
            btnClass = ".btn-auto";
          } else if (activeStep.mode === "engineer") {
            btnClass = ".btn-engineer";
          } else if (LEGACY_MODE_BUTTON_CLASSES.has(activeStep.mode)) {
            btnClass = `.btn-${activeStep.mode}, button[data-mode="${activeStep.mode}"]`;
          } else {
            btnClass = `button[data-mode="${activeStep.mode}"]`;
          }

          const genBtn = document.querySelector(btnClass);
          if (genBtn) {
            genBtn.scrollIntoView({ behavior: "smooth", block: "center" });
            genBtn.classList.add("visual-focus");
            await new Promise(r => setTimeout(r, 1000));
            genBtn.classList.add("visual-click");
            await new Promise(r => setTimeout(r, 300));
            genBtn.classList.remove("visual-click", "visual-focus");
          }
        } else {
          if (setModel) setModel(activeStep.providerKey);
          if (setTargetMarket) setTargetMarket(activeStep.marketplace);
        }
        
        // --- Human-Like Pre-Attempt Delay ---
        await humanWait(2, 6, "Preparing configuration...");

        // --- Sequential Key Selection (Smart Per-Step Reset) ---
        // Reset pointer for this provider before each step, UNLESS keys are auth-failed or provider is exhausted
        // Don't reset keys for providers that were just rate-limited — they should stay exhausted until cooldown
        if (!bannedProviders.has(activeStep.providerKey) && !providerExhaustedSet.has(activeStep.providerKey)) {
          resetProviderKeys(activeStep.providerKey);
        }
        let currentPointer = activeKeyPointers[activeStep.providerKey] || 0;
        const allKeysInPool = getAllKeys(activeStep.providerKey).filter(k => k.trim());
        let lastErrMessage = "";
        let attemptCountTotal = 0;


      while (currentPointer < allKeysInPool.length && !abortControllerRef.current?.signal.aborted) {
        const currentKey = allKeysInPool[currentPointer];
        const singleKeyArray = [currentKey];
        const keyLabel = currentPointer === 0 ? "Key 1" : `Key ${currentPointer + 1}`;
        
        let keySuccess = false;
        let keyHadError = false;
        
        // Inner Loop: Max 3 retries for this exact key
        for (let attempt = 1; attempt <= 3; attempt++) {
          attemptCountTotal++;
          if (abortControllerRef.current?.signal.aborted) break;
          
          const logPrefix = `[${activeStep.provider}] ${keyLabel} - Attempt ${attempt}`;
          if (keyHadError || attempt > 1) {
            const keysTotal = allKeysInPool.length;
            const keyNum = currentPointer + 1;
            setProgress(prev => ({ ...prev, subLabel: `🔄 ${activeStep.provider} • Key ${keyNum}/${keysTotal} • Retry ${attempt}/3 • ${activeStep.modelLabel}` }));
          }
          
          try {
            if (attempt > 1) {
               await waitWithBackoffJitter(attempt, 2500, 30000, `Smart retry in progress...`);
            }
            
            const seedValue = getRandomSeeds(1, type)[0];
            
            let apiKeysByModel = {
              gemini: getAllKeys("gemini").filter(k => k.trim()),
              groq: getAllKeys("groq").filter(k => k.trim()),
              mistral: getAllKeys("mistral").filter(k => k.trim()),
              openrouter: getAllKeys("openrouter").filter(k => k.trim()),
              huggingface: getAllKeys("huggingface").filter(k => k.trim()),
              cerebras: getAllKeys("cerebras").filter(k => k.trim()),
              nvidia: getAllKeys("nvidia").filter(k => k.trim()),
              github: getAllKeys("github").filter(k => k.trim()),
            };
            // Override current provider to use ONLY the single key being tested
            apiKeysByModel[activeStep.providerKey] = singleKeyArray;
            
            let targetMarketKey = activeStep.marketplace;
            if (targetMarketKey === "all") targetMarketKey = "All Marketplaces";

            const payload = {
              concept: seedValue.seedPhrase,
              quantity: 10,
              model: activeStep.modelValue,
              type: type,
              targetMarket: targetMarketKey,
              apiKeys: singleKeyArray,  // Only test ONE key
              apiKeysByModel,
              autoMode: true,
              autoSubject: seedValue.seedPhrase,
              autoCategory: "ai-free-choice",
              autoContext: seedValue.context || "",
              ...(activeStep.mode === "engineer" && { engineerMode: true }),
              ...(activeStep.mode !== "auto" && activeStep.mode !== "engineer" && { specialMode: activeStep.mode })
            };
            
            if (setMainLoading) setMainLoading(true);
            if (setMainGenStep) setMainGenStep(1);
            if (setMainPrompts) setMainPrompts([]);
            if (setMainModelUsed) setMainModelUsed(activeStep.modelValue);

            await new Promise(r => setTimeout(r, 400));
            if (setMainGenStep) setMainGenStep(2);

            const response = await fetchWithAttemptTimeout("/api/generate-prompts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
              signal: abortControllerRef.current.signal
            });
            
            if (!response.ok) {
              let errDetail = await response.text();
              try {
                const parsedErr = JSON.parse(errDetail);
                if (parsedErr.error) errDetail = parsedErr.error;
              } catch(e) {}
              
              throw new Error(`HTTP ${response.status}: ${errDetail}`);
            }
            
            if (setMainGenStep) setMainGenStep(3);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buf = "";
            let lastParsed = [];
            
            while (true) {
              if (abortControllerRef.current?.signal.aborted) throw new Error("Aborted");
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });

              const parsed = parseNumberedPrompts(buf, 10);
              if (parsed.length > lastParsed.length) {
                lastParsed = parsed;
                if (setMainPrompts) setMainPrompts([...parsed]);
              }
            }
            
            const finalPrompts = parseNumberedPrompts(buf, 10);
            
            // Bug Fix: Prevent silent failure — empty prompts after successful API call
            if (finalPrompts.length === 0) {
              throw new Error("API returned valid response but no prompts could be parsed. Raw response may be in unexpected format.");
            }
            
            generationResult.prompts = finalPrompts;
            generationResult.status = "Success";
            
            stepAttemptLogs.push(`✅ ${logPrefix}: Success! (${finalPrompts.length} prompts)`);
            generationResult.error = stepAttemptLogs.join("\n");
            
            if (setMainPrompts) setMainPrompts(finalPrompts);
            if (setMainGenStep) setMainGenStep(4);
            
            success = true;
            keySuccess = true;
            lastErrMessage = "";
            setActiveKeyInfo("");
            break; // Success! Exit inner loop 
          } catch (err) {
            lastErrMessage = err.message || "Unknown Error";
            keyHadError = true;
            setProgress(prev => ({ ...prev, subLabel: `🛡️ Step Recovery Active...` }));
            stepAttemptLogs.push(`❌ ${logPrefix}: ${lastErrMessage}`);
            generationResult.error = stepAttemptLogs.join("\n");
            
            if (err.name === "AbortError" || err.message === "Aborted") {
              generationResult.status = "Aborted";
              generationResult.error = "Test Cancelled by User";
              break; 
            }
            
            // 🌐 Network Auto-Healing / Drop Protection
            if (!navigator.onLine || lastErrMessage.toLowerCase().includes("failed to fetch") || lastErrMessage.toLowerCase().includes("network error")) {
              setProgress(prev => ({ ...prev, subLabel: "🌐 Internet disconnected. Pausing system..." }));
              stepAttemptLogs.push(`⏳ [Auto-Heal] Paused due to internet drop.`);
              let waitSecs = 0;
              while (!navigator.onLine && !abortControllerRef.current?.signal.aborted) {
                await new Promise(r => setTimeout(r, 2000));
                waitSecs += 2;
                if (waitSecs % 10 === 0) setProgress(prev => ({ ...prev, subLabel: `🌐 Waiting for internet... (${waitSecs}s)` }));
              }
              if (abortControllerRef.current?.signal.aborted) break;
              
              setProgress(prev => ({ ...prev, subLabel: "🌐 Internet restored! Resuming..." }));
              await new Promise(r => setTimeout(r, 2000));
              attempt--; // Don't count this as an API failure attempt
              continue;
            }

            const { isFatalForKey, category } = classifyAttemptError(lastErrMessage);
            
            if (isFatalForKey) {
              // Track the failure reason for smarter key management
              if (category === "auth") {
                markKeyFailed(activeStep.providerKey, currentKey, "auth");
              }
              break;
            }
          }
        }
        
        if (keySuccess || generationResult.status === "Aborted") {
          break; 
        } else {
          stepAttemptLogs.push(`🔁 Key rotation: ${activeStep.provider} ${keyLabel} exhausted (3/3 failed). Rotating to next key...`);
          markKeyFailed(activeStep.providerKey, currentKey, "quota");
          currentPointer++; 
          if (currentPointer < allKeysInPool.length) {
            const nextLabel = `Key ${currentPointer + 1}`;
            const keysTotal = allKeysInPool.length;
            setProgress(prev => ({ ...prev, subLabel: `🔑 Switching to ${nextLabel}/${keysTotal} for ${activeStep.provider}...` }));
            await humanWait(3, 7, `Switching to ${nextLabel}...`);
          }
        }
      }

      // Fallback recovery switch has been removed.
      // If the provider fails, it will be marked as an Error or deferred below.
      
      providerChainExhausted = true; // No survivor available or successfully completed
      } // End of Provider Chain Loop

      
      // Post-while loop check with Model-Level Task Reservation:
      const mk = getModelKey(step.providerKey, step.modelValue);
      const currentModelGroup = modelGroups.find(g => g.key === mk);

      if (!success && generationResult.status !== "Aborted") {
        const allKeysPool = getAllKeys(step.providerKey).filter(k => k.trim());
        const pointer = activeKeyPointers[step.providerKey] || 0;
        const allKeysExhausted = pointer >= allKeysPool.length && !bannedProviders.has(step.providerKey);
        
        if (allKeysExhausted) {
          const { retryAfterSeconds } = classifyAttemptError(stepAttemptLogs.join(" | "));
          const dynamicCooldownMs = retryAfterSeconds 
            ? (retryAfterSeconds + 20) * 1000 
            : INITIAL_COOLDOWN_MS;

          providerCooldownUntil[step.providerKey] = Math.max(
            providerCooldownUntil[step.providerKey] || 0,
            Date.now() + dynamicCooldownMs
          );
          providerExhaustedSet.add(step.providerKey);
          generationResult.status = "Skipped";
          generationResult.error = stepAttemptLogs.join("\n") + `\n⏳ Model paused: All ${allKeysPool.length} key(s) for ${step.provider}/${step.modelLabel} exhausted. Will resume from task ${modelProgress[mk]?.completed + 1}/${modelProgress[mk]?.total} after cooldown (~${Math.ceil(dynamicCooldownMs / 60000)} min).`;
          refreshHealth();

          // --- Model-Level Task Reservation ---
          // Mark this model as paused and skip ALL remaining tasks for this model
          if (modelProgress[mk]) {
            modelProgress[mk].status = "paused";
            modelProgress[mk].cooldownUntil = Date.now() + dynamicCooldownMs;
            modelProgress[mk].retryCount++;
          }

          // Skip remaining tasks for this model — they are RESERVED
          if (currentModelGroup) {
            const remainingStart = i + 1;
            const modelEnd = currentModelGroup.endIdx;
            for (let skip = remainingStart; skip <= modelEnd; skip++) {
              currentResults.push({
                ...matrix[skip],
                status: "Queued",
                time: 0,
                prompts: [],
                error: `📋 Reserved for ${step.modelLabel} (${step.provider}) — will resume after cooldown. Task ${modelProgress[mk]?.completed || 0}/${modelProgress[mk]?.total || '?'} completed so far.`
              });
            }
            i = modelEnd; // Jump to end of this model's tasks
            setProgress(prev => ({
              ...prev,
              subLabel: `⏸️ ${step.modelLabel} paused. ${modelEnd - remainingStart + 1} tasks reserved (${modelProgress[mk]?.completed || 0}/${modelProgress[mk]?.total || '?'} done). Moving to next model...`
            }));
          }
          setModelQueueStatus({ ...modelProgress });
          saveModelQueue(type, modelProgress);
        } else {
          // Non-rate-limit errors: use circuit breaker as safety net
          generationResult.status = "Error";
          generationResult.error = stepAttemptLogs.join("\n");
          providerFailureStreak[step.providerKey] = (providerFailureStreak[step.providerKey] || 0) + 1;
          if (providerFailureStreak[step.providerKey] >= CIRCUIT_BREAKER_FAILURES) {
            const cooldownUntil = Date.now() + PROVIDER_COOLDOWN_MS;
            providerCooldownUntil[step.providerKey] = Math.max(providerCooldownUntil[step.providerKey] || 0, cooldownUntil);
            generationResult.error += `\n🧯 Circuit breaker opened for ${step.provider} (${Math.floor(PROVIDER_COOLDOWN_MS / 60000)}m cooldown).`;
            refreshHealth();
            
            // Also pause this model at circuit breaker level
            if (modelProgress[mk]) {
              modelProgress[mk].status = "paused";
              modelProgress[mk].cooldownUntil = Date.now() + PROVIDER_COOLDOWN_MS;
              modelProgress[mk].retryCount++;
            }

            // Skip remaining tasks for this model
            if (currentModelGroup) {
              const remainingStart = i + 1;
              const modelEnd = currentModelGroup.endIdx;
              for (let skip = remainingStart; skip <= modelEnd; skip++) {
                currentResults.push({
                  ...matrix[skip],
                  status: "Queued",
                  time: 0,
                  prompts: [],
                  error: `📋 Reserved for ${step.modelLabel} — circuit breaker active`
                });
              }
              i = modelEnd;
            }
            setModelQueueStatus({ ...modelProgress });
            saveModelQueue(type, modelProgress);
          }
        }
      } else if (success) {
        providerFailureStreak[step.providerKey] = 0;
        providerExhaustedSet.delete(step.providerKey);
        // Update model progress
        if (modelProgress[mk]) {
          modelProgress[mk].completed++;
          if (modelProgress[mk].completed >= modelProgress[mk].total) {
            modelProgress[mk].status = "completed";
          } else {
            modelProgress[mk].status = "in_progress";
          }
          setModelQueueStatus({ ...modelProgress });
        }
      }
      
      // Record generation time BEFORE the cooldown delay — so delay is not included in time
      generationResult.time = ((Date.now() - startMs) / 1000).toFixed(1);
      currentResults.push(generationResult);
      setResults([...currentResults]);
      setActiveKeyInfo("");
      
      const mainLabel = `${activeStep.provider} - ${activeStep.marketplace} - ${activeStep.modelLabel}`;
      const pausedInfo = Object.values(modelProgress).filter(mp => mp.status === "paused").length;
      const queueInfo = pausedInfo > 0 ? ` | ⏸ ${pausedInfo} model(s) paused` : "";
      const newProgress = { current: i + 1, total: matrix.length, label: mainLabel, subLabel: `✅ Step Completed${queueInfo}` };
      setProgress(newProgress);
      saveStateToStorage(currentResults, newProgress);
      saveRunCheckpoint({
        isRunning: true,
        matrix,
        currentIndex: i + 1,
        results: currentResults,
        progress: newProgress,
        runId: runIdRef.current,
        isVisualMode,
        isExpressMode,
        heartbeatAt: Date.now(),
        updatedAt: Date.now(),
      });
      saveModelQueue(type, modelProgress);

      // Auto-Sync to Sheets if enabled
      if (autoSyncSheets && sheetsUrl && generationResult.status !== "Aborted") {
        try {
          const queued = JSON.parse(localStorage.getItem("offline_sync_queue") || "[]");
          const rowsToSync = [...queued, generationResult];
          fetch(sheetsUrl, {
            method: "POST",
            body: JSON.stringify({ action: "append", rows: rowsToSync, sheetName: runIdRef.current || "Results" }),
            headers: { "Content-Type": "text/plain;charset=utf-8" },
          }).then(res => {
            if (res.ok) localStorage.removeItem("offline_sync_queue");
            else localStorage.setItem("offline_sync_queue", JSON.stringify(rowsToSync));
          }).catch(() => {
            localStorage.setItem("offline_sync_queue", JSON.stringify(rowsToSync));
          });
        } catch (e) {
          const queued = JSON.parse(localStorage.getItem("offline_sync_queue") || "[]");
          localStorage.setItem("offline_sync_queue", JSON.stringify([...queued, generationResult]));
        }
      }
      
      // Delay to avoid rate limit, unless aborted
      if (!abortControllerRef.current?.signal.aborted && i < matrix.length - 1) {
        // Humanized Random Delay between 12 and 20 seconds
        const waitSeconds = Math.floor(Math.random() * (20 - 12 + 1)) + 12;
        
        setTimeout(() => {
          if (setMainGenStep) setMainGenStep(0);
        }, 3000);
        
        await new Promise(r => {
          const startTime = Date.now();
          const targetTime = startTime + (waitSeconds * 1000);
          
          setProgress(prev => ({ ...prev, subLabel: `⏳ Next step in ${waitSeconds}s...` }));
          
          const intervalId = setInterval(() => {
            const now = Date.now();
            if (now >= targetTime) {
              clearInterval(intervalId);
              r();
              return;
            }
            const ticksLeft = Math.max(0, Math.ceil((targetTime - now) / 1000));
            setProgress(prev => ({ ...prev, subLabel: `⏳ Next step in ${ticksLeft}s...` }));
          }, 1000);

          abortControllerRef.current?.signal.addEventListener('abort', () => {
            clearInterval(intervalId);
            r();
          });
        });
      }

      if (skipProviderRef.current) {
        skipProviderRef.current = false;
        const currentProviderKey = matrix[i].providerKey;
        let nextIdx = i;
        while (nextIdx + 1 < matrix.length && matrix[nextIdx + 1].providerKey === currentProviderKey) {
          nextIdx++;
          currentResults.push({
            ...matrix[nextIdx],
            status: "Skipped",
            time: 0,
            prompts: [],
            error: "Skipped manually by user (provider skip)"
          });
        }
        setResults([...currentResults]);
        saveStateToStorage(currentResults, { current: nextIdx + 1, total: matrix.length, label: "Skipped provider" });
        i = nextIdx;
      }
      // ♻️ Model Queue Status Update at provider transitions
      if (!abortControllerRef.current?.signal.aborted && i + 1 < matrix.length && matrix[i].providerKey !== matrix[i + 1].providerKey) {
        const pausedCount = Object.values(modelProgress).filter(mp => mp.status === "paused").length;
        if (pausedCount > 0) {
          setProgress(prev => ({
            ...prev,
            subLabel: `📋 ${pausedCount} model(s) paused — will resume in recovery pass. Moving to next provider...`
          }));
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
    
    // --- MODEL-LEVEL RECOVERY PASS ---
    // Resume paused models from their exact checkpoint after cooldown
    const pausedModels = modelGroups.filter(g => modelProgress[g.key]?.status === "paused");
    
    if (pausedModels.length > 0 && !abortControllerRef.current?.signal.aborted) {
      const summary = getModelSummary(modelProgress);
      setProgress(prev => ({
        ...prev,
        current: matrix.length,
        total: matrix.length,
        label: `♻️ Model Recovery: ${pausedModels.length} paused models`,
        subLabel: `${summary.completed} completed, ${summary.paused} paused — waiting for cooldowns...`
      }));
      await new Promise(r => setTimeout(r, 2000));

      let recoveryRound = 0;
      const MAX_RECOVERY_ROUNDS = 5;

      while (recoveryRound < MAX_RECOVERY_ROUNDS && !abortControllerRef.current?.signal.aborted) {
        const stillPaused = modelGroups.filter(g => modelProgress[g.key]?.status === "paused");
        if (stillPaused.length === 0) break;
        recoveryRound++;

        // Sort by earliest cooldown
        stillPaused.sort((a, b) => (modelProgress[a.key].cooldownUntil || 0) - (modelProgress[b.key].cooldownUntil || 0));

        for (const group of stillPaused) {
          if (abortControllerRef.current?.signal.aborted) break;
          const mp = modelProgress[group.key];
          if (mp.status !== "paused") continue;

          // Wait for cooldown
          const waitMs = Math.max(0, (mp.cooldownUntil || 0) - Date.now());
          if (waitMs > 0) {
            const waitSec = Math.ceil(waitMs / 1000);
            setProgress(prev => ({
              ...prev,
              label: `⏳ Waiting for ${group.modelLabel} cooldown`,
              subLabel: `Resuming in ${waitSec > 60 ? Math.ceil(waitSec / 60) + "m" : waitSec + "s"}... (${mp.completed}/${mp.total} done)`
            }));

            // Wait in 10-second chunks so abort can be detected
            let remaining = waitMs;
            while (remaining > 0 && !abortControllerRef.current?.signal.aborted) {
              const chunk = Math.min(remaining, 10000);
              await new Promise(r => setTimeout(r, chunk));
              remaining -= chunk;
              if (remaining > 0) {
                const secLeft = Math.ceil(remaining / 1000);
                setProgress(prev => ({
                  ...prev,
                  subLabel: `Resuming in ${secLeft > 60 ? Math.ceil(secLeft / 60) + "m" : secLeft + "s"}...`
                }));
              }
            }
            if (abortControllerRef.current?.signal.aborted) break;
          }

          // Reset keys for this provider before recovery
          if (!bannedProviders.has(group.providerKey)) {
            resetProviderKeys(group.providerKey);
            providerExhaustedSet.delete(group.providerKey);
            delete providerCooldownUntil[group.providerKey];
          }
          refreshHealth();

          mp.status = "in_progress";
          setModelQueueStatus({ ...modelProgress });

          setProgress(prev => ({
            ...prev,
            label: `♻️ Resuming ${group.modelLabel} (${mp.completed}/${mp.total})`,
            subLabel: `Recovery round ${recoveryRound}/${MAX_RECOVERY_ROUNDS}`
          }));

          // Find "Queued" tasks for this model in order
          const queuedTasks = [];
          for (let idx = group.startIdx; idx <= group.endIdx; idx++) {
            const resultIdx = currentResults.findIndex(r =>
              r.providerKey === matrix[idx].providerKey &&
              r.modelValue === matrix[idx].modelValue &&
              r.marketplace === matrix[idx].marketplace &&
              r.mode === matrix[idx].mode &&
              r.status === "Queued"
            );
            if (resultIdx !== -1) {
              queuedTasks.push({ matrixIdx: idx, resultIdx });
            }
          }

          let modelRateLimited = false;

          for (const { matrixIdx, resultIdx } of queuedTasks) {
            if (abortControllerRef.current?.signal.aborted) break;
            if (modelRateLimited) break;

            const step = matrix[matrixIdx];
            const recoveryStart = Date.now();

            setProgress(prev => ({
              ...prev,
              label: `♻️ ${group.modelLabel}: ${step.marketplace} / ${step.mode}`,
              subLabel: `Task ${mp.completed + 1}/${mp.total} (recovery)`
            }));

            // Human-like delay
            await humanWait(2, 5, "Preparing recovery task...");

            // Key rotation for recovery
            const allKeysInPool = getAllKeys(step.providerKey).filter(k => k.trim());
            const authFailed = authFailedKeys[step.providerKey] || new Set();
            let recoverySuccess = false;
            let recoveryResult = { ...step, status: "Running", time: 0, prompts: [], error: "" };
            let lastErr = "";

            for (let kIdx = 0; kIdx < allKeysInPool.length; kIdx++) {
              if (authFailed.has(allKeysInPool[kIdx])) continue;
              if (abortControllerRef.current?.signal.aborted) break;

              const currentKey = allKeysInPool[kIdx];
              const keyLabel = `Key ${kIdx + 1}`;

              for (let attempt = 1; attempt <= 3; attempt++) {
                if (abortControllerRef.current?.signal.aborted) break;
                try {
                  if (attempt > 1) {
                    await waitWithBackoffJitter(attempt, 2500, 30000, "Recovery retry...");
                  }

                  const seedValue = getRandomSeeds(1, type)[0];
                  const apiKeysByModel = {
                    gemini: getAllKeys("gemini").filter(k => k.trim()),
                    groq: getAllKeys("groq").filter(k => k.trim()),
                    mistral: getAllKeys("mistral").filter(k => k.trim()),
                    openrouter: getAllKeys("openrouter").filter(k => k.trim()),
                    huggingface: getAllKeys("huggingface").filter(k => k.trim()),
                    cerebras: getAllKeys("cerebras").filter(k => k.trim()),
                    nvidia: getAllKeys("nvidia").filter(k => k.trim()),
                    github: getAllKeys("github").filter(k => k.trim()),
                  };
                  apiKeysByModel[step.providerKey] = [currentKey];

                  let targetMarketKey = step.marketplace === "all" ? "All Marketplaces" : step.marketplace;
                  const payload = {
                    concept: seedValue.seedPhrase, quantity: 10, model: step.modelValue, type,
                    targetMarket: targetMarketKey, apiKeys: [currentKey], apiKeysByModel,
                    autoMode: true, autoSubject: seedValue.seedPhrase, autoCategory: "ai-free-choice",
                    autoContext: seedValue.context || "",
                    ...(step.mode === "engineer" && { engineerMode: true }),
                    ...(step.mode !== "auto" && step.mode !== "engineer" && { specialMode: step.mode })
                  };

                  const response = await fetchWithAttemptTimeout("/api/generate-prompts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                    signal: abortControllerRef.current.signal
                  });

                  if (!response.ok) {
                    let errDetail = await response.text();
                    try { const p = JSON.parse(errDetail); if (p.error) errDetail = p.error; } catch(e2) {}
                    throw new Error(`HTTP ${response.status}: ${errDetail}`);
                  }

                  const reader = response.body.getReader();
                  const decoder = new TextDecoder();
                  let buf = "";
                  while (true) {
                    if (abortControllerRef.current?.signal.aborted) throw new Error("Aborted");
                    const { done, value } = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, { stream: true });
                  }
                  const finalPrompts = parseNumberedPrompts(buf, 10);
                  if (finalPrompts.length === 0) {
                    throw new Error("Recovery: valid response but no prompts parsed.");
                  }

                  recoveryResult.prompts = finalPrompts;
                  recoveryResult.status = "Success";
                  recoveryResult.error = `✅ Recovered (${keyLabel}, ${finalPrompts.length} prompts)`;
                  recoverySuccess = true;
                  break;
                } catch (err) {
                  lastErr = err.message || "Unknown Error";
                  if (err.name === "AbortError" || err.message === "Aborted") {
                    recoveryResult.status = "Aborted";
                    recoveryResult.error = "Cancelled";
                    break;
                  }

                  // Network auto-heal
                  if (!navigator.onLine || lastErr.toLowerCase().includes("failed to fetch") || lastErr.toLowerCase().includes("network error")) {
                    let waitSecs = 0;
                    while (!navigator.onLine && !abortControllerRef.current?.signal.aborted) {
                      await new Promise(r => setTimeout(r, 2000));
                      waitSecs += 2;
                    }
                    if (abortControllerRef.current?.signal.aborted) break;
                    await new Promise(r => setTimeout(r, 2000));
                    attempt--;
                    continue;
                  }

                  const { isFatalForKey, category } = classifyAttemptError(lastErr);
                  if (isFatalForKey) {
                    if (category === "auth") {
                      if (!authFailedKeys[step.providerKey]) authFailedKeys[step.providerKey] = new Set();
                      authFailedKeys[step.providerKey].add(currentKey);
                    }
                    break;
                  }
                }
              }

              if (recoverySuccess || recoveryResult.status === "Aborted") break;

              // Check if this was a rate limit → all keys may be exhausted
              const { category } = classifyAttemptError(lastErr);
              if (category === "quota") {
                modelRateLimited = true;
                break;
              }
            }

            recoveryResult.time = ((Date.now() - recoveryStart) / 1000).toFixed(1);

            if (!recoverySuccess && recoveryResult.status !== "Aborted") {
              recoveryResult.status = modelRateLimited ? "Queued" : "Error";
              recoveryResult.error = modelRateLimited
                ? `📋 Still reserved — rate limited again (round ${recoveryRound})`
                : `❌ Recovery failed: ${lastErr}`;
            }

            // Replace "Queued" placeholder with actual result
            if (recoveryResult.status !== "Queued") {
              currentResults[resultIdx] = recoveryResult;
            }
            setResults([...currentResults]);

            if (recoverySuccess) {
              mp.completed++;
              setModelQueueStatus({ ...modelProgress });
            }

            // Auto-sync sheets
            if (autoSyncSheets && sheetsUrl && recoveryResult.status === "Success") {
              try {
                const queued = JSON.parse(localStorage.getItem("offline_sync_queue") || "[]");
                fetch(sheetsUrl, {
                  method: "POST",
                  body: JSON.stringify({ action: "append", rows: [...queued, recoveryResult], sheetName: runIdRef.current || "Results" }),
                  headers: { "Content-Type": "text/plain;charset=utf-8" },
                }).then(res => {
                  if (res.ok) localStorage.removeItem("offline_sync_queue");
                }).catch(() => {});
              } catch(e) {}
            }

            // Delay between recovery tasks
            if (!abortControllerRef.current?.signal.aborted) {
              await new Promise(r => setTimeout(r, Math.floor(Math.random() * 6000) + 8000));
            }
          }

          // Update model status after processing its queue
          if (mp.completed >= mp.total) {
            mp.status = "completed";
          } else if (modelRateLimited) {
            mp.status = "paused";
            mp.cooldownUntil = Date.now() + getAdaptiveCooldown(mp.retryCount);
            mp.retryCount++;
          } else if (!queuedTasks.some(qt => currentResults[qt.resultIdx]?.status === "Queued")) {
            // All tasks got a final status (success or error)
            mp.status = "completed";
          }

          setModelQueueStatus({ ...modelProgress });
          saveModelQueue(type, modelProgress);

          saveRunCheckpoint({
            isRunning: true,
            matrix,
            currentIndex: matrix.length,
            results: currentResults,
            progress: {
              current: matrix.length,
              total: matrix.length,
              label: `Model recovery: ${group.modelLabel}`,
              subLabel: `${mp.completed}/${mp.total} completed`
            },
            runId: runIdRef.current,
            isVisualMode,
            isExpressMode,
            heartbeatAt: Date.now(),
            updatedAt: Date.now(),
          });
          saveModelQueue(type, modelProgress);
        }

        // Check if any models are still paused
        const remaining = modelGroups.filter(g => modelProgress[g.key]?.status === "paused");
        if (remaining.length === 0) break;

        // Check if retries exceeded for all remaining
        if (remaining.every(g => modelProgress[g.key].retryCount >= MAX_DEFER_RETRIES)) {
          remaining.forEach(g => {
            modelProgress[g.key].status = "failed";
            // Mark remaining "Queued" tasks as Error
            for (let idx = g.startIdx; idx <= g.endIdx; idx++) {
              const ri = currentResults.findIndex(r =>
                r.providerKey === matrix[idx].providerKey &&
                r.modelValue === matrix[idx].modelValue &&
                r.marketplace === matrix[idx].marketplace &&
                r.mode === matrix[idx].mode &&
                r.status === "Queued"
              );
              if (ri !== -1) {
                currentResults[ri].status = "Error";
                currentResults[ri].error = `❌ Model recovery exhausted after ${MAX_DEFER_RETRIES} rounds.`;
              }
            }
          });
          setResults([...currentResults]);
          setModelQueueStatus({ ...modelProgress });
          break;
        }
      }
    }
    
    if (setMainLoading) setMainLoading(false);
    if (setMainGenStep) setMainGenStep(0);
    
    // Final model queue summary
    const finalSummary = getModelSummary(modelProgress);
    saveModelQueue(type, modelProgress);
    setModelQueueStatus({ ...modelProgress });

    if (!abortControllerRef.current?.signal.aborted) {
      const completionMsg = finalSummary.failed > 0
        ? `✅ ${finalSummary.completed} models completed, ${finalSummary.failed} failed`
        : "✅ All models completed!";
      setProgress(prev => ({ ...prev, subLabel: completionMsg }));
      playAudioAlert('success');
    }

    setIsRunning(false);
    setActiveKeyInfo("");
    currentStepStartedAtRef.current = 0;
    currentStepLabelRef.current = "";
    clearRunCheckpoint();
    isRunningRef.current = false;
  };

  const stopTest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (setMainLoading) setMainLoading(false);
    if (setMainGenStep) setMainGenStep(0);
    setIsRunning(false);
    setActiveKeyInfo("");
    currentStepStartedAtRef.current = 0;
    currentStepLabelRef.current = "";
    clearRunCheckpoint();
    isRunningRef.current = false;
  };

  const classifyAttemptError = (message = "") => {
    const err = String(message).toLowerCase();
    // Fix: Only match specific auth patterns — "invalid" alone is too broad and catches
    // "invalid JSON", "invalid model", "invalid request" etc., falsely banning good keys
    const isAuth = err.includes("401") || err.includes("403") || err.includes("unauthorized") || err.includes("invalid api key") || err.includes("invalid_api_key") || err.includes("invalid key") || err.includes("invalid token") || err.includes("invalid authentication");
    const isQuota = err.includes("429") || err.includes("quota") || err.includes("rate limit") || err.includes("too many");
    const isTimeout = err.includes("timeout") || err.includes("timed out") || err.includes("network") || err.includes("failed to fetch") || err.includes("503") || err.includes("502") || err.includes("504");
    const isRetryable4xx = err.includes("408");

    let retryAfterSeconds = null;
    const match = String(message).match(/\[RETRY_AFTER:(\d+)\]/i);
    if (match && match[1]) {
      retryAfterSeconds = parseInt(match[1], 10);
    }

    return {
      isFatalForKey: isAuth || isQuota,
      category: isAuth ? "auth" : isQuota ? "quota" : (isTimeout || isRetryable4xx) ? "transient" : "other",
      retryAfterSeconds
    };
  };

  const fetchWithAttemptTimeout = async (url, options, timeoutMs = 90000) => {
    const timeoutController = new AbortController();
    const externalSignal = options?.signal;
    let timeoutId;
    let onAbort;
    try {
      if (externalSignal) {
        onAbort = () => timeoutController.abort();
        externalSignal.addEventListener("abort", onAbort);
      }
      timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
      return await fetch(url, { ...options, signal: timeoutController.signal });
    } catch (e) {
      if (timeoutController.signal.aborted && externalSignal?.aborted) {
        throw new Error("Aborted");
      }
      if (timeoutController.signal.aborted) {
        throw new Error(`Request timeout after ${Math.floor(timeoutMs / 1000)}s`);
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
      if (externalSignal && onAbort) externalSignal.removeEventListener("abort", onAbort);
    }
  };
  
  const confirmClearResults = () => {
    setResults([]);
    setProgress({ current: 0, total: 0, label: "" });
    setModelQueueStatus({});
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem(LOCAL_STORAGE_BACKUP_KEY);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(RUN_CHECKPOINT_KEY);
      clearModelQueue(type);
    } catch(e) {}
    setShowClearConfirm(false);
  };

  const saveToGoogleSheets = async () => {
    if (!sheetsUrl || results.length === 0) return;
    setIsSyncing(true);
    try {
      const res = await fetch(sheetsUrl, {
        method: "POST",
        body: JSON.stringify({ action: "append", rows: results, sheetName: runIdRef.current || "Results" }),
        headers: { "Content-Type": "text/plain;charset=utf-8" },
      });
      const data = await res.json();
      if (data.success) {
        showToast("✅ Succesfully saved to Google Sheets!", "success");
      } else {
        showToast("❌ Error saving to Sheets: " + data.message, "error");
      }
    } catch (err) {
      showToast("❌ Failed to connect to Google Sheets URL.", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const confirmClearSheets = async () => {
    if (!sheetsUrl) return;
    setIsDeletingSheets(true);
    try {
      const res = await fetch(sheetsUrl, {
        method: "POST",
        body: JSON.stringify({ action: "clear", sheetName: runIdRef.current || "Results" }),
        headers: { "Content-Type": "text/plain;charset=utf-8" },
      });
      const data = await res.json();
      if (data.success) {
        showToast("✅ Online sheet data cleared successfully!", "success");
      } else {
        showToast("❌ Error clearing sheet: " + data.message, "error");
      }
    } catch (err) {
      showToast("❌ Failed to connect to Google Sheets URL.", "error");
    } finally {
      setIsDeletingSheets(false);
      setShowSheetsClearConfirm(false);
    }
  };

  if (!showTester) {
    return (
      <div className="card" style={{ background: 'linear-gradient(135deg, var(--bg) 0%, var(--bg2) 100%)', borderColor: 'rgba(79, 70, 229, 0.2)', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 150, height: 150, background: 'rgba(79, 70, 229, 0.1)', borderRadius: '50%', filter: 'blur(40px)' }}></div>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: '1 1 300px' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(79, 70, 229, 0.3)', flexShrink: 0 }}>
              <Activity size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)' }}>AI Performance & Quality Benchmark</h3>
              <p style={{ fontSize: 13, color: 'var(--text2)', margin: '4px 0 0 0', maxWidth: 450, lineHeight: 1.5 }}>
                Automatically test all configured API providers, analyze response times, and benchmark content generation securely.
              </p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowTester(true)} style={{ whiteSpace: 'nowrap', padding: '10px 20px', fontSize: 14 }}>
            <Play size={16} fill="currentColor" style={{ flexShrink: 0 }} /> Launch Auto Tester
          </button>
        </div>
        
        {toast.show && (
          <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: toast.type === 'error' ? '#fef2f2' : '#ecfdf5', border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#a7f3d0'}`, padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 9999, boxShadow: '0 20px 40px rgba(0,0,0,0.15)', animation: 'slideUpBounce 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
            {toast.type === 'error' ? <AlertTriangle size={20} color="#ef4444" /> : <CheckCircle size={20} color="#10b981" />}
            <span style={{ color: toast.type === 'error' ? '#b91c1c' : '#047857', fontWeight: 600, fontSize: '14px' }}>{toast.message}</span>
          </div>
        )}
      </div>
    );
  }

  const successCount = results.filter(r => r.status === "Success").length;
  const errorCount = results.filter(r => r.status === "Error" || r.status === "Skipped").length;

  return (
    <ErrorBoundary type={type}>
      <div className="card auto-tester-card">
        {showClearConfirm && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
          <div className="card" style={{ width: 360, maxWidth: '90%', padding: '24px', background: 'var(--card)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid var(--border)', transform: 'scale(1)', animation: 'dropdownPopIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Clear Benchmark Logs?</h4>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                  This will permanently delete all records of this test. You won&apos;t be able to download the Excel report anymore.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-ghost" onClick={() => setShowClearConfirm(false)} style={{ color: 'var(--text2)' }}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmClearResults} style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: 'white', border: 'none' }}>
                Yes, Clear Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {showSheetsClearConfirm && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
          <div className="card" style={{ width: 360, maxWidth: '90%', padding: '24px', background: 'var(--card)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid var(--error)', transform: 'scale(1)', animation: 'dropdownPopIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={24} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Clear Online Google Sheet?</h4>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                  This will permanently delete ALL data rows from your connected Google Sheet online. This action cannot be undone.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-ghost" onClick={() => setShowSheetsClearConfirm(false)} disabled={isDeletingSheets} style={{ color: 'var(--text2)' }}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmClearSheets} disabled={isDeletingSheets} style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: 'white', border: 'none' }}>
                {isDeletingSheets ? 'Deleting...' : 'Yes, Delete Online Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card-top" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(79, 70, 229, 0.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={16} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>AI Performance & Quality Benchmark</span>
          </div>
          <button className="btn-icon" onClick={() => setShowTester(false)} title="Minimize Dashboard">
            <XCircle size={18} />
          </button>
        </div>
      </div>
      
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--card)' }}>
        
        {!isRunning && (
          <>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginRight: 4 }}>Target Providers:</span>
              {Object.keys(PROVIDER_MODELS).map(p => {
                const pUi = PROVIDERS_UI.find(ui => ui.apiKey === p);
                const label = pUi ? pUi.label : p;
                const isActive = selectedProviders.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => {
                      setSelectedProviders(prev => 
                        prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                      );
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: isActive ? 'var(--accent-bg)' : 'transparent',
                      color: isActive ? 'var(--accent)' : 'var(--text2)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            
            {selectedProviders.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '-8px' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginRight: 4 }}>Specific Models:</span>
                {selectedProviders.map(p => {
                   return PROVIDER_MODELS[p].map(m => {
                     const isActive = selectedModels.includes(m.value);
                     return (
                      <button
                        key={m.value}
                        onClick={() => {
                          setSelectedModels(prev => 
                            prev.includes(m.value) ? prev.filter(x => x !== m.value) : [...prev, m.value]
                          );
                        }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 500,
                          border: isActive ? '1px solid rgba(79, 70, 229, 0.5)' : '1px solid var(--border)',
                          background: isActive ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                          color: isActive ? 'var(--accent)' : 'var(--text3)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {m.label}
                      </button>
                     );
                   });
                })}
               </div>
            )}
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '-2px' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginRight: 4 }}>Target Marketplaces:</span>
              {MARKETPLACES.map(m => {
                const isActive = selectedMarketplaces.includes(m);
                const mLabel = m === "all" ? "All Marketplaces" : m.charAt(0).toUpperCase() + m.slice(1);
                return (
                  <button
                    key={m}
                    onClick={() => {
                      setSelectedMarketplaces(prev => 
                        prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
                      );
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: isActive ? 'var(--accent-bg)' : 'transparent',
                      color: isActive ? 'var(--accent)' : 'var(--text2)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {mLabel}
                  </button>
                );
              })}
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '-2px' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginRight: 4 }}>Target Modes:</span>
              {getModesForType(type).map(m => {
                const isActive = selectedModes.includes(m);
                const mLabel = MODE_LABELS[m] || m.charAt(0).toUpperCase() + m.slice(1);
                return (
                  <button
                    key={m}
                    onClick={() => {
                      setSelectedModes(prev => 
                        prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
                      );
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: isActive ? 'var(--accent-bg)' : 'transparent',
                      color: isActive ? 'var(--accent)' : 'var(--text2)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {mLabel}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {!isRunning ? (
            <>
              <button className="btn btn-tester-start" onClick={() => startTest(false, false)} style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
                <Activity size={16} /> {results.length > 0 && results.length < getMatrix(false).length ? 'Resume Background Test' : '⚙️ Background Matrix Test'}
              </button>
              <button className="btn" onClick={() => startTest(true, false)} style={{ border: '1.5px solid var(--accent)', color: 'var(--accent)', background: 'var(--accent-bg)', fontWeight: 600 }}>
                👁️ {results.length > 0 && results.length < getMatrix(false).length ? 'Resume Visual Automation' : 'Live Visual Automation'}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-danger btn-tester-stop" onClick={stopTest} style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: 'white', border: 'none', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}>
                <Square size={16} fill="currentColor" /> Stop Test
              </button>
              <button className="btn btn-secondary" onClick={() => (skipProviderRef.current = true)} title="Skip to the very next provider">
                ⏭ Skip Provider
              </button>
            </>
          )}
          
          {!isRunning && errorCount > 0 && (
             <button className="btn" onClick={retryFailedTests} style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', fontWeight: 600, marginLeft: 'auto' }}>
               🔄 Retry {errorCount} Failed {errorCount === 1 ? 'Test' : 'Tests'}
             </button>
          )}

          <button 
            className="btn btn-secondary" 
            onClick={downloadExcel} 
            disabled={results.length === 0}
            style={{ marginLeft: !isRunning && errorCount > 0 ? '0' : 'auto' }}
          >
            <Download size={16} /> Export Local (.xlsx)
          </button>

          {sheetsUrl && (
            <>
              <button 
                className="btn" 
                onClick={saveToGoogleSheets} 
                disabled={results.length === 0 || isSyncing}
                style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', fontWeight: 600, border: '1px solid rgba(16, 185, 129, 0.2)' }}
              >
                {isSyncing ? "Syncing..." : "☁️ Save to Sheets"}
              </button>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text2)', cursor: 'pointer', background: 'var(--bg2)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <input 
                  type="checkbox" 
                  checked={autoSyncSheets} 
                  onChange={(e) => {
                    const val = e.target.checked;
                    setAutoSyncSheets(val);
                    try { localStorage.setItem("auto_tester_sheets_sync", val ? "true" : "false"); } catch {}
                  }}
                  style={{ accentColor: '#10b981', cursor: 'pointer' }}
                />
                Auto-Sync
              </label>
            </>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text2)', cursor: 'pointer', background: 'var(--bg2)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)', marginLeft: sheetsUrl ? '0' : 'auto' }}>
            <input 
              type="checkbox" 
              checked={enablePreFlight} 
              onChange={(e) => {
                const val = e.target.checked;
                setEnablePreFlight(val);
                try { localStorage.setItem("auto_tester_preflight", val ? "true" : "false"); } catch {}
              }}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            Pre-Flight
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text2)', cursor: 'pointer', background: 'var(--bg2)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <input 
              type="checkbox" 
              checked={enableAudioAlerts} 
              onChange={(e) => {
                const val = e.target.checked;
                setEnableAudioAlerts(val);
                try { localStorage.setItem("auto_tester_audio", val ? "true" : "false"); } catch {}
              }}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            Sound
          </label>

          {results.length > 0 && !isRunning && (
            <button className="btn" onClick={() => setShowClearConfirm(true)} style={{ color: 'var(--error)', background: 'rgba(239, 68, 68, 0.08)' }}>
              <Trash2 size={16} /> Clear Local
            </button>
          )}
          
          {sheetsUrl && !isRunning && (
            <button className="btn" onClick={() => setShowSheetsClearConfirm(true)} style={{ color: 'var(--error)', background: 'rgba(239, 68, 68, 0.08)' }}>
              <Trash2 size={16} /> Clear Sheets
            </button>
          )}
        </div>
        
        {/* Stats */}
        {(progress.total > 0 || results.length > 0) && (
          <div className="auto-tester-stats-grid">
            <div className="auto-tester-stat stat-progress">
              <span className="stat-label"><Activity size={12} /> Test Progress</span>
              <span className="stat-value" style={{ color: '#3b82f6' }}>{progress.current} / {progress.total}</span>
            </div>
            <div className="auto-tester-stat stat-success">
              <span className="stat-label"><CheckCircle size={12} /> Successful Outputs</span>
              <span className="stat-value" style={{ color: 'var(--success)' }}>{successCount}</span>
            </div>
            <div className="auto-tester-stat stat-error">
              <span className="stat-label"><AlertTriangle size={12} /> Failed Retries</span>
              <span className="stat-value" style={{ color: 'var(--error)' }}>{errorCount}</span>
            </div>
          </div>
        )}
        
        {/* Analytics Leaderboard */}
        {analytics.length > 0 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg2)' }}>
            <div style={{ padding: '12px 16px', background: 'var(--card)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🏆</span>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Analytics Leaderboard</h4>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) minmax(100px, 0.8fr) 80px 80px 100px', gap: '8px', padding: '8px 16px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)' }}>
              <div>Model</div>
              <div>Provider</div>
              <div style={{ textAlign: 'center' }}>Speed</div>
              <div style={{ textAlign: 'center' }}>Errors</div>
              <div style={{ textAlign: 'right' }}>Reliability</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', transition: 'all 0.3s ease' }}>
              {(isLeaderboardExpanded ? analytics : analytics.slice(0, 3)).map((s, idx) => (
                <div key={s.label + s.provider} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) minmax(100px, 0.8fr) 80px 80px 100px', gap: '8px', padding: '10px 16px', fontSize: 13, borderBottom: '1px solid var(--border)', background: 'var(--bg)', alignItems: 'center', animation: 'fadeIn 0.2s ease' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ color: 'var(--text3)', fontSize: 11, fontWeight: 700, width: '16px', flexShrink: 0 }}>{idx + 1}.</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.label}>{s.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ 
                      padding: '2px 8px', 
                      borderRadius: '12px', 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      background: 'var(--bg2)', 
                      color: 'var(--accent)',
                      border: '1px solid rgba(79, 70, 229, 0.2)',
                      whiteSpace: 'nowrap'
                    }}>
                      {s.provider}
                    </span>
                  </div>
                  <div style={{ textAlign: 'center', color: 'var(--text2)', fontWeight: 500 }}>
                    {s.avgTime}s <span style={{ fontSize: 10, color: 'var(--text3)' }}>avg</span>
                  </div>
                  <div style={{ textAlign: 'center', color: s.error > 0 ? 'var(--error)' : 'var(--text3)', fontWeight: s.error > 0 ? 700 : 400 }}>
                    {s.error}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: 11, fontWeight: 700, background: s.successRate === 100 ? 'rgba(16, 185, 129, 0.1)' : s.successRate >= 80 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: s.successRate === 100 ? 'var(--success)' : s.successRate >= 80 ? '#f59e0b' : 'var(--error)' }}>
                      {s.successRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
              {analytics.length > 3 && (
                 <button 
                   onClick={() => setIsLeaderboardExpanded(!isLeaderboardExpanded)}
                   style={{ 
                     padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text3)', 
                     textAlign: 'center', background: 'var(--bg2)', border: 'none', 
                     cursor: 'pointer', outline: 'none', transition: 'background 0.2s' 
                   }}
                   onMouseOver={e => e.currentTarget.style.background = 'var(--card)'}
                   onMouseOut={e => e.currentTarget.style.background = 'var(--bg2)'}
                 >
                   {isLeaderboardExpanded ? 'Collapse Leaderboard ▲' : `View All ${analytics.length} Models ▼`}
                 </button>
              )}
            </div>
          </div>
        )}

        {/* UPS 4.0: Live Key Health Cluster */}
        {Object.keys(liveKeyStatuses).length > 0 && (
          <div style={{ padding: '16px', background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={14} color="var(--accent)" />
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Live API Cluster Health</h4>
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                {Object.entries(liveKeyStatuses).map(([provider, keys]) => (
                  <div key={provider} style={{ background: 'var(--bg2)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '6px', opacity: 0.8 }}>{provider}</div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {keys.map((k, idx) => (
                        <div 
                          key={idx} 
                          title={`${k.label}: ${k.status}`}
                          style={{ 
                            width: '10px', 
                            height: '10px', 
                            borderRadius: '50%',
                            background: k.status === 'active' ? '#10b981' : k.status === 'cooldown' ? '#f59e0b' : '#ef4444',
                            boxShadow: k.status === 'active' ? '0 0 6px rgba(16, 185, 129, 0.4)' : 'none',
                            transition: 'all 0.3s ease'
                          }} 
                        />
                      ))}
                    </div>
                  </div>
                ))}
             </div>
             <div style={{ display: 'flex', gap: '12px', fontSize: 10, color: 'var(--text3)', marginTop: '4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Healthy</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} /> Cooldown</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} /> Exhausted</span>
             </div>
          </div>
        )}

        {/* Model Queue Status */}
        {Object.keys(modelQueueStatus).length > 0 && (
          <div style={{ padding: '16px', background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={14} color="var(--accent)" />
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Model Task Queue</h4>
              <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
                {Object.values(modelQueueStatus).filter(m => m.status === 'completed').length}/{Object.keys(modelQueueStatus).length} models done
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
              {Object.entries(modelQueueStatus).map(([mk, mp]) => {
                const [, modelValue] = mk.split('|');
                const modelInfo = Object.values(PROVIDER_MODELS).flat().find(m => m.value === modelValue);
                const pct = mp.total > 0 ? Math.round((mp.completed / mp.total) * 100) : 0;
                const statusColor = mp.status === 'completed' ? '#10b981' : mp.status === 'paused' ? '#f59e0b' : mp.status === 'failed' ? '#ef4444' : mp.status === 'in_progress' ? '#6366f1' : '#94a3b8';
                const statusIcon = mp.status === 'completed' ? '✓' : mp.status === 'paused' ? '⏸' : mp.status === 'failed' ? '✕' : mp.status === 'in_progress' ? '▶' : '○';
                return (
                  <div key={mk} style={{ background: 'var(--bg2)', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${statusColor}33` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {statusIcon} {modelInfo?.label || modelValue}
                      </span>
                      <span style={{ fontSize: 10, color: statusColor, fontWeight: 700 }}>{mp.completed}/{mp.total}</span>
                    </div>
                    <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: statusColor, borderRadius: 2, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: 10, color: 'var(--text3)', marginTop: '2px', flexWrap: 'wrap' }}>
              <span>○ Pending</span>
              <span style={{ color: '#6366f1' }}>▶ Active</span>
              <span style={{ color: '#f59e0b' }}>⏸ Paused</span>
              <span style={{ color: '#10b981' }}>✓ Done</span>
              <span style={{ color: '#ef4444' }}>✕ Failed</span>
            </div>
          </div>
        )}

        {/* Progress Bar Label */}
        {isRunning && (() => {
          let etaString = "";
          if (elapsedSeconds >= 60) {
            const mins = Math.floor(elapsedSeconds / 60);
            const secs = elapsedSeconds % 60;
            etaString = ` • Elapsed Time: ${mins}m ${secs.toString().padStart(2, '0')}s`;
          } else {
            etaString = ` • Elapsed Time: ${elapsedSeconds}s`;
          }
          return (
            <div className="auto-tester-progress-container">
              <div className="auto-tester-label" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                  <Activity size={14} className="spin-slow" color="var(--accent)" /> 
                  {progress.label}
                  <span style={{ color: 'var(--text3)', fontWeight: 500, fontSize: '12px' }}>{etaString}</span>
                </div>
                {progress.subLabel && (
                  <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600, paddingLeft: '22px', animation: 'fadeIn 0.3s ease' }}>
                    {progress.subLabel}
                  </div>
                )}

              </div>
              <div className="auto-tester-track">
                <div 
                  className="auto-tester-bar" 
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`, boxShadow: '0 0 10px var(--accent)' }} 
                />
              </div>
            </div>
          );
        })()}


        {/* Live Logs & Empty State */}
        {results.length > 0 ? (
          <div className="auto-tester-log-container" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)', marginBottom: 4, position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 10 }}>
              <div style={{ width: 120, flexShrink: 0 }}>System Status</div>
              <div style={{ flex: 1 }}>AI Configuration Setup {results.length > 50 && <span style={{ color: 'var(--accent)', textTransform: 'none', marginLeft: 8 }}>(Showing last 50 of {results.length})</span>}</div>
              <div style={{ minWidth: 40, textAlign: 'right' }}>Speed</div>
            </div>
            {results.slice(-50).reverse().map((r, i) => (
              <div key={i} className={`auto-tester-log-row ${r.status === 'Success' ? 'log-success' : r.status === 'Aborted' ? 'log-aborted' : r.status === 'Skipped' ? 'log-skipped' : 'log-error'}`}>
                <div style={{display: 'flex', alignItems: 'center', gap: 6, width: '120px', flexShrink: 0}}>
                  {r.status === 'Success' ? <CheckCircle size={14} color="var(--success)" /> : r.status === 'Aborted' ? <Square size={14} color="var(--text3)" /> : r.status === 'Skipped' ? <Clock size={14} color="#f59e0b" /> : <XCircle size={14} color="var(--error)" />}
                  <span style={{fontSize: 12, fontWeight: 600, color: r.status === 'Success' ? 'var(--success)' : r.status === 'Aborted' ? 'var(--text3)' : r.status === 'Skipped' ? '#f59e0b' : 'var(--error)'}}>{r.status}</span>
                </div>
                <div style={{flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 6}}>
                  <span className="log-badge" style={{ background: 'var(--card)' }}>{r.provider}</span>
                  <span className="log-badge log-model">{r.modelLabel}</span>
                  <span className="log-badge" style={{ background: 'var(--card)' }}>{r.marketplace}</span>
                  <span className="log-badge" style={{ background: 'var(--card)' }}>{r.mode}</span>
                </div>
                <div style={{fontSize: 12, fontWeight: 600, color: 'var(--text2)', justifySelf: 'flex-end', minWidth: '40px', textAlign: 'right'}}>
                  {r.time}s
                </div>
                {r.error && (
                  <div style={{width: '100%', fontSize: 11, color: r.status === 'Skipped' ? '#f59e0b' : 'var(--text3)', marginTop: 8, padding: '8px 12px', background: 'var(--card)', borderRadius: '8px', borderLeft: `3px solid ${r.status === 'Success' ? 'var(--success)' : 'var(--error)'}`, whiteSpace: 'pre-line', lineHeight: '1.6', fontFamily: 'monospace' }}>
                    {r.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: 'var(--bg2)', borderRadius: 12, border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <Activity size={32} opacity={0.5} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: 15, color: 'var(--text)' }}>System Ready</h4>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)' }}>Press Start to begin the automated benchmarking process.</p>
            </div>
          </div>
        )}
      </div>
      
      {toast.show && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: toast.type === 'error' ? '#fef2f2' : '#ecfdf5', border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#a7f3d0'}`, padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 9999, boxShadow: '0 20px 40px rgba(0,0,0,0.15)', animation: 'slideUpBounce 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
          {toast.type === 'error' ? <AlertTriangle size={20} color="#ef4444" /> : <CheckCircle size={20} color="#10b981" />}
          <span style={{ color: toast.type === 'error' ? '#b91c1c' : '#047857', fontWeight: 600, fontSize: '14px' }}>{toast.message}</span>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
