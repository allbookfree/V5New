# AI Prompt Studio

A professional AI prompt engineering platform for commercial microstock creators. Generate image, vector, and video prompts with complete AI creative freedom, halal content compliance, marketplace-specific optimization, and AI-powered SEO metadata extraction.

> **Version:** 2.0 | **Last Updated:** April 2026 | **Status:** Production Ready

## ✨ Features

### Ultimate AutoTester Benchmarking Suite 🎖️
A production-grade background testing suite to evaluate AI models autonomously:
- **Matrix Generation:** Cross-tests Models × Marketplaces × Generation Modes.
- **Provider & Model Filters:** Selectively benchmark specific providers (e.g., Groq, Gemini) or specific models across providers dynamically.
- **Auto-Skip Logic:** Intelligently bypasses broken endpoints or depleted API keys after 3 consecutive errors to save time.
- **Smart Retry System:** Filter out and seamlessly re-run only the failed permutations to achieve a 100% clean test suite.
- **Real-Time Leaderboard** Live metrics calculating Average Latency (Speed) and AI Reliability (Success Rate) sorted intuitively.
- **Live Visual Automation Mode:** A robust "Ghost Testing" feature that visually interacts with the UI, mimicking human clicks for system debugging.
- **Data Export:** Generate detailed native `.xlsx` benchmarking reports complete with response times and the exact Prompts generated.

### Prompt Generation
- **Image Prompt Generator** — Photorealistic stock photography prompts with lens, lighting, and composition control
- **Vector Prompt Generator** — Vector-conversion-ready illustration prompts with clean edges, flat fills, and scalable design rules
- **Video Prompt Generator** — Cinematic stock footage prompts with camera movement, pacing, and color grading
- **Complete Creative Freedom** — AI has absolute independence to choose any halal subject with zero fixed hints or biases
- **2.7M+ unique seed combinations** — 240 adjectives × 23 image contexts × 25 vector contexts × 20 video contexts

### Generation Modes
| Mode | Description |
|------|-------------|
| **Generate Prompts** | Manual mode — user provides a concept, AI generates detailed prompts |
| **Auto Generate** | One-click autonomous generation from diversity seed pool |
| **Engineer** | Professional prompt formulas with timeless content rules and repeat buyer strategy |
| **Icon Pack** | Cohesive icon sets with matching visual language — optimized for PNG transparent backgrounds |
| **Pattern** | Seamless repeating patterns for textile, wallpaper, packaging, and web backgrounds |
| **Collection** | Themed asset collections that work together as a visual brand kit |

### Target Marketplace Optimization
Platform-specific aesthetic guidance for higher approval rates:
- **Adobe Stock** — Premium editorial, cinematic lifestyle, authentic imperfection
- **Shutterstock** — Hyper-commercial, clean utility, bright lighting, broad appeal
- **Freepik** — Trendy, vibrant colors, modern digital styling, social media ready
- **Getty Images / iStock** — Authentic emotion, storytelling, narrative depth
- **Dreamstime / Depositphotos** — General stock, clear utility concepts

### Halal Content Compliance
- **Multi-layer enforcement** — System prompt, quality rules, special modes, and marketplace guidance all enforce zero human figures
- **Festival calendar** — 30+ seasonal events (Eid al-Fitr, Eid al-Adha, Ramadan, and international events) with auto-detection
- **SEO boost** — Automatic "nobody" and "no people" keywords for marketplace search filters

### Metadata Generator
- **AI-powered SEO metadata** from uploaded images — title (70 chars max), description (200 chars max), and 25-49 priority-ordered keywords
- **Anti-hallucination** — Only tags what is actually visible in the image
- **Keyword priority system** — First 10 keywords carry highest search weight
- **Title-keyword alignment** — Title terms reinforced in top keywords
- **Banned keyword filtering** — Auto-removes generic, trademark, and AI-related terms
- **Batch processing** — Multiple images with Excel/CSV export
- **Separate templates for Image and Vector** — Different SEO strategies per content type

### AI Providers (All Verified Active — April 2026)

| Provider | Models | Vision |
|----------|--------|--------|
| **Google Gemini** | Gemini 2.5 Flash, Gemini 2.5 Flash-Lite, Gemini 3 Flash (Preview), Gemini 3.1 Flash-Lite (Preview) | ✅ |
| **Groq** | Llama 3.3 70B Versatile, Llama 3.1 8B Instant, Llama 4 Scout 17B, GPT-OSS 120B | ✅ (Scout) |
| **Mistral** | Mistral Small Latest (= Mistral Small 4, March 2026) | ✅ |
| **OpenRouter** | Auto Router, Nemotron 120B, Llama 3.3 70B, GPT-OSS 120B, Qwen 3 Next 80B, Nemotron Nano 9B, Gemma 4 26B, Gemma 4 31B | ✅ (Gemma 4, Nemotron VL) |
| **HuggingFace** | Llama 3.3 70B, Qwen 2.5 72B, Mistral Nemo, DeepSeek-R1 Distill 32B | ✅ (Qwen VL, Llama Vision) |
| **Cerebras** | GPT-OSS 120B (production · 1M tokens/day), GLM 4.7 355B (preview), Qwen 3 235B (preview) | — |
| **NVIDIA NIM** | Nemotron Super 49B (40 RPM), Llama 3.3 70B Instruct | — |

- All providers use free-tier API keys
- Automatic failover between multiple API keys per provider
- Model queue with intelligent fallback (e.g., Gemini Flash → Flash-Lite, Cerebras preview → production)

### Provider Quotas (Free Tier · April 2026)

| Provider | Free Quota | Rate Limit | Notes |
|----------|-----------|-----------|-------|
| Google Gemini | Generous (varies by model) | 15-30 RPM | Includes Search grounding |
| Groq | 6,000 tokens/min | 30 RPM | All Llama 3/4 + GPT-OSS |
| Mistral | Free tier (la Plateforme) | 5 RPS | Vision + multimodal |
| OpenRouter | Free models capped | Per-model | Many `:free` models |
| HuggingFace | $0.10/month free credit | Per-model | Auto-routed |
| Cerebras | 1M tokens/day (production) | 30 RPM | Fastest inference |
| NVIDIA NIM | Free with key | 40 RPM | Pay-as-you-go available |

> Quotas change. If a provider feels slow or returns 429s often, add a second key from a different account or pick a different provider in the dropdown.

### Additional Features
- **Market Research Mode** — Google Search grounding integration for trending topics (Gemini only)
- **Quality Scoring** — AI-based commercial viability assessment (1-10 scale)
- **Analytics Dashboard** — Total prompts generated, type distribution, seed system statistics
- **Prompt History** — Browse, search, copy, and delete previously generated prompts (view-only, never sent to AI)
- **Copy All** — Clean prompt text for Excel compatibility
- **CSV/TXT Export** — UTF-8 BOM for proper Unicode
- **Dark/Light Theme** with Bengali and English UI
- **Local-first Security** — API keys stored in browser only, never on any server

## Tech Stack

| Technology | Detail |
|------------|--------|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19 |
| Styling | Custom CSS with CSS variables |
| i18n | Custom (English + Bengali) |
| Icons | Lucide React |
| Spreadsheet Export | SheetJS (xlsx) |
| Storage | Browser localStorage |

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

### Environment Variables

Copy `.env.example` to `.env.local` and fill in deployment-specific values:

```bash
cp .env.example .env.local
```

| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_BASE_URL` | Canonical site URL used by `sitemap.xml`. Required for SEO in production. | `http://localhost:5000` |
| `NEXT_PUBLIC_APP_URL` | Sent as `HTTP-Referer` to OpenRouter. Falls back to `NEXT_PUBLIC_BASE_URL`. | `NEXT_PUBLIC_BASE_URL` |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | Optional. When both are set the per-IP rate-limiter persists in Upstash Redis (survives serverless cold-starts). Free tier at upstash.com is sufficient. Without these, the limiter falls back to in-memory. | unset |
| `SENTRY_DSN` | Optional. Sentry public DSN. When set, uncaught route handler errors are forwarded for monitoring. Works with self-hosted Sentry too. | unset |
| `SENTRY_ENVIRONMENT` | Optional. Tag attached to Sentry events. | `production` (or `NODE_ENV`) |
| `ERROR_WEBHOOK_URL` | Optional. Any HTTPS endpoint that accepts a JSON POST. Useful for Slack incoming webhooks, BetterStack, Logtail, or a custom collector. | unset |

API provider keys are entered through the in-app **API Keys** modal and stored
in the browser only — never via environment variables.

### Optional production hardening

- **Rate-limiting**: see Upstash variables above.  Without them, rate-limit state is per-worker and resets on cold-start.
- **Error monitoring**: set `SENTRY_DSN` (or `ERROR_WEBHOOK_URL`) to capture 500s.
- **Model deprecation alerts**: run `node scripts/check-model-deprecations.mjs` periodically to audit provider catalogs and detect deprecated model IDs.

### Production Build

```bash
npm run build
npm start
```

## API Keys Setup

1. Open the app → click **API Keys** in the sidebar
2. Add at least one API key from any provider:
   - [Google AI Studio](https://aistudio.google.com/app/apikey) — Recommended primary
   - [Groq Console](https://console.groq.com/keys) — Fast inference
   - [Mistral Console](https://console.mistral.ai/api-keys) — Vision-capable
   - [OpenRouter](https://openrouter.ai/settings/keys) — Many free models
   - [HuggingFace](https://huggingface.co/settings/tokens) — Open-source models
3. Keys are stored in your browser only — never sent to any server except the AI provider
4. You can add multiple keys per provider for automatic failover

## Deployment (Vercel)

1. Push your code to a Git repository
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your repository
3. Deploy — zero configuration needed
4. API routes automatically work as serverless functions

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── generate-prompts/     # Main prompt generation engine
│   │   ├── generate-metadata/    # Vision-based metadata extraction
│   │   └── score-prompts/        # Commercial viability scoring
│   ├── prompt-generator/         # Image prompt page
│   ├── vector-generator/         # Vector prompt page
│   ├── video-generator/          # Video prompt page
│   ├── metadata-generator/       # Metadata extraction page
│   ├── history/                  # Prompt history viewer
│   └── analytics/                # Usage analytics
├── components/
│   ├── PromptGenerator.jsx       # Core generation UI
│   └── AutoTester.jsx            # Autonomous Benchmarking Suite Engine
├── config/
│   ├── models.js                 # Provider and model configurations
│   └── templates.js              # Quick-start prompt templates
├── lib/
│   ├── promptBuilder.js          # System prompt construction
│   ├── subjectPool.js            # Seed combination engine (adjectives + visual contexts)
│   ├── diversityPools.js         # Style, era, mood, composition randomization
│   ├── festivalCalendar.js       # 30+ seasonal festival events
│   ├── metadataPrompts.js        # SEO metadata prompt templates (image + vector)
│   ├── promptHistory.js          # LocalStorage history management
│   ├── promptUtils.js            # Copy, download, and parse utilities
│   ├── apiUtils.js               # Shared API utilities
│   └── apiErrors.js              # Error mapping and user-friendly messages
└── i18n/
    └── translations.js           # English + Bengali translations
```

## Environment Variables (Optional)

| Variable | Description | Default |
|---|---|---|
| `PORT` | Dev server port | `5000` |
| `NEXT_PUBLIC_APP_URL` | App URL for OpenRouter referer header | — |

## Maintenance

| When | Action |
|------|--------|
| Every 6 months | Check `models.js` for deprecated or new model IDs |
| Every year | Update `festivalCalendar.js` — Islamic dates shift annually |
| As needed | Review marketplace acceptance policies for changes |

## License

MIT
