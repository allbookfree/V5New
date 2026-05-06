"use client";

import Link from "next/link";
import { Sparkles, Palette, Video, Image, ArrowRight, Zap, Shield, Globe, BarChart3, Rocket, Clock3, Store } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

// SoftwareApplication JSON-LD makes the home page eligible for rich
// snippets in Google search (rating, price, screenshots). Keep this
// inline so it's serialized once per render and doesn't require an
// extra round-trip.
const SOFTWARE_APP_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "PromptStudio",
  "applicationCategory": "DesignApplication",
  "operatingSystem": "Web Browser",
  "description":
    "Halal-first AI prompt and microstock metadata generator. Optimized for Adobe Stock, Shutterstock, Freepik, Getty/iStock, Dreamstime, Vecteezy, Pond5, and Creative Market.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
  },
  "featureList": [
    "Image prompt generation",
    "Vector / illustration prompt generation",
    "Cinematic video prompt generation",
    "Microstock metadata extraction (titles, keywords)",
    "Halal content compliance",
    "Marketplace optimization (8 platforms)",
    "Multi-provider failover (Gemini, Groq, Mistral, OpenRouter, HuggingFace)",
  ],
};

const toolDefs = [
  { titleKey: "home.imageTitle", descKey: "home.imageDesc", icon: Sparkles, href: "/prompt-generator", gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)" },
  { titleKey: "home.vectorTitle", descKey: "home.vectorDesc", icon: Palette, href: "/vector-generator", gradient: "linear-gradient(135deg, #06b6d4, #0891b2)" },
  { titleKey: "home.videoTitle", descKey: "home.videoDesc", icon: Video, href: "/video-generator", gradient: "linear-gradient(135deg, #f97316, #ef4444)" },
  { titleKey: "home.metadataTitle", descKey: "home.metadataDesc", icon: Image, href: "/metadata-generator", gradient: "linear-gradient(135deg, #10b981, #059669)" },
  { titleKey: "home.marketplaceTitle", descKey: "home.marketplaceDesc", icon: Store, href: "/marketplace-guide", gradient: "linear-gradient(135deg, #f59e0b, #d97706)" },
];

const featureDefs = [
  { icon: Zap, titleKey: "home.feat3Title", descKey: "home.feat3Desc" },
  { icon: Shield, titleKey: "home.feat4Title", descKey: "home.feat4Desc" },
  { icon: Globe, titleKey: "home.feat5Title", descKey: "home.feat5Desc" },
  { icon: BarChart3, titleKey: "home.feat6Title", descKey: "home.feat6Desc" },
];

const highlightDefs = [
  { icon: Rocket, titleKey: "home.feat1Title", descKey: "home.feat1Desc" },
  { icon: Clock3, titleKey: "home.feat2Title", descKey: "home.feat2Desc" },
];

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <div className="home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_APP_JSONLD) }}
      />
      <div className="home-hero">
        <div className="home-badge"><Zap size={14} /><span>{t("home.badge")}</span></div>
        <h1 className="home-title">{t("home.title")}</h1>
        <p className="home-desc">{t("home.description")}</p>
      </div>

      <div className="home-highlights">
        {highlightDefs.map((item) => (
          <div key={item.titleKey} className="home-highlight">
            <div className="home-highlight-icon"><item.icon size={16} /></div>
            <div>
              <h4 className="home-highlight-title">{t(item.titleKey)}</h4>
              <p className="home-highlight-desc">{t(item.descKey)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="home-section">
        <h2 className="home-section-title">{t("home.chooseWorkspace")}</h2>
        <div className="home-grid">
          {toolDefs.map((td) => (
            <Link key={td.href} href={td.href} className="home-card">
              <div className="home-card-icon" style={{ background: td.gradient }}><td.icon size={22} /></div>
              <div className="home-card-body">
                <h3 className="home-card-title">{t(td.titleKey)}</h3>
                <p className="home-card-desc">{t(td.descKey)}</p>
              </div>
              <div className="home-arrow"><ArrowRight size={18} /></div>
            </Link>
          ))}
        </div>
      </div>

      <div className="home-features">
        {featureDefs.map((f) => (
          <div key={f.titleKey} className="home-feat">
            <div className="home-feat-icon"><f.icon size={18} /></div>
            <div>
              <h4 className="home-feat-title">{t(f.titleKey)}</h4>
              <p className="home-feat-desc">{t(f.descKey)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
