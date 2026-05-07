"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { VISION_MODELS } from "@/config/models";
import { PROVIDER_MODELS } from "@/config/providerModels";
import { readEncryptedSlot, writeEncryptedSlot, readPlaintextSlotSync } from "@/lib/keyVault";

const ApiKeyContext = createContext(null);

const STORAGE_KEY = "ai-prompt-studio-keys";
const STORAGE_MODE_KEY = "ai-prompt-studio-storage-mode";
const STORAGE_MODELS_KEY = "ai-prompt-studio-models";
const STORAGE_VISION_MODELS_KEY = "ai-prompt-studio-vision-models";

const DEFAULT_KEYS = {
  gemini: [""],
  groq: [""],
  mistral: [""],
  openrouter: [""],
  huggingface: [""],
  cerebras: [""],
  nvidia: [""],
  github: [""],
};
const DEFAULT_MODE = "local";
const DEFAULT_SELECTED_MODELS = {
  gemini: "gemini",
  groq: "groq",
  mistral: "mistral",
  openrouter: "or-auto",
  huggingface: "hf-qwen-vl72b",
  cerebras: "cerebras-gpt-oss",
  nvidia: "nvidia-maverick",
  github: "github-gpt4o",
};

const DEFAULT_SELECTED_VISION_MODELS = {
  gemini: "gemini-2.5-flash",
  groq: "meta-llama/llama-4-scout-17b-16e-instruct",
  mistral: "mistral-small-latest",
  openrouter: "google/gemma-3-27b-it:free",
  huggingface: "Qwen/Qwen2.5-VL-7B-Instruct",
  // Cerebras inference is text-only; no vision default.
  nvidia: "meta/llama-4-maverick-17b-128e-instruct",
  github: "gpt-4o",
};

// Derive valid text model values directly from PROVIDER_MODELS to stay in sync.
const VALID_TEXT_MODELS = Object.fromEntries(
  Object.entries(PROVIDER_MODELS).map(([provider, models]) => [
    provider,
    models.map((m) => m.value),
  ])
);

const VALID_VISION_MODELS = {
  gemini: VISION_MODELS.gemini.map(m => m.id),
  groq: VISION_MODELS.groq.map(m => m.id),
  mistral: VISION_MODELS.mistral.map(m => m.id),
  openrouter: VISION_MODELS.openrouter.map(m => m.id),
  huggingface: VISION_MODELS.huggingface.map(m => m.id),
  nvidia: (VISION_MODELS.nvidia || []).map(m => m.id),
  github: VISION_MODELS.github.map(m => m.id),
  // Cerebras has no vision models — empty array prevents accidental selection.
  cerebras: [],
};

function normalizeKeys(input) {
  const source = Array.isArray(input) ? input : typeof input === "string" ? [input] : [""];
  const normalized = [];
  const seen = new Set();
  for (const item of source) {
    const value = typeof item === "string" ? item.trim() : "";
    if (!value) {
      normalized.push("");
      continue;
    }
    if (seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  return normalized.length > 0 ? normalized : [""];
}

function readStorageMode() {
  if (typeof window === "undefined") return DEFAULT_MODE;
  const mode = localStorage.getItem(STORAGE_MODE_KEY);
  return mode === "session" ? "session" : DEFAULT_MODE;
}

function normalizeKeyBag(parsed) {
  if (!parsed || typeof parsed !== "object") return DEFAULT_KEYS;
  return {
    gemini: normalizeKeys(parsed.gemini),
    groq: normalizeKeys(parsed.groq),
    mistral: normalizeKeys(parsed.mistral),
    openrouter: normalizeKeys(parsed.openrouter),
    huggingface: normalizeKeys(parsed.huggingface),
    cerebras: normalizeKeys(parsed.cerebras),
    nvidia: normalizeKeys(parsed.nvidia),
    github: normalizeKeys(parsed.github),
  };
}

// Synchronous initial read used during the first render to avoid hydration
// flicker. Only reads legacy plaintext blobs; encrypted blobs are loaded
// asynchronously in a useEffect after mount and merged in.
function getInitialKeys() {
  if (typeof window === 'undefined') return DEFAULT_KEYS;
  try {
    const mode = readStorageMode();
    const preferredStorage = mode === "session" ? sessionStorage : localStorage;
    const fallbackStorage = mode === "session" ? localStorage : sessionStorage;
    const plain = readPlaintextSlotSync(preferredStorage, STORAGE_KEY)
      ?? readPlaintextSlotSync(fallbackStorage, STORAGE_KEY);
    if (plain) return normalizeKeyBag(plain);
  } catch (e) {
    console.error("Failed to load API keys:", e);
  }
  return DEFAULT_KEYS;
}

function getInitialSelectedModels() {
  if (typeof window === 'undefined') return DEFAULT_SELECTED_MODELS;
  try {
    const stored = localStorage.getItem(STORAGE_MODELS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const result = {};
      for (const provider of Object.keys(DEFAULT_SELECTED_MODELS)) {
        const valid = VALID_TEXT_MODELS[provider] || [];
        result[provider] = valid.includes(parsed[provider])
          ? parsed[provider]
          : DEFAULT_SELECTED_MODELS[provider];
      }
      return result;
    }
  } catch (e) {
    console.warn("Could not parse stored selected-text-model preferences; using defaults.", e);
  }
  return DEFAULT_SELECTED_MODELS;
}

function getInitialSelectedVisionModels() {
  if (typeof window === 'undefined') return DEFAULT_SELECTED_VISION_MODELS;
  try {
    const stored = localStorage.getItem(STORAGE_VISION_MODELS_KEY);
    const legacyStored = localStorage.getItem(STORAGE_MODELS_KEY);
    const parsed = stored ? JSON.parse(stored) : legacyStored ? JSON.parse(legacyStored) : {};
    return {
      gemini: VALID_VISION_MODELS.gemini.includes(parsed.gemini) ? parsed.gemini : DEFAULT_SELECTED_VISION_MODELS.gemini,
      groq: VALID_VISION_MODELS.groq.includes(parsed.groq) ? parsed.groq : DEFAULT_SELECTED_VISION_MODELS.groq,
      mistral: VALID_VISION_MODELS.mistral.includes(parsed.mistral) ? parsed.mistral : DEFAULT_SELECTED_VISION_MODELS.mistral,
      openrouter: VALID_VISION_MODELS.openrouter.includes(parsed.openrouter) ? parsed.openrouter : DEFAULT_SELECTED_VISION_MODELS.openrouter,
      huggingface: VALID_VISION_MODELS.huggingface.includes(parsed.huggingface) ? parsed.huggingface : DEFAULT_SELECTED_VISION_MODELS.huggingface,
      nvidia: VALID_VISION_MODELS.nvidia.includes(parsed.nvidia) ? parsed.nvidia : DEFAULT_SELECTED_VISION_MODELS.nvidia,
      github: VALID_VISION_MODELS.github?.includes(parsed.github) ? parsed.github : DEFAULT_SELECTED_VISION_MODELS.github,
    };
  } catch (e) {
    console.warn("Could not parse stored selected-vision-model preferences; using defaults.", e);
  }
  return DEFAULT_SELECTED_VISION_MODELS;
}

export function ApiKeyProvider({ children }) {
  const [keys, setKeys] = useState(getInitialKeys);
  const [storageMode, setStorageMode] = useState(readStorageMode);
  const [testResult, setTestResult] = useState({});
  const [testing, setTesting] = useState({});
  const [selectedModels, setSelectedModelsState] = useState(getInitialSelectedModels);
  const [selectedVisionModels, setSelectedVisionModelsState] = useState(getInitialSelectedVisionModels);

  // After mount, finish loading any encrypted blob (which couldn't be read
  // synchronously) and re-encrypt any legacy plaintext blob found by the
  // sync init path. This is the migration step from plain-JSON storage to
  // AES-GCM encrypted at-rest storage.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    (async () => {
      try {
        const mode = readStorageMode();
        const preferredStorage = mode === "session" ? sessionStorage : localStorage;
        const fallbackStorage = mode === "session" ? localStorage : sessionStorage;
        // Try preferred → fallback. Either may hold encrypted or plaintext.
        const decrypted = (await readEncryptedSlot(preferredStorage, STORAGE_KEY))
          ?? (await readEncryptedSlot(fallbackStorage, STORAGE_KEY));
        if (decrypted && !cancelled) {
          const normalized = normalizeKeyBag(decrypted);
          setKeys(normalized);
          // Re-write encrypted to upgrade legacy plaintext slots.
          await writeEncryptedSlot(preferredStorage, STORAGE_KEY, normalized);
          try { fallbackStorage.removeItem(STORAGE_KEY); } catch (e) { console.warn("Could not clear legacy API-key slot from fallback storage:", e); }
        }
      } catch (e) {
        console.error("Failed to load encrypted API keys:", e);
      }
    })();
    return () => { cancelled = true; };
    // We deliberately run this only once on mount; storageMode changes are
    // handled in updateStorageMode itself.
  }, []);

  const saveKeys = (newKeys) => {
    const normalized = {
      gemini: normalizeKeys(newKeys.gemini),
      groq: normalizeKeys(newKeys.groq),
      mistral: normalizeKeys(newKeys.mistral),
      openrouter: normalizeKeys(newKeys.openrouter),
      huggingface: normalizeKeys(newKeys.huggingface),
      cerebras: normalizeKeys(newKeys.cerebras),
      nvidia: normalizeKeys(newKeys.nvidia),
      github: normalizeKeys(newKeys.github),
    };
    setKeys(normalized);
    const writeStorage = storageMode === "session" ? sessionStorage : localStorage;
    const clearStorage = storageMode === "session" ? localStorage : sessionStorage;
    // Fire-and-forget: encryption is async but the in-memory state is
    // already updated, so the UI doesn't need to wait.
    writeEncryptedSlot(writeStorage, STORAGE_KEY, normalized).catch(e =>
      console.error("Failed to save API keys:", e)
    );
    try { clearStorage.removeItem(STORAGE_KEY); } catch (e) { console.warn("Could not clear legacy API-key slot during save:", e); }
  };

  const setSelectedModel = (providerKey, modelValue) => {
    if (!VALID_TEXT_MODELS[providerKey]?.includes(modelValue)) return;
    setSelectedModelsState(prev => {
      const next = { ...prev, [providerKey]: modelValue };
      try { localStorage.setItem(STORAGE_MODELS_KEY, JSON.stringify(next)); } catch (e) { console.warn("Could not persist selected text model:", e); }
      return next;
    });
  };

  const setSelectedVisionModel = (providerKey, modelValue) => {
    if (!VALID_VISION_MODELS[providerKey]?.includes(modelValue)) return;
    setSelectedVisionModelsState(prev => {
      const next = { ...prev, [providerKey]: modelValue };
      try { localStorage.setItem(STORAGE_VISION_MODELS_KEY, JSON.stringify(next)); } catch (e) { console.warn("Could not persist selected vision model:", e); }
      return next;
    });
  };

  const updateStorageMode = (mode) => {
    const nextMode = mode === "session" ? "session" : "local";
    setStorageMode(nextMode);
    try {
      localStorage.setItem(STORAGE_MODE_KEY, nextMode);
      const targetStorage = nextMode === "session" ? sessionStorage : localStorage;
      const clearStorage = nextMode === "session" ? localStorage : sessionStorage;
      writeEncryptedSlot(targetStorage, STORAGE_KEY, keys).catch(e =>
        console.error("Failed to migrate API keys to new storage mode:", e)
      );
      clearStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Failed to update storage mode:", e);
    }
  };

  const getKey = (provider) => {
    const providerKeys = keys[provider] || [""];
    return providerKeys[0] || "";
  };

  const getAllKeys = (provider) => {
    const providerKeys = keys[provider];
    if (!providerKeys) return [""];
    if (Array.isArray(providerKeys)) return providerKeys.filter(k => k);
    if (typeof providerKeys === 'string' && providerKeys) return [providerKeys];
    return [""];
  };

  const testKey = async (id, key, provider) => {
    if (!key) {
      setTestResult(prev => ({ ...prev, [id]: { success: false, message: "Enter a key first" } }));
      return;
    }

    setTesting(prev => ({ ...prev, [id]: true }));
    setTestResult(prev => ({ ...prev, [id]: null }));

    try {
      let res;

      if (provider === "gemini") {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      } else if (provider === "groq") {
        res = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${key}` }
        });
      } else if (provider === "mistral") {
        res = await fetch("https://api.mistral.ai/v1/models", {
          headers: { Authorization: `Bearer ${key}` }
        });
      } else if (provider === "openrouter") {
        res = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { Authorization: `Bearer ${key}` }
        });
      } else if (provider === "huggingface") {
        res = await fetch("https://router.huggingface.co/v1/models", {
          headers: { Authorization: `Bearer ${key}` }
        });
      } else if (provider === "cerebras") {
        res = await fetch("https://api.cerebras.ai/v1/models", {
          headers: { Authorization: `Bearer ${key}` }
        });
      } else if (provider === "nvidia") {
        res = await fetch("https://integrate.api.nvidia.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` }
        });
      } else if (provider === "github") {
        res = await fetch("https://models.inference.ai.azure.com/models", {
          headers: { Authorization: `Bearer ${key}` }
        });
      } else {
        setTestResult(prev => ({ ...prev, [id]: { success: false, message: `Unsupported provider: ${provider}` } }));
        return;
      }

      if (res?.ok) {
        setTestResult(prev => ({ ...prev, [id]: { success: true, message: "Valid" } }));
      } else if (res?.status === 401 || res?.status === 403) {
        setTestResult(prev => ({ ...prev, [id]: { success: false, message: "Invalid key" } }));
      } else if (res?.status === 429) {
        setTestResult(prev => ({ ...prev, [id]: { success: false, message: "Rate limit" } }));
      } else {
        setTestResult(prev => ({ ...prev, [id]: { success: false, message: `Error ${res?.status}` } }));
      }
    } catch (e) {
      console.warn(`testKey failed for provider=${provider}:`, e);
      setTestResult(prev => ({ ...prev, [id]: { success: false, message: "Connection failed" } }));
    } finally {
      setTesting(prev => ({ ...prev, [id]: false }));
    }
  };

  const [sheetsUrl, setSheetsUrl] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("ai-prompt-studio-sheets-url") || "";
  });

  const updateSheetsUrl = (url) => {
    setSheetsUrl(url);
    try {
      localStorage.setItem("ai-prompt-studio-sheets-url", url);
    } catch(e) {}
  };

  return (
    <ApiKeyContext.Provider value={{ 
      keys, saveKeys, getKey, getAllKeys, testKey, testResult, setTestResult, testing, setTesting, 
      storageMode, updateStorageMode, selectedModels, setSelectedModel, selectedVisionModels, setSelectedVisionModel,
      sheetsUrl, updateSheetsUrl
    }}>
      {children}
    </ApiKeyContext.Provider>
  );
}

export function useApiKeys() {
  const context = useContext(ApiKeyContext);
  if (!context) {
    throw new Error("useApiKeys must be used within an ApiKeyProvider");
  }
  return context;
}
