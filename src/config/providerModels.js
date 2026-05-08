// ============================================================
// providerModels.js — Settings modal model dropdowns
// Separated into TEXT models (for Prompt Generator / Settings)
// and VISION models (for Metadata Generator).
// Models that do BOTH appear in both lists.
// ============================================================
// Last verified: May 2026

// ─────────────────────────────────────────────────────────────
// PROVIDER_MODELS — Shown in Settings → Model Version dropdown
// These are the TEXT / PROMPT GENERATION capable models.
// Used by: Prompt Generator, Video Generator, Vector Generator
// ─────────────────────────────────────────────────────────────
export const PROVIDER_MODELS = {
  // ── Gemini ───────────────────────────────────────────────────
  // All Gemini models support both text and vision
  gemini: [
    { value: "gemini",      label: "Gemini 2.5 Flash",      info: "⚡ Stable · Text + Vision · Best balance" },
    { value: "gemini-lite", label: "Gemini 2.5 Flash-Lite",  info: "⚡ Stable · Text + Vision · High volume" },
    { value: "gemini-pro",  label: "Gemini 2.5 Pro",         info: "👑 Stable · Text + Vision · Highest quality" },
  ],

  // ── Groq ─────────────────────────────────────────────────────
  // Curated text dropdown — Maverick is in VISION_MODELS only (Metadata),
  // gpt-oss-20b dropped from Groq free tier (unreliable rate limits).
  groq: [
    { value: "groq",              label: "Llama 3.3 70B",             info: "📝 Production · Best quality text" },
    { value: "groq-fast",         label: "Llama 3.1 8B",              info: "⚡ Production · Fastest text" },
    { value: "groq-gpt-oss",      label: "GPT-OSS 120B",              info: "📝 Production · ~500 TPS text" },
    { value: "groq-qwen3",        label: "Qwen 3 32B",                info: "🧠 Preview · Reasoning text" },
    { value: "groq-kimi",         label: "Kimi K2-0905",              info: "🧠 Preview · MoE reasoning · Latest" },
  ],

  // ── Mistral ──────────────────────────────────────────────────
  // Small 4 + Pixtral = vision-capable (shown in both)
  // Nemo = text-only
  mistral: [
    { value: "mistral",         label: "Mistral Small 4",   info: "📝 Text + 👁️ Vision · Latest stable" },
    { value: "mistral-pixtral", label: "Pixtral 12B",       info: "👁️ Vision specialist · Image analysis" },
    { value: "mistral-nemo",    label: "Mistral Nemo 12B",  info: "📝 Text-only · Multilingual · Free" },
  ],

  // ── OpenRouter ───────────────────────────────────────────────
  // Free models verified from openrouter.ai/collections/free-models (May 2026)
  // Removed gemma4-26b (redundant with 31B). Added qwen3-coder for reasoning.
  openrouter: [
    { value: "or-auto",             label: "Auto (free router)",           info: "🤖 Auto-selects best free model" },
    { value: "or-gemma4-31b",       label: "Gemma 4 31B",                  info: "📝 Text + 👁️ Vision · Google · Free" },
    { value: "or-nemotron-super",   label: "Nemotron 3 Super 120B",        info: "📝 Text · NVIDIA MoE · Free" },
    { value: "or-gpt-oss",          label: "GPT-OSS 120B",                 info: "📝 Text · OpenAI open-source · Free" },
    { value: "or-deepseek-r1",      label: "DeepSeek R1",                  info: "🧠 Reasoning · Text-only · Free" },
    { value: "or-qwen3-coder",      label: "Qwen 3 Coder",                 info: "🧠 Code-tuned reasoning · Text · Free" },
  ],

  // ── HuggingFace ──────────────────────────────────────────────
  // All HF models here are vision-capable (used for metadata).
  // Llama 3.2 11B Vision dropped — Qwen pair already covers vision tier.
  huggingface: [
    { value: "hf-qwen-vl72b", label: "Qwen 2.5 VL 72B",     info: "👁️ Vision + Text · Best quality" },
    { value: "hf-qwen-vl7b",  label: "Qwen 2.5 VL 7B",      info: "👁️ Vision · Fast & lighter" },
  ],

  // ── Cerebras ─────────────────────────────────────────────────
  // ALL text-only. Deprecated models removed (effective 27 May 2026).
  cerebras: [
    { value: "cerebras-gpt-oss",  label: "GPT-OSS 120B",       info: "📝 Text · Ultra-fast inference" },
    { value: "cerebras-glm",      label: "GLM 4.7 (Z.ai)",     info: "🧠 Text · Coding + Reasoning" },
  ],

  // ── NVIDIA NIM ───────────────────────────────────────────────
  // 11B vision dropped — 90B sibling supersedes it on the free credit pool.
  nvidia: [
    { value: "nvidia-maverick",    label: "Llama 4 Maverick",   info: "📝 Text + 👁️ Vision · 128 experts" },
    { value: "nvidia-llama32-90b", label: "Llama 3.2 90B",      info: "👁️ Vision · High quality" },
    { value: "nvidia-nemotron",    label: "Nemotron Super 49B", info: "📝 Text reasoning · NVIDIA" },
  ],

  // ── GitHub Models ────────────────────────────────────────────
  // Endpoint: models.github.ai (Azure endpoint deprecated July 2025)
  // Curated: removed gpt-5-nano (3B) and Phi-4-mini (3.8B) — too small for stock prompt quality.
  github: [
    // Text + Vision capable
    { value: "github-gpt4o",      label: "GPT-4o",              info: "📝 Text + 👁️ Vision · Best quality" },
    { value: "github-gpt4o-mini", label: "GPT-4o Mini",         info: "📝 Text + 👁️ Vision · Fast" },
    { value: "github-gpt5",       label: "GPT-5",               info: "📝 Text + 👁️ Vision · Flagship" },
    { value: "github-gpt5-mini",  label: "GPT-5 Mini",          info: "📝 Text + 👁️ Vision · Efficient" },
    // Reasoning-only (text)
    { value: "github-o4-mini",    label: "o4-mini",              info: "🧠 Reasoning · Text-only" },
    { value: "github-o3-mini",    label: "o3-mini",              info: "🧠 Reasoning · Text-only" },
    // Microsoft Phi
    { value: "github-phi4-mm",    label: "Phi-4 Multimodal",     info: "📝 Text + 👁️ Vision + 🔊 Audio" },
    { value: "github-phi4",       label: "Phi-4",                info: "📝 Text + 👁️ Vision · Compact" },
    // Meta Llama
    { value: "github-llama70",    label: "Llama 3.3 70B",        info: "📝 Text · Open-source · Strong" },
  ],
};
