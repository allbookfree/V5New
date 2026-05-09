"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import {
  LayoutGrid, Image as ImageIcon, Palette, Video,
  CheckCircle2, AlertTriangle, XCircle, Info, TrendingUp,
} from "lucide-react";

// ─── Mode catalogue (label + bilingual hint) ─────────────────────────
// Curated from the actual buttons exposed in /prompt-generator,
// /vector-generator and /video-generator. The matrix below tells the
// user — at a glance — which buttons are the most profitable for each
// marketplace, including the AI-policy reality check.

const MODES = {
  image: [
    { id: "auto", label: { en: "Auto", bn: "অটো" } },
    { id: "engineer", label: { en: "Engineer (Pro)", bn: "ইঞ্জিনিয়ার (প্রো)" } },
    { id: "surreal", label: { en: "Surreal", bn: "সুরিয়াল" } },
    { id: "background-texture", label: { en: "Background / Texture", bn: "ব্যাকগ্রাউন্ড / টেক্সচার" } },
    { id: "wall-art", label: { en: "Wall Art", bn: "ওয়াল আর্ট" } },
    { id: "mockup", label: { en: "Mockup", bn: "মকআপ" } },
    { id: "collection", label: { en: "Collection", bn: "কালেকশন" } },
    { id: "print-on-demand", label: { en: "Print-on-Demand", bn: "প্রিন্ট-অন-ডিমান্ড" } },
    { id: "seasonal", label: { en: "Seasonal", bn: "মৌসুমী" } },
  ],
  vector: [
    { id: "auto", label: { en: "Auto", bn: "অটো" } },
    { id: "engineer", label: { en: "Engineer (Pro)", bn: "ইঞ্জিনিয়ার (প্রো)" } },
    { id: "glyph-icons", label: { en: "Glyph Icons", bn: "সলিড আইকন (Glyph)" } },
    { id: "icon-pack", label: { en: "Icon Pack", bn: "আইকন প্যাক" } },
    { id: "web-ui-icons", label: { en: "Web UI Icons", bn: "ওয়েব UI আইকন" } },
    { id: "brand-icons", label: { en: "Brand Icons", bn: "ব্র্যান্ড আইকন" } },
    { id: "logo-element", label: { en: "Logo Element", bn: "লোগো এলিমেন্ট" } },
    { id: "pattern", label: { en: "Seamless Pattern", bn: "সিমলেস প্যাটার্ন" } },
    { id: "background-texture", label: { en: "Background / Texture", bn: "ব্যাকগ্রাউন্ড / টেক্সচার" } },
    { id: "sticker-pack", label: { en: "Sticker Pack", bn: "স্টিকার প্যাক" } },
    { id: "clipart-bundle", label: { en: "Clipart Bundle", bn: "ক্লিপআর্ট বান্ডেল" } },
    { id: "infographic", label: { en: "Infographic", bn: "ইনফোগ্রাফিক" } },
    { id: "social-template", label: { en: "Social Template", bn: "সোশ্যাল টেমপ্লেট" } },
    { id: "t-shirt-graphic", label: { en: "T-shirt Graphic", bn: "টি-শার্ট গ্রাফিক্স" } },
    { id: "character-mascot", label: { en: "Character / Mascot", bn: "ক্যারেক্টার / মাসকট" } },
    { id: "collection", label: { en: "Collection", bn: "কালেকশন" } },
  ],
  video: [
    { id: "auto", label: { en: "Auto", bn: "অটো" } },
    { id: "engineer", label: { en: "Engineer (Pro)", bn: "ইঞ্জিনিয়ার (প্রো)" } },
    { id: "aerial-drone", label: { en: "Aerial / Drone", bn: "ড্রোন শট" } },
    { id: "macro-cinematic", label: { en: "Macro Cinematic", bn: "ম্যাক্রো শট" } },
    { id: "product-showcase", label: { en: "Product Showcase", bn: "প্রোডাক্ট অ্যাডভার্টাইজিং" } },
    { id: "b-roll", label: { en: "B-Roll", bn: "B-রোল" } },
    { id: "loopable", label: { en: "Loopable Clip", bn: "লুপেবল ক্লিপ" } },
    { id: "vertical", label: { en: "Vertical (9:16)", bn: "ভার্টিক্যাল (9:16)" } },
    { id: "time-lapse", label: { en: "Time-lapse", bn: "টাইম-ল্যাপস" } },
    { id: "slow-motion", label: { en: "Slow-motion", bn: "স্লো-মোশন" } },
    { id: "motion-graphics", label: { en: "Motion Graphics", bn: "মোশন গ্রাফিক্স" } },
    { id: "collection", label: { en: "Collection", bn: "কালেকশন" } },
  ],
};

// ─── Marketplace catalogue (subset for the matrix) ───────────────────
// aiPolicy: "direct" → AI accepted with disclosure (safe upload).
// aiPolicy: "manual" → marketplace doesn't accept raw AI; user must
//                       apply a manual edit / curation pass first.

const MARKETS = [
  { id: "adobe", name: "Adobe Stock", logo: "🅰️", aiPolicy: "direct" },
  { id: "shutterstock", name: "Shutterstock", logo: "📷", aiPolicy: "manual" },
  { id: "freepik", name: "Freepik", logo: "🎨", aiPolicy: "direct" },
  { id: "getty", name: "Getty / iStock", logo: "📸", aiPolicy: "manual" },
  { id: "dreamstime", name: "Dreamstime", logo: "💭", aiPolicy: "direct" },
  { id: "vecteezy", name: "Vecteezy", logo: "✨", aiPolicy: "direct" },
  { id: "pond5", name: "Pond5", logo: "🎬", aiPolicy: "manual" },
  { id: "depositphotos", name: "Depositphotos", logo: "🗂️", aiPolicy: "manual" },
  { id: "123rf", name: "123RF", logo: "🖼️", aiPolicy: "direct" },
  { id: "pixta", name: "Pixta", logo: "🌏", aiPolicy: "direct" },
  { id: "pixabay", name: "Pixabay", logo: "🌐", aiPolicy: "direct" },
  { id: "wirestock", name: "Wirestock", logo: "🔌", aiPolicy: "direct" },
  { id: "etsy", name: "Etsy (Digital)", logo: "🛍️", aiPolicy: "direct" },
  { id: "redbubble", name: "Redbubble / Teepublic", logo: "👕", aiPolicy: "direct" },
  { id: "society6", name: "Society6", logo: "🎨", aiPolicy: "direct" },
  { id: "creativemarket", name: "Creative Market", logo: "💎", aiPolicy: "manual" },
  { id: "envato", name: "Envato Elements", logo: "🟢", aiPolicy: "manual" },
  { id: "amazon-kdp", name: "Amazon KDP", logo: "📚", aiPolicy: "manual" },
];

// ─── Fit matrix ──────────────────────────────────────────────────────
// "best"   → strongest match (top earner / first stop)
// "good"   → solid fit (worth uploading)
// "ok"     → acceptable but not the platform's strength
// "avoid"  → marketplace doesn't accept this format / mode
// undefined cells render as "—" (no special opinion).

const FIT = {
  // Image modes
  "image:auto": {
    adobe: "best", shutterstock: "best", freepik: "good", getty: "good", dreamstime: "good",
    vecteezy: "good", pond5: "ok", depositphotos: "ok", "123rf": "good", pixta: "good",
    pixabay: "good", wirestock: "best", etsy: "ok", redbubble: "ok", society6: "ok",
    creativemarket: "ok", envato: "ok", "amazon-kdp": "ok",
  },
  "image:engineer": {
    adobe: "best", shutterstock: "best", freepik: "good", getty: "best", dreamstime: "best",
    vecteezy: "good", pond5: "ok", depositphotos: "good", "123rf": "good", pixta: "best",
    pixabay: "good", wirestock: "best", etsy: "ok", redbubble: "ok", society6: "good",
    creativemarket: "good", envato: "good", "amazon-kdp": "good",
  },
  "image:surreal": {
    adobe: "best", shutterstock: "best", freepik: "ok", getty: "good", dreamstime: "best",
    vecteezy: "ok", pond5: "ok", depositphotos: "ok", "123rf": "good", pixta: "ok",
    pixabay: "ok", wirestock: "good", etsy: "good", redbubble: "good", society6: "best",
    creativemarket: "ok", envato: "ok", "amazon-kdp": "ok",
  },
  "image:background-texture": {
    adobe: "best", shutterstock: "best", freepik: "best", getty: "ok", dreamstime: "good",
    vecteezy: "best", pond5: "ok", depositphotos: "good", "123rf": "good", pixta: "good",
    pixabay: "best", wirestock: "best", etsy: "good", redbubble: "good", society6: "best",
    creativemarket: "good", envato: "good", "amazon-kdp": "best",
  },
  "image:wall-art": {
    adobe: "best", shutterstock: "good", freepik: "ok", getty: "best", dreamstime: "best",
    vecteezy: "ok", pond5: "avoid", depositphotos: "ok", "123rf": "good", pixta: "good",
    pixabay: "good", wirestock: "good", etsy: "best", redbubble: "best", society6: "best",
    creativemarket: "good", envato: "ok", "amazon-kdp": "best",
  },
  "image:mockup": {
    adobe: "best", shutterstock: "best", freepik: "best", getty: "ok", dreamstime: "good",
    vecteezy: "good", pond5: "avoid", depositphotos: "good", "123rf": "good", pixta: "good",
    pixabay: "ok", wirestock: "good", etsy: "good", redbubble: "ok", society6: "ok",
    creativemarket: "best", envato: "best", "amazon-kdp": "good",
  },
  "image:collection": {
    adobe: "good", shutterstock: "good", freepik: "best", getty: "ok", dreamstime: "good",
    vecteezy: "best", pond5: "avoid", depositphotos: "good", "123rf": "ok", pixta: "good",
    pixabay: "ok", wirestock: "good", etsy: "best", redbubble: "ok", society6: "good",
    creativemarket: "best", envato: "best", "amazon-kdp": "good",
  },
  "image:print-on-demand": {
    adobe: "ok", shutterstock: "ok", freepik: "ok", getty: "avoid", dreamstime: "ok",
    vecteezy: "good", pond5: "avoid", depositphotos: "ok", "123rf": "ok", pixta: "ok",
    pixabay: "ok", wirestock: "ok", etsy: "best", redbubble: "best", society6: "best",
    creativemarket: "good", envato: "ok", "amazon-kdp": "best",
  },
  "image:seasonal": {
    adobe: "best", shutterstock: "best", freepik: "best", getty: "good", dreamstime: "good",
    vecteezy: "good", pond5: "avoid", depositphotos: "good", "123rf": "good", pixta: "good",
    pixabay: "good", wirestock: "good", etsy: "best", redbubble: "best", society6: "best",
    creativemarket: "good", envato: "good", "amazon-kdp": "best",
  },
  // Vector modes
  "vector:auto": {
    adobe: "best", shutterstock: "best", freepik: "best", getty: "ok", dreamstime: "good",
    vecteezy: "best", pond5: "avoid", depositphotos: "good", "123rf": "good", pixta: "good",
    pixabay: "good", wirestock: "good", etsy: "best", redbubble: "ok", society6: "ok",
    creativemarket: "best", envato: "best", "amazon-kdp": "ok",
  },
  "vector:engineer": {
    adobe: "best", shutterstock: "best", freepik: "best", getty: "good", dreamstime: "good",
    vecteezy: "best", pond5: "avoid", depositphotos: "good", "123rf": "good", pixta: "good",
    pixabay: "good", wirestock: "good", etsy: "best", redbubble: "ok", society6: "good",
    creativemarket: "best", envato: "best", "amazon-kdp": "good",
  },
  "vector:glyph-icons": {
    adobe: "best", shutterstock: "good", freepik: "best", getty: "ok", dreamstime: "ok",
    vecteezy: "best", pond5: "avoid", depositphotos: "good", "123rf": "good", pixta: "ok",
    pixabay: "good", wirestock: "ok", etsy: "good", redbubble: "ok", society6: "ok",
    creativemarket: "best", envato: "best", "amazon-kdp": "ok",
  },
  "vector:brand-icons": {
    adobe: "best", shutterstock: "good", freepik: "best", getty: "good", dreamstime: "ok",
    vecteezy: "good", pond5: "avoid", depositphotos: "ok", "123rf": "ok", pixta: "ok",
    pixabay: "ok", wirestock: "ok", etsy: "best", redbubble: "ok", society6: "ok",
    creativemarket: "best", envato: "best", "amazon-kdp": "ok",
  },
  "vector:background-texture": {
    adobe: "best", shutterstock: "best", freepik: "best", getty: "ok", dreamstime: "good",
    vecteezy: "best", pond5: "avoid", depositphotos: "best", "123rf": "good", pixta: "good",
    pixabay: "best", wirestock: "good", etsy: "best", redbubble: "best", society6: "best",
    creativemarket: "best", envato: "best", "amazon-kdp": "best",
  },
  "vector:icon-pack": {
    adobe: "best", shutterstock: "best", freepik: "best", getty: "good", dreamstime: "good",
    vecteezy: "best", pond5: "avoid", depositphotos: "best", "123rf": "good", pixta: "good",
    pixabay: "good", wirestock: "good", etsy: "best", redbubble: "ok", society6: "ok",
    creativemarket: "best", envato: "best", "amazon-kdp": "ok",
  },
  "vector:web-ui-icons": {
    adobe: "best", shutterstock: "good", freepik: "best", getty: "ok", dreamstime: "ok",
    vecteezy: "best", pond5: "avoid", depositphotos: "good", "123rf": "good", pixta: "ok",
    pixabay: "good", wirestock: "ok", etsy: "best", redbubble: "ok", society6: "ok",
    creativemarket: "best", envato: "best", "amazon-kdp": "ok",
  },
  "vector:pattern": {
    adobe: "best", shutterstock: "best", freepik: "best", getty: "ok", dreamstime: "good",
    vecteezy: "best", pond5: "avoid", depositphotos: "best", "123rf": "good", pixta: "good",
    pixabay: "good", wirestock: "good", etsy: "best", redbubble: "best", society6: "best",
    creativemarket: "best", envato: "best", "amazon-kdp": "best",
  },
  "vector:sticker-pack": {
    adobe: "good", shutterstock: "best", freepik: "best", getty: "ok", dreamstime: "good",
    vecteezy: "best", pond5: "avoid", depositphotos: "good", "123rf": "good", pixta: "ok",
    pixabay: "ok", wirestock: "good", etsy: "best", redbubble: "best", society6: "good",
    creativemarket: "best", envato: "good", "amazon-kdp": "ok",
  },
  "vector:clipart-bundle": {
    adobe: "best", shutterstock: "best", freepik: "best", getty: "ok", dreamstime: "best",
    vecteezy: "best", pond5: "avoid", depositphotos: "best", "123rf": "good", pixta: "good",
    pixabay: "good", wirestock: "good", etsy: "best", redbubble: "good", society6: "good",
    creativemarket: "best", envato: "best", "amazon-kdp": "best",
  },
  "vector:logo-element": {
    adobe: "best", shutterstock: "good", freepik: "best", getty: "best", dreamstime: "ok",
    vecteezy: "best", pond5: "avoid", depositphotos: "ok", "123rf": "ok", pixta: "ok",
    pixabay: "ok", wirestock: "ok", etsy: "best", redbubble: "good", society6: "ok",
    creativemarket: "best", envato: "best", "amazon-kdp": "good",
  },
  "vector:infographic": {
    adobe: "best", shutterstock: "good", freepik: "best", getty: "best", dreamstime: "ok",
    vecteezy: "good", pond5: "avoid", depositphotos: "ok", "123rf": "ok", pixta: "ok",
    pixabay: "ok", wirestock: "ok", etsy: "good", redbubble: "ok", society6: "ok",
    creativemarket: "best", envato: "best", "amazon-kdp": "ok",
  },
  "vector:social-template": {
    adobe: "best", shutterstock: "best", freepik: "best", getty: "ok", dreamstime: "ok",
    vecteezy: "best", pond5: "avoid", depositphotos: "good", "123rf": "good", pixta: "good",
    pixabay: "good", wirestock: "ok", etsy: "best", redbubble: "ok", society6: "ok",
    creativemarket: "best", envato: "best", "amazon-kdp": "good",
  },
  "vector:t-shirt-graphic": {
    adobe: "good", shutterstock: "good", freepik: "good", getty: "ok", dreamstime: "ok",
    vecteezy: "good", pond5: "avoid", depositphotos: "ok", "123rf": "ok", pixta: "ok",
    pixabay: "ok", wirestock: "ok", etsy: "best", redbubble: "best", society6: "best",
    creativemarket: "good", envato: "ok", "amazon-kdp": "ok",
  },
  "vector:character-mascot": {
    adobe: "good", shutterstock: "good", freepik: "best", getty: "ok", dreamstime: "good",
    vecteezy: "best", pond5: "avoid", depositphotos: "good", "123rf": "ok", pixta: "ok",
    pixabay: "ok", wirestock: "good", etsy: "best", redbubble: "best", society6: "best",
    creativemarket: "best", envato: "good", "amazon-kdp": "ok",
  },
  "vector:collection": {
    adobe: "best", shutterstock: "good", freepik: "best", getty: "ok", dreamstime: "good",
    vecteezy: "best", pond5: "avoid", depositphotos: "best", "123rf": "good", pixta: "good",
    pixabay: "good", wirestock: "good", etsy: "best", redbubble: "good", society6: "good",
    creativemarket: "best", envato: "best", "amazon-kdp": "good",
  },
  // Video modes
  "video:auto": {
    adobe: "good", shutterstock: "best", freepik: "ok", getty: "best", dreamstime: "good",
    vecteezy: "ok", pond5: "best", depositphotos: "good", "123rf": "ok", pixta: "good",
    pixabay: "good", wirestock: "good", etsy: "avoid", redbubble: "avoid", society6: "avoid",
    creativemarket: "ok", envato: "good", "amazon-kdp": "avoid",
  },
  "video:engineer": {
    adobe: "good", shutterstock: "best", freepik: "ok", getty: "best", dreamstime: "good",
    vecteezy: "ok", pond5: "best", depositphotos: "good", "123rf": "ok", pixta: "good",
    pixabay: "ok", wirestock: "good", etsy: "avoid", redbubble: "avoid", society6: "avoid",
    creativemarket: "ok", envato: "good", "amazon-kdp": "avoid",
  },
  "video:aerial-drone": {
    adobe: "best", shutterstock: "best", freepik: "good", getty: "best", dreamstime: "good",
    vecteezy: "ok", pond5: "best", depositphotos: "good", "123rf": "ok", pixta: "good",
    pixabay: "good", wirestock: "best", etsy: "avoid", redbubble: "avoid", society6: "avoid",
    creativemarket: "ok", envato: "good", "amazon-kdp": "avoid",
  },
  "video:macro-cinematic": {
    adobe: "best", shutterstock: "best", freepik: "ok", getty: "best", dreamstime: "good",
    vecteezy: "ok", pond5: "best", depositphotos: "good", "123rf": "ok", pixta: "good",
    pixabay: "good", wirestock: "good", etsy: "avoid", redbubble: "avoid", society6: "avoid",
    creativemarket: "ok", envato: "good", "amazon-kdp": "avoid",
  },
  "video:product-showcase": {
    adobe: "best", shutterstock: "best", freepik: "good", getty: "good", dreamstime: "good",
    vecteezy: "ok", pond5: "best", depositphotos: "good", "123rf": "good", pixta: "ok",
    pixabay: "good", wirestock: "good", etsy: "avoid", redbubble: "avoid", society6: "avoid",
    creativemarket: "good", envato: "best", "amazon-kdp": "avoid",
  },
  "video:b-roll": {
    adobe: "good", shutterstock: "best", freepik: "ok", getty: "best", dreamstime: "good",
    vecteezy: "ok", pond5: "best", depositphotos: "good", "123rf": "ok", pixta: "good",
    pixabay: "good", wirestock: "good", etsy: "avoid", redbubble: "avoid", society6: "avoid",
    creativemarket: "ok", envato: "ok", "amazon-kdp": "avoid",
  },
  "video:loopable": {
    adobe: "ok", shutterstock: "good", freepik: "ok", getty: "ok", dreamstime: "ok",
    vecteezy: "ok", pond5: "good", depositphotos: "ok", "123rf": "ok", pixta: "ok",
    pixabay: "good", wirestock: "good", etsy: "avoid", redbubble: "avoid", society6: "avoid",
    creativemarket: "ok", envato: "ok", "amazon-kdp": "avoid",
  },
  "video:vertical": {
    adobe: "best", shutterstock: "best", freepik: "good", getty: "good", dreamstime: "good",
    vecteezy: "ok", pond5: "best", depositphotos: "good", "123rf": "ok", pixta: "good",
    pixabay: "good", wirestock: "best", etsy: "avoid", redbubble: "avoid", society6: "avoid",
    creativemarket: "ok", envato: "good", "amazon-kdp": "avoid",
  },
  "video:time-lapse": {
    adobe: "best", shutterstock: "best", freepik: "good", getty: "best", dreamstime: "good",
    vecteezy: "ok", pond5: "best", depositphotos: "good", "123rf": "ok", pixta: "good",
    pixabay: "good", wirestock: "good", etsy: "avoid", redbubble: "avoid", society6: "avoid",
    creativemarket: "ok", envato: "good", "amazon-kdp": "avoid",
  },
  "video:slow-motion": {
    adobe: "best", shutterstock: "best", freepik: "good", getty: "best", dreamstime: "good",
    vecteezy: "ok", pond5: "best", depositphotos: "good", "123rf": "ok", pixta: "good",
    pixabay: "good", wirestock: "good", etsy: "avoid", redbubble: "avoid", society6: "avoid",
    creativemarket: "ok", envato: "good", "amazon-kdp": "avoid",
  },
  "video:motion-graphics": {
    adobe: "good", shutterstock: "good", freepik: "ok", getty: "ok", dreamstime: "ok",
    vecteezy: "ok", pond5: "best", depositphotos: "ok", "123rf": "ok", pixta: "ok",
    pixabay: "ok", wirestock: "good", etsy: "avoid", redbubble: "avoid", society6: "avoid",
    creativemarket: "good", envato: "best", "amazon-kdp": "avoid",
  },
  "video:collection": {
    adobe: "good", shutterstock: "good", freepik: "good", getty: "good", dreamstime: "good",
    vecteezy: "ok", pond5: "best", depositphotos: "good", "123rf": "good", pixta: "good",
    pixabay: "good", wirestock: "good", etsy: "avoid", redbubble: "avoid", society6: "avoid",
    creativemarket: "best", envato: "best", "amazon-kdp": "avoid",
  },
};

const FIT_STYLES = {
  best: { bg: "rgba(16,185,129,0.18)", color: "#10b981", border: "rgba(16,185,129,0.45)", text: { en: "Best", bn: "সেরা" } },
  good: { bg: "rgba(59,130,246,0.16)", color: "#3b82f6", border: "rgba(59,130,246,0.4)", text: { en: "Good", bn: "ভালো" } },
  ok: { bg: "rgba(245,158,11,0.14)", color: "#f59e0b", border: "rgba(245,158,11,0.35)", text: { en: "OK", bn: "ঠিক" } },
  avoid: { bg: "rgba(239,68,68,0.14)", color: "#ef4444", border: "rgba(239,68,68,0.35)", text: { en: "N/A", bn: "নয়" } },
};

const CONTENT_TABS = [
  { id: "image", icon: ImageIcon, color: "#6366f1", label: { en: "Image", bn: "ইমেজ" } },
  { id: "vector", icon: Palette, color: "#10b981", label: { en: "Vector", bn: "ভেক্টর" } },
  { id: "video", icon: Video, color: "#f43f5e", label: { en: "Video", bn: "ভিডিও" } },
];

function FitCell({ fit, lang }) {
  if (!fit) {
    return <span style={{ fontSize: 11, color: "var(--text4)" }}>—</span>;
  }
  const s = FIT_STYLES[fit];
  if (!s) return <span style={{ fontSize: 11, color: "var(--text4)" }}>—</span>;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 38,
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>{fit === "avoid" ? <XCircle size={11} /> : fit === "best" ? <CheckCircle2 size={11} /> : s.text[lang] || s.text.en}</span>
  );
}

export default function FeatureGuidePage() {
  const { lang } = useLanguage();
  const [tab, setTab] = useState("image");

  const labels = {
    title: lang === "bn" ? "বাটন ↔ মার্কেটপ্লেস ম্যাট্রিক্স" : "Button ↔ Marketplace Matrix",
    subtitle: lang === "bn"
      ? "প্রত্যেক বাটন কোন মার্কেটপ্লেসের জন্য সবচেয়ে ভালো — এক ঝলকে দেখুন।"
      : "See at a glance which generation button earns the most on each marketplace.",
    legend: lang === "bn" ? "রেটিং" : "Rating",
    aiDirect: lang === "bn" ? "AI সরাসরি" : "AI Direct",
    aiManual: lang === "bn" ? "হাতের ছোঁয়া দরকার" : "Manual Touch",
    note: lang === "bn"
      ? "⚠️ চিহ্নিত মার্কেটপ্লেসগুলোতে আপলোডের আগে নিজের এডিট/কিউরেশন পাস দিতে হবে — raw AI আউটপুট সরাসরি গ্রহণযোগ্য নয়।"
      : "Marketplaces marked ⚠️ don't accept raw AI output — apply your own manual edit / curation pass before upload.",
    seeMarket: lang === "bn" ? "মার্কেটপ্লেস গাইড দেখুন" : "Open Marketplace Guide",
    seeModel: lang === "bn" ? "মডেল গাইড দেখুন" : "Open Model Guide",
    seeTrends: lang === "bn" ? "মার্কেট ট্রেন্ডস দেখুন" : "Open Market Trends",
  };

  const modes = MODES[tab];

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(16,185,129,0.06) 100%)",
        border: "1px solid var(--border)", borderRadius: 14, padding: "20px 22px", marginBottom: 18,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LayoutGrid size={22} color="#6366f1" />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{labels.title}</h1>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text2)" }}>{labels.subtitle}</p>
        <div style={{
          marginTop: 12, padding: "8px 12px", background: "rgba(245,158,11,0.08)",
          border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8,
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <Info size={14} color="#f59e0b" style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>{labels.note}</span>
        </div>
      </div>

      {/* Tab buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {CONTENT_TABS.map(c => {
          const active = tab === c.id;
          const Icon = c.icon;
          return (
            <button key={c.id} type="button" onClick={() => setTab(c.id)} style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
              borderRadius: 10, border: `1px solid ${active ? c.color : "var(--border)"}`,
              background: active ? `${c.color}20` : "var(--card)",
              color: active ? c.color : "var(--text2)", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>
              <Icon size={14} /> {c.label[lang] || c.label.en}
            </button>
          );
        })}
        <Link href="/marketplace-guide" style={{
          marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 14px", borderRadius: 10, border: "1px solid var(--border)",
          background: "var(--card)", color: "var(--text2)", fontWeight: 600, fontSize: 12,
          textDecoration: "none",
        }}>{labels.seeMarket}</Link>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, fontSize: 11,
        color: "var(--text3)", alignItems: "center",
      }}>
        <span style={{ fontWeight: 700, color: "var(--text2)" }}>{labels.legend}:</span>
        {(["best", "good", "ok", "avoid"]).map(k => {
          const s = FIT_STYLES[k];
          return (
            <span key={k} style={{
              display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px",
              borderRadius: 6, background: s.bg, color: s.color, border: `1px solid ${s.border}`,
              fontWeight: 700,
            }}>
              {k === "avoid" ? <XCircle size={10} /> : k === "best" ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
              {s.text[lang] || s.text.en}
            </span>
          );
        })}
      </div>

      {/* Matrix table */}
      <div style={{
        overflowX: "auto", border: "1px solid var(--border)", borderRadius: 12,
        background: "var(--card)",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--bg2)" }}>
              <th style={{
                position: "sticky", left: 0, background: "var(--bg2)", zIndex: 2,
                textAlign: "left", padding: "10px 14px", borderBottom: "1px solid var(--border)",
                fontSize: 11, fontWeight: 700, color: "var(--text2)", minWidth: 200,
              }}>{lang === "bn" ? "বাটন / মোড" : "Button / Mode"}</th>
              {MARKETS.map(m => (
                <th key={m.id} style={{
                  textAlign: "center", padding: "10px 8px", borderBottom: "1px solid var(--border)",
                  borderLeft: "1px solid var(--border)",
                  fontSize: 10, fontWeight: 700, color: "var(--text2)", minWidth: 88,
                }} title={m.aiPolicy === "manual" ? labels.aiManual : labels.aiDirect}>
                  <div style={{ fontSize: 14, marginBottom: 2 }}>{m.logo}</div>
                  <div style={{ fontSize: 10, color: "var(--text2)", lineHeight: 1.2 }}>
                    {m.aiPolicy === "manual" ? "⚠️ " : "✅ "}{m.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modes.map(mode => {
              const row = FIT[`${tab}:${mode.id}`] || {};
              return (
                <tr key={mode.id}>
                  <td style={{
                    position: "sticky", left: 0, background: "var(--card)", zIndex: 1,
                    padding: "10px 14px", borderBottom: "1px solid var(--border)",
                    fontSize: 12, fontWeight: 600, color: "var(--text)",
                  }}>{mode.label[lang] || mode.label.en}</td>
                  {MARKETS.map(m => (
                    <td key={m.id} style={{
                      textAlign: "center", padding: "8px",
                      borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)",
                    }}>
                      <FitCell fit={row[m.id]} lang={lang} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer hint */}
      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/market-trends" style={{
          flex: 1, minWidth: 220, padding: "12px 14px", borderRadius: 10,
          border: "1px solid #6366f1", background: "rgba(99,102,241,0.08)",
          color: "#6366f1", textDecoration: "none", fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <TrendingUp size={14} /> {labels.seeTrends}
        </Link>
        <Link href="/marketplace-guide" style={{
          flex: 1, minWidth: 220, padding: "12px 14px", borderRadius: 10,
          border: "1px solid var(--border)", background: "var(--card)",
          color: "var(--text)", textDecoration: "none", fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <ImageIcon size={14} /> {labels.seeMarket}
        </Link>
        <Link href="/model-guide" style={{
          flex: 1, minWidth: 220, padding: "12px 14px", borderRadius: 10,
          border: "1px solid var(--border)", background: "var(--card)",
          color: "var(--text)", textDecoration: "none", fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <LayoutGrid size={14} /> {labels.seeModel}
        </Link>
      </div>
    </div>
  );
}
