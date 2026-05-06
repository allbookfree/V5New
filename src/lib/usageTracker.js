const STORAGE_KEY = "ai-prompt-studio-usage";

// Free-tier per-account limits as of Q2 2026. Sources:
//   * Gemini 2.5 Flash:     15 RPM / 1500 RPD on the free tier
//   * Groq:                 30 RPM / 14400 RPD (Llama 3.x family)
//   * Mistral free:         1 RPM / 500k tokens-per-minute, no daily cap
//                           we keep RPD = 500 as a soft local guardrail
//   * OpenRouter free:      20 RPM / 50 RPD (free models routed via :free)
//                           higher with $10+ wallet balance — left at 50
//                           as the conservative free-tier value
//   * HuggingFace router:   ~30 RPM / ~1000 RPD on free tier (varies by
//                           model). Conservative defaults below.
//   * Cerebras free:        30 RPM / 14400 RPD (matches Groq tier; very fast
//                           inference, text-only as of Q2 2026)
//   * NVIDIA NIM free:      ~60 RPM / 1000 monthly credits — credits
//                           burn at varying rates per model, so we use a
//                           conservative 200 RPD soft cap
//
// rpm = requests per minute (used for soft client throttling)
// rpd = requests per day (used to color the usage badges)
const PROVIDER_LIMITS = {
  gemini:     { rpm: 15, rpd: 1500,  label: "Gemini Flash" },
  groq:       { rpm: 30, rpd: 14400, label: "Groq" },
  mistral:    { rpm: 1,  rpd: 500,   label: "Mistral" },
  openrouter: { rpm: 20, rpd: 50,    label: "OpenRouter" },
  huggingface:{ rpm: 30, rpd: 1000,  label: "HuggingFace" },
  cerebras:   { rpm: 30, rpd: 14400, label: "Cerebras" },
  nvidia:     { rpm: 60, rpd: 200,   label: "NVIDIA NIM" },
};

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadUsage() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    const today = getTodayKey();
    if (data._date !== today) return { _date: today };
    return data;
  } catch {
    return {};
  }
}

function saveUsage(data) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function recordUsage(provider) {
  const data = loadUsage();
  data._date = getTodayKey();
  data[provider] = (data[provider] || 0) + 1;
  saveUsage(data);
  return data[provider];
}

export function getUsage(provider) {
  const data = loadUsage();
  if (data._date !== getTodayKey()) return 0;
  return data[provider] || 0;
}

export function getAllUsage() {
  const data = loadUsage();
  const today = getTodayKey();
  if (data._date !== today) return {};
  const result = {};
  for (const key of Object.keys(PROVIDER_LIMITS)) {
    result[key] = { used: data[key] || 0, limit: PROVIDER_LIMITS[key].rpd, label: PROVIDER_LIMITS[key].label };
  }
  return result;
}

export function getProviderLimits() {
  return PROVIDER_LIMITS;
}

export function getRemainingRequests(provider) {
  const limits = PROVIDER_LIMITS[provider];
  if (!limits) return 0;
  return Math.max(0, limits.rpd - getUsage(provider));
}

export function isProviderAvailable(provider) {
  return getRemainingRequests(provider) > 0;
}

export function getBestAvailableProvider(preferredProvider, configuredProviders) {
  if (isProviderAvailable(preferredProvider)) return preferredProvider;

  const priority = ["gemini", "groq", "mistral", "openrouter", "huggingface"];
  for (const p of priority) {
    if (p !== preferredProvider && configuredProviders.includes(p) && isProviderAvailable(p)) {
      return p;
    }
  }
  return preferredProvider;
}
