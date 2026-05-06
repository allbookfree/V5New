// ============================================================
// MODEL REGISTRY — Verified May 2026
// All model IDs confirmed against official provider documentation.
// ============================================================

export const MODEL_IDS = {
  // ── Gemini (ai.google.dev/gemini-api/docs/models) ──────────────────────
  // Stable, vision-capable, free via Google AI Studio API key
  gemini: "gemini-2.5-flash",
  "gemini-lite": "gemini-2.5-flash-lite",
  "gemini-pro": "gemini-2.5-pro",

  // ── Groq (console.groq.com/docs/models) ────────────────────────────────
  // Production: llama-3.1-8b-instant, llama-3.3-70b-versatile, gpt-oss-120b, gpt-oss-20b
  // Preview:    llama-4-scout (vision), qwen3-32b
  groq: "llama-3.3-70b-versatile",
  "groq-fast": "llama-3.1-8b-instant",
  "groq-gpt-oss": "openai/gpt-oss-120b",
  "groq-gpt-oss-20b": "openai/gpt-oss-20b",
  "groq-qwen3": "qwen/qwen3-32b",

  // ── Mistral (docs.mistral.ai) ───────────────────────────────────────────
  // Free experiment tier: mistral-small-latest (Small 4, vision), open-mistral-nemo, pixtral-12b-latest
  mistral: "mistral-small-latest",
  "mistral-pixtral": "pixtral-12b-latest",
  "mistral-nemo": "open-mistral-nemo",

  // ── OpenRouter (openrouter.ai — :free tagged models) ───────────────────
  openrouter: "openrouter/auto",
  "or-auto": "openrouter/auto",
  "or-gemma4-31b": "google/gemma-4-31b-it:free",
  "or-llama32v": "meta-llama/llama-3.2-11b-vision-instruct:free",
  "or-llama4-scout": "meta-llama/llama-4-scout:free",
  "or-qwen-vl": "qwen/qwen2.5-vl-3b-instruct:free",
  "or-deepseek-r1": "deepseek/deepseek-r1:free",

  // ── HuggingFace (Inference Providers) ──────────────────────────────────
  // Note: Legacy api-inference.huggingface.co deprecated for large models (July 2025).
  // HF token now routes through Inference Providers (Together AI etc.) automatically.
  huggingface: "Qwen/Qwen2.5-VL-72B-Instruct",
  "hf-qwen-vl72b": "Qwen/Qwen2.5-VL-72B-Instruct",
  "hf-qwen-vl7b": "Qwen/Qwen2.5-VL-7B-Instruct",
  "hf-llama32v": "meta-llama/Llama-3.2-11B-Vision-Instruct",

  // ── Cerebras (inference-docs.cerebras.ai/models — OFFICIAL) ───────────
  // ONLY these 4 models exist on Cerebras. No others. Text-only (no vision).
  // Production: gpt-oss-120b, llama3.1-8b
  // Preview:    qwen-3-235b-a22b-instruct-2507, zai-glm-4.7
  cerebras: "gpt-oss-120b",
  "cerebras-gpt-oss": "gpt-oss-120b",
  "cerebras-llama8b": "llama3.1-8b",
  "cerebras-qwen235": "qwen-3-235b-a22b-instruct-2507",
  "cerebras-glm": "zai-glm-4.7",

  // ── NVIDIA NIM (build.nvidia.com — free credits) ───────────────────────
  // Vision models confirmed from build.nvidia.com/explore/vision
  nvidia: "meta/llama-4-maverick-17b-128e-instruct",
  "nvidia-maverick": "meta/llama-4-maverick-17b-128e-instruct",
  "nvidia-llama32-11b": "meta/llama-3.2-11b-vision-instruct",
  "nvidia-llama32-90b": "meta/llama-3.2-90b-vision-instruct",
  "nvidia-nemotron": "nvidia/llama-3.3-nemotron-super-49b-v1",

  // ── GitHub Models (github.com/marketplace/models/catalog — PAT) ────────
  // Verified from live catalog page. Vision = image-capable via Azure inference endpoint.
  github: "gpt-4o",
  "github-gpt4o": "gpt-4o",
  "github-gpt4o-mini": "gpt-4o-mini",
  "github-gpt5": "gpt-5",
  "github-gpt5-mini": "gpt-5-mini",
  "github-gpt5-nano": "gpt-5-nano",
  "github-o4-mini": "o4-mini",
  "github-o3-mini": "o3-mini",
  "github-phi4": "Phi-4",
  "github-phi4-mm": "Phi-4-multimodal-instruct",
  "github-phi4-mini": "Phi-4-mini-instruct",
  "github-llama70": "Meta-Llama-3.3-70B-Instruct",
};

export const OR_MODEL_MAP = {
  // OpenRouter auto-router — self-heals when free models churn
  "or-auto": "openrouter/auto",
  // Pinned stable free picks
  "or-gemma4-31b": "google/gemma-4-31b-it:free",
  "or-llama32v": "meta-llama/llama-3.2-11b-vision-instruct:free",
  "or-llama4-scout": "meta-llama/llama-4-scout:free",
  "or-qwen-vl": "qwen/qwen2.5-vl-3b-instruct:free",
  "or-deepseek-r1": "deepseek/deepseek-r1:free",
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
  "groq-gpt-oss-20b": "GPT-OSS 20B (Groq)",
  "groq-qwen3": "Qwen 3 32B (Groq)",
  // Mistral
  mistral: "Mistral Small 4 (Vision)",
  "mistral-pixtral": "Pixtral 12B (Vision)",
  "mistral-nemo": "Mistral Nemo 12B",
  // OpenRouter
  openrouter: "OpenRouter",
  "or-auto": "OR: Auto (best free)",
  "or-gemma4-31b": "OR: Gemma 4 31B (Vision)",
  "or-llama32v": "OR: Llama 3.2 11B Vision",
  "or-llama4-scout": "OR: Llama 4 Scout (Vision)",
  "or-qwen-vl": "OR: Qwen 2.5 VL 3B (Vision)",
  "or-deepseek-r1": "OR: DeepSeek R1 (Reasoning)",
  // HuggingFace
  huggingface: "HuggingFace",
  "hf-qwen-vl72b": "HF: Qwen 2.5 VL 72B",
  "hf-qwen-vl7b": "HF: Qwen 2.5 VL 7B",
  "hf-llama32v": "HF: Llama 3.2 11B Vision",
  // Cerebras (text-only)
  cerebras: "Cerebras GPT-OSS 120B",
  "cerebras-gpt-oss": "Cerebras: GPT-OSS 120B",
  "cerebras-llama8b": "Cerebras: Llama 3.1 8B",
  "cerebras-qwen235": "Cerebras: Qwen 3 235B MoE",
  "cerebras-glm": "Cerebras: GLM 4.7 (Preview)",
  // NVIDIA NIM
  nvidia: "NVIDIA Llama 4 Maverick",
  "nvidia-maverick": "NVIDIA: Llama 4 Maverick (Vision)",
  "nvidia-llama32-11b": "NVIDIA: Llama 3.2 11B Vision",
  "nvidia-llama32-90b": "NVIDIA: Llama 3.2 90B Vision",
  "nvidia-nemotron": "NVIDIA: Nemotron Super 49B",
  // GitHub Models
  github: "GitHub: GPT-4o",
  "github-gpt4o": "GitHub: GPT-4o (Vision)",
  "github-gpt4o-mini": "GitHub: GPT-4o Mini (Vision)",
  "github-gpt5": "GitHub: GPT-5 (Vision)",
  "github-gpt5-mini": "GitHub: GPT-5 Mini (Vision)",
  "github-gpt5-nano": "GitHub: GPT-5 Nano (Fast)",
  "github-o4-mini": "GitHub: o4-mini (Reasoning)",
  "github-o3-mini": "GitHub: o3-mini (Reasoning)",
  "github-phi4": "GitHub: Phi-4 (Vision)",
  "github-phi4-mm": "GitHub: Phi-4 Multimodal (Vision+Audio)",
  "github-phi4-mini": "GitHub: Phi-4 Mini (Fast)",
  "github-llama70": "GitHub: Llama 3.3 70B",
};

export const PROVIDER_KEY_MAP = {
  // Gemini variants → gemini key
  "gemini-lite": "gemini",
  "gemini-pro": "gemini",
  // Groq variants → groq key
  "groq-fast": "groq",
  "groq-gpt-oss": "groq",
  "groq-gpt-oss-20b": "groq",
  "groq-qwen3": "groq",
  // Mistral variants → mistral key
  "mistral-pixtral": "mistral",
  "mistral-nemo": "mistral",
  // OpenRouter variants → openrouter key
  "or-auto": "openrouter",
  "or-gemma4-31b": "openrouter",
  "or-llama32v": "openrouter",
  "or-llama4-scout": "openrouter",
  "or-qwen-vl": "openrouter",
  "or-deepseek-r1": "openrouter",
  // HuggingFace variants → huggingface key
  "hf-qwen-vl72b": "huggingface",
  "hf-qwen-vl7b": "huggingface",
  "hf-llama32v": "huggingface",
  // Cerebras variants → cerebras key
  "cerebras-gpt-oss": "cerebras",
  "cerebras-llama8b": "cerebras",
  "cerebras-qwen235": "cerebras",
  "cerebras-glm": "cerebras",
  // NVIDIA variants → nvidia key
  "nvidia-maverick": "nvidia",
  "nvidia-llama32-11b": "nvidia",
  "nvidia-llama32-90b": "nvidia",
  "nvidia-nemotron": "nvidia",
  // GitHub variants → github key
  "github-gpt4o": "github",
  "github-gpt4o-mini": "github",
  "github-gpt5": "github",
  "github-gpt5-mini": "github",
  "github-gpt5-nano": "github",
  "github-o4-mini": "github",
  "github-o3-mini": "github",
  "github-phi4": "github",
  "github-phi4-mm": "github",
  "github-phi4-mini": "github",
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
  // Groq
  "groq", "groq-fast", "groq-gpt-oss", "groq-gpt-oss-20b", "groq-qwen3",
  // Mistral
  "mistral", "mistral-pixtral", "mistral-nemo",
  // OpenRouter
  "openrouter", "or-auto", "or-gemma4-31b", "or-llama32v", "or-llama4-scout", "or-qwen-vl", "or-deepseek-r1",
  // HuggingFace
  "huggingface", "hf-qwen-vl72b", "hf-qwen-vl7b", "hf-llama32v",
  // Cerebras (ONLY these 4 — verified from official docs)
  "cerebras", "cerebras-gpt-oss", "cerebras-llama8b", "cerebras-qwen235", "cerebras-glm",
  // NVIDIA NIM
  "nvidia", "nvidia-maverick", "nvidia-llama32-11b", "nvidia-llama32-90b", "nvidia-nemotron",
  // GitHub Models
  "github", "github-gpt4o", "github-gpt4o-mini",
  "github-gpt5", "github-gpt5-mini", "github-gpt5-nano",
  "github-o4-mini", "github-o3-mini",
  "github-phi4", "github-phi4-mm", "github-phi4-mini",
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
    // Only vision-capable model on Groq (preview)
    { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout (Vision)" },
  ],
  mistral: [
    { id: "pixtral-12b-latest",   label: "Pixtral 12B (Vision)" },
    { id: "mistral-small-latest", label: "Mistral Small 4 (Vision)" },
  ],
  huggingface: [
    { id: "Qwen/Qwen2.5-VL-72B-Instruct",              label: "Qwen 2.5 VL 72B" },
    { id: "Qwen/Qwen2.5-VL-7B-Instruct",               label: "Qwen 2.5 VL 7B" },
    { id: "meta-llama/Llama-3.2-11B-Vision-Instruct",  label: "Llama 3.2 11B Vision" },
  ],
  openrouter: [
    { id: "google/gemma-4-31b-it:free",                          label: "Gemma 4 31B (Vision)" },
    { id: "meta-llama/llama-3.2-11b-vision-instruct:free",       label: "Llama 3.2 11B Vision" },
    { id: "meta-llama/llama-4-scout:free",                       label: "Llama 4 Scout (Vision)" },
    { id: "qwen/qwen2.5-vl-3b-instruct:free",                    label: "Qwen 2.5 VL 3B (Vision)" },
    // deepseek-r1 is text-only — NOT in vision models
  ],
  nvidia: [
    // Confirmed from build.nvidia.com/explore/vision
    { id: "meta/llama-4-maverick-17b-128e-instruct",  label: "Llama 4 Maverick (Vision)" },
    { id: "meta/llama-3.2-90b-vision-instruct",       label: "Llama 3.2 90B (Vision)" },
    { id: "meta/llama-3.2-11b-vision-instruct",       label: "Llama 3.2 11B (Vision)" },
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
