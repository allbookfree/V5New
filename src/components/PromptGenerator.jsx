"use client";

import { useState, useEffect, useRef, useMemo, memo } from "react";
import dynamic from "next/dynamic";
import { Sparkles, Download, Hash, Type, Cpu, AlertCircle, FileText, Copy, Check, Settings, Lightbulb, Save, Edit3, CheckSquare, Square, Globe, Wand2, Star, CalendarDays, Wrench, Repeat, ImageIcon, Layers, Shirt, Sunrise, Frame, Package, Puzzle, Palette, Briefcase, Bot, Plane, Search, Box } from "lucide-react";

const AutoTester = dynamic(() => import("./AutoTester"), { ssr: false });

import { useApiKeys } from "@/context/ApiKeyContext";
import { useLanguage } from "@/context/LanguageContext";
import { copyToClipboard, downloadPromptsCsv, downloadPromptsTxt, parseNumberedPrompts } from "@/lib/promptUtils";
import { mapApiError } from "@/lib/apiErrors";
import { saveToPromptHistory } from "@/lib/promptHistory";
import { getRandomSeeds } from "@/lib/subjectPool";
import { getUpcomingFestivals, getFestivalContext } from "@/lib/festivalCalendar";
import { PROVIDERS_UI, MODEL_LABELS, PROVIDER_KEY_MAP } from "@/config/models";
import { recordUsage, getBestAvailableProvider } from "@/lib/usageTracker";

// Marketplaces that do NOT accept raw AI output through their standard
// contributor portal. Selecting one of these surfaces a manual-touch hint
// so users know to apply their own editing pass before upload (and to
// prefer vector / template / curated formats where possible).
const MANUAL_TOUCH_MARKETS = new Set([
  "shutterstock",
  "getty",
  "depositphotos",
  "pond5",
  "creativemarket",
  "envato",
  "amazon-kdp",
]);

const SPECIAL_MODES_BY_TYPE = {
  image: [
    { value: "surreal",           labelKey: "prompt.surreal",          tipKey: "prompt.surrealTip",          icon: Sparkles,   color: "#8b5cf6" },
    { value: "background-texture",labelKey: "prompt.backgroundTexture",tipKey: "prompt.backgroundTextureTip",icon: Layers,     color: "#0ea5e9" },
    { value: "wall-art",          labelKey: "prompt.wallArt",          tipKey: "prompt.wallArtTip",          icon: Frame,      color: "#f59e0b" },
    { value: "mockup",            labelKey: "prompt.mockup",           tipKey: "prompt.mockupTip",           icon: Package,    color: "#10b981" },
    { value: "collection",        labelKey: "prompt.collection",       tipKey: "prompt.collectionTip",       icon: Puzzle,     color: "#ec4899" },
    { value: "print-on-demand",   labelKey: "prompt.printOnDemand",    tipKey: "prompt.printOnDemandTip",    icon: Shirt,      color: "#f97316" },
    { value: "seasonal",          labelKey: "prompt.seasonal",         tipKey: "prompt.seasonalTip",         icon: Sunrise,    color: "#06b6d4" },
  ],
  vector: [
    { value: "glyph-icons",      labelKey: "prompt.glyphIcons",       tipKey: "prompt.glyphIconsTip",       icon: Briefcase,  color: "#475569" },
    { value: "t-shirt-graphic",  labelKey: "prompt.tShirtGraphic",    tipKey: "prompt.tShirtGraphicTip",    icon: Shirt,      color: "#f43f5e" },
    { value: "character-mascot", labelKey: "prompt.characterMascot",  tipKey: "prompt.characterMascotTip",  icon: Bot,        color: "#10b981" },
    { value: "icon-pack",        labelKey: "prompt.iconPack",         tipKey: "prompt.iconPackTip",         icon: Palette,    color: "#6366f1" },
    { value: "icon-bundle",      labelKey: "prompt.iconBundle",       tipKey: "prompt.iconBundleTip",       icon: Box,        color: "#a855f7" },
    { value: "web-ui-icons",     labelKey: "prompt.webUiIcons",       tipKey: "prompt.webUiIconsTip",       icon: Layers,     color: "#0ea5e9" },
    { value: "pattern",          labelKey: "prompt.pattern",          tipKey: "prompt.patternTip",          icon: ImageIcon,  color: "#f59e0b" },
    { value: "sticker-pack",     labelKey: "prompt.stickerPack",      tipKey: "prompt.stickerPackTip",      icon: Star,       color: "#ec4899" },
    { value: "clipart-bundle",   labelKey: "prompt.clipartBundle",    tipKey: "prompt.clipartBundleTip",    icon: Sparkles,   color: "#f97316" },
    { value: "logo-element",     labelKey: "prompt.logoElement",      tipKey: "prompt.logoElementTip",      icon: Wand2,      color: "#8b5cf6" },
    { value: "infographic",      labelKey: "prompt.infographic",      tipKey: "prompt.infographicTip",      icon: FileText,   color: "#10b981" },
    { value: "social-template",  labelKey: "prompt.socialTemplate",   tipKey: "prompt.socialTemplateTip",   icon: Globe,      color: "#06b6d4" },
    { value: "background-texture",labelKey: "prompt.backgroundTexture",tipKey: "prompt.backgroundTextureTip",icon: Layers,     color: "#0ea5e9" },
    { value: "brand-icons",      labelKey: "prompt.brandIcons",       tipKey: "prompt.brandIconsTip",       icon: Package,    color: "#f59e0b" },
    { value: "collection",       labelKey: "prompt.collection",       tipKey: "prompt.collectionTip",       icon: Puzzle,     color: "#ec4899" },
  ],
  video: [
    { value: "aerial-drone",    labelKey: "prompt.aerialDrone",     tipKey: "prompt.aerialDroneTip",     icon: Plane,      color: "#3b82f6" },
    { value: "macro-cinematic", labelKey: "prompt.macroCinematic",  tipKey: "prompt.macroCinematicTip",  icon: Search,     color: "#10b981" },
    { value: "product-showcase",labelKey: "prompt.productShowcase", tipKey: "prompt.productShowcaseTip", icon: Box,        color: "#f59e0b" },
    { value: "b-roll",          labelKey: "prompt.bRoll",          tipKey: "prompt.bRollTip",          icon: ImageIcon,  color: "#6366f1" },
    { value: "loopable",        labelKey: "prompt.loopable",        tipKey: "prompt.loopableTip",        icon: Repeat,     color: "#0ea5e9" },
    { value: "vertical",        labelKey: "prompt.vertical",        tipKey: "prompt.verticalTip",        icon: Layers,     color: "#f59e0b" },
    { value: "time-lapse",      labelKey: "prompt.timeLapse",       tipKey: "prompt.timeLapseTip",       icon: Sunrise,    color: "#10b981" },
    { value: "slow-motion",     labelKey: "prompt.slowMotion",      tipKey: "prompt.slowMotionTip",      icon: Sparkles,   color: "#ec4899" },
    { value: "motion-graphics", labelKey: "prompt.motionGraphics",  tipKey: "prompt.motionGraphicsTip",  icon: Wand2,      color: "#f97316" },
    { value: "collection",      labelKey: "prompt.collection",      tipKey: "prompt.collectionTip",      icon: Puzzle,     color: "#8b5cf6" },
  ],
};

function formatModelName(raw) {
  if (!raw) return "";
  if (MODEL_LABELS[raw]) return MODEL_LABELS[raw];
  if (raw.endsWith("+search")) {
    const base = raw.replace("+search", "");
    const name = MODEL_LABELS[base] || base;
    return `${name} + Search`;
  }
  if (raw.startsWith("or:")) {
    const short = raw.slice(3).split("/").pop()?.split(":")[0] || raw;
    return short.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }
  if (raw.startsWith("hf:")) {
    const short = raw.slice(3).split("/").pop() || raw;
    return short.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }
  return raw;
}

const PipelineTracker = memo(function PipelineTracker({ step, providerLabel, isResearch, t }) {
  if (step === 0) return null;
  const steps = isResearch
    ? [
        { id: 1, label: t("prompt.stepPreparing"), desc: t("prompt.descValidating") },
        { id: 2, label: t("prompt.stepResearching"), desc: t("prompt.descSearching") },
        { id: 3, label: t("prompt.stepGenerating"), desc: t("prompt.descMarketWriting") },
        { id: 4, label: t("prompt.stepComplete"), desc: t("prompt.descResearchReady") },
      ]
    : [
        { id: 1, label: t("prompt.stepPreparing"), desc: t("prompt.descValidating") },
        { id: 2, label: t("prompt.stepConnecting"), desc: t("prompt.descSendingTo") },
        { id: 3, label: t("prompt.stepGenerating"), desc: t("prompt.descWriting") },
        { id: 4, label: t("prompt.stepComplete"), desc: t("prompt.descAllReady") },
      ];
  return (
    <div className="pipeline-wrap">
      <div className="pipeline-track">
        {steps.map((s, i) => {
          const done = step > s.id;
          const active = step === s.id;
          return (
            <div key={s.id} className="pipeline-step-group">
              <div className={`pipeline-step${done ? " done" : active ? " active" : " pending"}`}>
                <div className="pipeline-dot">
                  {done ? <Check size={11} strokeWidth={3} /> : active ? <span className="pipeline-pulse" /> : null}
                </div>
                <span className="pipeline-label">{s.label}</span>
                {active && <span className="pipeline-desc">{s.id === 2 && !isResearch ? `${s.desc} ${providerLabel}` : s.desc}</span>}
              </div>
              {i < steps.length - 1 && (
                <div className={`pipeline-line${step > s.id ? " filled" : ""}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default function PromptGenerator({
  type = "image",
  title = "Prompt Generator",
  description = "Generate prompts with AI",
  icon: Icon = Sparkles,
  gradient,
  storagePrefix = "prompt",
  titleKey,
  descKey,
  advancedTitleKey,
  placeholderKey,
}) {
  const { getAllKeys, selectedModels, keys } = useApiKeys();
  const { t, lang } = useLanguage();
  const [concept, setConcept] = useState("");
  const [quantity, setQuantity] = useState(10);
  const [model, setModel] = useState("google");
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(-1);
  const [copiedAll, setCopiedAll] = useState(false);
  const [advancedOn, setAdvancedOn] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`${storagePrefix}_advanced_on`) === "true";
  });
  const [customInstructions, setCustomInstructions] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(`${storagePrefix}_advanced_instructions`) || "";
  });
  const [showEditor, setShowEditor] = useState(() => {
    if (typeof window === "undefined") return false;
    const savedState = localStorage.getItem(`${storagePrefix}_advanced_on`);
    const savedText = localStorage.getItem(`${storagePrefix}_advanced_instructions`);
    return savedState === "true" && !savedText;
  });
  const [saved, setSaved] = useState(false);
  const [modelUsed, setModelUsed] = useState("");
  const [genStep, setGenStep] = useState(0);
  const resetTimer = useRef(null);
  // Prompt-settings controls (style/mood/lighting/etc.) were removed from
  // the UI â€” the generation backend still accepts them, so keep empty-
  // string state so the existing payload shape stays stable.
  const style = "";
  const mood = "";
  const lighting = "";
  const camera = "";
  const shot = "";
  const speed = "";
  const aspectRatio = "16:9";
  const duration = "";
  const negativePrompt = "";
  const [marketResearch, setMarketResearch] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [targetMarket, setTargetMarket] = useState("all");
  const [specialMode, setSpecialMode] = useState("");
  // HALAL mode is always on â€” user-facing toggle removed. System prompt
  // and per-mode rules always exclude human figures.
  const halalMode = true;

  const [mounted, setMounted] = useState(false);

  // Seed the prompt input from a `?seed=...` URL query param (used by
  // /market-trends "Use as prompt" buttons, and any future deep-link
  // entry point). The setConcept call is wrapped in an async IIFE so it
  // doesn't sit in the synchronous body of the effect — that satisfies
  // the react-hooks/set-state-in-effect lint rule. We also strip the
  // seed param from the URL after applying it so a refresh / share
  // doesn't keep re-applying the same seed.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    const seed = params.get("seed");
    if (!seed) return undefined;
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      setConcept(seed);
      params.delete("seed");
      const remaining = params.toString();
      const cleanUrl = window.location.pathname + (remaining ? `?${remaining}` : "");
      window.history.replaceState({}, "", cleanUrl);
    })();
    return () => { cancelled = true; };
  }, []);

  const [qualityScoring, setQualityScoring] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`${storagePrefix}_quality_scoring`) === "true";
  });
  const [scores, setScores] = useState([]);
  const [scoring, setScoring] = useState(false);
  const scoringAbortRef = useRef(null);
  const [refiningIdx, setRefiningIdx] = useState(-1);
  const [festivalMode, setFestivalMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`${storagePrefix}_festival_mode`) === "true";
  });
  const [upcomingFestivals, setUpcomingFestivals] = useState(() => {
    if (typeof window === "undefined") return [];
    if (localStorage.getItem(`${storagePrefix}_festival_mode`) === "true") {
      return getUpcomingFestivals(30);
    }
    return [];
  });
  // Auto-rotate is now an implicit default â€” when one provider hits its
  // daily quota, getBestAvailableProvider() picks the next-best one.
  const autoRotate = true;
  const [rotationNotice, setRotationNotice] = useState("");

  const displayTitle = titleKey ? t(titleKey) : title;
  const displayDesc = descKey ? t(descKey) : description;
  const advancedTitle = advancedTitleKey ? t(advancedTitleKey) : t("prompt.advancedInstructions");
  const displayPlaceholder = placeholderKey ? t(placeholderKey) : t("prompt.placeholder");

  const providerInfo = useMemo(
    () => PROVIDERS_UI.find((p) => p.value === model) || PROVIDERS_UI[0],
    [model],
  );
  const actualModelKey = useMemo(() => {
    if (model === "openrouter") return selectedModels?.openrouter || "or-auto";
    if (model === "huggingface") return selectedModels?.huggingface || "hf-qwen-vl72b";
    return (selectedModels && selectedModels[providerInfo.apiKey]) || providerInfo.apiKey;
  }, [model, selectedModels, providerInfo]);

  // Memoise key lookups by tying them to the actual `keys` state from the
  // ApiKeyContext.  This avoids 7 redundant localStorage reads on every
  // re-render and keeps downstream prop identity stable until keys really
  // change in Settings.
  const apiKeys = useMemo(
    () => getAllKeys(providerInfo.apiKey).filter((k) => k.trim()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [providerInfo.apiKey, keys],
  );
  const apiKeysByModel = useMemo(
    () => ({
      gemini: getAllKeys("gemini"),
      groq: getAllKeys("groq"),
      mistral: getAllKeys("mistral"),
      openrouter: getAllKeys("openrouter"),
      huggingface: getAllKeys("huggingface"),
      cerebras: getAllKeys("cerebras"),
      nvidia: getAllKeys("nvidia"),
      github: getAllKeys("github"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keys],
  );
  const hasApiKey = apiKeys.length > 0;

  // All localStorage-based initial state is now read via lazy useState
  // initializers above, eliminating set-state-in-effect lint errors.

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);
  useEffect(() => {
    // Deferred to avoid React 19 set-state-in-effect lint â€” harmless
    // mount flag for SSR hydration guard.
    queueMicrotask(() => setMounted(true));
  }, []);

  const toggleAdvanced = () => {
    if (advancedOn) {
      setAdvancedOn(false);
      setShowEditor(false);
      setSaved(false);
      localStorage.setItem(`${storagePrefix}_advanced_on`, "false");
    } else {
      setAdvancedOn(true);
      localStorage.setItem(`${storagePrefix}_advanced_on`, "true");
      const savedText = localStorage.getItem(`${storagePrefix}_advanced_instructions`);
      if (savedText) { setCustomInstructions(savedText); setShowEditor(false); }
      else { setShowEditor(true); }
    }
  };

  const saveInstructions = () => {
    if (customInstructions.trim()) {
      localStorage.setItem(`${storagePrefix}_advanced_instructions`, customInstructions);
      setSaved(true);
      setTimeout(() => { setShowEditor(false); setSaved(false); }, 500);
    } else {
      localStorage.removeItem(`${storagePrefix}_advanced_instructions`);
      setShowEditor(false);
    }
  };

  const toggleQualityScoring = () => {
    const next = !qualityScoring;
    setQualityScoring(next);
    localStorage.setItem(`${storagePrefix}_quality_scoring`, next ? "true" : "false");
    if (!next) {
      setScores([]);
      setScoring(false);
      if (scoringAbortRef.current) scoringAbortRef.current.abort();
    }
  };

  const toggleFestivalMode = () => {
    const next = !festivalMode;
    setFestivalMode(next);
    localStorage.setItem(`${storagePrefix}_festival_mode`, next ? "true" : "false");
    if (next) {
      setUpcomingFestivals(getUpcomingFestivals(30));
    } else {
      setUpcomingFestivals([]);
    }
  };

  const runScoring = async (promptList) => {
    if (!qualityScoring || promptList.length === 0) return;
    if (scoringAbortRef.current) scoringAbortRef.current.abort();
    const controller = new AbortController();
    scoringAbortRef.current = controller;
    setScoring(true);
    try {
      const res = await fetch("/api/score-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompts: promptList,
          type,
          model: actualModelKey,
          selectedModel: selectedModels?.openrouter || "or-auto",
          selectedGeminiModel: selectedModels?.gemini || "gemini",
          apiKeys: apiKeysByModel,
          specialMode,
        }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (res.ok) {
        const data = await res.json();
        if (data.scores && !controller.signal.aborted) setScores(data.scores);
      }
    } catch (e) {
      if (e.name === "AbortError") return;
    }
    if (!controller.signal.aborted) setScoring(false);
  };

  // Refine a single prompt in-place: regenerates ONE replacement using the
  // user's current model + API keys + creative settings, with a refine-style
  // master instruction.  We reuse the existing /api/generate-prompts route
  // (quantity=1) so providers, fallbacks, and rate limits all behave
  // identically to a normal generation.
  const refineOne = async (idx) => {
    const original = prompts[idx];
    if (!original || refiningIdx >= 0) return;
    if (!hasApiKey) return setError(t("errors.addApiKey"));
    setError("");
    setRefiningIdx(idx);
    try {
      const refineConcept = `REFINE TASK â€” produce ONE elevated replacement for this ${type} prompt.

Original prompt:
"""
${original}
"""

Keep the same subject and core idea, but make the new version more specific, more visually rich, and more commercially valuable.  Add stronger visual descriptors (lighting, composition, color palette, mood, surface/material detail).  Remove vague or generic phrasing.  Return exactly one replacement prompt as item 1.`;
      const payload = {
        concept: refineConcept,
        quantity: 1,
        model: marketResearch ? "gemini" : actualModelKey,
        apiKeys,
        apiKeysByModel,
        type,
        targetMarket,
        halalMode,
      };
      if (advancedOn && customInstructions.trim()) payload.customInstructions = customInstructions.trim();
      if (type === "video") {
        if (camera) payload.camera = camera;
        if (shot) payload.shot = shot;
        if (speed) payload.speed = speed;
        if (mood) payload.mood = mood;
        if (aspectRatio) payload.aspectRatio = aspectRatio;
        if (duration) payload.duration = duration;
      } else {
        if (style) payload.style = style;
        if (mood) payload.mood = mood;
        if (lighting) payload.lighting = lighting;
      }
      if (negativePrompt.trim()) payload.negativePrompt = negativePrompt.trim();
      const res = await fetch("/api/generate-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let errMsg = t("errors.requestFailed");
        try {
          const errText = await res.text();
          if (errText.trim().startsWith("{")) errMsg = mapApiError(JSON.parse(errText), t);
        } catch {}
        throw new Error(errMsg);
      }
      const text = await res.text();
      const parsed = parseNumberedPrompts(text, 1);
      if (parsed.length > 0) {
        setPrompts(prev => {
          const next = [...prev];
          next[idx] = parsed[0];
          return next;
        });
        // Clear the cached AI score for this slot â€” it no longer matches.
        setScores(prev => {
          if (!prev || prev.length === 0) return prev;
          const next = [...prev];
          next[idx] = undefined;
          return next;
        });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setRefiningIdx(-1);
    }
  };

  const streamAndParse = async (payload) => {
    await new Promise(r => setTimeout(r, 400));
    setGenStep(2);

    const res = await fetch("/api/generate-prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let errMsg = t("errors.requestFailed");
      try {
        const text = await res.text();
        if (text.trim().startsWith("{")) {
          errMsg = mapApiError(JSON.parse(text), t);
        }
      } catch {}
      throw new Error(errMsg);
    }

    setGenStep(3);
    const usedModel = res.headers.get("x-model-used") || model;
    setModelUsed(usedModel);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "", lastParsed = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parsed = parseNumberedPrompts(buf, quantity);
      if (parsed.length > lastParsed.length) {
        lastParsed = parsed;
        setPrompts([...parsed]);
      }
    }
    const final = parseNumberedPrompts(buf, quantity);
    if (final.length) {
      setPrompts([...final]);
      saveToPromptHistory(type, final);
      if (qualityScoring) runScoring(final);
    }

    setGenStep(4);
    resetTimer.current = setTimeout(() => setGenStep(0), 5000);
  };

  const generate = async () => {
    if (!concept.trim()) return setError(t("errors.enterPromptFirst"));
    if (marketResearch) {
      if (!hasGeminiKey) return setError(t("prompt.marketResearchRequires"));
    } else if (!hasApiKey) {
      return setError(t("errors.addApiKey"));
    }
    setError("");
    setRotationNotice("");
    setLoading(true);
    setPrompts([]);
    setModelUsed("");
    setSelected(new Set());
    setScores([]);
    if (resetTimer.current) clearTimeout(resetTimer.current);

    setGenStep(1);

    try {
      let effectiveModel = marketResearch ? "gemini" : actualModelKey;
      let effectiveProviderKey = marketResearch ? "gemini" : (PROVIDER_KEY_MAP[actualModelKey] || providerInfo.apiKey);

      if (autoRotate && !marketResearch) {
        const configuredProviders = Object.keys(apiKeysByModel).filter(p => apiKeysByModel[p]?.some(k => k.trim()));
        const bestProvider = getBestAvailableProvider(effectiveProviderKey, configuredProviders);
        if (bestProvider !== effectiveProviderKey) {
          const defaultModels = { gemini: "gemini", groq: "groq", mistral: "mistral", openrouter: "or-auto", huggingface: "hf-qwen-vl72b", cerebras: "cerebras-gpt-oss", nvidia: "nvidia-maverick", github: "github-gpt4o" };
          effectiveModel = selectedModels?.[bestProvider] || defaultModels[bestProvider] || bestProvider;
          const providerLabel = PROVIDERS_UI.find(p => p.apiKey === bestProvider)?.label || bestProvider;
          setRotationNotice(`Auto-switched to ${providerLabel} (${effectiveProviderKey} limit reached)`);
          effectiveProviderKey = bestProvider;
        }
      }

      const mrApiKeys = marketResearch ? getAllKeys("gemini").filter(k => k.trim()) : apiKeys;
      const payload = { concept: concept.trim(), quantity, model: effectiveModel, apiKeys: mrApiKeys, apiKeysByModel, type, targetMarket, halalMode };
      if (festivalMode && upcomingFestivals.length > 0) {
        payload.festivalContext = getFestivalContext(upcomingFestivals);
      }
      if (advancedOn && customInstructions.trim()) {
        payload.customInstructions = customInstructions.trim();
      }
      if (type === "video") {
        if (camera) payload.camera = camera;
        if (shot) payload.shot = shot;
        if (speed) payload.speed = speed;
        if (mood) payload.mood = mood;
        if (aspectRatio) payload.aspectRatio = aspectRatio;
        if (duration) payload.duration = duration;
      } else {
        if (style) payload.style = style;
        if (mood) payload.mood = mood;
        if (lighting) payload.lighting = lighting;
      }
      if (negativePrompt.trim()) payload.negativePrompt = negativePrompt.trim();
      if (marketResearch) payload.marketResearch = true;

      await streamAndParse(payload);
      recordUsage(effectiveProviderKey);
    } catch (e) {
      setError(e.message);
      setGenStep(0);
    } finally {
      setLoading(false);
    }
  };

  const autoGenerate = async (useEngineerMode = false) => {
    if (marketResearch && !hasGeminiKey) return setError(t("prompt.marketResearchRequires"));
    const useMarketResearch = marketResearch && hasGeminiKey;
    if (!useMarketResearch && !hasApiKey) return setError(t("errors.addApiKey"));
    setError("");
    setLoading(true);
    setPrompts([]);
    setModelUsed("");
    setSelected(new Set());
    setScores([]);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setGenStep(1);

    try {
      let autoSubject, autoCategory, autoContext;
      const seeds = getRandomSeeds(1, type);
      const seed = seeds[0];
      autoSubject = seed.seedPhrase;
      autoCategory = "ai-free-choice";
      autoContext = seed.context;

      const mrAutoApiKeys = useMarketResearch ? getAllKeys("gemini").filter(k => k.trim()) : apiKeys;
      const payload = {
        concept: autoSubject,
        quantity,
        model: useMarketResearch ? "gemini" : actualModelKey,
        apiKeys: mrAutoApiKeys,
        apiKeysByModel,
        type,
        autoMode: true,
        autoSubject,
        autoCategory,
        autoContext: autoContext || "",
        targetMarket,
        halalMode,
        ...(useEngineerMode && { engineerMode: true }),
      };
      // BUG FIX: inject festival context for auto/engineer modes too
      if (festivalMode && upcomingFestivals.length > 0) {
        payload.festivalContext = getFestivalContext(upcomingFestivals);
      }
      if (advancedOn && customInstructions.trim()) {
        payload.customInstructions = customInstructions.trim();
      }
      if (type === "video") {
        if (camera) payload.camera = camera;
        if (shot) payload.shot = shot;
        if (speed) payload.speed = speed;
        if (mood) payload.mood = mood;
        if (aspectRatio) payload.aspectRatio = aspectRatio;
        if (duration) payload.duration = duration;
      } else {
        if (style) payload.style = style;
        if (mood) payload.mood = mood;
        if (lighting) payload.lighting = lighting;
      }
      if (negativePrompt.trim()) payload.negativePrompt = negativePrompt.trim();
      if (useMarketResearch) payload.marketResearch = true;

      await streamAndParse(payload);
    } catch (e) {
      setError(e.message);
      setGenStep(0);
    } finally {
      setLoading(false);
    }
  };

  const specialGenerate = async (specialMode) => {
    if (marketResearch && !hasGeminiKey) return setError(t("prompt.marketResearchRequires"));
    const useMarketResearch = marketResearch && hasGeminiKey;
    if (!useMarketResearch && !hasApiKey) return setError(t("errors.addApiKey"));
    setError("");
    setLoading(true);
    setPrompts([]);
    setModelUsed("");
    setSelected(new Set());
    setScores([]);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setGenStep(1);

    try {
      const seeds = getRandomSeeds(1, type, specialMode);
      const seed = seeds[0];
      // Icon Bundle honors the user-typed concept as a locked theme. When the
      // concept box is empty, it falls back to the seed-driven AI free choice
      // like every other special mode.
      const userConcept = concept.trim();
      const usingUserTheme = specialMode === "icon-bundle" && userConcept.length > 0;
      const mrAutoApiKeys = useMarketResearch ? getAllKeys("gemini").filter(k => k.trim()) : apiKeys;
      const payload = {
        concept: usingUserTheme ? userConcept : seed.seedPhrase,
        quantity,
        model: useMarketResearch ? "gemini" : actualModelKey,
        apiKeys: mrAutoApiKeys,
        apiKeysByModel,
        type,
        autoMode: true,
        autoSubject: usingUserTheme ? userConcept : seed.seedPhrase,
        autoCategory: usingUserTheme ? "user-theme" : "ai-free-choice",
        autoContext: seed.context || "",
        targetMarket,
        halalMode,
        specialMode,
      };
      // BUG FIX: inject festival context for special mode generations too
      if (festivalMode && upcomingFestivals.length > 0) {
        payload.festivalContext = getFestivalContext(upcomingFestivals);
      }
      if (advancedOn && customInstructions.trim()) {
        payload.customInstructions = customInstructions.trim();
      }
      if (type === "video") {
        if (camera) payload.camera = camera;
        if (shot) payload.shot = shot;
        if (speed) payload.speed = speed;
        if (mood) payload.mood = mood;
        if (aspectRatio) payload.aspectRatio = aspectRatio;
        if (duration) payload.duration = duration;
      } else {
        if (style) payload.style = style;
        if (mood) payload.mood = mood;
        if (lighting) payload.lighting = lighting;
      }
      if (negativePrompt.trim()) payload.negativePrompt = negativePrompt.trim();
      if (useMarketResearch) payload.marketResearch = true;

      await streamAndParse(payload);
    } catch (e) {
      setError(e.message);
      setGenStep(0);
    } finally {
      setLoading(false);
    }
  };

  const copyOne = async (text, i) => {
    await copyToClipboard(text);
    setCopied(i);
    setTimeout(() => setCopied(-1), 1400);
  };

  const copyAll = async () => {
    const list = selected.size > 0
      ? prompts.filter((_, i) => selected.has(i))
      : [...prompts];
    await copyToClipboard(list.join("\n"));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1800);
  };

  const toggleSelect = (i) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(prompts.map((_, i) => i)));
  const deselectAll = () => setSelected(new Set());

  const downloadCSV = () => {
    const list = selected.size > 0 ? prompts.filter((_, i) => selected.has(i)) : prompts;
    downloadPromptsCsv(list, storagePrefix);
  };

  const downloadTXT = () => {
    const list = selected.size > 0 ? prompts.filter((_, i) => selected.has(i)) : prompts;
    downloadPromptsTxt(list, storagePrefix);
  };


  const iconStyle = gradient ? { background: gradient } : undefined;
  const toggleStyle = gradient && advancedOn ? { background: gradient } : undefined;
  const advancedIconStyle = gradient && advancedOn
    ? { background: gradient, boxShadow: "0 3px 10px rgba(0,0,0,0.2)" }
    : {};

  const hasGeminiKey = mounted && getAllKeys("gemini").some(k => k.trim());

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-icon" style={iconStyle}><Icon size={24} /></div>
        <h1 className="page-title">{displayTitle}</h1>
        <p className="page-desc">{displayDesc}</p>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="field-group">
            <label className="field-label" htmlFor="prompt-input"><Type size={15} />{t("prompt.yourPrompt")}</label>
            <input id="prompt-input" type="text" className="field" placeholder={displayPlaceholder} value={concept} onChange={(e) => setConcept(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !loading && generate()} />
          </div>

          <div className="toolbar-row">
            {model === "google" && (
              <button
                className={`toolbar-btn${marketResearch ? " toolbar-btn-active toolbar-btn-research" : ""}`}
                onClick={() => setMarketResearch(!marketResearch)}
                title={hasGeminiKey ? t("prompt.marketResearchTip") : t("prompt.marketResearchRequires")}
                style={{ opacity: hasGeminiKey ? 1 : 0.5 }}
                disabled={!hasGeminiKey}
              >
                <Globe size={13} />
                <span>{t("prompt.marketResearch")}</span>
                {marketResearch && <Check size={13} />}
              </button>
            )}
            <button
              className={`toolbar-btn${qualityScoring ? " toolbar-btn-active toolbar-btn-scoring" : ""}`}
              onClick={toggleQualityScoring}
              title={t("prompt.qualityScoreTip")}
            >
              <Star size={13} />
              <span>{t("prompt.qualityScore")}</span>
              {qualityScoring && <Check size={13} />}
            </button>
            <button
              className={`toolbar-btn${festivalMode ? " toolbar-btn-active toolbar-btn-festival" : ""}`}
              onClick={toggleFestivalMode}
              title={t("prompt.festivalModeTip")}
            >
              <CalendarDays size={13} />
              <span>{t("prompt.festivalMode")}</span>
              {festivalMode && upcomingFestivals.length > 0 && (
                <span className="festival-badge">{lang === "bn" ? upcomingFestivals[0].namebn : upcomingFestivals[0].name}</span>
              )}
              {festivalMode && <Check size={13} />}
            </button>
          </div>

          {marketResearch && (
            <div className="research-banner">
              <Globe size={14} />
              <span>{t("prompt.marketResearchBanner")}</span>
            </div>
          )}

          {festivalMode && upcomingFestivals.length > 0 && (
            <div className="festival-banner">
              <CalendarDays size={14} />
              <span>{t("prompt.festivalModeBanner")} â€” {upcomingFestivals.slice(0, 3).map(f => lang === "bn" ? f.namebn : f.name).join(", ")}</span>
            </div>
          )}

          <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div>
              <label className="field-label" htmlFor="quantity-input"><Hash size={15} />{t("prompt.quantity")}</label>
              <input id="quantity-input" type="number" className="field" min={1} max={200} value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(200, +e.target.value || 1)))} />
            </div>
            <div>
              <label className="field-label" htmlFor="model-select"><Cpu size={15} />{t("prompt.aiProvider")}</label>
              <select id="model-select" className="field" value={model} onChange={(e) => { setModel(e.target.value); if (e.target.value !== "google") setMarketResearch(false); }} disabled={marketResearch}>
                {PROVIDERS_UI.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="market-select">{t("prompt.optimizeForPlatform")}</label>
              <select id="market-select" className="field" value={targetMarket} onChange={e => setTargetMarket(e.target.value)}>
                <option value="all">{t("prompt.allMarketplaces")}</option>
                <optgroup label={t("prompt.mpGroupDirect")}>
                  <option value="adobe">✅ Adobe Stock</option>
                  <option value="freepik">✅ Freepik</option>
                  <option value="dreamstime">✅ Dreamstime</option>
                  <option value="vecteezy">✅ Vecteezy</option>
                  <option value="etsy">✅ Etsy (Digital / POD)</option>
                  <option value="wirestock">✅ Wirestock</option>
                  <option value="redbubble">✅ Redbubble / Teepublic</option>
                  <option value="123rf">✅ 123RF</option>
                  <option value="pixta">✅ Pixta (Asia / Global)</option>
                  <option value="society6">✅ Society6 (POD)</option>
                  <option value="pixabay">✅ Pixabay</option>
                </optgroup>
                <optgroup label={t("prompt.mpGroupManual")}>
                  <option value="shutterstock">⚠️ Shutterstock</option>
                  <option value="getty">⚠️ Getty Images / iStock</option>
                  <option value="depositphotos">⚠️ Depositphotos</option>
                  <option value="pond5">⚠️ Pond5 (Video)</option>
                  <option value="creativemarket">⚠️ Creative Market</option>
                  <option value="envato">⚠️ Envato Elements</option>
                  <option value="amazon-kdp">⚠️ Amazon KDP (Book Covers)</option>
                </optgroup>
              </select>
              {targetMarket !== "all" && (
                <div className={`market-policy-hint ${MANUAL_TOUCH_MARKETS.has(targetMarket) ? "manual" : "direct"}`}>
                  {MANUAL_TOUCH_MARKETS.has(targetMarket)
                    ? t("prompt.mpPolicyManualHint")
                    : t("prompt.mpPolicyDirectHint")}
                </div>
              )}
            </div>
          </div>

          {error && <div className="error"><AlertCircle size={16} style={{ flexShrink: 0 }} /><span>{error}</span></div>}

          {rotationNotice && (
            <div className="rotation-notice">
              <Repeat size={14} />
              <span>{rotationNotice}</span>
            </div>
          )}

          <div className="actions">
            <button className="btn btn-primary" onClick={generate} disabled={!mounted || loading}>
              {loading ? <><span className="spinner spinner-sm" />{marketResearch ? t("prompt.researching") : t("prompt.generating")}</> : <>{marketResearch ? <Globe size={16} /> : <Sparkles size={16} />}{marketResearch ? t("prompt.researchGenerate") : t("prompt.generatePrompts")}</>}
            </button>
            <button
              className="btn btn-auto"
              onClick={() => autoGenerate(false)}
              disabled={!mounted || loading || (!hasApiKey && !(marketResearch && hasGeminiKey))}
              title={(!hasApiKey && !(marketResearch && hasGeminiKey)) ? t("prompt.addKeyToEnable") : t("prompt.autoGenerateTip")}
            >
              {loading ? <><span className="spinner spinner-sm" />{t("prompt.autoGenerating")}</> : <><Wand2 size={16} />{t("prompt.autoGenerate")}</>}
            </button>
            <button
              className="btn btn-engineer"
              onClick={() => autoGenerate(true)}
              disabled={!mounted || loading || (!hasApiKey && !(marketResearch && hasGeminiKey))}
              title={(!hasApiKey && !(marketResearch && hasGeminiKey)) ? t("prompt.addKeyToEnable") : t("prompt.engineerTip")}
            >
              {loading ? <><span className="spinner spinner-sm" />{t("prompt.engineering")}</> : <><Wrench size={16} />{t("prompt.engineer")}</>}
            </button>
            {/* === Special Mode Buttons — click to generate immediately === */}
            {(SPECIAL_MODES_BY_TYPE[type] || []).length > 0 && (
              <div className="special-mode-buttons">
                {SPECIAL_MODES_BY_TYPE[type].map((m) => {
                  const ModeIcon = m.icon || Star;
                  const isThisLoading = loading && specialMode === m.value;
                  const isDisabled = !mounted || (!hasApiKey && !(marketResearch && hasGeminiKey));
                  return (
                    <button
                      key={m.value}
                      className="btn btn-special-mode"
                      style={{ "--mode-color": m.color }}
                      onClick={() => {
                        // Seasonal button auto-enables Festival Mode for synergy
                        if (m.value === "seasonal" && !festivalMode) toggleFestivalMode();
                        setSpecialMode(m.value);
                        specialGenerate(m.value);
                      }}
                      disabled={isDisabled || loading}
                      title={isDisabled ? t("prompt.addKeyToEnable") : t(m.tipKey)}
                    >
                      {isThisLoading
                        ? <><span className="spinner spinner-sm" />{t("prompt.generating")}</>
                        : <><ModeIcon size={14} className="mode-btn-icon" />{t(m.labelKey)}</>
                      }
                    </button>
                  );
                })}
              </div>
            )}
            {prompts.length > 0 && !loading && (
              <>
                <button className="btn btn-secondary" onClick={copyAll}>
                  {copiedAll ? <><Check size={16} />{t("prompt.copied")}</> : <><Copy size={16} />{selected.size > 0 ? `${t("prompt.copyCount")} ${selected.size}` : t("prompt.copyAll")}</>}
                </button>
                <button className="btn btn-secondary" onClick={downloadCSV}><Download size={16} />{t("prompt.csv")}</button>
                <button className="btn btn-secondary" onClick={downloadTXT}><FileText size={16} />{t("prompt.txt")}</button>
                <button className="btn btn-ghost" onClick={selected.size === prompts.length ? deselectAll : selectAll}>
                  {selected.size === prompts.length ? <><Square size={14} />{t("prompt.deselect")}</> : <><CheckSquare size={14} />{t("prompt.selectAll")}</>}
                </button>
              </>
            )}
            {prompts.length > 0 && !loading && (
              <span className="badge"><FileText size={13} />{selected.size > 0 ? `${selected.size}/${prompts.length}` : prompts.length} prompts</span>
            )}
          </div>

          <PipelineTracker step={genStep} providerLabel={providerInfo.label} isResearch={marketResearch} t={t} />
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="advanced-header">
            <div className="advanced-left">
              <div className={`advanced-icon ${advancedOn ? "on" : "off"}`} style={advancedIconStyle}>
                <Settings size={16} />
              </div>
              <div>
                <span className="advanced-title">{advancedTitle}</span>
                <p className="advanced-status">
                  {!advancedOn ? t("prompt.off") :
                   !showEditor && customInstructions ? t("prompt.onSaved") :
                   t("prompt.onEnter")}
                </p>
              </div>
            </div>
            <button className="toggle-btn" onClick={toggleAdvanced} aria-label={advancedOn ? "Disable" : "Enable"}>
              {advancedOn ? (
                <div className="toggle-track on" style={toggleStyle}><div className="toggle-thumb on" /></div>
              ) : (
                <div className="toggle-track off"><div className="toggle-thumb off" /></div>
              )}
            </button>
          </div>

          {advancedOn && showEditor && (
            <div className="advanced-content">
              <textarea className="field" rows={6} placeholder={t("prompt.instructionsPlaceholder")} value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} />
              <div className="advanced-actions">
                <button className="btn btn-primary" onClick={saveInstructions}>
                  {saved ? <><Check size={16} />{t("prompt.saved")}</> : <><Save size={16} />{t("prompt.save")}</>}
                </button>
                <p className="field-hint">{t("prompt.saveHint")}</p>
              </div>
            </div>
          )}

          {advancedOn && !showEditor && customInstructions && (
            <div className="advanced-saved">
              <button className="btn btn-secondary" onClick={() => setShowEditor(true)}>
                <Edit3 size={16} />{t("prompt.editInstructions")}
              </button>
            </div>
          )}
        </div>
      </div>

      {(prompts.length > 0 || loading) && (
        <div className="card">
          <div className="card-top card-top-flex">
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", minWidth: 0, width: "100%" }}>
              <span className="field-label" style={{ margin: 0 }}><Sparkles size={15} />{t("prompt.generatedPrompts")}</span>
              
              {modelUsed && !loading && prompts.length > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
                  background: "linear-gradient(145deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  color: "var(--foreground)",
                  padding: "5px 12px",
                  borderRadius: "100px",
                  fontSize: "12px",
                  fontWeight: 500,
                  boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                  animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                  maxWidth: "100%",
                  overflow: "hidden",
                }}>
                  <Sparkles size={13} color="rgb(52, 211, 153)" style={{ flexShrink: 0 }} />
                  <span style={{ opacity: 0.7, whiteSpace: "nowrap" }}>Model:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ 
                      background: "rgba(52, 211, 153, 0.15)",
                      color: "rgb(52, 211, 153)", 
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "6px",
                      whiteSpace: "nowrap",
                      border: "1px solid rgba(52, 211, 153, 0.3)",
                      fontSize: "11px",
                      letterSpacing: "0.3px",
                      textTransform: "uppercase"
                    }}>{providerInfo.label}</span>
                    <span style={{ opacity: 0.3, fontWeight: 300 }}>/</span>
                    <span style={{ 
                      background: "linear-gradient(90deg, #a855f7, #3b82f6)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      fontWeight: 700,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "150px",
                      padding: "2px 0"
                    }}>{formatModelName(actualModelKey)}</span>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {qualityScoring && scoring && (
                <div className="card-top-loading">
                  <span className="spinner spinner-sm" />
                  <span>{t("prompt.scoring")}</span>
                </div>
              )}
              {loading && (
                <div className="card-top-loading">
                  <span className="spinner spinner-sm" />
                  <span>{t("prompt.creating")}</span>
                </div>
              )}
            </div>
          </div>
          <div className="card-body">
            {loading && prompts.length === 0 && (
              <div className="loading">
                <span className="spinner spinner-lg" />
                <div className="loading-text">
                  <p className="loading-title">{t("prompt.generatingYour")}</p>
                  <p className="loading-desc">{t("prompt.creatingUnique")}</p>
                </div>
              </div>
            )}
            <div className="prompt-list">
              {prompts.map((p, i) => (
                <div key={i} className={`prompt${selected.has(i) ? " prompt-selected" : ""}`} style={{ animation: `slideUp 0.2s ease ${Math.min(i * 0.02, 0.2)}s both` }}>
                  <button className="btn-icon prompt-check" onClick={() => toggleSelect(i)} title={selected.has(i) ? t("prompt.deselect") : t("prompt.selectAll")}>
                    {selected.has(i) ? <CheckSquare size={16} style={{ color: "var(--accent)" }} /> : <Square size={16} />}
                  </button>
                  <span className="prompt-num">{i + 1}</span>
                  <span className="prompt-text">{p}</span>
                  {qualityScoring && scores[i] !== undefined && (
                    <span className={`score-badge ${scores[i] >= 8 ? "score-high" : scores[i] >= 5 ? "score-mid" : "score-low"}`} title={t("prompt.qualityScore")}>
                      <Star size={11} />
                      {scores[i]}
                    </span>
                  )}
                  <button
                    className="btn-icon prompt-refine"
                    onClick={() => refineOne(i)}
                    disabled={refiningIdx >= 0 || loading}
                    title={t("prompt.refine") || "Refine this prompt"}
                  >
                    {refiningIdx === i ? <span className="spinner spinner-sm" /> : <Wand2 size={14} />}
                  </button>
                  <button className="btn-icon prompt-copy" onClick={() => copyOne(p, i)} title={t("prompt.copyCount")}>
                    {copied === i ? <Check size={15} style={{ color: "var(--success)" }} /> : <Copy size={15} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && prompts.length === 0 && genStep === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><Lightbulb size={22} /></div>
          <p className="empty-state-title">{t("prompt.emptyReadyTitle")}</p>
          <p className="empty-state-desc">{t("prompt.emptyReadyDesc")}</p>
        </div>
      )}

      <AutoTester
        type={type}
        setMainPrompts={setPrompts}
        setMainLoading={setLoading}
        setMainGenStep={setGenStep}
        setMainModelUsed={setModelUsed}
        setModel={setModel}
        setTargetMarket={setTargetMarket}
      />

      {copied >= 0 && <div className="toast"><Check size={16} />{t("prompt.copied")}</div>}
      {copiedAll && <div className="toast"><Check size={16} />{t("prompt.copied")}</div>}
    </div>
  );
}
