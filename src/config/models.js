// ============================================================
// MODEL REGISTRY — Verified May 2026 (curated, working only)
// All model IDs confirmed against official provider documentation.
// GitHub Models: migrated from deprecated Azure endpoint to models.github.ai
// OpenRouter: free models refreshed from openrouter.ai/collections/free-models
// May 2026 cleanup: removed deprecated/redundant/unstable models so the
// dropdown only shows providers that reliably deliver free output.
// ============================================================

export const MODEL_IDS = {
  // ── Gemini (ai.google.dev/gemini-api/docs/models) ──────────────────────
  // Stable, vision-capable, free via Google AI Studio API key
  gemini: "gemini-2.5-flash",
  "gemini-lite": "gemini-2.5-flash-lite",
  "gemini-pro": "gemini-2.5-pro",

  // ── Groq (console.groq.com/docs/models) ────────────────────────────────
  // Production: llama-3.1-8b-instant, llama-3.3-70b-versatile, gpt-oss-120b
  // Preview:    llama-4-scout (vision), llama-4-maverick (vision), qwen3-32b,
  //             kimi-k2-instruct-0905 (gpt-oss-20b removed — unreliable on free tier)
  groq: "llama-3.3-70b-versatile",
  "groq-fast": "llama-3.1-8b-instant",
  "groq-gpt-oss": "openai/gpt-oss-120b",
  "groq-qwen3": "qwen/qwen3-32b",
  "groq-maverick": "meta-llama/llama-4-maverick-17b-128e-instruct",
  "groq-kimi": "moonshotai/kimi-k2-instruct-0905",

  // ── Mistral (docs.mistral.ai) ───────────────────────────────────────────
  // Free experiment tier: mistral-small-latest (Small 4, vision), open-mistral-nemo, pixtral-12b-latest
  mistral: "mistral-small-latest",
  "mistral-pixtral": "pixtral-12b-latest",
  "mistral-nemo": "open-mistral-nemo",

  // ── OpenRouter (openrouter.ai — verified free models May 2026) ────────
  // Models confirmed from openrouter.ai/collections/free-models
  // Removed gemma4-26b (redundant with 31B sibling)
  openrouter: "openrouter/free",
  "or-auto": "openrouter/free",
  "or-gemma4-31b": "google/gemma-4-31b-it:free",
  "or-nemotron-super": "nvidia/nemotron-3-super-120b-a12b:free",
  "or-gpt-oss": "openai/gpt-oss-120b:free",
  "or-deepseek-r1": "deepseek/deepseek-r1:free",
  "or-qwen3-coder": "qwen/qwen3-coder:free",

  // ── HuggingFace (Inference Providers) ──────────────────────────────────
  // Note: Legacy api-inference.huggingface.co deprecated for large models (July 2025).
  // HF token now routes through Inference Providers (Together AI etc.) automatically.
  // Removed Llama 3.2 11B Vision — Qwen 2.5 VL pair already covers vision.
  huggingface: "Qwen/Qwen2.5-VL-72B-Instruct",
  "hf-qwen-vl72b": "Qwen/Qwen2.5-VL-72B-Instruct",
  "hf-qwen-vl7b": "Qwen/Qwen2.5-VL-7B-Instruct",

  // ── Cerebras (inference-docs.cerebras.ai/models — OFFICIAL) ───────────
  // Cleanup May 2026: removed llama3.1-8b and qwen-3-235b-a22b-instruct-2507
  // (both officially deprecated 27 May 2026). Remaining are stable.
  cerebras: "gpt-oss-120b",
  "cerebras-gpt-oss": "gpt-oss-120b",
  "cerebras-glm": "zai-glm-4.7",

  // ── NVIDIA NIM (build.nvidia.com — free credits) ───────────────────────
  // Vision models confirmed from build.nvidia.com/explore/vision
  // Removed Llama 3.2 11B Vision (the 90B sibling supersedes it).
  nvidia: "meta/llama-4-maverick-17b-128e-instruct",
  "nvidia-maverick": "meta/llama-4-maverick-17b-128e-instruct",
  "nvidia-llama32-90b": "meta/llama-3.2-90b-vision-instruct",
  "nvidia-nemotron": "nvidia/llama-3.3-nemotron-super-49b-v1",

  // ── GitHub Models (models.github.ai — PAT) ───────────────────────────
  // Azure endpoint (models.inference.ai.azure.com) deprecated July 2025, removed Oct 2025.
  // Now uses models.github.ai/inference/chat/completions
  // Curated set: removed gpt-5-nano and Phi-4-mini-instruct — too small (<5B)
  // for the stock-prompt task and routinely failed engineer-mode quality bar.
  github: "gpt-4o",
  "github-gpt4o": "gpt-4o",
  "github-gpt4o-mini": "gpt-4o-mini",
  "github-gpt5": "gpt-5",
  "github-gpt5-mini": "gpt-5-mini",
  "github-o4-mini": "o4-mini",
  "github-o3-mini": "o3-mini",
  "github-phi4": "Phi-4",
  "github-phi4-mm": "Phi-4-multimodal-instruct",
  "github-llama70": "Meta-Llama-3.3-70B-Instruct",
};

export const OR_MODEL_MAP = {
  // OpenRouter free router — auto-selects from available free models
  "or-auto": "openrouter/free",
  // Pinned stable free picks (verified May 2026)
  "or-gemma4-31b": "google/gemma-4-31b-it:free",
  "or-nemotron-super": "nvidia/nemotron-3-super-120b-a12b:free",
  "or-gpt-oss": "openai/gpt-oss-120b:free",
  "or-deepseek-r1": "deepseek/deepseek-r1:free",
  "or-qwen3-coder": "qwen/qwen3-coder:free",
};

export const MODEL_LABELS = {
  // Gemini
  gemini: "Gemini 2.5 Flash",
  "gemini-lite": "Gemini 2.5 Flash-Lite",
  "gemini-pro": "Gemini 2.5 Pro",
  // Groq
  groq: "Llama 3.3 70B",
  "groq-fast": "Llama 3.1 8B (Fast)",
  "groq-gpt-oss": "GPT-OSS 120B (Groq)",
  "groq-qwen3": "Qwen 3 32B (Groq)",
  "groq-maverick": "Llama 4 Maverick (Groq)",
  "groq-kimi": "Kimi K2-0905 (Groq)",
  // Mistral
  mistral: "Mistral Small 4 (Vision)",
  "mistral-pixtral": "Pixtral 12B (Vision)",
  "mistral-nemo": "Mistral Nemo 12B",
  // OpenRouter (verified free May 2026)
  openrouter: "OpenRouter",
  "or-auto": "OR: Auto (free router)",
  "or-gemma4-31b": "OR: Gemma 4 31B (Vision)",
  "or-nemotron-super": "OR: Nemotron 3 Super 120B",
  "or-gpt-oss": "OR: GPT-OSS 120B",
  "or-deepseek-r1": "OR: DeepSeek R1 (Reasoning)",
  "or-qwen3-coder": "OR: Qwen 3 Coder",
  // HuggingFace
  huggingface: "HuggingFace",
  "hf-qwen-vl72b": "HF: Qwen 2.5 VL 72B",
  "hf-qwen-vl7b": "HF: Qwen 2.5 VL 7B",
  // Cerebras (text-only, deprecated models removed May 2026)
  cerebras: "Cerebras GPT-OSS 120B",
  "cerebras-gpt-oss": "Cerebras: GPT-OSS 120B",
  "cerebras-glm": "Cerebras: GLM 4.7 (Preview)",
  // NVIDIA NIM
  nvidia: "NVIDIA Llama 4 Maverick",
  "nvidia-maverick": "NVIDIA: Llama 4 Maverick (Vision)",
  "nvidia-llama32-90b": "NVIDIA: Llama 3.2 90B Vision",
  "nvidia-nemotron": "NVIDIA: Nemotron Super 49B",
  // GitHub Models (endpoint: models.github.ai)
  github: "GitHub: GPT-4o",
  "github-gpt4o": "GitHub: GPT-4o (Vision)",
  "github-gpt4o-mini": "GitHub: GPT-4o Mini (Vision)",
  "github-gpt5": "GitHub: GPT-5 (Vision)",
  "github-gpt5-mini": "GitHub: GPT-5 Mini (Vision)",
  "github-o4-mini": "GitHub: o4-mini (Reasoning)",
  "github-o3-mini": "GitHub: o3-mini (Reasoning)",
  "github-phi4": "GitHub: Phi-4 (Vision)",
  "github-phi4-mm": "GitHub: Phi-4 Multimodal (Vision+Audio)",
  "github-llama70": "GitHub: Llama 3.3 70B",
};

export const PROVIDER_KEY_MAP = {
  // Gemini variants → gemini key
  "gemini-lite": "gemini",
  "gemini-pro": "gemini",
  // Groq variants → groq key
  "groq-fast": "groq",
  "groq-gpt-oss": "groq",
  "groq-qwen3": "groq",
  "groq-maverick": "groq",
  "groq-kimi": "groq",
  // Mistral variants → mistral key
  "mistral-pixtral": "mistral",
  "mistral-nemo": "mistral",
  // OpenRouter variants → openrouter key
  "or-auto": "openrouter",
  "or-gemma4-31b": "openrouter",
  "or-nemotron-super": "openrouter",
  "or-gpt-oss": "openrouter",
  "or-deepseek-r1": "openrouter",
  "or-qwen3-coder": "openrouter",
  // HuggingFace variants → huggingface key
  "hf-qwen-vl72b": "huggingface",
  "hf-qwen-vl7b": "huggingface",
  // Cerebras variants → cerebras key
  "cerebras-gpt-oss": "cerebras",
  "cerebras-glm": "cerebras",
  // NVIDIA variants → nvidia key
  "nvidia-maverick": "nvidia",
  "nvidia-llama32-90b": "nvidia",
  "nvidia-nemotron": "nvidia",
  // GitHub variants → github key
  "github-gpt4o": "github",
  "github-gpt4o-mini": "github",
  "github-gpt5": "github",
  "github-gpt5-mini": "github",
  "github-o4-mini": "github",
  "github-o3-mini": "github",
  "github-phi4": "github",
  "github-phi4-mm": "github",
  "github-llama70": "github",
};

export const PROVIDERS_UI = [
  { value: "google",      label: "Gemini",        apiKey: "gemini" },
  { value: "groq",        label: "Groq",          apiKey: "groq" },
  { value: "mistral",     label: "Mistral",       apiKey: "mistral" },
  { value: "openrouter",  label: "OpenRouter",    apiKey: "openrouter" },
  { value: "huggingface", label: "HuggingFace",   apiKey: "huggingface" },
  { value: "cerebras",    label: "Cerebras",      apiKey: "cerebras" },
  { value: "nvidia",      label: "NVIDIA NIM",    apiKey: "nvidia" },
  { value: "github",      label: "GitHub Models", apiKey: "github" },
];

export const ALLOWED_MODELS = [
  // Gemini
  "gemini", "gemini-lite", "gemini-pro",
  // Groq (gpt-oss-20b dropped — see MODEL_IDS comment)
  "groq", "groq-fast", "groq-gpt-oss", "groq-qwen3", "groq-maverick", "groq-kimi",
  // Mistral
  "mistral", "mistral-pixtral", "mistral-nemo",
  // OpenRouter (verified free May 2026, gemma4-26b dropped)
  "openrouter", "or-auto", "or-gemma4-31b", "or-nemotron-super", "or-gpt-oss", "or-deepseek-r1", "or-qwen3-coder",
  // HuggingFace (Llama 3.2 11B Vision dropped — Qwen pair covers vision)
  "huggingface", "hf-qwen-vl72b", "hf-qwen-vl7b",
  // Cerebras (deprecated models removed May 2026 — only the survivors remain)
  "cerebras", "cerebras-gpt-oss", "cerebras-glm",
  // NVIDIA NIM (11B dropped — 90B sibling supersedes it)
  "nvidia", "nvidia-maverick", "nvidia-llama32-90b", "nvidia-nemotron",
  // GitHub Models (gpt5-nano and phi4-mini dropped — too small for stock prompts)
  "github", "github-gpt4o", "github-gpt4o-mini",
  "github-gpt5", "github-gpt5-mini",
  "github-o4-mini", "github-o3-mini",
  "github-phi4", "github-phi4-mm",
  "github-llama70",
];

export const ALLOWED_TYPES = ["image", "vector", "video"];

// ============================================================
// VISION_MODELS — Only include models verified to accept image input
// ============================================================
export const VISION_MODELS = {
  gemini: [
    { id: "gemini-2.5-flash",      label: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
    { id: "gemini-2.5-pro",        label: "Gemini 2.5 Pro" },
  ],
  groq: [
    // Scout = vision, Maverick = vision + text (both verified)
    { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout (Vision)" },
    { id: "meta-llama/llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick (Vision)" },
  ],
  mistral: [
    { id: "pixtral-12b-latest",   label: "Pixtral 12B (Vision)" },
    { id: "mistral-small-latest", label: "Mistral Small 4 (Vision)" },
  ],
  huggingface: [
    { id: "Qwen/Qwen2.5-VL-72B-Instruct",              label: "Qwen 2.5 VL 72B" },
    { id: "Qwen/Qwen2.5-VL-7B-Instruct",               label: "Qwen 2.5 VL 7B" },
  ],
  openrouter: [
    { id: "google/gemma-4-31b-it:free",                          label: "Gemma 4 31B (Vision)" },
    // deepseek-r1, nemotron-super, qwen3-coder are text-only — NOT in vision models
  ],
  nvidia: [
    // Confirmed from build.nvidia.com/explore/vision
    { id: "meta/llama-4-maverick-17b-128e-instruct",  label: "Llama 4 Maverick (Vision)" },
    { id: "meta/llama-3.2-90b-vision-instruct",       label: "Llama 3.2 90B (Vision)" },
  ],
  github: [
    // Vision models confirmed from GitHub Models catalog
    { id: "gpt-4o",                    label: "GPT-4o (Vision)" },
    { id: "gpt-4o-mini",               label: "GPT-4o Mini (Vision)" },
    { id: "gpt-5",                     label: "GPT-5 (Vision)" },
    { id: "gpt-5-mini",                label: "GPT-5 Mini (Vision)" },
    { id: "Phi-4",                     label: "Phi-4 (Vision)" },
    { id: "Phi-4-multimodal-instruct", label: "Phi-4 Multimodal (Vision+Audio)" },
  ],
  // Cerebras is text-only — intentionally omitted from VISION_MODELS.
};

// ============================================================
// VISION_ELITE_ORDER — Auto-fallback for Metadata Generator
// Ordered: quality > reliability > daily limit generosity
// ============================================================
export const VISION_ELITE_ORDER = [
  { provider: "gemini",      model: "gemini-2.5-flash" },
  { provider: "github",      model: "gpt-4o" },
  { provider: "mistral",     model: "pixtral-12b-latest" },
  { provider: "huggingface", model: "Qwen/Qwen2.5-VL-72B-Instruct" },
  { provider: "nvidia",      model: "meta/llama-4-maverick-17b-128e-instruct" },
  { provider: "groq",        model: "meta-llama/llama-4-scout-17b-16e-instruct" },
  { provider: "openrouter",  model: "google/gemma-4-31b-it:free" },
];
