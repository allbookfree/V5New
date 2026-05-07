"use client";

import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import {
  BookOpen, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, XCircle,
  Sparkles, Wand2, Search, Calendar, Star, Zap, Layers, Frame, Package,
  Puzzle, Shirt, Sunrise, Palette, Bot, Image as ImageIcon, FileText,
  Globe, Briefcase, Plane, Repeat, Monitor
} from "lucide-react";

// ─── Rating helpers ─────────────────────────────────────────────────
function RatingStars({ rating }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={11} fill={i <= rating ? "#f59e0b" : "none"} stroke={i <= rating ? "#f59e0b" : "var(--text4)"} />
      ))}
    </span>
  );
}

function Badge({ type, label }) {
  const colors = {
    best: { bg: "#10b98120", color: "#10b981", border: "#10b98140" },
    good: { bg: "#3b82f620", color: "#3b82f6", border: "#3b82f640" },
    ok: { bg: "#f59e0b20", color: "#f59e0b", border: "#f59e0b40" },
    avoid: { bg: "#ef444420", color: "#ef4444", border: "#ef444440" },
  };
  const c = colors[type] || colors.ok;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700,
      padding: "2px 8px", borderRadius: 6, background: c.bg, color: c.color, border: `1px solid ${c.border}`
    }}>
      {type === "best" && <CheckCircle2 size={10} />}
      {type === "avoid" && <XCircle size={10} />}
      {type === "ok" && <AlertTriangle size={10} />}
      {label}
    </span>
  );
}

// ─── Model Data ─────────────────────────────────────────────────────
// effectiveB = effective parameter count in billions for numeric comparison.
// For MoE models, this reflects total capacity, not per-expert count.
const MODELS = [
  // Gemini
  { id: "gemini-pro", provider: "Gemini", label: "Gemini 2.5 Pro", params: "~1T+", effectiveB: 1000, tier: "flagship", emoji: "🔵" },
  { id: "gemini", provider: "Gemini", label: "Gemini 2.5 Flash", params: "~300B+", effectiveB: 300, tier: "recommended", emoji: "🔵" },
  { id: "gemini-lite", provider: "Gemini", label: "Gemini 2.5 Flash-Lite", params: "~100B+", effectiveB: 100, tier: "good", emoji: "🔵" },
  // Groq
  { id: "groq-kimi", provider: "Groq", label: "Kimi K2", params: "1T+ MoE", effectiveB: 200, tier: "recommended", emoji: "🔴" },
  { id: "groq-gpt-oss", provider: "Groq", label: "GPT-OSS 120B", params: "120B", effectiveB: 120, tier: "recommended", emoji: "🔴" },
  { id: "groq-maverick", provider: "Groq", label: "Llama 4 Maverick", params: "17B×128E", effectiveB: 400, tier: "good", emoji: "🔴" },
  { id: "groq", provider: "Groq", label: "Llama 3.3 70B", params: "70B", effectiveB: 70, tier: "good", emoji: "🔴" },
  { id: "groq-qwen3", provider: "Groq", label: "Qwen 3 32B", params: "32B", effectiveB: 32, tier: "good", emoji: "🔴" },
  { id: "groq-gpt-oss-20b", provider: "Groq", label: "GPT-OSS 20B", params: "20B", effectiveB: 20, tier: "limited", emoji: "🔴" },
  { id: "groq-fast", provider: "Groq", label: "Llama 3.1 8B", params: "8B", effectiveB: 8, tier: "caution", emoji: "🔴" },
  // Mistral
  { id: "mistral", provider: "Mistral", label: "Mistral Small 4", params: "~24B", effectiveB: 24, tier: "good", emoji: "🟠" },
  { id: "mistral-nemo", provider: "Mistral", label: "Mistral Nemo 12B", params: "12B", effectiveB: 12, tier: "limited", emoji: "🟠" },
  { id: "mistral-pixtral", provider: "Mistral", label: "Pixtral 12B", params: "12B", effectiveB: 12, tier: "limited", emoji: "🟠" },
  // OpenRouter (verified free models May 2026)
  { id: "or-auto", provider: "OpenRouter", label: "Auto (free router)", params: "varies", effectiveB: 50, tier: "good", emoji: "🟣" },
  { id: "or-deepseek-r1", provider: "OpenRouter", label: "DeepSeek R1", params: "671B MoE", effectiveB: 671, tier: "good", emoji: "🟣" },
  { id: "or-nemotron-super", provider: "OpenRouter", label: "Nemotron 3 Super 120B", params: "120B MoE", effectiveB: 120, tier: "good", emoji: "🟣" },
  { id: "or-gpt-oss", provider: "OpenRouter", label: "GPT-OSS 120B", params: "120B", effectiveB: 120, tier: "good", emoji: "🟣" },
  { id: "or-gemma4-31b", provider: "OpenRouter", label: "Gemma 4 31B", params: "31B", effectiveB: 31, tier: "good", emoji: "🟣" },
  { id: "or-gemma4-26b", provider: "OpenRouter", label: "Gemma 4 26B A4B", params: "26B MoE", effectiveB: 26, tier: "good", emoji: "🟣" },
  // HuggingFace
  { id: "hf-qwen-vl72b", provider: "HuggingFace", label: "Qwen 2.5 VL 72B", params: "72B", effectiveB: 72, tier: "good", emoji: "🟡" },
  { id: "hf-qwen-vl7b", provider: "HuggingFace", label: "Qwen 2.5 VL 7B", params: "7B", effectiveB: 7, tier: "caution", emoji: "🟡" },
  { id: "hf-llama32v", provider: "HuggingFace", label: "Llama 3.2 11B", params: "11B", effectiveB: 11, tier: "limited", emoji: "🟡" },
  // Cerebras
  { id: "cerebras-qwen235", provider: "Cerebras", label: "Qwen 3 235B MoE", params: "235B", effectiveB: 235, tier: "flagship", emoji: "⚡" },
  { id: "cerebras-gpt-oss", provider: "Cerebras", label: "GPT-OSS 120B", params: "120B", effectiveB: 120, tier: "recommended", emoji: "⚡" },
  { id: "cerebras-glm", provider: "Cerebras", label: "GLM 4.7", params: "~9B", effectiveB: 9, tier: "good", emoji: "⚡" },
  { id: "cerebras-llama8b", provider: "Cerebras", label: "Llama 3.1 8B", params: "8B", effectiveB: 8, tier: "caution", emoji: "⚡" },
  // NVIDIA
  { id: "nvidia-maverick", provider: "NVIDIA", label: "Llama 4 Maverick", params: "17B×128E", effectiveB: 400, tier: "good", emoji: "🟢" },
  { id: "nvidia-llama32-90b", provider: "NVIDIA", label: "Llama 3.2 90B", params: "90B", effectiveB: 90, tier: "good", emoji: "🟢" },
  { id: "nvidia-nemotron", provider: "NVIDIA", label: "Nemotron Super 49B", params: "49B", effectiveB: 49, tier: "good", emoji: "🟢" },
  { id: "nvidia-llama32-11b", provider: "NVIDIA", label: "Llama 3.2 11B", params: "11B", effectiveB: 11, tier: "limited", emoji: "🟢" },
  // GitHub
  { id: "github-gpt5", provider: "GitHub", label: "GPT-5", params: "~1T+", effectiveB: 1000, tier: "flagship", emoji: "⬛" },
  { id: "github-gpt5-mini", provider: "GitHub", label: "GPT-5 Mini", params: "~200B+", effectiveB: 200, tier: "recommended", emoji: "⬛" },
  { id: "github-gpt4o", provider: "GitHub", label: "GPT-4o", params: "~200B+", effectiveB: 200, tier: "recommended", emoji: "⬛" },
  { id: "github-gpt4o-mini", provider: "GitHub", label: "GPT-4o Mini", params: "~8B+", effectiveB: 8, tier: "good", emoji: "⬛" },
  { id: "github-o4-mini", provider: "GitHub", label: "o4-mini", params: "~100B+", effectiveB: 100, tier: "good", emoji: "⬛" },
  { id: "github-o3-mini", provider: "GitHub", label: "o3-mini", params: "~100B+", effectiveB: 100, tier: "good", emoji: "⬛" },
  { id: "github-phi4", provider: "GitHub", label: "Phi-4", params: "14B", effectiveB: 14, tier: "limited", emoji: "⬛" },
  { id: "github-phi4-mm", provider: "GitHub", label: "Phi-4 Multimodal", params: "14B", effectiveB: 14, tier: "limited", emoji: "⬛" },
  { id: "github-llama70", provider: "GitHub", label: "Llama 3.3 70B", params: "70B", effectiveB: 70, tier: "good", emoji: "⬛" },
  { id: "github-phi4-mini", provider: "GitHub", label: "Phi-4 Mini", params: "3.8B", effectiveB: 3.8, tier: "caution", emoji: "⬛" },
  { id: "github-gpt5-nano", provider: "GitHub", label: "GPT-5 Nano", params: "~8B", effectiveB: 8, tier: "limited", emoji: "⬛" },
];

// ─── Feature / Button definitions ───────────────────────────────────
const FEATURES = [
  {
    id: "manual", section: "core",
    icon: Sparkles, color: "#6366f1",
    promptSize: "~1500",
    minModel: "any",
  },
  {
    id: "auto", section: "core",
    icon: Zap, color: "#f59e0b",
    promptSize: "~2000",
    minModel: "30B+",
  },
  {
    id: "engineer", section: "core",
    icon: Wand2, color: "#8b5cf6",
    promptSize: "~3000",
    minModel: "70B+",
  },
  {
    id: "market-research", section: "core",
    icon: Search, color: "#10b981",
    promptSize: "~2000",
    minModel: "gemini-only",
  },
  {
    id: "festival", section: "core",
    icon: Calendar, color: "#ec4899",
    promptSize: "~2500",
    minModel: "30B+",
  },
  {
    id: "quality-score", section: "core",
    icon: Star, color: "#f59e0b",
    promptSize: "~800",
    minModel: "30B+",
  },
  // Image special modes
  {
    id: "surreal", section: "image",
    icon: Sparkles, color: "#8b5cf6",
    promptSize: "~2800",
    minModel: "70B+",
  },
  {
    id: "background-texture", section: "image",
    icon: Layers, color: "#0ea5e9",
    promptSize: "~2500",
    minModel: "30B+",
  },
  {
    id: "wall-art", section: "image",
    icon: Frame, color: "#f59e0b",
    promptSize: "~3200",
    minModel: "70B+",
  },
  {
    id: "mockup", section: "image",
    icon: Package, color: "#10b981",
    promptSize: "~2200",
    minModel: "30B+",
  },
  {
    id: "collection", section: "image",
    icon: Puzzle, color: "#ec4899",
    promptSize: "~2500",
    minModel: "70B+",
  },
  {
    id: "print-on-demand", section: "image",
    icon: Shirt, color: "#f97316",
    promptSize: "~2800",
    minModel: "70B+",
  },
  {
    id: "seasonal", section: "image",
    icon: Sunrise, color: "#06b6d4",
    promptSize: "~3500",
    minModel: "70B+",
  },
  // Vector special modes
  {
    id: "icon-pack", section: "vector",
    icon: Palette, color: "#6366f1",
    promptSize: "~2500",
    minModel: "70B+",
  },
  {
    id: "pattern", section: "vector",
    icon: ImageIcon, color: "#f59e0b",
    promptSize: "~2500",
    minModel: "30B+",
  },
  {
    id: "sticker-pack", section: "vector",
    icon: Star, color: "#ec4899",
    promptSize: "~2500",
    minModel: "70B+",
  },
  {
    id: "clipart-bundle", section: "vector",
    icon: Sparkles, color: "#f97316",
    promptSize: "~2800",
    minModel: "70B+",
  },
  {
    id: "logo-element", section: "vector",
    icon: Wand2, color: "#8b5cf6",
    promptSize: "~3000",
    minModel: "70B+",
  },
  {
    id: "glyph-icons", section: "vector",
    icon: Briefcase, color: "#475569",
    promptSize: "~2000",
    minModel: "30B+",
  },
  {
    id: "web-ui-icons", section: "vector",
    icon: Monitor, color: "#0ea5e9",
    promptSize: "~3000",
    minModel: "70B+",
  },
  {
    id: "t-shirt-graphic", section: "vector",
    icon: Shirt, color: "#f43f5e",
    promptSize: "~2200",
    minModel: "30B+",
  },
  {
    id: "character-mascot", section: "vector",
    icon: Bot, color: "#10b981",
    promptSize: "~2200",
    minModel: "30B+",
  },
  {
    id: "brand-icons", section: "vector",
    icon: Package, color: "#f59e0b",
    promptSize: "~2800",
    minModel: "70B+",
  },
  {
    id: "infographic", section: "vector",
    icon: FileText, color: "#10b981",
    promptSize: "~2500",
    minModel: "30B+",
  },
  {
    id: "social-template", section: "vector",
    icon: Globe, color: "#06b6d4",
    promptSize: "~2500",
    minModel: "30B+",
  },
  // Video special modes
  {
    id: "aerial-drone", section: "video",
    icon: Plane, color: "#3b82f6",
    promptSize: "~2000",
    minModel: "30B+",
  },
  {
    id: "macro-cinematic", section: "video",
    icon: Search, color: "#10b981",
    promptSize: "~2000",
    minModel: "30B+",
  },
  {
    id: "product-showcase", section: "video",
    icon: Package, color: "#f59e0b",
    promptSize: "~2000",
    minModel: "30B+",
  },
  {
    id: "b-roll", section: "video",
    icon: ImageIcon, color: "#6366f1",
    promptSize: "~1500",
    minModel: "any",
  },
  {
    id: "loopable", section: "video",
    icon: Repeat, color: "#0ea5e9",
    promptSize: "~1500",
    minModel: "any",
  },
  {
    id: "vertical", section: "video",
    icon: Layers, color: "#f59e0b",
    promptSize: "~1500",
    minModel: "any",
  },
  {
    id: "time-lapse", section: "video",
    icon: Sunrise, color: "#10b981",
    promptSize: "~1500",
    minModel: "any",
  },
  {
    id: "slow-motion", section: "video",
    icon: Sparkles, color: "#ec4899",
    promptSize: "~1500",
    minModel: "any",
  },
  {
    id: "motion-graphics", section: "video",
    icon: Wand2, color: "#f97316",
    promptSize: "~1500",
    minModel: "any",
  },
];

// ─── Rating computation ─────────────────────────────────────────────
function getModelRatingForFeature(model, feature) {
  const { tier } = model;
  const { minModel, id } = feature;

  // Market research is Gemini-only
  if (id === "market-research") {
    if (model.provider === "Gemini") {
      if (tier === "flagship") return { rating: 5, badge: "best" };
      if (tier === "recommended") return { rating: 5, badge: "best" };
      return { rating: 4, badge: "good" };
    }
    return { rating: 0, badge: "avoid" };
  }

  // Base rating by model tier
  let base;
  if (tier === "flagship") base = 5;
  else if (tier === "recommended") base = 5;
  else if (tier === "good") base = 4;
  else if (tier === "limited") base = 2;
  else base = 1; // caution

  // Feature-specific overrides (checked BEFORE generic minModel penalties)
  // Auto mode needs high creativity — penalize small models
  if (id === "auto" && (tier === "caution" || tier === "limited")) {
    return { rating: 1, badge: "avoid" };
  }

  // Penalty for small models on complex features (uses numeric effectiveB)
  if (minModel === "70B+") {
    if (tier === "caution") return { rating: 1, badge: "avoid" };
    if (tier === "limited") return { rating: 2, badge: "ok" };
    if (tier === "good" && model.effectiveB < 70) {
      return { rating: 2, badge: "ok" };
    }
  } else if (minModel === "30B+") {
    if (tier === "caution") return { rating: 1, badge: "avoid" };
    if (tier === "limited") {
      if (model.effectiveB < 10) return { rating: 1, badge: "avoid" };
      return { rating: 2, badge: "ok" };
    }
    if (tier === "good" && model.effectiveB < 30) {
      return { rating: 2, badge: "ok" };
    }
  }

  let badge = "good";
  if (base >= 5) badge = "best";
  else if (base >= 4) badge = "good";
  else if (base >= 2) badge = "ok";
  else badge = "avoid";

  return { rating: base, badge };
}

// ─── Main Page Component ────────────────────────────────────────────
export default function ModelGuidePage() {
  const { lang, t } = useLanguage();
  const [expandedSection, setExpandedSection] = useState("core");
  const [expandedFeature, setExpandedFeature] = useState(null);
  const [providerFilter, setProviderFilter] = useState("all");

  const isBn = lang === "bn";

  const labels = {
    title: isBn ? "AI মডেল গাইড" : "AI Model Guide",
    subtitle: isBn
      ? "কোন বাটন/ফিচারের জন্য কোন মডেল ব্যবহার করবেন — এবং কোনটা করবেন না"
      : "Which model to use for each button/feature — and which to avoid",
    badge: isBn ? "সম্পূর্ণ কম্প্যাটিবিলিটি গাইড" : "Complete Compatibility Guide",
    coreModes: isBn ? "মূল ফিচার" : "Core Features",
    imageModes: isBn ? "ইমেজ স্পেশাল মোড" : "Image Special Modes",
    vectorModes: isBn ? "ভেক্টর স্পেশাল মোড" : "Vector Special Modes",
    videoModes: isBn ? "ভিডিও স্পেশাল মোড" : "Video Special Modes",
    systemPromptSize: isBn ? "সিস্টেম প্রম্পট সাইজ" : "System Prompt Size",
    minModel: isBn ? "ন্যূনতম মডেল" : "Minimum Model",
    tokens: isBn ? "টোকেন" : "tokens",
    allProviders: isBn ? "সব" : "All",
    bestModels: isBn ? "সেরা মডেল" : "Best Models",
    avoidModels: isBn ? "এড়িয়ে চলুন" : "Avoid",
    clickToSee: isBn ? "বিস্তারিত দেখতে ক্লিক করুন" : "Click to see details",
    geminiOnly: isBn ? "শুধু Gemini" : "Gemini Only",
    anyModel: isBn ? "যেকোনো মডেল" : "Any Model",
    halalTitle: isBn ? "HALAL কমপ্লায়েন্স — মডেল অনুযায়ী ঝুঁকি" : "HALAL Compliance Risk by Model",
    halalDesc: isBn
      ? "HALAL rule (কোনো মানুষের ফিগার/মুখ/হাত নেই) কোন মডেল কতটা মেনে চলে"
      : "How reliably each model tier follows the HALAL rule (no human figures/faces/hands)",
    quickTipsTitle: isBn ? "দ্রুত পরামর্শ" : "Quick Tips",
  };

  const featureLabels = {
    manual: { en: "Manual Generate", bn: "ম্যানুয়াল জেনারেট" },
    auto: { en: "Auto Generate", bn: "অটো জেনারেট" },
    engineer: { en: "Engineer Mode", bn: "ইঞ্জিনিয়ার মোড" },
    "market-research": { en: "Market Research", bn: "মার্কেট রিসার্চ" },
    festival: { en: "Festival Mode", bn: "ফেস্টিভ্যাল মোড" },
    "quality-score": { en: "Quality Scoring", bn: "কোয়ালিটি স্কোরিং" },
    surreal: { en: "Surreal", bn: "সুরিয়াল" },
    "background-texture": { en: "Background/Texture", bn: "ব্যাকগ্রাউন্ড/টেক্সচার" },
    "wall-art": { en: "Wall Art", bn: "ওয়াল আর্ট" },
    mockup: { en: "Mockup", bn: "মকআপ" },
    collection: { en: "Collection", bn: "কালেকশন" },
    "print-on-demand": { en: "Print-on-Demand", bn: "প্রিন্ট-অন-ডিমান্ড" },
    seasonal: { en: "Seasonal", bn: "সিজনাল" },
    "icon-pack": { en: "Icon Pack", bn: "আইকন প্যাক" },
    pattern: { en: "Seamless Pattern", bn: "সিমলেস প্যাটার্ন" },
    "sticker-pack": { en: "Sticker Pack", bn: "স্টিকার প্যাক" },
    "clipart-bundle": { en: "Clipart Bundle", bn: "ক্লিপআর্ট বান্ডেল" },
    "logo-element": { en: "Logo Element", bn: "লোগো এলিমেন্ট" },
    "glyph-icons": { en: "Glyph Icons", bn: "গ্লিফ আইকন" },
    "web-ui-icons": { en: "Web UI Icons", bn: "ওয়েব UI আইকন" },
    "t-shirt-graphic": { en: "T-Shirt Graphic", bn: "টি-শার্ট গ্রাফিক" },
    "character-mascot": { en: "Character Mascot", bn: "ক্যারেক্টার ম্যাসকট" },
    "brand-icons": { en: "Brand Icons", bn: "ব্র্যান্ড আইকন" },
    infographic: { en: "Infographic", bn: "ইনফোগ্রাফিক" },
    "social-template": { en: "Social Template", bn: "সোশ্যাল টেমপ্লেট" },
    "aerial-drone": { en: "Aerial/Drone", bn: "এরিয়াল/ড্রোন" },
    "macro-cinematic": { en: "Macro Cinematic", bn: "ম্যাক্রো সিনেম্যাটিক" },
    "product-showcase": { en: "Product Showcase", bn: "প্রোডাক্ট শোকেস" },
    "b-roll": { en: "B-Roll", bn: "বি-রোল" },
    loopable: { en: "Loopable", bn: "লুপেবল" },
    vertical: { en: "Vertical 9:16", bn: "ভার্টিক্যাল 9:16" },
    "time-lapse": { en: "Time-Lapse", bn: "টাইম-ল্যাপস" },
    "slow-motion": { en: "Slow Motion", bn: "স্লো মোশন" },
    "motion-graphics": { en: "Motion Graphics", bn: "মোশন গ্রাফিক্স" },
  };

  const featureDescriptions = {
    manual: { en: "User provides a concept, AI generates prompts", bn: "ইউজার concept দেয়, AI prompt তৈরি করে" },
    auto: { en: "AI picks subject + generates — needs high creativity", bn: "AI নিজে subject বাছাই করে — বেশি সৃজনশীলতা দরকার" },
    engineer: { en: "Most detailed prompts with all rules — largest system prompt", bn: "সবচেয়ে বিস্তারিত prompt, সব rules সহ — সবচেয়ে বড় system prompt" },
    "market-research": { en: "Google Search grounding for trending topics — Gemini exclusive", bn: "Google Search দিয়ে trending topics খোঁজে — শুধু Gemini" },
    festival: { en: "Auto-detects current festival/season", bn: "বর্তমান উৎসব/ঋতু স্বয়ংক্রিয়ভাবে শনাক্ত করে" },
    "quality-score": { en: "AI scores prompt quality 1-10", bn: "AI prompt-এর quality 1-10 স্কোর দেয়" },
    surreal: { en: "Impossible, whimsical scenes — needs imagination", bn: "অসম্ভব, কাল্পনিক দৃশ্য — কল্পনাশক্তি দরকার" },
    "background-texture": { en: "Textures and backgrounds — straightforward", bn: "টেক্সচার ও ব্যাকগ্রাউন্ড — সরল" },
    "wall-art": { en: "Gallery-quality art prints in sets of 3", bn: "গ্যালারি-মানের আর্ট প্রিন্ট, ৩ এর সেটে" },
    mockup: { en: "Product mockups with blank surfaces", bn: "খালি সারফেস সহ প্রোডাক্ট মকআপ" },
    collection: { en: "Cohesive themed set — same palette, different subjects", bn: "একই palette, ভিন্ন subject — সামঞ্জস্যপূর্ণ সেট" },
    "print-on-demand": { en: "T-shirt, mug designs — POD specific", bn: "টি-শার্ট, মগ ডিজাইন — POD নির্দিষ্ট" },
    seasonal: { en: "Festival + season content — largest system prompt", bn: "উৎসব + ঋতু কন্টেন্ট — সবচেয়ে বড় system prompt" },
    "icon-pack": { en: "Industry icon sets — consistent style", bn: "ইন্ডাস্ট্রি আইকন সেট — একই স্টাইল" },
    pattern: { en: "Seamless tileable patterns", bn: "সিমলেস টাইলেবল প্যাটার্ন" },
    "sticker-pack": { en: "Matching sticker set — same character", bn: "একই character-এর sticker সেট" },
    "clipart-bundle": { en: "Decorative elements bundle", bn: "ডেকোরেটিভ এলিমেন্ট বান্ডেল" },
    "logo-element": { en: "Logo marks, badges, emblems", bn: "লোগো মার্ক, ব্যাজ, এম্বলেম" },
    "glyph-icons": { en: "Solid black silhouette icons", bn: "সলিড কালো সিলুয়েট আইকন" },
    "web-ui-icons": { en: "Pixel-perfect 24×24 UI icons", bn: "পিক্সেল-পারফেক্ট 24×24 UI আইকন" },
    "t-shirt-graphic": { en: "Self-contained apparel graphics", bn: "স্বনির্ভর পোশাকের গ্রাফিক" },
    "character-mascot": { en: "Non-human mascot logos", bn: "নন-হিউম্যান ম্যাসকট লোগো" },
    "brand-icons": { en: "App-icon-grade brand graphics", bn: "অ্যাপ-আইকন মানের ব্র্যান্ড গ্রাফিক" },
    infographic: { en: "Data visualization elements", bn: "ডেটা ভিজুয়ালাইজেশন এলিমেন্ট" },
    "social-template": { en: "Social media template backgrounds", bn: "সোশ্যাল মিডিয়া টেমপ্লেট ব্যাকগ্রাউন্ড" },
    "aerial-drone": { en: "Aerial/drone cinematography prompts", bn: "এরিয়াল/ড্রোন সিনেম্যাটোগ্রাফি" },
    "macro-cinematic": { en: "Extreme close-up macro footage", bn: "এক্সট্রিম ক্লোজ-আপ ম্যাক্রো ফুটেজ" },
    "product-showcase": { en: "Studio-lit product footage", bn: "স্টুডিও-লিট প্রোডাক্ট ফুটেজ" },
    "b-roll": { en: "Cinematic B-roll cutaways", bn: "সিনেম্যাটিক বি-রোল কাটঅ্যাওয়ে" },
    loopable: { en: "Seamlessly looping clips", bn: "সিমলেসলি লুপিং ক্লিপ" },
    vertical: { en: "9:16 Reels/Shorts format", bn: "9:16 রিলস/শর্টস ফরম্যাট" },
    "time-lapse": { en: "Compressed time footage", bn: "সংকুচিত সময়ের ফুটেজ" },
    "slow-motion": { en: "High FPS slow motion footage", bn: "হাই FPS স্লো মোশন ফুটেজ" },
    "motion-graphics": { en: "Animated typography/icons", bn: "অ্যানিমেটেড টাইপোগ্রাফি/আইকন" },
  };

  const sections = [
    { id: "core", label: labels.coreModes, color: "#6366f1" },
    { id: "image", label: labels.imageModes, color: "#8b5cf6" },
    { id: "vector", label: labels.vectorModes, color: "#10b981" },
    { id: "video", label: labels.videoModes, color: "#f43f5e" },
  ];

  const providers = ["all", "Gemini", "Groq", "Mistral", "OpenRouter", "HuggingFace", "Cerebras", "NVIDIA", "GitHub"];

  const filteredModels = providerFilter === "all" ? MODELS : MODELS.filter(m => m.provider === providerFilter);

  const halalData = [
    { tier: isBn ? "Flagship (Gemini Pro, GPT-5, Qwen 235B)" : "Flagship (Gemini Pro, GPT-5, Qwen 235B)", pct: "99%+", color: "#10b981" },
    { tier: isBn ? "Recommended (120B, GPT-4o, Flash)" : "Recommended (120B, GPT-4o, Flash)", pct: "98%+", color: "#10b981" },
    { tier: isBn ? "Good (70B, 49B, 32B, 31B)" : "Good (70B, 49B, 32B, 31B)", pct: "90%+", color: "#f59e0b" },
    { tier: isBn ? "Limited (11B-20B)" : "Limited (11B-20B)", pct: "80-85%", color: "#f97316" },
    { tier: isBn ? "Caution (3B-8B)" : "Caution (3B-8B)", pct: "50-70%", color: "#ef4444" },
  ];

  const quickTips = isBn ? [
    "সব ফিচারে সবচেয়ে নিরাপদ: Gemini 2.5 Flash, Groq GPT-OSS 120B, GitHub GPT-4o/GPT-5",
    "Market Research শুধু Gemini দিয়ে কাজ করে — অন্য কোনো provider নয়",
    "8B মডেল (Llama 3.1 8B, Phi-4 Mini) দিয়ে Special Modes ব্যবহার করবেন না",
    "Seasonal + Marketplace combo সবচেয়ে বড় system prompt — শুধু বড় মডেল ব্যবহার করুন",
    "Collection mode-এ cohesion জরুরি — 70B+ মডেল ব্যবহার করুন",
    "HALAL compliance: ছোট মডেলে (8B/3B) human figure চলে আসতে পারে — বড় মডেল ব্যবহার করুন",
  ] : [
    "Safest for all features: Gemini 2.5 Flash, Groq GPT-OSS 120B, GitHub GPT-4o/GPT-5",
    "Market Research only works with Gemini — no other provider",
    "Do not use 8B models (Llama 3.1 8B, Phi-4 Mini) for Special Modes",
    "Seasonal + Marketplace combo has the largest system prompt — use large models only",
    "Collection mode needs cohesion — use 70B+ models",
    "HALAL compliance: small models (8B/3B) may include human figures — use large models",
  ];

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--accent-soft)", color: "var(--accent)", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
          <BookOpen size={14} /> {labels.badge}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", margin: "8px 0" }}>{labels.title}</h1>
        <p style={{ color: "var(--text2)", fontSize: 14, maxWidth: 550, margin: "0 auto" }}>{labels.subtitle}</p>
      </div>

      {/* Quick Tips */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", marginBottom: 24, borderLeft: "4px solid #6366f1" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={16} style={{ color: "#f59e0b" }} /> {labels.quickTipsTitle}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {quickTips.map((tip, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>
              <span style={{ color: "#6366f1", fontWeight: 700, flexShrink: 0 }}>•</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* HALAL Risk Table */}
      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{labels.halalTitle}</h3>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--text3)" }}>{labels.halalDesc}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {halalData.map((row, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: `${row.color}08`, borderRadius: 8, border: `1px solid ${row.color}20` }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", flex: 1, minWidth: 0 }}>{row.tier}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 80, height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                  <div style={{ width: `${parseInt(row.pct)}%`, height: "100%", borderRadius: 3, background: row.color }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: row.color, minWidth: 45 }}>{row.pct}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Provider Filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {providers.map(p => (
          <button key={p} type="button" onClick={() => setProviderFilter(p)}
            style={{
              padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: providerFilter === p ? "2px solid var(--accent)" : "1px solid var(--border)",
              background: providerFilter === p ? "var(--accent-soft)" : "var(--card)",
              color: providerFilter === p ? "var(--accent)" : "var(--text2)",
            }}>
            {p === "all" ? labels.allProviders : p}
          </button>
        ))}
      </div>

      {/* Feature Sections */}
      {sections.map(section => {
        const sectionFeatures = FEATURES.filter(f => f.section === section.id);
        const isExpanded = expandedSection === section.id;

        return (
          <div key={section.id} style={{ marginBottom: 16 }}>
            <button type="button" onClick={() => setExpandedSection(isExpanded ? null : section.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
                cursor: "pointer", textAlign: "left"
              }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: section.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{section.label}</span>
              <span style={{ fontSize: 11, color: "var(--text3)", marginRight: 8 }}>
                {sectionFeatures.length} {isBn ? "টি ফিচার" : "features"}
              </span>
              {isExpanded ? <ChevronUp size={16} color="var(--text3)" /> : <ChevronDown size={16} color="var(--text3)" />}
            </button>

            {isExpanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                {sectionFeatures.map(feature => {
                  const fl = featureLabels[feature.id] || { en: feature.id, bn: feature.id };
                  const fd = featureDescriptions[feature.id] || { en: "", bn: "" };
                  const isFeatureExpanded = expandedFeature === feature.id;

                  // Compute best and avoid lists
                  const ratings = filteredModels.map(m => ({
                    model: m,
                    ...getModelRatingForFeature(m, feature)
                  }));
                  const bestModels = ratings.filter(r => r.badge === "best").map(r => r.model.label);
                  const avoidModels = ratings.filter(r => r.badge === "avoid").map(r => r.model.label);

                  return (
                    <div key={feature.id} style={{
                      background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
                      overflow: "hidden", marginLeft: 16
                    }}>
                      {/* Feature Header */}
                      <button type="button" onClick={() => setExpandedFeature(isFeatureExpanded ? null : feature.id)}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                          cursor: "pointer", border: "none", background: "transparent", textAlign: "left"
                        }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${feature.color}15`, color: feature.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <feature.icon size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{isBn ? fl.bn : fl.en}</div>
                          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{isBn ? fd.bn : fd.en}</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                          <span style={{ fontSize: 10, color: "var(--text3)" }}>
                            {feature.minModel === "gemini-only" ? labels.geminiOnly : feature.minModel === "any" ? labels.anyModel : `${labels.minModel}: ${feature.minModel}`}
                          </span>
                          <span style={{ fontSize: 10, color: "var(--text4)" }}>{labels.systemPromptSize}: {feature.promptSize}</span>
                        </div>
                        {isFeatureExpanded ? <ChevronUp size={14} color="var(--text3)" /> : <ChevronDown size={14} color="var(--text3)" />}
                      </button>

                      {/* Quick Summary */}
                      {!isFeatureExpanded && (
                        <div style={{ padding: "0 16px 10px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {bestModels.length > 0 && (
                            <span style={{ fontSize: 10, color: "#10b981" }}>
                              ✓ {bestModels.slice(0, 3).join(", ")}{bestModels.length > 3 ? ` +${bestModels.length - 3}` : ""}
                            </span>
                          )}
                          {avoidModels.length > 0 && (
                            <span style={{ fontSize: 10, color: "#ef4444" }}>
                              ✗ {avoidModels.slice(0, 3).join(", ")}{avoidModels.length > 3 ? ` +${avoidModels.length - 3}` : ""}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Expanded Model List */}
                      {isFeatureExpanded && (
                        <div style={{ padding: "0 16px 14px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {ratings.sort((a, b) => b.rating - a.rating).map(({ model, rating, badge }) => (
                              <div key={model.id} style={{
                                display: "flex", alignItems: "center", gap: 10, padding: "7px 10px",
                                borderRadius: 8, background: badge === "avoid" ? "#ef444408" : badge === "best" ? "#10b98108" : "transparent",
                                border: `1px solid ${badge === "avoid" ? "#ef444420" : badge === "best" ? "#10b98120" : "var(--border)"}`,
                              }}>
                                <span style={{ fontSize: 12, flexShrink: 0 }}>{model.emoji}</span>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", flex: 1, minWidth: 0 }}>
                                  {model.label}
                                </span>
                                <span style={{ fontSize: 10, color: "var(--text4)", flexShrink: 0 }}>{model.params}</span>
                                <RatingStars rating={rating} />
                                <Badge type={badge} label={
                                  badge === "best" ? (isBn ? "সেরা" : "Best")
                                    : badge === "good" ? (isBn ? "ভালো" : "Good")
                                    : badge === "ok" ? (isBn ? "মোটামুটি" : "OK")
                                    : badge === "avoid" ? (isBn ? "এড়িয়ে চলুন" : "Avoid")
                                    : badge
                                } />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
