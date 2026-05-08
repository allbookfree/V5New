import { MODEL_IDS, OR_MODEL_MAP, PROVIDER_KEY_MAP, ALLOWED_MODELS, ALLOWED_TYPES } from "@/config/models";
import { buildSystemPrompt, sanitizeUntrustedText } from "@/lib/promptBuilder";
import { jsonError, sanitizeKeys, fetchWithTimeout, APP_REFERER, APP_TITLE, enforceSameOrigin, readJsonBody, MAX_REQUEST_BODY_BYTES } from "@/lib/apiUtils";
import { AUTO_DIVERSITY_POOLS, ENGINEER_DIVERSITY_POOLS } from "@/lib/diversityPools";
import { recordSuccess, recordFailure, reorderQueue } from "@/lib/providerHealth";
import { normalizeRetryAfter } from "@/lib/retryAfter";

const MAX_PROMPT_CHARS = 4000;
const REQUEST_TIMEOUT_MS = 60000;

function pickRandom(arr, n) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

// Sleep with up to ±25% jitter so multiple concurrent invocations don't
// stampede a recovering provider in lockstep. Floors at 50 ms so we never
// sleep zero (which defeats the purpose of the delay).
function sleepJitter(baseMs) {
  const ms = Math.max(50, Math.round(baseMs * (0.75 + Math.random() * 0.5)));
  return new Promise(r => setTimeout(r, ms));
}

function getMarketplaceGuidance(targetMarket, type) {
  if (targetMarket === "all" || !targetMarket) return "";

  const isVideo = type === "video";
  const isVector = type === "vector";
  const mediumLabel = isVideo ? "video" : isVector ? "vector" : "image";

  // Timeless platform aesthetic profiles — no date-locked trends, no hardcoded
  // category lists. AI is asked to choose categories using its own commercial
  // intuition. Each block describes the platform's enduring identity, the
  // technical/aesthetic bar, and what to avoid. Categories that "happen to be
  // hot" change every quarter, so we deliberately stay platform-agnostic on
  // subject matter.
  const profiles = {
    adobe: {
      identity: "Premium editorial / advertising tier. Reviewers reject anything that looks generic, plastic, or obviously AI.",
      aesthetic: isVideo
        ? "High-budget commercial cinematography: rock-steady camera, natural motion physics, theatrical lighting, narrative depth."
        : isVector
        ? "Premium professional vector design: clean paths, deliberate composition, scalable, no rasterized look, no photorealism."
        : "Magazine-cover quality: editorial lighting, authentic micro-imperfections (skin texture, fabric weave, surface grain), strong narrative.",
      avoid: "Plastic corporate stock clichés, perfect symmetry, smooth uniform lighting, telltale AI sheen, repetitive compositions.",
    },
    shutterstock: {
      identity: "Highest-volume universal stock — content licensed across global advertising, web, and print. As of 2024, the public AI Generator pipeline is the only sanctioned route for synthetic content; uploads through the regular Contributor portal must look human-shot. Buyers value broad versatility + indemnified safety.",
      aesthetic: isVideo
        ? "Hyper-commercial stock motion that looks like a real production shoot: ultra-stable tripod/gimbal, isolated subject, broad global readability, copy-space friendly. Hide all AI-style tells."
        : isVector
        ? "Designer-ready vectors that look hand-drawn or human-drafted: isolated elements, clear copy space, sRGB, EPS-clean paths, fonts outlined, no embedded bitmaps, smooth gradients without banding."
        : "Bright, sharp, isolated subjects that read as authentic photography. Universal global appeal. Reviewers will reject obvious AI artifacts — the human-touch curation pass after generation is mandatory before upload.",
      avoid: "Over-processed AI sheen, plastic skin/textures, busy backgrounds, repeated lighting tells, niche/regional concepts that limit universal use.",
    },
    freepik: {
      identity: "Modern digital-first marketplace — content is used in social, web, marketing collateral, and design templates.",
      aesthetic: isVideo
        ? "Vibrant, fast-paced motion suitable for social media, ads, and explainer content."
        : isVector
        ? "Trendy stylized flat or semi-flat vectors, playful palettes, EPS in CC, RGB color mode, file size 0.5–80 MB."
        : "Photo size 2000–8000 px, file size <1.5 MB, no visible watermarks/logos. Bright, contemporary, social-ready.",
      avoid: "Drab/dated aesthetics, holiday content submitted after the holiday, designs containing visible third-party brands or year numbers.",
    },
    getty: {
      identity: "Editorial / commercial premium tier. Strictest authenticity bar in the industry. Getty/iStock currently rejects pure generative AI submissions — only the in-house Generative AI by iStock pipeline is sanctioned; everything submitted via the regular Contributor portal MUST look human-made. Buyers explicitly want content that feels human-made and emotionally true.",
      aesthetic: isVideo
        ? "Story-first cinematography: candid moments, lived-in environments, controlled imperfection, deliberate grain or texture, hand-held warmth."
        : isVector
        ? "Hand-crafted feel — visible brushwork, intentional asymmetry, conceptual depth. Vectors must communicate an idea, not just decorate."
        : "Authentic light, real-world surface textures, candid framing, narrative depth. Treat each frame as if it could anchor an editorial spread — the human curation pass after generation is non-negotiable.",
      avoid: "Hyper-smooth skin, sterile symmetry, clinical/uniform lighting, generic AI compositions. These are the exact patterns Getty's reviewers reject.",
    },
    dreamstime: {
      identity: "General-purpose stock used by small business, blogs, news, and entry-tier marketing. AI-generated content is officially accepted with disclosure (the Dreamstime AI Generator and traditional contributor flow both work). Volume + clarity-of-concept matter most.",
      aesthetic: "Direct, instantly readable concepts. Subject + context understandable at thumbnail size. Broad, flexible utility.",
      avoid: "Overly artistic or ambiguous compositions; abstract concepts that confuse a casual buyer; missing AI disclosure on AI uploads.",
    },
    depositphotos: {
      identity: "Royalty-free general stock. Pure generative AI is not accepted through the regular Contributor portal — the only direct AI route is via the Picfair partner pipeline. For everything else, treat AI output as a starting point that needs a real human edit pass before submission.",
      aesthetic: isVideo
        ? "Stable, well-lit clips that read as professionally shot footage. Hide AI motion artifacts; favour locked-off camera or smooth slider movement."
        : isVector
        ? "Clean, designer-friendly vectors with crisp paths and on-trend palettes — must look like they were drafted in Illustrator, not auto-generated."
        : "Authentic photography look: real lens character, natural lighting, believable surface micro-detail. The human touch-up after generation is mandatory.",
      avoid: "Recognisable AI tells (over-smooth skin, melting textures, repeated patterns), missing disclosure, low-resolution exports.",
    },
    vecteezy: {
      identity: "Vectors / photos / video marketplace popular with creators and small studios. AI content welcome but held to clear quality bar.",
      aesthetic: isVideo
        ? "High-resolution authentic motion — travel, time-lapse, lifestyle, b-roll. Stable, well-lit, well-composed."
        : isVector
        ? "Beautiful illustrations and well-designed icon packs. Cohesive style, clean construction, designer-ready output."
        : "Engaging authentic photography across any category — quality > quantity.",
      avoid: "Sloppy execution, derivative AI looks, watermarks, brand logos, low-resolution exports.",
    },
    pond5: {
      identity: "Video-first marketplace for filmmakers, broadcasters, and ad agencies. Pure generative AI footage is currently rejected at intake — only the dedicated Pond5 AI Marketplace channel accepts synthetic clips. Prompts here must describe content that COULD be a real shoot, with a human grading/editing pass before upload. Premium footage commands premium prices.",
      aesthetic: isVideo
        ? "Cinematic footage: 4K+ resolution, color-graded look, professional camera work, broadcast-ready stability, clear story beat per clip. Hide every AI tell."
        : "If submitting stills: production-still quality — behind-the-scenes feel, cinematic lighting, narrative context.",
      avoid: "Shaky handheld, social-media filters, jump-cuts mid-clip, watermarks, obvious AI motion glitches. Pond5 buyers expect agency-grade quality.",
    },
    creativemarket: {
      identity: "Design-asset marketplace for templates, fonts, graphics, and curated illustration sets. Pure AI-generated photo packs are discouraged — vector / template / font products fare best, and even those benefit from a clear human edit pass to look hand-crafted. Buyers are designers building brand identity systems.",
      aesthetic: isVector
        ? "Cohesive curated sets: shared palette, consistent stroke/style, layered/editable construction, presentation-ready, hand-drafted feel."
        : "Lifestyle imagery and textures that designers can drop into mockups, social templates, and brand boards. Editorial mood, on-trend palettes."
        ,
      avoid: "One-off unrelated assets, mixed styles within a pack, hard-to-edit flattened files, generic stock looks, raw unedited AI output.",
    },
    envato: {
      identity: "Subscription-based powerhouse for agencies and freelancers. As of 2024 Envato Elements stopped accepting pure AI-generated stock photos through the standard route; vector graphics, patterns, templates and design assets remain the strongest categories. Photos require a human edit/composite pass before upload.",
      aesthetic: isVideo
        ? "Clean, modern, highly stable footage (corporate, tech, lifestyle, abstract backgrounds) that reads as a real production."
        : isVector
        ? "Highly organized layers, trendy commercial aesthetics (glassmorphism, clean flat, isometric), presentation-ready, looks designer-drafted."
        : "Utility-first photography: hero images with copy space, clean isolated objects, diverse lifestyle. The human touch-up before upload is mandatory.",
      avoid: "Disorganized files, messy compositions, anything that requires heavy editing by the buyer, raw unedited AI output, obvious synthetic tells.",
    },
    etsy: {
      identity: "B2C marketplace for digital downloads, wall art, and clipart. Buyers want aesthetic, beautiful, emotional, or trendy craft assets.",
      aesthetic: isVector
        ? "Cute, ornamental, watercolor-style, or trendy SVG cut-file aesthetics. Focus on craft, wedding, nursery, and seasonal themes."
        : "Aesthetic wall-art styles, moody vintage, boho, pastel, or hyper-niche artwork. Emotional and decorative value over corporate utility.",
      avoid: "Corporate/business aesthetics, sterile white-background stock, technical/IT concepts.",
    },
    wirestock: {
      identity: "Multi-agency distributor. Reviewers are extremely strict about technical quality and AI-disclosure rules. Content must be hyper-realistic.",
      aesthetic: "Absolute photorealism. Perfect lighting, zero AI artifacts, flawless anatomy (though we avoid humans), authentic textures.",
      avoid: "Slightly melted textures, impossible physics, text/watermarks, cartoon styles (unless explicitly specified as illustration).",
    },
    redbubble: {
      identity: "Print-on-demand platform for Gen-Z/Millennial apparel and stickers. Trend-driven, pop-culture adjacent, expressive. AI designs are accepted as long as you own the prompt rights and avoid trademark/IP infringement.",
      aesthetic: "Self-contained designs with clean transparent/white backgrounds. High contrast, bold colors, readable from a distance (on a t-shirt).",
      avoid: "Full-bleed photographs, messy edges, low-contrast designs, generic corporate imagery, copyrighted characters or logos.",
    },
    "123rf": {
      identity: "Mid-tier global stock marketplace. AI-generated content is officially accepted with disclosure since 2023; competitive earnings and quick review. Volume + clear, commercially-relevant subjects matter.",
      aesthetic: isVideo
        ? "Stable, well-lit, broadcast-clean clips with universal appeal."
        : isVector
        ? "Crisp vector packs (icons, patterns, infographics) with clean paths and trendy palettes."
        : "Bright, sharp, commercially versatile photography — isolated subjects, copy space, no obvious AI tells.",
      avoid: "Missing AI disclosure, low-resolution exports, third-party brand marks, melting textures.",
    },
    pixta: {
      identity: "Japan-headquartered global stock marketplace. AI content accepted since 2024 with disclosure. Strong demand for Asian and global lifestyle subjects — huge opportunity for under-supplied non-Western themes (halal, South Asian, Southeast Asian).",
      aesthetic: isVideo
        ? "Clean, professionally framed motion suitable for Japanese and global advertising; understated, story-first."
        : isVector
        ? "Crisp, polite design aesthetic; vector packs with multilingual usability and clean construction."
        : "Authentic photography with broad regional readability — lighting, environment, and props that resonate in both Asian and Western markets.",
      avoid: "Western-only stereotypes, missing AI disclosure, niche memes, low resolution, busy compositions.",
    },
    society6: {
      identity: "Print-on-demand marketplace for art prints, home goods, apparel, and decor. AI art is welcome; designs must be self-contained and reproducible across many product surfaces (mug, throw pillow, framed print, tote).",
      aesthetic: "Decorative, gallery-friendly art with strong palette discipline. Designs must hold up at small sticker scale AND large wall-art scale. Transparent or clean background friendly.",
      avoid: "Generic stock looks, photographs that lose impact when cropped to product shapes, copyrighted characters/logos.",
    },
    pixabay: {
      identity: "Free media platform with a Content Plus paid tier. AI content welcome (with disclosure). Best as an audience-builder — huge organic discovery flowing into your portfolio across the wider stock ecosystem.",
      aesthetic: isVideo
        ? "Light, social-friendly, web-ready clips with universal appeal."
        : isVector
        ? "Clean SVG-friendly vectors usable in web/blog/social."
        : "Bright, broadly usable photography — hero shots, lifestyle moments, and texture/background frames.",
      avoid: "Missing AI disclosure, niche or regional-only subjects with limited reach, watermarks/logos.",
    },
    "amazon-kdp": {
      identity: "Amazon Kindle Direct Publishing — dominant marketplace for self-published books, low-content notebooks/journals, and book-cover-grade artwork. Amazon allows AI-generated covers and interior art with disclosure, but expects a clear human curation/edit pass before publication.",
      aesthetic: isVector
        ? "Cover-grade vector art and patterns: clean lines, strong silhouette, readable at thumbnail size, scalable for paperback and hardcover trims."
        : "Cover-grade illustration / photo: strong focal subject, copy-space at top + bottom for title/author, mood that matches the book's genre, readable at Kindle thumbnail scale.",
      avoid: "Cluttered compositions, weak focal subject, designs that fail at thumbnail size, raw unedited AI output, anything resembling a real public figure or trademarked character.",
    },
  };

  const profile = profiles[targetMarket];
  if (!profile) return "";

  return `\n\n[TARGET PLATFORM: ${targetMarket.toUpperCase()} — design every ${mediumLabel} prompt to clear this platform's review bar]
- Platform identity: ${profile.identity}
- Aesthetic bar: ${profile.aesthetic}
- Avoid: ${profile.avoid}
- Subject matter: choose freely using your own commercial intuition. Identify themes that are commercially valuable AND undersupplied on this specific platform — never default to oversaturated stock clichés.`;
}

function getSpecialModeInstructions(specialMode, type, targetMarket) {
  const marketplaceGuidance = getMarketplaceGuidance(targetMarket, type);

  if (specialMode === "icon-pack") {
    const styleInstruction = type === "image"
      ? "(1) the art style (3D rendered, claymorphism, glassmorphism, isometric, realistic materials, soft lighting, etc.)"
      : "(1) the art style (flat vector, line art, solid color filled, sharp geometric, clean UI, duotone, etc.)";

    return `\n\n[SPECIAL MODE: ICON PACK GENERATOR — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING AN ICON PACK — a cohesive set of icons that belong together visually.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the THEME, INDUSTRY, and SUBJECT. You are given NO specific subject — you must INVENT the entire concept yourself. Choose ANY halal subject that exists in the world — there are no limits, no restrictions, and no suggestions. Your commercial intuition decides everything.

PROFESSIONAL ICON STANDARDS (CRITICAL — these separate amateur icons from professional ones):
- GRID ALIGNMENT: All icons must be designed as if on a 64×64 pixel grid — shapes must snap to clean edges, no fractional positioning.
- STROKE CONSISTENCY: If using outline/line style, ALL icons must use the SAME stroke weight (describe as "uniform 2pt stroke weight" or "consistent bold 3pt stroke"). Never mix thin and thick strokes within one pack.
- COLOR DISCIPLINE: Choose a STRICT palette of 3-4 colors maximum per pack. Every icon uses the SAME colors. This is what makes a pack look professional — color consistency across all icons.
- SIMPLICITY RULE: Each icon must be INSTANTLY RECOGNIZABLE at 32×32 pixels. If an icon requires zooming in to understand, it is too complex. Favor simple, bold shapes with clear silhouettes.
- CLEAN VECTOR SHAPES: Describe shapes that are SVG-friendly — geometric circles, rounded rectangles, clean curves. NO complex gradients, NO blur effects, NO photorealistic textures (these break when converted to vector).
- DUAL VARIANT AWARENESS: When describing the style, specify whether these are "filled icons" (solid shapes) or "outline/stroke icons" (line-based). Top-selling packs offer both — mention this in the prompt.

ICON PACK STRUCTURAL RULES:
- ALL icons in this batch MUST share the SAME visual language: same art style, same color palette approach, same stroke weight or 3D rendering style, same level of detail.
- Each icon must depict a DIFFERENT subject/object but they must all feel like they belong to the SAME cohesive set.
- At the start of your output, mentally decide: ${styleInstruction}, (2) the color approach (maximum 3-4 colors — e.g., "navy blue, coral orange, and white" or "monochrome charcoal gray"), (3) the industry/theme.
- Then generate EVERY icon prompt following that exact same visual system.

COMMERCIAL INSTINCT — pick ONE halal industry/theme using your own judgment:
- Use your commercial intuition to pick a category that has steady, recurring buyer demand AND room to differentiate from oversaturated packs already on marketplaces.
- BIGGER PACKS SELL MORE: 20–30 matching icons outsell a pack of 5–10. Generate prompts that suggest meaningful variety within the chosen theme.
- KEYWORD TIP: Include the exact category name in each prompt (e.g., "business icon", "medical icon") for marketplace search optimization.

PROMPT STRUCTURE FOR EACH ICON:
- Subject (what the icon depicts) + Art style + Color palette (exact colors) + Stroke/fill specification + Background ("isolated icon on pure white background" or "isolated icon on transparent background") + Grid alignment note + Simplicity level.
- Every prompt MUST specify: "isolated icon on transparent background" or "isolated icon on pure white background" — this is CRITICAL for commercial viability.

SEO & MARKETPLACE OPTIMIZATION (include in EACH prompt):
- Include the industry keyword in the prompt (e.g., "healthcare icon", "finance icon", "food delivery icon").
- Describe the icon's intended USE CASE (e.g., "for mobile app UI", "for website navigation", "for presentation slides", "for infographic").
- This helps buyers find the right icon when searching on marketplace platforms.

COMMERCIAL INTELLIGENCE:
- Icon PACKS (sets of matching icons) sell 3-5x MORE than individual icons — buyers want complete matching sets they can use across an entire project.
- Each individual icon must ALSO be commercially valuable on its own — buyers sometimes buy individual icons too.
- Each icon must be STANDALONE SELLABLE as a single PNG with transparent background AND work as part of the cohesive set.
- Think like a UI/UX designer — what icon sets would YOU pay money for?
- Choose a contemporary icon style language using your own judgment — examples include 3D with soft shadows, glassmorphism, claymorphism, isometric, or clean flat with bold colors. Pick whichever feels currently in-demand for the chosen industry; do not mix multiple styles in one pack.
- AVOID trademark/brand logos (Facebook, Instagram, etc.) — these require pixel-perfect accuracy and have legal restrictions. Focus on GENERIC CONCEPT icons instead.
HALAL: 100% strictly NO human figures, faces, hands, or body parts in any icon. Use abstract representations, objects, symbols, architecture, food, and nature elements ONLY.
${marketplaceGuidance}`;
  }

  if (specialMode === "pattern") {
    return `\n\n[SPECIAL MODE: SEAMLESS PATTERN GENERATOR — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING SEAMLESS REPEATING PATTERN PROMPTS for commercial sale on microstock platforms.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the pattern motif. You are given NO specific motif or subject — you must INVENT the entire concept yourself. Choose ANY halal pattern motif that exists — there are no limits, no restrictions, and no suggestions. Your commercial intuition decides everything.

PROFESSIONAL PATTERN STANDARDS (CRITICAL):
- SEAMLESS TILING: Every prompt MUST describe a pattern that tiles PERFECTLY in all directions. Include "seamless repeating pattern" or "seamless tileable pattern" in EVERY prompt.
- COLOR HARMONY: Specify exact color palettes (e.g., "dusty rose, sage green, and cream" or "navy, gold, and white"). Buyers search for specific color themes.
- SCALE SPECIFICATION: Always state the motif scale — "small-scale micro pattern", "medium-scale repeat", or "large-scale statement pattern". Scale determines the use case.
- DPI/RESOLUTION NOTE: Patterns for textile print need 300 DPI minimum. Mention "high-resolution, print-ready" in prompts.
- REPEAT STRUCTURE: Specify the exact repeat type: regular grid, half-drop, brick, diamond, diagonal, radial, ogee, or organic scatter.

SEAMLESS PATTERN STRUCTURAL RULES:
- Each pattern must be COMPLETELY DIFFERENT from the others — different motif, different style, different color family, different scale.
- Vary between geometric, organic/botanical, abstract, and textural patterns across the batch.

COMMERCIAL INSTINCT — pick a pattern motif/family using your own judgment:
- Choose ANY halal motif (botanical, geometric, abstract, textural, ornamental, food, architectural, calligraphic, etc.) — let your commercial intuition pick a category that has steady year-round demand AND an underserved corner you can occupy.
- Think about end use: textile/fashion, wallpaper, packaging, stationery, gift wrap, web backgrounds, ceramics. Different end uses reward different palettes (muted for home decor, vibrant for fashion, playful for nursery/kids).

PROMPT STRUCTURE FOR EACH PATTERN:
- Motif/subject (what repeats) + Pattern structure (seamless tile, half-drop, etc.) + Art style (watercolor, flat vector, hand-drawn, geometric, photorealistic texture) + Exact color palette (name 3-4 colors) + Intended use (textile, wallpaper, website background, packaging, wrapping paper) + Scale + Resolution note.

SEO & MARKETPLACE OPTIMIZATION:
- Include the pattern category keyword (e.g., "floral seamless pattern", "geometric tile pattern", "tropical leaf pattern").
- Mention the target use case (e.g., "for fabric textile printing", "for website background", "for gift wrapping paper").

COMMERCIAL INTELLIGENCE:
- Patterns sell exceptionally well for textile designers, packaging designers, and web backgrounds.
- Surface design for fashion is a massive market — think fabric, scarves, cushion covers.
- COLLECTIONS sell best: 3-5 coordinating patterns in the same color palette but different motifs.
- Neutral/muted palettes outsell neon/bright for home decor; bold/vibrant outsell for fashion.
HALAL: 100% strictly NO human figures, faces, hands, or body parts. Use plants, geometry, objects, stylized animals (if appropriate), food, architecture, calligraphy, and abstract elements ONLY.
${marketplaceGuidance}`;
  }

  if (specialMode === "sticker-pack") {
    return `\n\n[SPECIAL MODE: STICKER PACK GENERATOR — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING A STICKER PACK — a set of fun, expressive, commercially appealing sticker designs.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the THEME, CHARACTERS, and STYLE. You are given NO specific subject — you must INVENT the entire sticker concept yourself. Choose ANY halal theme — there are no limits, no restrictions, and no suggestions. Your commercial intuition decides everything.

STICKER PACK STRUCTURAL RULES (CRITICAL):
- ALL stickers in this batch MUST share the SAME character/mascot/object family and art style — they look like they belong to ONE sticker pack.
- CHARACTERS MUST BE NON-HUMAN: Use animals, food items with faces, objects with expressions, cute monsters, abstract creatures, plants with personality, or any creative non-human characters.
- Each sticker shows a DIFFERENT emotion, action, or situation but with the SAME character/mascot.
- Stickers must have CLEAN OUTLINES suitable for die-cut production.
- Every prompt MUST specify: "sticker design, die-cut style, white border outline, isolated on white background" — this is CRITICAL for commercial viability.

STICKER STYLE OPTIONS (choose ONE per pack and keep consistent):
- Kawaii/cute Japanese style — big eyes, soft colors, rounded shapes
- Cartoon/comic style — bold outlines, vibrant colors, dynamic poses
- Flat minimal — geometric shapes, limited color palette, modern aesthetic
- Watercolor — soft edges, pastel tones, artistic feel
- Chibi/SD — super-deformed cute proportions, large heads

COMMERCIAL INTELLIGENCE:
- Sticker packs sell on: Telegram, WhatsApp, iMessage, LINE, Redbubble, Etsy, Creative Market
- Sets of 8-12 matching stickers sell 5x more than individual stickers
- Expressions that sell best: happy, sad, angry, love, sleepy, excited, confused, celebrating, working, eating
- Each sticker must work at small sizes (256x256px) — keep designs SIMPLE and READABLE
HALAL: 100% strictly NO human figures, faces, hands, or body parts. Use animals, objects, food, plants, abstract creatures ONLY. Characters can have cartoon expressions but must NOT be humanoid.
${marketplaceGuidance}`;
  }

  if (specialMode === "mockup") {
    return `\n\n[SPECIAL MODE: PRODUCT MOCKUP GENERATOR — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING PRODUCT MOCKUP PROMPTS — blank product templates where buyers will place their own designs.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the PRODUCT TYPE, SETTING, and STYLING. You are given NO specific product — you must INVENT the entire mockup concept yourself. Choose ANY halal product mockup — there are no limits, no restrictions, and no suggestions. Your commercial intuition decides everything.

MOCKUP STRUCTURAL RULES (CRITICAL):
- Each prompt describes a PRODUCT in a STYLED SETTING with a BLANK/PLAIN surface where a design could be placed.
- The product surface must be described as BLANK, PLAIN, or with a PLACEHOLDER AREA — this is where buyers will overlay their own designs.
- Include realistic lighting, shadows, and environment for professional quality.
- Specify camera angle, depth of field, and background styling.

PRODUCT TYPE SELECTION - use your own commercial judgment:
- Use your intuition to identify which mockup product types have the highest buyer demand on creative marketplaces right now.
- Think across all product categories: apparel (t-shirt, hoodie, tote bag, cap), print (book cover, poster, business card, letterhead), tech (phone case, laptop skin), home (mug, pillow, wall art frame, canvas, coaster), packaging (box, label, shopping bag, bottle), and stationery (notebook, planner, greeting card).
- Vary product types across the batch - buyers want mockups for different product categories.
- Consider the context/environment that makes each mockup feel aspirational and professional.

PROMPT STRUCTURE FOR EACH MOCKUP:
- Product type + Surface description (blank/plain) + Setting/environment + Lighting + Camera angle + Background + Mood/atmosphere + Photorealistic quality specification

COMMERCIAL INTELLIGENCE:
- Mockups are among the HIGHEST-EARNING assets on Creative Market, Envato, and Freepik
- Buyers need mockups to present their designs to clients — this is a B2B market with RECURRING demand
- Clean, minimal settings sell better than cluttered ones
- Multiple angles of the same product type can be sold as a SET
HALAL: 100% strictly NO human figures, faces, hands, or body parts. Show products on surfaces, stands, tables, or floating — NEVER held by or worn on a human body.
${marketplaceGuidance}`;
  }

  if (specialMode === "social-template") {
    return `\n\n[SPECIAL MODE: SOCIAL MEDIA TEMPLATE GENERATOR — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING SOCIAL MEDIA TEMPLATE PROMPTS — background/layout designs for social media posts, stories, and covers.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the THEME, STYLE, and PURPOSE. You are given NO specific topic — you must INVENT the entire template concept yourself. Choose ANY halal theme — there are no limits, no restrictions, and no suggestions. Your commercial intuition decides everything.

SOCIAL MEDIA TEMPLATE STRUCTURAL RULES (CRITICAL):
- Each prompt describes a TEMPLATE BACKGROUND/LAYOUT — NOT a finished post. It must have CLEAR EMPTY SPACE for text overlay.
- Include TEXT PLACEHOLDER AREAS — describe regions that are intentionally left clean/minimal for buyers to add their own text.
- Specify the PLATFORM FORMAT: Instagram post (1080x1080), Instagram story (1080x1920), Facebook cover (820x312), Pinterest pin (1000x1500), LinkedIn banner (1584x396).
- Every design must be COMMERCIALLY VERSATILE — usable for multiple businesses/brands.

TEMPLATE CATEGORIES TO CONSIDER:
- Quote/motivation backgrounds — clean with text-friendly space
- Sale/promotion templates — bold colors, geometric frames, price tag areas
- Announcement templates — event, launch, news format
- Seasonal/holiday templates — festive backgrounds matching current trends
- Business/corporate templates — professional, clean, branded feel
- Food/restaurant templates — appetizing backgrounds with menu-style layouts
- Real estate templates — property showcase layouts
- Educational/infographic templates — structured content layouts

PROMPT STRUCTURE FOR EACH TEMPLATE:
- Background style + Color palette + Layout structure (where text goes) + Decorative elements + Platform format + Mood/industry + Text placeholder description

COMMERCIAL INTELLIGENCE:
- Social media templates are the FASTEST-GROWING category on Canva, Creative Market, and Envato
- Buyers are social media managers, small businesses, and influencers who need DAILY content
- Templates that work for MULTIPLE industries sell 10x more than niche-specific ones
- Include mix of formats: square posts, vertical stories, horizontal covers
HALAL: 100% strictly NO human figures, faces, hands, silhouettes, or body parts. Use abstract shapes, patterns, nature elements, objects, and geometric designs for decorative elements ONLY.
${marketplaceGuidance}`;
  }

  if (specialMode === "infographic") {
    return `\n\n[SPECIAL MODE: INFOGRAPHIC ELEMENTS GENERATOR — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING INFOGRAPHIC ELEMENT PROMPTS — data visualization components, process flows, and informational graphics.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the THEME, DATA TYPE, and VISUAL STYLE. You are given NO specific data or topic — you must INVENT the entire infographic concept yourself. Choose ANY halal business/educational topic — there are no limits, no restrictions, and no suggestions. Your commercial intuition decides everything.

INFOGRAPHIC STRUCTURAL RULES (CRITICAL):
- Each prompt describes a STANDALONE INFOGRAPHIC ELEMENT — not a complete infographic page, but a single reusable component.
- Include PLACEHOLDER TEXT descriptions (e.g., "numbered steps with placeholder text areas", "chart with sample data labels").
- Elements must be VECTOR-STYLE — clean lines, flat colors, scalable design.
- Specify the ELEMENT TYPE clearly in each prompt.

INFOGRAPHIC ELEMENT TYPES:
- Process/workflow diagrams — step 1-2-3-4 horizontal or vertical flows
- Timeline graphics — chronological event visualizations
- Comparison charts — vs/side-by-side layouts
- Statistics/number callouts — big number with supporting graphic
- Pie/donut charts — with labeled segments
- Icon + text layouts — icon grid with description areas
- Mind maps — central topic branching outward
- Hierarchy/org charts — tree structure layouts
- Cycle/loop diagrams — circular process flows
- Map-based infographics — geographic data visualization
- Checklist/to-do graphics — checkmark-style progress layouts
- Before/after comparisons — split-screen layouts

PROMPT STRUCTURE FOR EACH ELEMENT:
- Element type + Visual style (flat, isometric, gradient, minimal) + Color scheme + Layout structure + Placeholder content description + Background + Intended use

COMMERCIAL INTELLIGENCE:
- Infographic elements are in CONSTANT demand from marketers, educators, consultants, and corporate communications teams
- REUSABLE elements sell better than topic-specific ones — buyers customize with their own data
- Clean, modern, flat design style outsells everything else in this category
- Sets of matching infographic elements (same style, same colors) sell as premium bundles
HALAL: 100% strictly NO human figures, faces, hands, or body parts. Use abstract icons, geometric shapes, arrows, charts, and symbolic representations ONLY.
${marketplaceGuidance}`;
  }

  if (specialMode === "collection") {
    const collectionType = type === "vector" ? "illustrations/graphics" : type === "video" ? "stock footage clips/B-roll" : "images";
    const collectionGoal = type === "video" ? "cinematic stock footage sequence" : "visual brand kit";

    return `\n\n[SPECIAL MODE: COHESIVE COLLECTION GENERATOR — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING A COHESIVE ASSET COLLECTION — a themed set of ${collectionType} that work together as a ${collectionGoal}.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the THEME, INDUSTRY, and VISUAL APPROACH. You are given NO specific theme — you must INVENT the entire collection concept yourself. Choose ANY halal theme that exists — there are no limits, no restrictions, and no suggestions. Your commercial intuition decides everything.

COLLECTION STRUCTURAL RULES (CRITICAL):
- ALL assets in this batch MUST share: the SAME color palette (pick 3-5 core colors), the SAME mood/atmosphere, the SAME photographic/cinematic/artistic style, the SAME lighting approach.
- Each asset explores a DIFFERENT SUBJECT within the same theme — different objects, compositions, or perspectives, but all unmistakably part of ONE visual family.
- Think of this as a ${collectionGoal} — a buyer should want ALL of these for ONE project.
- Include a mix of asset types within the theme: hero/feature ${type === "vector" ? "illustrations" : type === "video" ? "clips" : "images"}, supporting detail shots, and accent/texture shots.

COMMERCIAL INTELLIGENCE:
- Collections outsell individual assets by 5-10x in microstock — buyers prefer themed sets they can use across an entire project.
- Think about what collection theme a buyer would want ALL assets from for ONE real project — that is the ideal collection.
- Maintain CONSISTENT quality — every single asset must be portfolio-worthy. One weak piece ruins the collection's appeal.
HALAL: 100% strictly NO human figures, faces, hands, or body parts. Focus on objects, nature, architecture, food, textures, patterns, landscapes, and still life ONLY.
${marketplaceGuidance}`;
  }

  if (specialMode === "surreal") {
    const styleHint = type === "image"
      ? "photorealistic surreal photography — hyper-real objects in impossible scenarios, shot with cinematic lighting and shallow depth of field"
      : "vector/illustration surreal art — clean flat or isometric style with impossible physics, whimsical compositions, bold colors";

    return `\n\n[SPECIAL MODE: SURREAL & WHIMSICAL GENERATOR — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING SURREAL/WHIMSICAL CONTENT — playful, impossible, absurd, and imaginative scenes that delight viewers.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the SUBJECT, SCENARIO, and STYLE. You are given NO specific concept — you must INVENT entirely original surreal scenes. Choose ANY halal concept — there are no limits. Your creative imagination decides everything.

WHY THIS MODE EXISTS (commercial logic):
- LOW COMPETITION: Most AI contributors flood marketplaces with generic business/nature content. Genuinely surreal, imaginative content stands out at thumbnail size.
- ANTI-REJECTION: Surreal scenes are inherently unique — each frame is one-of-a-kind, which sidesteps the "similar content" rejection that hits repetitive AI portfolios on Adobe Stock and Shutterstock.
- DURABLE DEMAND: Editorial, advertising, book-cover, poster, and social-engagement buyers consistently pay premium for imaginative imagery — this is an evergreen niche, not a passing trend.

SURREAL CONTENT RULES (CRITICAL):
- IMPOSSIBLE PHYSICS: Objects floating, melting, growing from unexpected places, defying gravity, changing scale dramatically
- UNEXPECTED COMBINATIONS: Combine two or more objects, environments, or phenomena that should never coexist. Use scale changes, impossible physics, and absurd object pairings invented entirely by your own creative imagination. The MORE unexpected and original, the BETTER - do NOT repeat common surreal tropes.
- EMOTIONAL TONE: Always POSITIVE, PLAYFUL, DELIGHTFUL — never scary, dark, or disturbing. Think "children's dream" not "nightmare."
- VIVID COLORS: Bold, saturated, eye-catching palettes. Surreal content should POP in thumbnail view.
- CLEAN COMPOSITION: Despite the absurdity, the scene must be well-composed and professionally executed.

STYLE: ${styleHint}

CREATIVE DIRECTION: Use your own imagination — combine impossible physics, unexpected object pairings, dramatic scale changes, and whimsical scenarios. The more original and surprising, the better. Do NOT repeat common surreal tropes — invent something nobody has seen before.

PROMPT STRUCTURE:
- Main subject (the impossible/absurd element) + Setting/environment + Lighting (dramatic, whimsical) + Color palette (vivid, bold) + Mood (playful, dreamy, delightful) + Style specification + Quality markers

COMMERCIAL INTELLIGENCE:
- Surreal content is used for: creative advertising, social media engagement posts, editorial illustrations, book covers, poster art, greeting cards
- EACH scene must be so visually striking that a viewer would STOP SCROLLING — this is the #1 commercial requirement
- Scenes without text work best — pure visual storytelling
- Consider seasonal surreal themes: Christmas, Ramadan, summer, autumn — surreal + seasonal = highly searchable
HALAL: 100% strictly NO human figures, faces, hands, or body parts. Use objects, animals, food, plants, architecture, nature, and abstract elements ONLY. Non-human characters (animals, objects with implied personality) are encouraged.
${marketplaceGuidance}`;
  }

  if (specialMode === "background-texture") {
    const bgStyleHint = type === "image"
      ? "photorealistic textures and backgrounds — ultra-high-resolution, seamless-compatible, print-ready quality"
      : "vector/illustration backgrounds — clean gradients, geometric patterns, abstract compositions suitable for vector conversion";

    return `\n\n[SPECIAL MODE: BACKGROUND & TEXTURE GENERATOR — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING PREMIUM BACKGROUNDS AND TEXTURES — the single most downloaded content category on Adobe Stock (25% of ALL downloads).
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the TEXTURE TYPE, COLOR SCHEME, and STYLE. You are given NO specific texture — you must INVENT entirely original backgrounds. Choose ANY halal concept — there are no limits. Your commercial intuition decides everything.

WHY THIS MODE EXISTS (TIMELESS COMMERCIAL FRAMING):
- Backgrounds, textures and patterns are one of the highest-volume, most universally licensed categories on every microstock and creator marketplace because every website, slide deck, social post, and print design needs them.
- Buyers stay loyal to creators whose backgrounds tile cleanly, scale well, and respect a coherent palette — portfolio cohesion drives repeat sales.
- Generic, plastic AI backgrounds get rejected; tactile, intentional, well-described surfaces consistently outperform.

BACKGROUND/TEXTURE BROAD CATEGORIES:
- Abstract backgrounds (gradients, geometric, fluid art, particles, waves)
- Natural textures (wood, stone, fabric, paper, metal, organic materials)
- Specialty backgrounds (holographic, neon, watercolor, sky/cloud, festive/seasonal)
- You are NOT restricted to these — choose ANY halal texture or background type your commercial instinct suggests. The more ORIGINAL and UNEXPECTED, the better.

STYLE: ${bgStyleHint}

TEXTURE QUALITY RULES (CRITICAL):
- RESOLUTION: Describe as "ultra-high-resolution, 300 DPI print-ready quality" — textures must work at large print sizes
- SEAMLESS POTENTIAL: When describing repeatable textures, include "seamless tileable" or "continuous pattern" — these sell 3x more
- COLOR VARIATION: For each texture type, vary the color palette dramatically between prompts — a marble texture in white-gold, another in dark green-gold, another in pink-gray
- CLEAN EDGES: No vignetting, no lens effects, no borders — pure texture edge-to-edge
- VERSATILE: Each background must work as: website hero, presentation background, social media backdrop, print material, packaging surface

PROMPT STRUCTURE:
- Texture/background type + Material description + Color palette (exact colors) + Surface detail level + Lighting (even, directional, dramatic) + Resolution/quality specification + Intended use + Seamless/tileable note if applicable

COMMERCIAL INTELLIGENCE:
- Backgrounds and textures have the HIGHEST reuse value — one buyer may download dozens of textures for different projects
- NEUTRAL/MUTED palettes sell best for business use; BOLD/VIBRANT for creative/social media use — include BOTH types
- SEASONAL backgrounds (festive, autumn, spring bloom) sell in massive bursts during their season
- Texture BUNDLES (5-10 matching textures in different colors) command premium pricing on Etsy and Creative Market
- "Copy space" backgrounds (with clear areas for text) are specifically searched by designers — include some with obvious text-friendly zones
HALAL: 100% compliant — backgrounds and textures inherently contain NO human elements. Focus purely on materials, abstract forms, nature elements, and geometric compositions.
${marketplaceGuidance}`;
  }

  if (specialMode === "glyph-icons") {
    return `\n\n[SPECIAL MODE: GLYPH / SOLID SILHOUETTE ICON GENERATOR — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING GLYPH ICONS — solid black, minimalist silhouette icons used heavily in business cards, contact sections, resumes, and print media.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the ICON CATEGORY. You are given NO specific category — you must INVENT the entire icon set concept yourself. Choose ANY halal category — there are no limits. Your commercial intuition decides everything.

GLYPH ICON TECHNICAL STANDARDS (CRITICAL):
- SOLID BLACK ONLY: These icons must be designed using solid black fills on a transparent or pure white background. NO outlines, NO gradients, NO colors, NO complex details.
- EXTREME SIMPLICITY: These icons are often printed at 5mm sizes on business cards. If they have internal details, the details must be created using thick negative space (cutouts) so they don't bleed when printed.
- SILHOUETTE AESTHETIC: Focus on strong, recognizable outer shapes.
- ESSENTIAL CATEGORIES: Contact info (phone, email, web, location/pin, user), social media (generic variants like 'professional network logo', 'video platform logo', 'chat bubble'), e-commerce (cart, card), or UI essentials.
- AVOID BRAND LOGOS: Do not use trademarked logos directly. Use generic equivalents.

PROMPT STRUCTURE FOR EACH GLYPH ICON:
- Icon subject + "solid black glyph icon" or "minimalist silhouette icon" + "for business card / print" + "thick negative space cutouts" + "isolated on white background" + "vector scalable".

COMMERCIAL INTELLIGENCE:
- Buyers download these by the millions for print media. The simpler and bolder, the better.
- Sets of 16, 24, or 36 related glyphs sell best.

HALAL: 100% strictly NO human figures, faces, hands, or body parts. Use abstract user silhouettes (circle + shoulders shape), geometric symbols, and functional representations ONLY.
${marketplaceGuidance}`;
  }

  if (specialMode === "t-shirt-graphic") {
    return `\n\n[SPECIAL MODE: T-SHIRT / APPAREL GRAPHIC GENERATOR — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING APPAREL GRAPHICS — highly commercial vector designs specifically created to be printed on t-shirts, hoodies, and tote bags via Print-on-Demand (POD) platforms.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the NICHE, THEME, and STYLE. You are given NO specific theme — you must INVENT the entire graphic concept yourself. Choose ANY halal theme — there are no limits. Your commercial intuition decides everything.

T-SHIRT GRAPHIC TECHNICAL STANDARDS (CRITICAL):
- SELF-CONTAINED COMPOSITION: The design must be a cohesive, standalone graphic that looks good centered on a t-shirt. No cut-off edges or full-bleed scenes.
- TRANSPARENT BACKGROUND: The design MUST be isolated on a transparent or pure black/pure white background. Mention this explicitly in every prompt.
- BOLD READABILITY: High contrast, bold shapes, and clear silhouettes. It must be readable from a distance.
- COLOR LIMIT: Limit to 3-6 bold, CMYK-safe colors to ensure it prints well on fabric. Mention the exact color palette.

T-SHIRT NICHES (COMMERCIAL DEMAND):
- Outdoor & Adventure (mountains, trees, camping, vintage badges)
- Retro / Vintage 70s-90s (sunset stripes, distressed textures, neon synthwave)
- Hobbies & Professions (coffee, coding, photography, gardening)
- Typography-focused (though we generate imagery, describe the graphic that accompanies the text)

PROMPT STRUCTURE FOR EACH GRAPHIC:
- Subject/Theme + Visual Style (retro, vintage badge, line art, detailed vector) + Color Palette + "self-contained t-shirt graphic design" + "isolated on transparent background" + "bold print-ready colors".

HALAL: 100% strictly NO human figures, faces, hands, or body parts. Use animals, nature, typography elements, objects, geometric shapes, and abstract graphics ONLY.
${marketplaceGuidance}`;
  }

  if (specialMode === "character-mascot") {
    return `\n\n[SPECIAL MODE: CHARACTER MASCOT GENERATOR — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING NON-HUMAN CHARACTER MASCOTS — expressive, stylized character logos and illustrations used by esports teams, youtube channels, tech brands, and merchandise.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the ANIMAL, OBJECT, or CREATURE and its STYLE. You are given NO specific subject — you must INVENT the entire mascot concept yourself. Choose ANY halal mascot — there are no limits. Your commercial intuition decides everything.

MASCOT TECHNICAL STANDARDS (CRITICAL):
- STRICTLY NON-HUMAN: Use animals (wolf, bear, eagle, tiger, shark), inanimate objects with personality (angry coffee mug, cool slice of pizza, flying controller), or abstract creatures/monsters.
- ESPORTS / BRAND STYLE: Thick, aggressive outlines, dynamic angles, heavy shading, and vibrant, high-contrast colors (e.g., neon green + dark grey, crimson red + gold).
- EXPRESSION: Describe the personality (fierce, aggressive, cool, cute, determined). Even objects can have expressive "eyes" or "attitudes".
- COMPOSITION: Usually a head/bust shot or a dynamic floating pose. Must be self-contained.
- BACKGROUND: "Isolated on dark background" or "isolated on white background" — ready for vector extraction.

PROMPT STRUCTURE FOR EACH MASCOT:
- Mascot subject (e.g., "fierce cybernetic wolf" or "angry taco character") + "esports logo mascot style" or "brand mascot illustration" + Color palette + Outline/Shading style (thick vector outlines, cel-shaded) + Expression/Attitude + "isolated on transparent background".

HALAL: 100% strictly NO human figures, faces, hands, or body parts. NEVER use humans. Use animals, food, everyday objects, robots, or mythological creatures (non-humanoid) ONLY.
${marketplaceGuidance}`;
  }

  if (specialMode === "web-ui-icons") {
    return `\n\n[SPECIAL MODE: WEB UI ICON SET GENERATOR — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING A WEB UI ICON SET — small, pixel-perfect icons used in website navigation bars, footers, headers, dashboards, and mobile apps.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the ICON CATEGORY and VISUAL STYLE. You are given NO specific category — you must INVENT the entire icon set concept yourself. Choose ANY halal web UI category — there are no limits. Your commercial intuition decides everything.

CRITICAL DIFFERENCE FROM "ICON PACK" MODE:
- Icon Pack = general industry icons (medical, food, travel) at 64×64 — for presentations, infographics, marketing
- Web UI Icons = TINY functional icons (16×16, 24×24, 32×32) — for actual website/app interfaces
- Web UI Icons must be PIXEL-PERFECT at tiny sizes — every single pixel matters
- These are the icons developers and designers embed directly into their website code

WEB UI ICON TECHNICAL STANDARDS (NON-NEGOTIABLE):
- PIXEL GRID: All icons must be designed on a strict 24×24 pixel grid (with 16px and 32px variants). Every line and shape snaps to full pixels — NO half-pixel positioning.
- STROKE WEIGHT: Uniform 1.5pt or 2pt stroke for ALL icons in the set. Consistency is everything.
- OPTICAL SIZE: Icons must be INSTANTLY recognizable at 16×16 pixels. If you need to squint, it's too complex.
- SVG-FIRST: Describe shapes using simple geometric primitives — circles, rectangles, lines, arcs. NO complex curves, NO gradients, NO shadows, NO blur.
- MONOCHROME BASE: Primary set must work in single color (black on transparent). Color variants are secondary.
- PADDING: Describe a consistent 2px padding/safe zone around each icon — never let elements touch the edge of the grid.
- LINE CAPS: Specify "rounded line caps and joins" or "square/butt caps" — must be consistent across ALL icons.

WEB UI ICON CATEGORIES (HIGHEST COMMERCIAL DEMAND):
- NAVIGATION: home, menu/hamburger, search/magnifying glass, back arrow, forward arrow, close/X, expand, collapse, breadcrumb, sidebar toggle
- USER ACTIONS: download, upload, share, edit/pencil, delete/trash, save/floppy, print, copy, paste, undo, redo, refresh, settings/gear
- COMMUNICATION: email/envelope, chat bubble, phone, video call, notification/bell, send/paper plane, attachment/paperclip, inbox, outbox
- MEDIA CONTROLS: play, pause, stop, skip forward, skip back, volume, mute, fullscreen, picture-in-picture, playlist, shuffle, repeat
- STATUS & FEEDBACK: checkmark/success, warning/triangle, error/circle-x, info/circle-i, loading/spinner, star/favorite, heart/like, flag, bookmark
- E-COMMERCE: shopping cart, bag, credit card, gift, coupon/tag, truck/delivery, package/box, receipt, wallet, store
- DATA & CONTENT: file, folder, image, document, spreadsheet, calendar, chart/graph, filter, sort, table, list view, grid view
- SOCIAL: generic user/avatar, group/team, globe/world, link/chain, external link, QR code, thumbs up, comment
- SECURITY: lock, unlock, shield, key, eye/visible, eye-off/hidden, fingerprint, two-factor

PROMPT STRUCTURE FOR EACH ICON:
- Icon subject (what it depicts) + Grid specification (24×24 base) + Stroke style + Line cap style + Color approach (monochrome/single color) + Background ("isolated on transparent background") + Simplicity assertion ("recognizable at 16px") + Use case hint ("for SaaS dashboard", "for e-commerce checkout", "for mobile app tab bar")

SEO & MARKETPLACE OPTIMIZATION:
- Include "web icon", "UI icon", "interface icon" in every prompt — this is what designers search for
- Mention specific use cases: "website navigation icon", "mobile app icon", "dashboard sidebar icon", "SaaS application icon"
- Target audience: web developers, UI/UX designers, SaaS companies, app developers

COMMERCIAL INTELLIGENCE:
- Web UI icon sets command premium pricing on creator marketplaces when they're large, complete, and consistent.
- Sets of 100–500 matching icons consistently outperform smaller packs because developers need full coverage — a set missing common verbs ("settings", "search", "upload") is unusable in practice.
- The most valuable icon sets ship multiple weights (thin / regular / bold) so designers can match their UI hierarchy.
- AVOID brand-specific logos (Facebook, Instagram, etc.) — use generic category representations instead.

HALAL: 100% strictly NO human figures, faces, hands, or body parts. Use abstract user silhouettes (circle + shoulders shape), geometric symbols, and functional representations ONLY.
${marketplaceGuidance}`;
  }

  if (specialMode === "clipart-bundle") {
    const clipartStyle = type === "image"
      ? "high-resolution PNG clipart with transparent background — watercolor, hand-painted, or digitally illustrated style with rich detail and artistic quality"
      : "vector clipart — clean SVG-compatible illustrations with artistic flair, suitable for both screen and print";

    return `\n\n[SPECIAL MODE: CLIPART BUNDLE GENERATOR — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING A CLIPART BUNDLE — a collection of individual decorative/artistic elements that designers, crafters, and creators buy to use in their projects.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the THEME, STYLE, and SUBJECT. You are given NO specific theme — you must INVENT the entire clipart collection yourself. Choose ANY halal theme — there are no limits. Your commercial intuition decides everything.

WHY THIS MODE EXISTS (TIMELESS COMMERCIAL FRAMING):
- Decorative clipart is one of the most enduring digital-download categories on creator marketplaces because crafters, invitation designers, scrapbookers, and social-media creators buy it constantly.
- Coordinated bundles (themed sets that share style + palette) consistently outperform individual elements because buyers are solving "design this whole thing" not "find one element".
- Wedding / floral / botanical / seasonal themes have proven year-round demand. Originality and cohesive bundles are the durable competitive advantage — not chasing any single trend.

CRITICAL DIFFERENCE FROM ICON PACK:
- Icons = functional, geometric, minimal, UI-focused (for apps/websites)
- Clipart = artistic, decorative, detailed, craft-focused (for invitations, cards, prints, scrapbooks)
- Clipart has MORE artistic detail, MORE color variation, MORE organic shapes
- Clipart is meant to be BEAUTIFUL and DECORATIVE, not just functional

CLIPART BUNDLE STANDARDS (CRITICAL):
- ISOLATED ELEMENTS: Each clipart piece must be a STANDALONE element on transparent background — "isolated [subject] on transparent background, PNG-ready"
- ARTISTIC STYLE CONSISTENCY: All elements in one bundle share the SAME art style — if watercolor, ALL watercolor; if flat vector, ALL flat vector
- COLOR HARMONY: All elements share a COORDINATED color palette — they must look beautiful when used together in one design
- HIGH RESOLUTION: "High-resolution, 300 DPI, print-ready quality" — clipart is often used for physical prints
- CLEAN EDGES: No rough edges, no artifacts, no color bleeding outside the subject

STYLE: ${clipartStyle}

EVERGREEN CLIPART CATEGORIES (illustrative — not exhaustive):
- Floral/botanical, wedding/event, seasonal/holiday, animals/wildlife (stylised), food/kitchen, celestial, vintage/retro, tropical, stationery/frames.
- These are durable starting points, not constraints. Use your own judgement and pick ANY halal clipart theme that feels undersupplied or commercially compelling — originality wins.

PROMPT STRUCTURE FOR EACH CLIPART ELEMENT:
- Subject (what it depicts) + Art style (watercolor, flat, hand-drawn, etc.) + Color palette (specific colors) + Detail level + Background ("isolated on transparent background") + Resolution ("high-resolution, 300 DPI") + Intended use (invitation, card, scrapbook, social media, etc.)

BUNDLE THINKING (CRITICAL FOR SALES):
- A bundle of 20-50 COORDINATED elements sells 5-10x more than individual pieces
- Every prompt should describe elements that BELONG TOGETHER — they share theme + style + colors
- Include a MIX of element types: main subjects + supporting decorations + borders/frames + small accents
- Think like a wedding designer: "I need the main flower, plus leaves, plus branches, plus a wreath, plus scattered petals, plus a frame" — all matching

COMMERCIAL INTELLIGENCE:
- Watercolor and hand-drawn aesthetics have very durable buyer demand in the clipart market because they feel personal and art-directed.
- Floral / botanical themes are evergreen.  Seasonal themes spike for a few weeks each year and then go quiet — plan for that.
- Different platforms support different price tiers (premium bundles vs entry-tier marketplaces).  Decide which tier you're targeting and design the bundle's polish + element count to match.
- ALWAYS describe "transparent background" — clipart without transparency is nearly worthless.

HALAL: 100% strictly NO human figures, faces, hands, or body parts. Use flowers, plants, animals, food, objects, abstract elements, celestial objects, and decorative shapes ONLY.
${marketplaceGuidance}`;
  }

  if (specialMode === "logo-element") {
    return `\n\n[SPECIAL MODE: LOGO ELEMENT & BADGE GENERATOR — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING LOGO ELEMENTS, BADGES, AND EMBLEMS — pre-designed graphic components that designers use as starting points for brand identity projects.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the INDUSTRY, STYLE, and DESIGN APPROACH. You are given NO specific industry — you must INVENT the entire logo element concept yourself. Choose ANY halal industry — there are no limits. Your commercial intuition decides everything.

WHY THIS MODE EXISTS (TIMELESS COMMERCIAL FRAMING):
- Logo / badge / emblem starter packs are an enduring top category on premium creator marketplaces because every new business and personal brand needs a mark.
- Cohesive sets that cover an industry well (icon + wordmark slot + alternate marks + monograms) sell better than one-off marks because buyers can adapt the kit to their actual identity.
- Buyers are typically small businesses, startups, and freelance designers customising for clients — they pay for quality starting points that save them hours, not finished bespoke work.

LOGO ELEMENT TYPES (choose ONE type per prompt, vary across the batch):
- MINIMAL MARKS: Clean geometric shapes (circle, triangle, hexagon) with a simple symbol inside — modern tech/startup aesthetic
- VINTAGE BADGES: Circular or shield-shaped badges with banner ribbons, laurel wreaths, and ornamental borders — brewery, bakery, outdoor/adventure brands
- LETTERMARKS: Stylized single letters or monograms within geometric frames — luxury, fashion, law firms
- EMBLEM CRESTS: Detailed crests with symmetrical elements — academic, financial, heritage brands
- MASCOT ELEMENTS: Non-human character-based marks (animal silhouettes, food mascots, abstract creatures) — playful brands, restaurants, sports
- WORDMARK FRAMES: Decorative containers/shapes designed to hold text (buyer adds their brand name) — versatile across industries
- ICON MARKS: Simple standalone symbols that work as app icons, watermarks, and social media avatars — tech, lifestyle brands
- HAND-DRAWN MARKS: Sketch-like, organic, imperfect logos — artisan, craft, organic food brands

LOGO ELEMENT TECHNICAL STANDARDS (CRITICAL):
- VECTOR-READY: Describe using clean geometric shapes, clear paths, no complex gradients — must convert to SVG perfectly
- SCALABLE: Must look perfect from 16×16 favicon to billboard size — describe elements that are simple enough for extreme scaling
- BLACK + WHITE FIRST: Primary design must work in pure black on white background — color is secondary
- SYMMETRY: Most logo elements should be symmetrical or intentionally asymmetrical — never accidentally unbalanced
- NEGATIVE SPACE: Use negative space cleverly (like the FedEx arrow or NBC peacock) — this is what separates amateur from professional logos
- NO TEXT: Describe the GRAPHIC ELEMENT only — buyer will add their own text. Include "text placeholder area" or "space below/beside for brand name"
- ISOLATED: "Isolated logo mark on white background" or "isolated emblem on transparent background"

INDUSTRY-SPECIFIC INTELLIGENCE (what sells):
- FOOD & BEVERAGE: Coffee shop marks, bakery emblems, restaurant badges, organic food seals — always in demand
- TECH & STARTUP: Minimal geometric marks, abstract connectivity symbols, circuit-inspired shapes
- OUTDOOR & ADVENTURE: Mountain/tree/compass emblems, wilderness badges, camping/hiking crests
- FITNESS & WELLNESS: Strength symbols, zen/balance marks, health-inspired geometric shapes
- REAL ESTATE: House silhouettes, key symbols, building outlines, roof-line marks
- CREATIVE AGENCIES: Paint brush elements, pencil marks, camera/lens symbols, abstract art marks
- LEGAL & FINANCE: Shield crests, column/pillar elements, scale-of-justice inspired marks, laurel wreaths

PROMPT STRUCTURE FOR EACH LOGO ELEMENT:
- Element type (minimal mark, vintage badge, etc.) + Industry/vibe + Shape description + Design details + Negative space usage + Color approach ("black and white, vector-ready") + Background + Scale note ("works from favicon to print") + Text placeholder description

COMMERCIAL INTELLIGENCE:
- Logo KITS (5-10 related logo variations + supporting elements) sell 5x more than individual marks
- Buyers want CUSTOMIZABLE elements — describe designs that are easy to modify (swap colors, add text, resize)
- Vintage/retro badges are EVERGREEN — they never go out of style
- Minimal geometric marks are the fastest-growing segment — tech companies drive this demand
- Include "mockup suggestion" — describe how the logo might look on a business card or storefront
- AVOID over-complexity — the best logos are the simplest ones. If you can't draw it from memory, it's too complex.

HALAL: 100% strictly NO human figures, faces, hands, or body parts. Use animals (silhouettes), objects, geometric shapes, nature elements (leaf, mountain, tree, wave), food items, and abstract symbols ONLY.
${marketplaceGuidance}`;
  }

  if (specialMode === "brand-icons") {
    return `\n\n[SPECIAL MODE: BRAND-STYLE ICON GENERATOR — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING BRAND-STYLE ICONS — the type of polished, recognizable icons used by social media platforms, mobile apps, SaaS products, fintech companies, and tech brands.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the ICON CATEGORY and VISUAL APPROACH. You are given NO specific brand — you must INVENT entirely original brand-style icon concepts. Choose ANY halal category — there are no limits. Your commercial intuition decides everything.

WHY THIS MODE EXISTS (TIMELESS COMMERCIAL FRAMING):
- Brand-style icons are among the HIGHEST-VALUE vector assets on every marketplace because designers, startups, and agencies constantly need professional app-icon-grade graphics for client presentations, pitch decks, UI mockups, and branding projects.
- Generic, non-trademarked brand-style icons sidestep legal risk while filling the exact visual niche buyers search for — "social media icon set", "app icon pack", "fintech icon collection".
- Unlike simple UI icons (16-24px functional glyphs), brand-style icons are LARGE (512×512 to 1024×1024), richly detailed, and visually striking — they are mini works of art.

CRITICAL TRADEMARK SAFETY RULES (NON-NEGOTIABLE):
- NEVER use real brand names (Facebook, Instagram, GitHub, Twitter/X, TikTok, Snapchat, WhatsApp, Spotify, Netflix, etc.) in any prompt.
- NEVER describe exact copies of real brand logos or their distinctive visual elements.
- Instead, describe GENERIC CONCEPT icons that represent the CATEGORY: "social media platform icon", "video streaming service icon", "code repository icon", "photo sharing app icon", "instant messaging app icon", "music streaming icon", "short-form video app icon".
- This approach is 100% marketplace-safe and buyers PREFER generic versions they can use without trademark concerns.

BRAND-STYLE ICON CATEGORIES - choose using your own commercial judgment:
- Use your intuition to identify which app categories are experiencing growth, have many active buyers in design marketplaces, and are underserved by existing icon sets.
- Think about the full spectrum of digital products: social, communication, productivity, fintech, e-commerce, entertainment, developer tools, health, education, creative tools, and emerging categories.
- Include a mix of established high-demand categories AND emerging/growing app categories - emerging categories have less competition.
- Each icon in the batch should represent a DIFFERENT app category, giving buyers broad coverage for pitch decks and presentations.

BRAND-STYLE ICON TECHNICAL STANDARDS (CRITICAL):
- SIZE: Large format — 512×512 or 1024×1024 pixel canvas. These are NOT tiny UI icons — they are richly detailed app-icon-grade graphics.
- SHAPE: Rounded square (iOS app icon style), circle, or squircle — describe the container shape explicitly.
- DEPTH & POLISH: Include subtle gradients, soft shadows, 3D-like depth, glass/glossy effects, or material design elevation — these icons must look PREMIUM and POLISHED.
- COLOR: Bold, saturated, distinctive brand-palette colors. Each icon should have its OWN signature color scheme (e.g., deep purple + electric blue, coral + warm white, emerald + gold).
- CENTRAL SYMBOL: A single, clear, bold symbol/glyph centered in the icon that instantly communicates the app's purpose.
- BACKGROUND: The icon's own colored background within the rounded square — NOT on a separate background. Describe as "app icon with [color] gradient background, rounded square shape".
- CONSISTENCY: All icons in a batch should share the same design language (same shadow depth, same corner radius style, same level of detail) but each has its OWN unique color palette and symbol.

PROMPT STRUCTURE FOR EACH BRAND ICON:
- App category (what it represents) + Container shape (rounded square, circle) + Central symbol description + Color palette (2-3 bold colors) + Visual effects (gradient, shadow, gloss, depth) + Design style (flat, skeuomorphic, glassmorphism, neomorphism, material design) + Size specification (512×512 or 1024×1024) + Quality markers ("professional app icon", "brand-quality")

SEO & MARKETPLACE OPTIMIZATION:
- Include "app icon", "brand icon", or "platform icon" in every prompt — this is what designers search for.
- Mention the generic category: "social media app icon", "fintech app icon", "SaaS platform icon"
- Target audience: UI designers, startup founders, pitch deck creators, brand identity designers, mobile app developers

COMMERCIAL INTELLIGENCE:
- Brand-style icon SETS (10-20 matching icons across categories) command premium pricing because buyers need a complete visual language for pitch decks and presentations.
- Startups and agencies are the primary buyers — they need generic "placeholder" app icons for mockups, wireframes, and investor presentations.
- Icons that look like they COULD be a real app (but aren't copying any specific brand) are the sweet spot — professionally polished but legally clean.
- The MOST valuable icons combine: (1) instant category recognition, (2) premium visual polish, (3) distinctive color identity, (4) scalability from 64px to 1024px.
- Include a mix of established categories (social, messaging, payments) and EMERGING categories (AI tools, Web3, creator economy, health tech) — emerging categories have less competition.

HALAL: 100% strictly NO human figures, faces, hands, or body parts in any icon. Use abstract symbols, geometric shapes, objects, nature elements, and conceptual representations ONLY.
${marketplaceGuidance}`;
  }

  if (specialMode === "wall-art") {
    const artStyle = type === "image"
      ? "photorealistic or digital art quality — gallery-worthy, frame-ready, museum-grade aesthetic with rich color depth and artistic sophistication"
      : "vector/illustration wall art — clean artistic style suitable for high-resolution printing, bold shapes and deliberate color palettes";

    return `\n\n[SPECIAL MODE: PRINTABLE WALL ART GENERATOR — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING PRINTABLE WALL ART — digital art prints that buyers download, print, and hang on their walls in frames.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the SUBJECT, STYLE, and AESTHETIC. You are given NO specific subject — you must INVENT entirely original art prints. Choose ANY halal concept — there are no limits. Your artistic vision decides everything.

WHY THIS MODE EXISTS (TIMELESS COMMERCIAL FRAMING):
- Printable wall art is one of the most enduring digital-download categories on print-on-demand and creator marketplaces. Buyers want art they can download and print themselves — zero shipping, instant gratification.
- Matching SETS (especially sets of 3 or 5 designed to hang together) consistently command premium pricing because they solve "what do I put on this wall?" in one purchase.
- Sellable wall art has near-zero unit cost — create once, license unlimited times. Quality, originality, and cohesive sets are the durable competitive advantages, not any specific season or trend.
- The home-decor audience is broad and recurring. Concentrate on art that looks beautiful in a real home from across a room.

WALL ART CATEGORIES:
- Minimalist line art, botanical/nature, abstract, landscape/scenery, vintage/retro, celestial, geometric, seasonal themes, neutral earth tones — all sell well.
- You are NOT restricted to these — choose ANY halal wall art subject and style your artistic vision suggests. The more ORIGINAL your concept, the less competition you face.

STYLE: ${artStyle}

WALL ART TECHNICAL STANDARDS (CRITICAL):
- ASPECT RATIOS: Standard frame sizes — describe art that works at 2:3 (4×6, 8×12, 16×24), 3:4 (6×8, 9×12), 4:5 (8×10, 16×20), and 1:1 (square). Mention the intended ratio.
- RESOLUTION: "Ultra-high-resolution, 300 DPI minimum, suitable for large format printing up to 24×36 inches"
- MARGINS: Describe art with clean edges — no elements running off the edge unless intentional (full-bleed)
- COLOR ACCURACY: Describe colors that will look good printed on paper — avoid neon/screen-only colors that don't print well
- SIMPLE COMPOSITION: Wall art should have a clear focal point and balanced composition — it must look good from across a room

GALLERY WALL SET STRATEGY (PREMIUM PRICING):
- Generate prompts that create MATCHING SETS of 3-5 prints that look beautiful TOGETHER on one wall
- Sets should share: same color palette, same art style, same visual weight, but different subjects
- Example set: "3 botanical prints — monstera leaf, eucalyptus branch, palm frond — all in sage green and cream, minimalist watercolor style"
- Gallery wall sets sell for 3-5x the price of individual prints

PROMPT STRUCTURE FOR EACH ART PRINT:
- Subject matter + Art style + Color palette (specific colors that print well) + Composition description + Aspect ratio + Mood/atmosphere + Interior design context ("for Scandinavian living room", "for boho bedroom") + Quality markers ("gallery-quality", "museum-grade print") + Resolution note

COMMERCIAL INTELLIGENCE:
- NEUTRAL PALETTES sell most for home decor: beige, sage, terracotta, cream, dusty rose, warm gray, olive
- Minimalist/simple outsells complex/busy for wall art — people want calming art on their walls
- "Set of 3" is the magic number — always think in sets of 3 matching prints
- Vertical/portrait orientation outsells landscape for wall art (most frames are vertical)
- Season matters: autumn/warm prints sell Aug-Nov, spring/fresh prints sell Feb-Apr
- The art must be BEAUTIFUL enough that someone would PAY to print and frame it — this is the highest quality bar of any mode

HALAL: 100% strictly NO human figures, faces, hands, or body parts. Use nature, plants, abstract shapes, landscapes, celestial objects, geometric forms, food, architecture, and natural textures ONLY.
${marketplaceGuidance}`;
  }

  if (specialMode === "aerial-drone" && type === "video") {
    return `\n\n[SPECIAL MODE: AERIAL / DRONE / FPV CINEMATOGRAPHY — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING AERIAL DRONE SHOTS — sweeping, cinematic footage taken from high above or flying rapidly through environments. This is extremely high-value on stock video platforms because it is expensive and difficult to shoot in real life.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the LOCATION and VIBE. Choose ANY halal location — there are no limits. Your commercial intuition decides everything.

AERIAL/DRONE TECHNICAL STANDARDS (CRITICAL):
- CAMERA MOVEMENT (MANDATORY): Every prompt MUST describe specific aerial motion. Use terms like: "sweeping drone shot", "FPV fly-through", "top-down bird's-eye view tracking", "slow orbit around", "rising reveal shot", or "fast low-altitude skimming".
- SCALE AND SCOPE: Highlight the vastness of the scene. Mention tiny details on the ground (cars, waves, trees) to establish massive scale.
- LIGHTING: Aerial shots demand dramatic lighting. "Golden hour long shadows", "volumetric fog rolling over mountains", "neon cyberpunk city glow at night".
- HIGH DEMAND NICHES: Untouched nature (glaciers, deep forests, dramatic cliffs), futuristic/cyberpunk cities, massive agricultural fields, or hyper-modern architecture.

PROMPT STRUCTURE: "Aerial drone shot" + Subject/Location + Specific camera motion + Altitude/Angle (high altitude, low-flying FPV, top-down) + Lighting/Atmosphere + Speed (slow cinematic, fast FPV).

HALAL: 100% strictly NO human figures, faces, hands, or body parts. Focus entirely on landscapes, cityscapes, vehicles (cars/boats from far away), and vast environments.
${marketplaceGuidance}`;
  }

  if (specialMode === "macro-cinematic" && type === "video") {
    return `\n\n[SPECIAL MODE: EXTREME MACRO / MICROSCOPIC CINEMATOGRAPHY — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING EXTREME MACRO FOOTAGE — ultra close-up, highly detailed video of textures, fluids, particles, and small objects. AI video models excel at fluid dynamics and textures, making this a top-selling category.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the MATERIAL. Choose ANY halal material — there are no limits. Your commercial intuition decides everything.

MACRO TECHNICAL STANDARDS (CRITICAL):
- EXTREME PROXIMITY: The camera is inches or millimeters away. "Extreme macro close-up", "microscopic view".
- TEXTURE & DYNAMICS (MANDATORY): Describe how the material behaves. "Slowly blooming ink in water", "coffee beans cascading", "frost crystallizing on glass", "magnetic ferrofluid spiking", "honey dripping over textured stone".
- DEPTH OF FIELD: Always describe "extremely shallow depth of field, creamy bokeh background". Only a tiny slice of the subject is in sharp focus.
- LIGHTING: Macro requires dramatic, directional lighting. "Backlit macro", "sharp rim light reflecting off liquid", "iridescent glow".

PROMPT STRUCTURE: "Extreme macro close-up" + Subject/Material + The specific motion/fluid dynamics + Depth of Field note + Lighting setup.

HALAL: 100% strictly NO human figures, faces, hands, or body parts. NO human eyes or skin close-ups. Use ONLY fluids, food, nature (leaves, ice, minerals), abstract particles, and inanimate objects.
${marketplaceGuidance}`;
  }

  if (specialMode === "product-showcase" && type === "video") {
    return `\n\n[SPECIAL MODE: PRODUCT SHOWCASE / ADVERTISING CINEMATOGRAPHY — COMMERCIAL MICROSTOCK SALE]
YOU ARE GENERATING COMMERCIAL PRODUCT FOOTAGE — high-end, studio-lit advertising shots of generic products. Brands, agencies, and dropshippers use these to cut into their own commercials.
CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the GENERIC PRODUCT and the STUDIO SETUP. Choose ANY halal product — there are no limits. Your commercial intuition decides everything.

PRODUCT SHOWCASE TECHNICAL STANDARDS (CRITICAL):
- GENERIC PRODUCTS ONLY: Do NOT use real brand names (no Apple, Nike, etc). Use "generic elegant perfume bottle", "sleek modern smartwatch", "minimalist skincare jar", "premium coffee bag", "futuristic headphones".
- COMMERCIAL CAMERA MOVEMENT: "Slow dramatic orbit", "smooth slider tracking shot", "macro pan across the surface", "product rotating on a pedestal".
- STUDIO LIGHTING: Describe high-end advertising lighting. "Dramatic chiaroscuro", "softbox overhead lighting", "colored neon rim lights", "water ripples reflecting light onto the product".
- BACKGROUND: "Clean studio backdrop", "dramatic dark environment", "surreal minimal pedestal", or "natural lifestyle setting".

PROMPT STRUCTURE: "Commercial product shot" + Generic Product Description + Environment/Pedestal + Lighting Setup + Specific Camera Movement (orbit, pan, tilt).

HALAL: 100% strictly NO human figures, faces, hands, or body parts. NO hands holding the product. The product must be resting on a surface, floating, or rotating mechanically.
${marketplaceGuidance}`;
  }

  if (specialMode === "b-roll" && type === "video") {
    return `\n\n[SPECIAL MODE: B-ROLL / SUPPORTING FOOTAGE]
Generate cinematic B-roll prompts — establishing shots, cutaways, ambient details, and texture footage that editors splice between main scenes. Each clip must be self-contained, atmospheric, and visually rich enough to stand alone.

CORE TRAITS: short (3-8s) tight clips · clear focal subject · steady or slow camera · no dialogue / no on-screen text · evocative not narrative · works as cutaway in any longer edit.

VARY across the batch: location type, time of day, motion technique, and subject - use your own cinematic commercial judgment to choose subjects that real editors actively search for when buying B-roll.

PROMPT STRUCTURE: subject + setting/atmosphere + camera language + lighting + mood + duration hint. Reference the aspect ratio and duration the user specified.
${marketplaceGuidance}`;
  }

  if (specialMode === "loopable" && type === "video") {
    return `\n\n[SPECIAL MODE: SEAMLESS LOOPABLE CLIP]
Generate prompts for seamlessly looping video clips — first frame and last frame must match perfectly so the clip can repeat indefinitely without a visible cut. Used for stickers, backgrounds, GIFs, web hero loops, and kiosk displays.

CORE TRAITS: continuous repetitive motion (rotation, oscillation, breathing, drift, particle flow) · steady framing · no transitions or cuts · 2-6s typical length · matched start/end state.

GOOD LOOP CONCEPTS: rotating objects, drifting clouds, flowing water, blooming/morphing shapes, pulsing lights, orbiting elements, abstract gradients, particle systems, mechanical mechanisms. AVOID one-shot events that don't naturally cycle.

PROMPT STRUCTURE: looping subject + describe the cycle motion + start/end-frame matching language + visual style + color palette + duration. Always include the phrase "seamlessly loopable, first frame matches last frame".
${marketplaceGuidance}`;
  }

  if (specialMode === "vertical" && type === "video") {
    return `\n\n[SPECIAL MODE: VERTICAL 9:16 — REELS / SHORTS / TIKTOK / STORIES]
Generate vertical-native video prompts framed for 9:16. The composition must put the subject in the upper-middle of the frame (where phone hands and captions don't cover it) and use vertical motion.

CORE TRAITS: 9:16 aspect ratio · subject vertically centered · motion that benefits from tall frame (waterfalls, skyscrapers, full-body subjects, top-down food shots, walking/running, slow vertical pan) · phone-watcher pacing (hook in first 1s) · 5-15s typical length.

VARY across the batch: use your commercial intuition to identify which vertical video micro-genres are most actively purchased by social media creators and brands right now - think about what buyers of 9:16 content actually need. AVOID horizontal-first composition that gets cropped weirdly.

PROMPT STRUCTURE: vertical subject + 9:16 composition note + camera motion + lighting + sensory mood + intended platform feel.
${marketplaceGuidance}`;
  }

  if (specialMode === "time-lapse" && type === "video") {
    return `\n\n[SPECIAL MODE: TIME-LAPSE]
Generate time-lapse prompts — fast-forwarded footage compressing minutes/hours/days into a few seconds of dramatic change. Highest commercial demand for stock cinematic openers and explainer B-roll.

CORE TRAITS: locked-off camera (or controlled hyperlapse motion) · visible accelerated change (light, weather, traffic, growth, construction, crowds) · dramatic before→after arc within the clip · 4-12s typical length.

SUBJECT SELECTION: Use your cinematic commercial intuition to identify time-lapse subjects with the most dramatic and visually compelling transformations. Think about what real documentary filmmakers, advertisers, and broadcast producers actively search for and license. CHOOSE ONE strong central transformation per prompt.

PROMPT STRUCTURE: subject + transformation arc + start state → end state + camera (locked-off / hyperlapse) + lighting change + duration. Mention "time-lapse" and the rough real-world duration being compressed.
${marketplaceGuidance}`;
  }

  if (specialMode === "slow-motion" && type === "video") {
    return `\n\n[SPECIAL MODE: SLOW-MOTION]
Generate dramatic slow-motion prompts — high-frame-rate footage of fast events played back slowly to reveal detail, texture, and emotion invisible at normal speed.

CORE TRAITS: high-speed capture (240-1000fps look) · single hero moment + impact · macro or close-up framing · crisp directional lighting that shows detail · 3-8s typical length.

SUBJECT SELECTION: Use your commercial creative judgment to identify subjects whose fast natural motion becomes visually extraordinary at high frame rates - phenomena that are invisible or unremarkable at normal speed but become stunning in slow-motion. AVOID slow ambient motion that gains nothing from slow-mo.

PROMPT STRUCTURE: hero subject + the fast event + slow-motion framing + macro/close-up note + lighting that highlights texture + duration. Include phrases like "ultra slow-motion, 480fps capture, every droplet visible".
${marketplaceGuidance}`;
  }

  if (specialMode === "motion-graphics" && type === "video") {
    return `\n\n[SPECIAL MODE: MOTION GRAPHICS]
Generate motion-graphics prompts — animated typography, kinetic icons, infographic reveals, and abstract design clips. NOT photorealistic footage — these are designed/illustrated motion pieces with a clear graphic style.

CORE TRAITS: flat or 3D-rendered design aesthetic · clean color palette (2-4 colors max) · type-driven or icon-driven · smooth easing curves · solid or geometric backgrounds · 4-10s typical length.

USE CASE SELECTION: Use your commercial judgment to identify motion graphics use cases with the strongest buyer demand - think about what motion designers, video editors, and marketing teams actively search for and purchase. Specify a clear graphic style for each prompt (flat 2D, isometric, 3D-rendered, paper cutout, glitch, retro 80s, minimal modernist) and vary styles across the batch.

PROMPT STRUCTURE: graphic style + animated subject (text/icon/shape/data) + motion description (slide, morph, bounce, type-on, particle reveal) + color palette + duration + intended use. ALWAYS include "motion graphics, designed animation, not live-action footage".
${marketplaceGuidance}`;
  }


  if (specialMode === "print-on-demand") {
    return `\n\n[SPECIAL MODE: PRINT-ON-DEMAND (POD) DESIGN GENERATOR — COMMERCIAL MICROSTOCK + POD PLATFORMS]
YOU ARE GENERATING DESIGNS FOR PRINT-ON-DEMAND PRODUCTS — T-shirts, hoodies, mugs, tote bags, phone cases, throw pillows, wall tapestries, notebooks, and stickers sold on Redbubble, Merch by Amazon, Society6, Printful, Zazzle, and Teepublic.

CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose the subject, style, and theme. Be highly creative and original — you are not given a specific concept, so INVENT compelling POD designs that buyers will want to wear or display.

WHY POD DESIGNS SELL (COMMERCIAL INTELLIGENCE):
- POD is a $10B+ market growing 25% annually. The sweet spot is DESIGN that works on BOTH a product AND a flat art print.
- Buyers want: bold, eye-catching, conversation-starting graphics. NOT subtle, NOT complex, NOT photo-realistic textures.
- Simple, bold designs (3-5 colors max) are the top sellers because they print cleanly on fabric and don't fade into a mess.
- Niche audiences (cat lovers, hiking fans, coffee addicts, book lovers, plant moms) outperform "general appeal" designs 10:1.
- Text-free or minimal-text designs are more versatile (no localization issues, no copyright concerns).

POD DESIGN TECHNICAL REQUIREMENTS (CRITICAL FOR ACCEPTANCE):
- BACKGROUND: ALWAYS pure white (#FFFFFF) or transparent background — products cannot have colored backgrounds unless the color is part of the design itself.
- RESOLUTION: Minimum 300 DPI, at least 4500×5400px (or equivalent) for full-size T-shirt print.
- COLORS: Maximum 4-6 spot colors. CMYK-safe palette — avoid neon/electric colors that don't print accurately.
- ISOLATION: The design element must be clearly isolated from the background — crisp, clean edges.
- COMPOSITION: Graphic must work as a self-contained design unit — balanced, centered, intentional negative space.
- NO TEXT unless it is extremely simple, bold, and a deliberate part of the design concept.

COMMERCIAL STRATEGY - use your own creative-commercial intuition:
- Identify a specific niche audience with high buyer intent and genuine passion or identity they want to express visually.
- Determine what VISUAL LANGUAGE that niche responds to - illustration, vintage badge, minimalist geometric, botanical art, abstract print, retro, kawaii, etc.
- Ask: "Would someone buy this because it represents THEM specifically?" If yes, strong POD concept.
- Prioritize EVERGREEN appeal - designs that sell equally well today AND two years from now without becoming dated.
- Every prompt in the batch MUST target a completely different niche, style, and buyer persona.

PROMPT STRUCTURE FOR EACH POD DESIGN:
Niche/concept + Graphic style (flat vector, bold graphic, vintage engraving, watercolor, geometric, etc.) + Color palette (max 5 CMYK-safe colors) + Composition (centered, isolated on white) + Print quality (300 DPI, clean edges) + Product suitability note + Mood/personality

HALAL: 100% strictly NO human figures, faces, hands, or body parts. All designs must feature animals, objects, nature, abstract shapes, geometric forms, food, or patterns ONLY.
${marketplaceGuidance}`;
  }

  if (specialMode === "seasonal") {
    const now = new Date();
    const month = now.getMonth(); // 0-indexed
    const year = now.getFullYear();
    let seasonalContext = "";
    if (month >= 2 && month <= 4) seasonalContext = "Spring is here — cherry blossoms, fresh greens, rain, renewal, Easter, spring flowers, gardening, pastel colors, birds, fresh beginnings. Also: spring cleaning, allergies, fresh markets, Holi festival.";
    else if (month >= 5 && month <= 7) seasonalContext = "Summer season — beach, sunshine, tropical fruits, ice cream, vacation, sunsets, palm trees, travel, outdoor dining, sunflowers, bright warm colors, barbecue, watermelon, sea shells.";
    else if (month >= 8 && month <= 10) seasonalContext = "Autumn/Fall — pumpkins, fall leaves, warm ochre/rust/burgundy colors, harvest, apple picking, cozy interiors, mushrooms, acorns, Thanksgiving, Halloween-adjacent (non-horror), warm drinks, wool textures.";
    else seasonalContext = "Winter / Holiday season — snow, pine trees, cozy indoor settings, warm lights, stars, geometric winter patterns, warm beverages, fireplaces, Northern lights, Eid al-Fitr (early in Islamic calendar), Islamic New Year, winter wildlife.";

    // Islamic calendar awareness
    const islamicNote = "ISLAMIC CALENDAR PRIORITY: Ramadan, Eid al-Fitr, and Eid al-Adha are the HIGHEST-DEMAND seasonal events for halal-friendly stock content with relatively low AI competition. Use your commercial intuition to generate compelling Islamic seasonal imagery that buyers actively search for on global marketplaces — gold/deep green/teal/purple/cream are the dominant festive color families.";

    return `\n\n[SPECIAL MODE: SEASONAL & FESTIVE CONTENT GENERATOR — TIMED COMMERCIAL PEAKS]
YOU ARE GENERATING SEASONAL AND FESTIVE CONTENT — imagery that buyers need at specific times of year for greeting cards, social media, marketing campaigns, home decoration, and digital gifts.

CREATIVE FREEDOM: You have ABSOLUTE CREATIVE FREEDOM to choose which seasonal theme, which festival, and which visual approach. Mix timeless seasonal subjects (autumn leaves, spring flowers) with specific festive occasions for maximum range.

WHY SEASONAL CONTENT IS A PROVEN REVENUE STRATEGY:
- Seasonal content creates BURST SALES: a Ramadan design uploaded once generates downloads every year for the lifetime of the account.
- Most contributors neglect seasonal content — this means LESS competition at HIGH demand windows.
- Buyers URGENTLY need seasonal content (they wait until the last 2-3 weeks before a holiday). Evergreen seasonal content (e.g., autumn trees) sells year-round; event-specific content (e.g., Eid lanterns) sells intensely for 4-6 weeks.
- Platform search for seasonal terms spikes 300-700% in the weeks before major events.

CURRENT SEASONAL CONTEXT: ${seasonalContext}

${islamicNote}

TOP SEASONAL THEMES TO GENERATE (choose the most commercially interesting mix):
ISLAMIC HOLIDAYS (HIGH-VALUE, LOW-COMPETITION): Ramadan lanterns, crescent & star patterns, Eid gift arrangements, mosque silhouettes, Arabic geometric patterns, Islamic calligraphy-inspired abstract art, Eid-al-Adha livestock-free celebratory patterns.
SPRING: Cherry blossom, tulips, Easter eggs (empty decorative), spring bird, garden harvest, fresh rain.
SUMMER: Tropical fruit, beach items, sunflower, hot air balloon, ice cream cone, summer sunset, sea shells.
AUTUMN/FALL: Pumpkin patch, colorful fallen leaves, harvest baskets, mushrooms, pine cones, warm beverages.
WINTER: Snowflake patterns, pine branch, winter aurora, cozy flat-lay, geometric holiday ornament, hot chocolate.
YEAR-ROUND EVERGREEN: New Year fireworks (abstract), birthday celebration elements (no people), graduation caps and books, nature at every season change.

TECHNICAL REQUIREMENTS:
- High commercial quality — these will be used for greeting cards, social posts, marketing banners.
- Warm, festive color palettes: deep emerald, gold, cream, burgundy, cobalt, teal, terracotta.
- Provide a mix of: atmospheric scenes (wide), close-up detail shots (product/object level), and flat-lay graphic arrangements.
- Works as both standalone stock image AND part of a themed pack.

PROMPT STRUCTURE FOR EACH SEASONAL IMAGE:
Season/occasion + Hero subject(s) + Festive atmosphere description + Color palette (specific, warm, festive) + Lighting (warm golden light, candle glow, winter cool blue) + Composition style (overhead flat-lay / close-up / wide atmospheric) + Commercial use context (greeting card, social media, home decor) + Quality markers

HALAL: 100% strictly NO human figures, faces, hands, or body parts. Use objects, nature, decorations, architecture, patterns, and symbolic elements ONLY.
${marketplaceGuidance}`;
  }

  return "";
}

function buildDiverseUserPrompt(concept, { autoMode = false, autoCategory = "", autoContext = "", type = "image", engineerMode = false, targetMarket = "all", specialMode = "", halalMode = true } = {}) {
  // Generate a cryptographically strong mathematical seed for the AI to base its generation on
  const cryptoSeed = Math.random().toString(36).substring(2, 12).toUpperCase();
  const timeSeed = Date.now().toString().slice(-6);
  const mathSeed = `${cryptoSeed}-${timeSeed}`;

  const marketplaceGuidance = getMarketplaceGuidance(targetMarket, type);

  // Absolute freedom instruction
  const diversityHint = `ABSOLUTE FREEDOM SEED: [${mathSeed}]
Use this unique cryptographic seed to anchor your creative process. 
You are not bound by any predefined lists, eras, regions, or styles. 
Invent a completely unique combination of:
- Era and cultural region
- Lighting and atmospheric mood
- Camera angles, composition, or artistic style
Draw from your entire infinite latent space to create something commercially viable but never seen before.
${marketplaceGuidance}`;

  const contextHint = autoContext ? `\nCreative direction: ${autoContext}` : "";

  const simpleGuidance = type === "video"
    ? `- Every prompt MUST describe a scene with inherent MOTION and temporal change — things moving, flowing, changing, growing, or transforming over time.
- Include specific camera movements (dolly, crane, tracking, orbit) and describe the motion within the scene itself.
- Avoid static compositions — stock video buyers need dynamic content with visual energy.`
    : type === "vector"
      ? `- Every prompt MUST describe content suitable for VECTOR illustration — clean lines, solid flat color fills, scalable graphics.
- Focus on commercially versatile vector art — clean, simple, and scalable for web, print, and app use.
- Avoid photographic realism — vector art must be clean, simple, and commercially versatile for web, print, and app use.
- Specify art style (flat, isometric, line art, geometric, hand-drawn, etc.) and intended use case.`
      : `- Every prompt MUST describe a photographically compelling scene with specific lighting, composition, and mood.
- Include camera angle, depth of field, color palette, and environment details.
- Focus on images that work as stock photos: versatile compositions with copy space, clean backgrounds, and universal appeal.`;

  const engineerGuidance = type === "video"
    ? `- Follow this prompt structure: [Subject + Action] + [Setting] + [Camera Movement] + [Lighting] + [Color Grade] + [Atmosphere] + [Quality].
- Every prompt MUST describe a scene with inherent MOTION and temporal change — things moving, flowing, changing, growing, or transforming over time.
- Include SPECIFIC camera movements using professional terms (dolly, crane, tracking, orbit, steadicam, FPV, drone ascending, slider, jib, time-lapse, hyperlapse).
- Describe the scene's natural flow: wind through leaves, water rippling, light shifting, shadows moving, clouds drifting, flames flickering, steam rising, rain falling.
- Specify atmosphere and mood: misty, crisp, hazy, moody, warm, cold, ethereal, dramatic.
- Include quality modifiers: 4K cinematic, slow motion 120fps, natural motion, realistic physics, shallow depth of field.
- LENS & FORMAT: name a real lens/format when it sharpens the brief — anamorphic 2.39:1, ARRI Alexa, RED Komodo, Blackmagic 6K, vintage Cooke S4, 35mm prime, 50mm macro, 24mm wide. Match the format to the buyer (broadcast, web hero, social).
- FRAME RATE INTENT: state the frame-rate purpose — 24fps cinematic, 30fps broadcast, 60fps smooth motion, 120fps super slow-mo, time-lapse, hyperlapse. Frame rate is part of the look, not a footnote.
- COLOR GRADE: specify a grade/LUT vibe when it elevates the scene — teal-and-orange blockbuster, bleach-bypass desaturated, Kodak 2383 print, Fuji Eterna, warm sunset wash, cool morning haze, neutral commercial. Avoid generic "vibrant".
- AUDIO-FRIENDLY CONTEXT: even though we generate visual prompts, briefly hint at the implied sound world (gentle ambience, footsteps, wind, rain, machinery, market chatter). Models that support sound use it; models that don't simply ignore it — there is no downside.
- ASPECT-RATIO INTELLIGENCE: pick a primary aspect ratio that fits the buyer use-case — 16:9 hero / broadcast, 9:16 Reels / TikTok / Shorts, 1:1 grid post, 4:5 feed, 2.39:1 cinematic, 21:9 ultrawide. Compose for that ratio, do not just crop.
- LOOPABLE CLIPS: where the action allows, design a seamless loop (start frame matches end frame) — these are premium for website backgrounds, kiosk displays and corporate decks.
- CULTURAL BREADTH (HALAL): vary regions, environments and palettes (Mediterranean coast, Southeast Asian rainforest, Andean highlands, Nordic fjords, Gulf desert dunes, East African savanna, Levantine olive groves) without leaning on tired stereotypes. Always halal-safe — no human faces, no figures, no national flags or religious symbols on people.
- Avoid static compositions — stock video buyers need dynamic content with visual energy.
- Focus on content with HIGH COMMERCIAL DEMAND — use your intuition to choose categories that real buyers actively search for and license.
- Each video prompt must feel like a scene a real production company would shoot for a commercial client — the kind of footage used in TV commercials, corporate presentations, and social media campaigns.
- AI QUALITY SAFEGUARDS: Do NOT describe any readable text, signs, or writing in the video scene — AI-generated text is always garbled. Focus on pure visual storytelling without text elements. Ensure consistent lighting and natural physics throughout the described motion. Avoid impossible morphing, sudden teleports, or limbs/objects passing through solids.`
    : type === "vector"
      ? `- Follow this prompt structure: [Subject] + [Art Style] + [Colors/Palette] + [Composition] + [Rendering Rules] + [Use Case].
- Every prompt MUST describe content suitable for VECTOR conversion — the image will be converted to vector format using automated tracing tools, so clean edges and solid colors are CRITICAL for successful conversion.
- VECTOR CONVERSION RULES (CRITICAL): Designs MUST have clean sharp edges, high contrast between elements, solid flat color fills (NO gradients, NO noise, NO grain, NO texture), minimal detail complexity, and clear separation between foreground and background. Every shape must have a definite hard boundary. Avoid: photographic noise, subtle color transitions, soft shadows, transparency effects, fine hair-like details, and complex patterns that merge during vectorization.
- Specify the exact art style: flat 2D, isometric, line art, low-poly, geometric, hand-drawn sketch, paper-cut, silhouette, or retro poster.
- Define rendering rules: flat solid fills with 3-5 bold distinct colors maximum, clean crisp outlines, strong contrast, no blurry edges, no anti-aliasing blur between color regions.
- Specify composition: isolated on pure white background (#FFFFFF), centered, or seamless pattern tile.
- Include the intended use case: app icon, web icon set, infographic element, logo concept, social media asset, presentation graphic, UI illustration, packaging design, badge, sticker, or seamless pattern.
- Focus on commercially practical vector content — choose categories and subjects that real designers, marketers, and developers actively search for.
- Each design must be commercially practical — something a designer, marketer, or developer would actively search for and license for their real project.
- AI QUALITY SAFEGUARDS: Do NOT include any readable text, letters, numbers, labels, or writing in the design — AI cannot render clean text and it ruins vector conversion. Keep designs simple enough that every shape has a clear boundary for clean tracing.`
      : `- Follow this prompt structure: [Shot Type] + [Subject + Details] + [Setting] + [Lighting] + [Camera/Lens] + [Style/Mood] + [Color Palette].
- Every image MUST look like a REAL photograph — photorealistic, believable, and professionally shot. No illustrations, no paintings, no artistic interpretations. Pure realistic photography only.
- Think like a professional photographer — specify the complete visual brief as if directing a real photo shoot with real equipment.
- Include specific lens and camera references (85mm f/1.4, wide-angle 24mm, macro 100mm, 50mm prime, telephoto 200mm, tilt-shift, medium format Hasselblad) for precise visual control.
- Specify lighting setup: golden hour, chiaroscuro, softbox, rembrandt, rim lighting, volumetric fog, window light, studio strobe, natural ambient, high-key, low-key.
- Describe composition and framing: rule of thirds, symmetrical, leading lines, flat-lay, extreme close-up, panoramic, overhead, eye-level, dutch angle.
- Include quality modifiers: 8K resolution, DSLR quality, film stock tones (Kodak Portra 400, Fuji Velvia 50, Kodak Ektar 100), high dynamic range, sharp focus, shallow depth of field with creamy bokeh.
- ASPECT-RATIO INTELLIGENCE: pick the ratio that matches the buyer use-case rather than defaulting to one shape — 3:2 editorial / DSLR, 4:5 magazine / Instagram feed, 1:1 social grid, 16:9 web hero / banner, 9:16 mobile / Reels / Pinterest, 2:3 portrait poster, 21:9 ultrawide hero. Compose for that ratio (subject placement, copy space, breathing room) — do not just crop a square.
- COLOR-GRADE / FILM LANGUAGE: name the look, not just the colors — Kodak Portra warmth, Fuji Pro 400H pastel, Cinestill 800T tungsten glow, bleach-bypass, teal-and-orange, muted earth tones, high-key clean white, low-key moody, golden-hour amber, blue-hour twilight. Avoid generic "vibrant".
- CULTURAL BREADTH (HALAL): rotate global settings, materials and palettes — Mediterranean coast, Southeast Asian rainforest, Andean highlands, Nordic fjords, Gulf desert dunes, East African savanna, Levantine olive groves, Japanese ryokan interiors, Latin American mercados — without leaning on tired stereotypes. Always halal-safe — no human faces, no figures, no national flags or religious symbols on people.
- SEASONAL & TIME-OF-DAY VARIETY: deliberately rotate season (spring blossom, high summer, autumn harvest, deep winter) and time of day (dawn, golden hour, noon, blue hour, night) across the prompt set — do not let every prompt collapse onto the same lighting.
- COPY-SPACE WHERE NATURAL: when the composition naturally allows it, include areas of soft focus, open sky, blurred background, or clean surface that could serve as copy space for text overlay — but NEVER force empty space that ruins the image's beauty. The image must look stunning on its own first.
- "IMPOSSIBLE SHOT" OPPORTUNITIES: extreme macro, underwater, aerial / drone, cross-section, microscope, x-ray-style, or dangerous-scenario shots that real photographers cannot easily capture but buyers desperately want.
- Every image MUST look like a REAL photograph — photorealistic, believable, professionally shot. No illustrations, no paintings, no artistic interpretations unless the buyer brief explicitly demands it.
- Focus on images that work as premium stock photos: versatile compositions, clean backgrounds, and universal commercial appeal.
- Use your own commercial intuition to choose niches and subjects that have high demand and real buyer interest.
- Each prompt must describe a scene that a real buyer would pay premium price for — think magazine covers, advertising campaigns, website heroes, and editorial features.
- AI QUALITY SAFEGUARDS: Do NOT describe any readable text, signs, labels, letters, numbers, or writing in the scene — AI-generated text always appears garbled and causes rejection. Avoid overly complex overlapping objects that create rendering confusion. Ensure lighting direction and shadows are consistent throughout the scene. Describe natural authentic textures (wood grain, fabric weave, stone surface) rather than smooth plastic-like surfaces. Avoid extra fingers, melted hands, or other AI tells by keeping anatomy out of frame entirely (halal rule already handles this).`;

  const typeSpecificGuidance = engineerMode ? engineerGuidance : simpleGuidance;

  const isAiFreeChoice = autoMode && autoCategory === "ai-free-choice";

  const autoBlock = autoMode
    ? `\n\n[AUTO MODE — COMMERCIAL MICROSTOCK INTELLIGENCE]
${isAiFreeChoice
      ? `YOU HAVE ABSOLUTE CREATIVE FREEDOM.
You are NOT given any specific subject, object, topic, or hint. You must INVENT everything yourself from scratch.
${contextHint ? `Visual approach suggestion (optional — you may follow, adapt, or ignore): ${autoContext}` : ""}
FREEDOM RULE: You can think of LITERALLY ANY halal subject in the entire world. There are NO examples, NO suggestions, and NO restrictions on what you can choose. Your commercial intuition is your ONLY guide.
You are not limited to physical objects — you can also think of abstract concepts, emotions, processes, states of being, or any other idea that can be visualized.
Your ONE goal: choose subjects that microstock buyers ACTUALLY search for and pay money to license. Think commercially. Think about what a designer, marketer, or content creator NEEDS right now.`
      : `Category: ${autoCategory} | Subject: "${concept}"${contextHint}`}
You are generating for commercial microstock platforms (Adobe Stock, Shutterstock, Freepik, Dreamstime, and others).
TYPE-SPECIFIC REQUIREMENTS (${type.toUpperCase()}):
${typeSpecificGuidance}
COMMERCIAL REQUIREMENTS:
- Every prompt MUST describe content that real buyers would license for business, marketing, editorial, or design use.
- Each prompt should target a DIFFERENT buyer persona (marketer, blogger, designer, educator, publisher, app developer, social media manager).
- Prioritize universally sellable concepts with broad market appeal — think search volume, trending themes, and gaps in stock libraries.
- Each prompt must feel like it was created by a different creative director — explore COMPLETELY different angles.
- AVOID generating content that already floods stock marketplaces. Be original, unexpected, and fresh while remaining commercially viable.
ANTI-SIMILARITY RULE (CRITICAL — prevents marketplace rejection):
- Each prompt MUST describe a COMPLETELY DIFFERENT subject from a DIFFERENT category — never two prompts about the same type of object, scene, or theme.
- Vary EVERY visual dimension across prompts: different subject, different setting/environment, different color palette (warm vs cool vs neutral), different composition/angle (close-up vs wide vs overhead vs eye-level), different lighting mood, and different commercial use case.
- Think of each prompt as if it will be uploaded to a marketplace that rejects similar-looking content — no two images from this batch should look even remotely alike.
- Avoid oversaturated subjects that already exist in millions on stock platforms (generic sunsets, basic flower close-ups, simple coffee cups). Instead, find unique angles on common subjects OR choose uncommon subjects with commercial demand.
- If describing the same broad category (e.g., food), each prompt must show a COMPLETELY different food item, different preparation style, different cultural context, and different photographic approach.
MARKET INTELLIGENCE (timeless principles — apply across all platforms):
- AUTHENTIC IMPERFECTION beats hyper-polished AI looks. Include natural textures (linen, stone, wood grain), subtle film grain, and lived-in realism where appropriate.
- TACTILE REALISM: real-feeling surfaces (plaster, woven fabric, cracked earth, rough stone, velvet, cork, bark, hammered metal) consistently outperform plastic, uniform, smooth-as-glass renders.
- SENSORY CONTENT: describe textures the viewer can almost touch — wet moss, sun-warmed terracotta, frost on glass, steam rising from a bowl, dew on a petal.
- COHESIVE COLLECTIONS sell better than one-offs — design each batch as a set a brand could use together.
- CONCEPTS > objects — abstract ideas and themes outsell simple object photos. Use your own commercial intuition to identify which concepts are valuable AND undersupplied right now.
- IMPOSSIBLE / IMAGINATIVE shots (extreme macro, aerial, underwater, cross-section, surreal pairings) are high-value because real photographers struggle to capture them.
- CROSS-PLATFORM AWARENESS: content here may be sold on Adobe Stock, Shutterstock, Freepik, Getty/iStock, Dreamstime, Vecteezy, Pond5, Envato/Creative Market. Make content versatile enough to land on multiple platforms.
${engineerMode ? `TIMELESS CONTENT RULE:
- Every prompt MUST describe content that is EVERGREEN — it should sell equally well today, next year, and 5 years from now.
- Do NOT reference specific dates, current events, trending memes, or time-bound concepts that will become outdated.
- Focus on universal themes that have permanent commercial value — choose themes that will sell equally well regardless of trends or seasons.
MICROSTOCK PLATFORM INTELLIGENCE:
- Different platforms have different buyer preferences — use your commercial intuition to create content that appeals across multiple marketplaces.
- The most valuable content combines technical excellence with commercial utility — each prompt must describe something a real buyer would pay premium price for.
- "Impossible shots" (extreme macro, aerial, underwater, cross-section perspectives) are high-value because real photographers struggle to capture them.
REPEAT BUYER STRATEGY:
- Create content so high-quality that a buyer who purchases one asset will return to buy more from the same portfolio.
- Maintain consistent professional quality across all prompts — every single output must be portfolio-worthy.
- Think in terms of COLLECTIONS: related themes, matching styles, complementary color palettes that work together as a set.
- Prioritize subjects with RECURRING demand — content that buyers need year-round, not just once.
- Target MULTIPLE buyer personas across prompts — each prompt should serve a different type of professional.` : `- Use your commercial intuition to identify themes and subjects that buyers actually pay for. Think about what is undersupplied in stock marketplaces, not what is already flooded.`}`
    : "";

  const specialModeBlock = specialMode ? getSpecialModeInstructions(specialMode, type, targetMarket) : "";

  const outputFormat = engineerMode ? `\nOUTPUT FORMAT (STRICT):
- Output ONLY numbered prompts (1. 2. 3. etc.)
- Each prompt must be 2-3 detailed sentences minimum with specific visual descriptions.
- Do NOT include any introduction, explanation, commentary, summary, or sign-off text.
- Do NOT say "Here are your prompts" or "I hope these help" or anything similar.
- Start directly with "1." and end after the last numbered prompt. Nothing else.\n` : "";

  return `[Session seed: ${mathSeed}]

Topic: ${concept}
${autoBlock}${specialModeBlock}

${diversityHint}
${halalMode ? `\nHALAL CONTENT RULE: Do NOT include any human figures, human body parts, human faces, human hands, human silhouettes, or human shadows in any prompt. Focus on objects, nature, architecture, food, textures, patterns, landscapes, and still life. This is a strict requirement.\n` : ""}${outputFormat}
Generate prompts that feel completely fresh and unexpected. Each prompt must explore a DIFFERENT combination of the inspiration angles above — and must be nothing like the previously generated prompts.`;
}

const ALLOWED_MODELS_SET = new Set(ALLOWED_MODELS);
const ALLOWED_TYPES_SET = new Set(ALLOWED_TYPES);

class AppError extends Error {
  constructor(message, status = 500, code = "UNKNOWN_ERROR") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

function shortenError(msg) {
  if (!msg) return "Request failed.";
  const lower = msg.toLowerCase();
  if (lower.includes("quota")) return "Quota exceeded. Try another key.";
  if (lower.includes("rate limit")) return "Rate limit hit. Please retry.";
  if (lower.includes("invalid") || lower.includes("unauthorized")) return "Invalid API key.";
  if (lower.includes("timeout") || lower.includes("aborted")) return "Provider timeout. Try again.";
  if (lower.includes("context") && lower.includes("length")) return "Input too long. Reduce prompt or quantity.";
  if (lower.includes("not found") || lower.includes("does not exist")) return "Model not found. Check API access.";
  if (lower.includes("model") && lower.includes("access")) return "Model not accessible with this key.";
  if (lower.includes("limit")) return "Limit reached. Try another key.";
  // Expose the actual error message if it doesn't match the patterns above
  return msg.length > 200 ? msg.slice(0, 200) + "..." : msg;
}

function createTextResponse(text, modelUsed) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Model-Used": modelUsed,
    },
  });
}

function validateRequest(body) {
  if (!body || typeof body !== "object") return "Invalid request payload.";

  const concept = typeof body.concept === "string" ? body.concept.trim() : "";
  const quantity = Number(body.quantity);
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "image";
  const validKeys = sanitizeKeys(body.apiKeys);
  const apiKeysByModel = body.apiKeysByModel && typeof body.apiKeysByModel === "object" ? body.apiKeysByModel : null;
  const customInstructions = typeof body.customInstructions === "string" ? body.customInstructions.trim().slice(0, 8000) : "";
  const style = typeof body.style === "string" ? body.style.trim().slice(0, 80) : "";
  const mood = typeof body.mood === "string" ? body.mood.trim().slice(0, 80) : "";
  const lighting = typeof body.lighting === "string" ? body.lighting.trim().slice(0, 80) : "";
  const camera = typeof body.camera === "string" ? body.camera.trim().slice(0, 80) : "";
  const shot = typeof body.shot === "string" ? body.shot.trim().slice(0, 80) : "";
  const speed = typeof body.speed === "string" ? body.speed.trim().slice(0, 80) : "";
  const aspectRatio = typeof body.aspectRatio === "string" ? body.aspectRatio.trim().slice(0, 16) : "";
  const duration = typeof body.duration === "string" ? body.duration.trim().slice(0, 16) : "";
  const negativePrompt = typeof body.negativePrompt === "string" ? body.negativePrompt.trim().slice(0, 200) : "";
  const marketResearch = body.marketResearch === true;
  const targetMarket = typeof body.targetMarket === "string" ? body.targetMarket.trim() : "all";
  const autoMode = body.autoMode === true;
  const autoSubject = typeof body.autoSubject === "string" ? body.autoSubject.trim().slice(0, 400) : "";
  const autoCategory = typeof body.autoCategory === "string" ? body.autoCategory.trim().slice(0, 100) : "";
  const autoContext = typeof body.autoContext === "string" ? body.autoContext.trim().slice(0, 200) : "";
  const festivalContext = typeof body.festivalContext === "string" ? body.festivalContext.trim().slice(0, 2000) : "";

  if (!autoMode && !concept) return "Enter a prompt first.";
  if (concept.length > MAX_PROMPT_CHARS) return `Prompt is too long (max ${MAX_PROMPT_CHARS} chars).`;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return "Quantity: 1-100 only.";
  if (!ALLOWED_MODELS_SET.has(model)) return "Unknown model.";
  if (!ALLOWED_TYPES_SET.has(type)) return "Unknown prompt type.";

  if (marketResearch) {
    const geminiKeys = apiKeysByModel ? sanitizeKeys(apiKeysByModel.gemini) : validKeys;
    if (geminiKeys.length === 0) return "Market Research requires a Google Gemini API key.";
  } else if (validKeys.length === 0) {
    return "No API key. Add one via API Keys.";
  }

  const engineerMode = body.engineerMode === true;
  const specialMode = typeof body.specialMode === "string" ? body.specialMode.trim() : "";
  const halalMode = body.halalMode !== false; // default ON; explicit `false` opts out
  const rawConcept = autoMode && autoSubject ? autoSubject : concept;
  // Sanitize the user concept *and* the autoMode metadata fields the same
  // way we sanitize customInstructions: every value here flows into the
  // model prompt and could carry an injection payload (forged role tokens,
  // boundary markers, "ignore previous instructions" phrases, etc.).
  const effectiveConcept = sanitizeUntrustedText(rawConcept, MAX_PROMPT_CHARS);
  const safeAutoCategory = sanitizeUntrustedText(autoCategory, 100);
  const safeAutoContext = sanitizeUntrustedText(autoContext, 200);
  const safeNegativePrompt = sanitizeUntrustedText(negativePrompt, 200);
  return { concept: effectiveConcept, quantity, model, type, validKeys, apiKeysByModel, customInstructions, style, mood, lighting, camera, shot, speed, aspectRatio, duration, negativePrompt: safeNegativePrompt, marketResearch, targetMarket, autoMode, autoSubject, autoCategory: safeAutoCategory, autoContext: safeAutoContext, festivalContext, engineerMode, specialMode, halalMode };
}


// normalizeRetryAfter has been extracted to src/lib/retryAfter.js so it
// can be unit-tested without pulling in the route's @/-aliased imports.

function extractRetryAfter(res, errMsg) {
  const retryAfter = res.headers.get("retry-after") ||
                     res.headers.get("x-ratelimit-reset") ||
                     res.headers.get("x-ratelimit-reset-requests") ||
                     res.headers.get("x-ratelimit-reset-tokens");
  const seconds = normalizeRetryAfter(retryAfter);
  if (seconds != null) {
    return `${errMsg} [RETRY_AFTER:${seconds}]`;
  }
  return errMsg;
}

function parseProviderError(status, message, provider) {
  const safeMessage = shortenError(message || `${provider} error (${status})`);
  if (status === 401 || status === 403) return new AppError(safeMessage, 401, "PROVIDER_AUTH");
  if (status === 429) return new AppError(safeMessage, 429, "PROVIDER_RATE_LIMIT");
  if (status >= 500) return new AppError(safeMessage, 502, "PROVIDER_UPSTREAM");
  return new AppError(safeMessage, 400, "PROVIDER_BAD_REQUEST");
}

function normalizeThrownError(err) {
  if (err instanceof AppError) return err;
  const msg = String(err?.message || "Provider request failed.");
  const lower = msg.toLowerCase();
  if (lower.includes("timeout") || lower.includes("aborted")) {
    return new AppError("Provider timeout. Try again.", 504, "PROVIDER_TIMEOUT");
  }
  return new AppError(shortenError(msg), 502, "PROVIDER_FAILURE");
}

function isRetryableError(err) {
  if (err instanceof AppError) {
    return err.status === 429 || err.status === 502 || err.status === 504;
  }
  return false;
}

function buildModelQueue(primaryModel, apiKeysByModel, validKeys) {
  const providerKey = PROVIDER_KEY_MAP[primaryModel] || primaryModel;
  const modelKeys = apiKeysByModel ? sanitizeKeys(apiKeysByModel[providerKey]) : [];
  const keys = modelKeys.length > 0 ? modelKeys : validKeys;
  const queue = [{ model: primaryModel, keys }];
  if (primaryModel.startsWith("gemini") && primaryModel !== "gemini-lite") {
    queue.push({ model: "gemini-lite", keys });
  } else if (primaryModel === "gemini-lite") {
    queue.push({ model: "gemini", keys });
  } else if (primaryModel === "groq" || primaryModel === "groq-scout" || primaryModel === "groq-maverick" || primaryModel === "groq-gpt-oss") {
    queue.push({ model: "groq-fast", keys });
  } else if (primaryModel === "groq-fast" || primaryModel === "groq-gpt-oss-mini") {
    queue.push({ model: "groq", keys });
  }
  return queue;
}

// OpenRouter fallback list — only used when the live /v1/models call fails.
// Keep this list intentionally short and conservative; the live discovery
// in getOpenRouterTextModels() returns the freshest free models on every
// request (5-min cache).  Order = preference when live data unavailable.
const OR_TEXT_FALLBACK_MODELS = [
  // OpenRouter's official free router — tries best available free model.
  "openrouter/free",
  // Verified free models from openrouter.ai/collections/free-models (May 2026)
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-120b:free",
  "google/gemma-4-31b-it:free",
  "deepseek/deepseek-r1:free",
  "qwen/qwen3-coder:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
];

const _orTextCache = { models: null, ts: 0 };
const OR_TEXT_CACHE_TTL = 5 * 60 * 1000;

async function getOpenRouterTextModels(apiKey) {
  if (_orTextCache.models && Date.now() - _orTextCache.ts < OR_TEXT_CACHE_TTL) return _orTextCache.models;
  try {
    const res = await fetchWithTimeout("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    }, 10000);
    if (!res.ok) return OR_TEXT_FALLBACK_MODELS;
    const json = await res.json();
    const models = (json.data || [])
      .filter(m => {
        const free = m.id?.endsWith(":free") || Number(m.pricing?.prompt) === 0;
        const ctx = m.context_length || 0;
        const isReasoning = /\b(r1|reasoning|think)\b/i.test(m.id || "");
        return free && ctx >= 8000 && !isReasoning;
      })
      .sort((a, b) => (b.context_length || 0) - (a.context_length || 0))
      .map(m => m.id)
      .slice(0, 6);
    const result = models.length > 0 ? models : OR_TEXT_FALLBACK_MODELS;
    _orTextCache.models = result;
    _orTextCache.ts = Date.now();
    return result;
  } catch {
    return OR_TEXT_FALLBACK_MODELS;
  }
}

export async function POST(request) {
  const csrf = enforceSameOrigin(request);
  if (csrf) return csrf;

  const { limited, response: limitResponse } = await (await import("@/lib/rateLimit")).rateLimit(request);
  if (limited) return limitResponse;

  let body;
  try {
    body = await readJsonBody(request, MAX_REQUEST_BODY_BYTES.prompts);
  } catch (err) {
    return jsonError(err.message || "Invalid request body.", err.status || 400, err.code || "VALIDATION_ERROR");
  }
  try {
    const validation = validateRequest(body);
    if (typeof validation === "string") {
      return jsonError(validation, 400, "VALIDATION_ERROR");
    }

    const { concept, quantity, model, type, validKeys, apiKeysByModel, customInstructions, style, mood, lighting, camera, shot, speed, aspectRatio, duration, negativePrompt, marketResearch, targetMarket, autoMode, autoCategory, autoContext, festivalContext, engineerMode, specialMode, halalMode } = validation;
    const systemPrompt = buildSystemPrompt(type, quantity, customInstructions, { style, mood, lighting, camera, shot, speed, aspectRatio, duration, negativePrompt, autoMode: !!autoMode, halalMode: !!halalMode });
    let userPrompt = buildDiverseUserPrompt(concept, { autoMode, autoCategory, autoContext, type, engineerMode: !!engineerMode, targetMarket, specialMode, halalMode });
    if (festivalContext) {
      userPrompt += festivalContext;
    }

    if (marketResearch) {
      const geminiKeys = apiKeysByModel ? sanitizeKeys(apiKeysByModel.gemini) : validKeys;
      if (!geminiKeys.length) return jsonError("Market Research requires a Google Gemini API key.", 400, "VALIDATION_ERROR");
      return await handleMarketResearch(geminiKeys, systemPrompt, userPrompt, type, quantity, { customInstructions, style, mood, lighting, camera, shot, speed, aspectRatio, duration, negativePrompt, geminiModel: model, targetMarket });
    }

    if (model === "openrouter" || model.startsWith("or-")) {
      const orKeys = apiKeysByModel ? sanitizeKeys(apiKeysByModel.openrouter) : validKeys;
      if (!orKeys.length) return jsonError("No OpenRouter key configured.", 400, "NO_KEYS");
      const specificModel = OR_MODEL_MAP[model] || null;
      return await handleOpenRouter(orKeys, systemPrompt, userPrompt, specificModel);
    }

    if (model === "huggingface" || model.startsWith("hf-")) {
      const hfKeys = apiKeysByModel ? sanitizeKeys(apiKeysByModel.huggingface) : validKeys;
      if (!hfKeys.length) return jsonError("No HuggingFace key configured.", 400, "NO_KEYS");
      const hfModelId = MODEL_IDS[model] || MODEL_IDS["hf-qwen-vl72b"];
      return await handleHuggingFace(hfKeys, systemPrompt, userPrompt, hfModelId);
    }

    if (model === "cerebras" || model.startsWith("cerebras-")) {
      const cbKeys = apiKeysByModel ? sanitizeKeys(apiKeysByModel.cerebras) : validKeys;
      if (!cbKeys.length) return jsonError("No Cerebras key configured.", 400, "NO_KEYS");
      return await handleCerebras(cbKeys, systemPrompt, userPrompt, MODEL_IDS[model] || MODEL_IDS["cerebras-gpt-oss"]);
    }

    if (model === "nvidia" || model.startsWith("nvidia-")) {
      const nvKeys = apiKeysByModel ? sanitizeKeys(apiKeysByModel.nvidia) : validKeys;
      if (!nvKeys.length) return jsonError("No NVIDIA NIM key configured.", 400, "NO_KEYS");
      return await handleNvidia(nvKeys, systemPrompt, userPrompt, MODEL_IDS[model] || MODEL_IDS["nvidia-nemotron"]);
    }

    if (model === "github" || model.startsWith("github-")) {
      const ghKeys = apiKeysByModel ? sanitizeKeys(apiKeysByModel.github) : validKeys;
      if (!ghKeys.length) return jsonError("No GitHub Models key configured.", 400, "NO_KEYS");
      const ghResult = await handleGitHub(ghKeys, systemPrompt, userPrompt, MODEL_IDS[model] || MODEL_IDS["github-gpt4o-mini"]);
      // Auto-fallback: if Azure content filter blocked the request, try
      // other providers silently so the user gets a result instead of an error.
      if (ghResult?.__contentFiltered) {
        const fallbacks = [
          { name: "gemini", keys: apiKeysByModel ? sanitizeKeys(apiKeysByModel.gemini) : [], fn: (k) => callGemini(k, systemPrompt, userPrompt, MODEL_IDS["gemini"]) },
          { name: "groq", keys: apiKeysByModel ? sanitizeKeys(apiKeysByModel.groq) : [], fn: (k) => callGroq(k, systemPrompt, userPrompt, MODEL_IDS["groq"]) },
          { name: "mistral", keys: apiKeysByModel ? sanitizeKeys(apiKeysByModel.mistral) : [], fn: (k) => callMistral(k, systemPrompt, userPrompt) },
          { name: "openrouter", keys: apiKeysByModel ? sanitizeKeys(apiKeysByModel.openrouter) : [], fn: null },
          { name: "huggingface", keys: apiKeysByModel ? sanitizeKeys(apiKeysByModel.huggingface) : [], fn: null },
          { name: "cerebras", keys: apiKeysByModel ? sanitizeKeys(apiKeysByModel.cerebras) : [], fn: null },
        ];
        for (const fb of fallbacks) {
          if (!fb.keys.length) continue;
          try {
            let result;
            if (fb.name === "openrouter") result = await handleOpenRouter(fb.keys, systemPrompt, userPrompt, null);
            else if (fb.name === "huggingface") result = await handleHuggingFace(fb.keys, systemPrompt, userPrompt, MODEL_IDS["hf-qwen-vl72b"]);
            else if (fb.name === "cerebras") result = await handleCerebras(fb.keys, systemPrompt, userPrompt, MODEL_IDS["cerebras-gpt-oss"]);
            else {
              const res = await fb.fn(fb.keys[0]);
              const text = res.body ? await res.text() : "";
              if (text) return createTextResponse(text, `${fb.name}:fallback`);
              continue;
            }
            if (result.ok) return result;
            continue;
          } catch { continue; }
        }
        const triedProviders = fallbacks.filter(fb => fb.keys.length > 0).map(fb => fb.name).join(", ");
        const msg = triedProviders
          ? `GitHub Models (Azure) blocked this prompt due to content policy. Fallback providers (${triedProviders}) also failed. Check your keys or try a different prompt.`
          : "GitHub Models (Azure) blocked this prompt due to content policy and no fallback provider keys are configured. Add Gemini or Groq keys in Settings.";
        return jsonError(msg, 400, "CONTENT_FILTER");
      }
      return ghResult;
    }

    // Static queue from the user's primary model + provider-specific
    // fallbacks, then re-ranked by recent success/failure history so
    // healthy models bubble up.  The user's chosen model always stays first.
    const modelQueue = reorderQueue(buildModelQueue(model, apiKeysByModel, validKeys));

    let lastError = null;

    for (const modelItem of modelQueue) {
      const keys = modelItem.keys;
      if (!keys.length) continue;

      for (let i = 0; i < keys.length; i++) {
        const apiKey = keys[i];
        try {
          let response;
          if (modelItem.model.startsWith("gemini")) response = await callGemini(apiKey, systemPrompt, userPrompt, MODEL_IDS[modelItem.model]);
          else if (modelItem.model.startsWith("groq")) response = await callGroq(apiKey, systemPrompt, userPrompt, MODEL_IDS[modelItem.model]);
          else if (modelItem.model === "mistral") response = await callMistral(apiKey, systemPrompt, userPrompt);
          else {
            lastError = new AppError(`Unknown model: ${modelItem.model}`, 400, "VALIDATION_ERROR");
            continue;
          }

          recordSuccess(modelItem.model);
          if (response.headers.get("X-Model-Used")) return response;
          if (response.body && !modelItem.model.startsWith("gemini")) {
            const text = await response.text();
            return createTextResponse(text, modelItem.model);
          }
          return new Response(response.body, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "X-Model-Used": modelItem.model,
            },
          });
        } catch (err) {
          const normalizedError = normalizeThrownError(err);
          lastError = normalizedError;
          recordFailure(modelItem.model, normalizedError?.status === 429 ? "rate_limit" : "fail");
          if (i < keys.length - 1 && isRetryableError(normalizedError)) continue;
          if (i < keys.length - 1) continue;
          break;
        }
      }
    }
    if (lastError) return jsonError(lastError.message, lastError.status, lastError.code);
    return jsonError("All keys exhausted. Add new keys.", 429, "ALL_KEYS_EXHAUSTED");
  } catch (err) {
    try {
      const { reportError } = await import("@/lib/errorReporter");
      // Awaited so the report fetch completes before the serverless
      // runtime freezes after the response is returned.
      await reportError(err, { route: "/api/generate-prompts" });
    } catch {}
    return jsonError("Something went wrong. Try again.", 500, "INTERNAL_ERROR");
  }
}

async function handleMarketResearch(geminiKeys, baseSystemPrompt, userConcept, type, quantity, { customInstructions, style, mood, lighting, camera, shot, speed, aspectRatio, duration, negativePrompt, geminiModel, targetMarket } = {}) {
  const typeLabel = type === "vector" ? "vector/illustration" : type === "video" ? "stock video" : "stock photo";
  const platforms = "Adobe Stock, Shutterstock, iStock, Getty Images, Freepik, Dreamstime, Depositphotos";

  const marketGuide = getMarketplaceGuidance(targetMarket, type);

  let settingsBlock = "";
  if (type === "video") {
    const mods = [];
    if (aspectRatio) mods.push(`Aspect ratio: ${aspectRatio} — frame composition must respect this`);
    if (duration) {
      if (duration === "loopable") mods.push(`Duration: seamlessly loopable — first and last frames must match for clean repeat`);
      else mods.push(`Duration: ${duration} — pacing, beats, and shot count must fit this length`);
    }
    if (camera) mods.push(`Camera movement: ${camera}`);
    if (shot) mods.push(`Shot type: ${shot}`);
    if (speed) mods.push(`Pacing/speed: ${speed}`);
    if (mood) mods.push(`Mood/atmosphere: ${mood}`);
    if (mods.length) settingsBlock = `\nApply these cinematic attributes to every prompt:\n${mods.map(m => `- ${m}`).join("\n")}`;
  } else {
    const mods = [];
    if (style) mods.push(`Style: ${style}`);
    if (mood) mods.push(`Mood/atmosphere: ${mood}`);
    if (lighting) mods.push(`Lighting: ${lighting}`);
    if (mods.length) settingsBlock = `\nApply these visual attributes to every prompt:\n${mods.map(m => `- ${m}`).join("\n")}`;
  }
  const negBlock = negativePrompt ? `\nExclude from all prompts: ${negativePrompt}` : "";
  const customBlock = customInstructions ? `\nADDITIONAL INSTRUCTIONS (follow precisely):\n${customInstructions}` : "";

  const researchPrompt = `You are a microstock market research analyst and ${type === "video" ? "cinematographer" : type === "vector" ? "vector illustrator" : "stock photographer"} prompt engineer.

STEP 1 — MARKET RESEARCH:
Use Google Search to research CURRENT trending and best-selling ${typeLabel} niches, topics, and styles on these platforms: ${platforms}.
Focus on:
- What ${typeLabel} categories are trending RIGHT NOW
- Most downloaded/purchased ${typeLabel} themes this month
- Seasonal trends and upcoming events that drive ${typeLabel} sales
- Commercial niches with high demand but low competition
- The specific style, composition, and keywords that top-selling ${typeLabel}s use

STEP 2 — GENERATE PROMPTS:
Based on your market research findings, generate EXACTLY ${quantity} ${typeLabel} prompts related to "${userConcept}".

Each prompt must be:
- Optimized for what is ACTUALLY selling well right now on microstock platforms
- Commercially viable and high-quality enough to be accepted and sell on ${platforms}
- Detailed (2-3 sentences minimum) with specific visual descriptions
- Aligned with current market demand and trending topics you discovered
${settingsBlock}${negBlock}${customBlock}
${marketGuide}

IMPORTANT RULES:
- All content must be HALAL — absolutely NO nudity, alcohol, pork, gambling, violence, inappropriate content
- Focus on universally sellable HALAL commercial themes — use your commercial intuition and market research data to choose the most profitable subjects
- Output ONLY numbered prompts (1. 2. 3. etc.)
- No introductions, research summaries, or explanations — ONLY the numbered prompts

Begin with market research, then generate ${quantity} commercially optimized prompts:`;

  const MARKET_RESEARCH_MODELS = [
    { key: "gemini", is25Flash: true, maxPasses: 3, retryDelayMs: 5000 },
    { key: "gemini-lite", is25Flash: true, maxPasses: 1, retryDelayMs: 1000 },
    { key: "gemini-pro", is25Flash: false, maxPasses: 1, retryDelayMs: 1000 },
  ];

  let lastErr = null;
  for (const modelEntry of MARKET_RESEARCH_MODELS) {
    const modelId = MODEL_IDS[modelEntry.key];
    if (!modelId) continue;

    let allKeysRateLimited = false;

    for (let pass = 0; pass < modelEntry.maxPasses; pass++) {
      if (pass > 0) {
        // Wait before retrying all keys (give RPM quota time to reset)
        await sleepJitter(modelEntry.retryDelayMs);
      }

      allKeysRateLimited = true;

      for (let ki = 0; ki < geminiKeys.length; ki++) {
        const apiKey = geminiKeys[ki];
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;

          const genConfig = {
            temperature: 0.9,
            topP: 0.95,
            maxOutputTokens: 8192,
          };

          const res = await fetchWithTimeout(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: researchPrompt }] }],
              tools: [{ google_search: {} }],
              generationConfig: genConfig,
            }),
          }, 90000);

          if (!res.ok) {
            let errMsg = `Gemini error (${res.status})`;
            try {
              const errBody = await res.json();
              if (errBody.error?.message) errMsg = errBody.error.message;
            } catch { }
            errMsg = extractRetryAfter(res, errMsg);
            console.error(`[Market Research] ${modelId} key[${ki}] pass[${pass}] → ${res.status}: ${errMsg}`);
            lastErr = parseProviderError(res.status, errMsg, "Gemini");
            if (res.status === 429) {
              await sleepJitter(1000);
              continue;
            }
            allKeysRateLimited = false;
            throw lastErr;
          }

          const data = await res.json();
          const parts = data?.candidates?.[0]?.content?.parts || [];
          const text = parts
            .filter((p) => !p.thought && typeof p.text === "string")
            .map((p) => p.text)
            .join("");

          if (!text) {
            lastErr = new AppError("Gemini returned empty response.", 502, "PROVIDER_FAILURE");
            allKeysRateLimited = false;
            continue;
          }

          return createTextResponse(text, `${modelId}+search`);
        } catch (err) {
          lastErr = normalizeThrownError(err);
          allKeysRateLimited = false;
          if (isRetryableError(lastErr)) {
            await sleepJitter(1000);
            continue;
          }
        }
      }

      // If not all keys were rate limited, no point retrying this model
      if (!allKeysRateLimited) break;
    }
  }
  if (lastErr) return jsonError(lastErr.message, lastErr.status, lastErr.code);
  return jsonError("Market Research failed. Check Gemini API key.", 502, "ALL_KEYS_EXHAUSTED");
}

async function handleOpenRouter(keys, systemPrompt, userPrompt, specificModel = null) {
  let lastErr = null;
  for (const apiKey of keys) {
    const models = specificModel ? [specificModel] : await getOpenRouterTextModels(apiKey);
    for (const model of models) {
      try {
        const res = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": APP_REFERER,
            "X-Title": APP_TITLE,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.9,
            max_tokens: 8192,
          }),
        });

        if (res.status === 429) {
          lastErr = new AppError(`OpenRouter rate limit hit on ${model}. Retrying next...`, 429, "PROVIDER_RATE_LIMIT");
          await sleepJitter(2000); // Crucial delay to avoid IP ban
          continue;
        }
        if (res.status === 401 || res.status === 403) {
          lastErr = new AppError("Invalid OpenRouter key.", 401, "PROVIDER_AUTH");
          break;
        }
        if (!res.ok) {
          let errMsg = `OpenRouter error (${res.status})`;
          try { const e = await res.json(); if (e?.error?.message) errMsg = e.error.message; } catch { }
          errMsg = extractRetryAfter(res, errMsg);
          lastErr = new AppError(shortenError(errMsg), res.status >= 500 ? 502 : 400, "PROVIDER_ERROR");
          await sleepJitter(1000);
          continue;
        }

        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content || "";
        if (!text) continue;

        return createTextResponse(text, `or:${model}`);
      } catch (err) {
        lastErr = normalizeThrownError(err);
        if (isRetryableError(lastErr)) {
          await sleepJitter(1500);
          continue;
        }
      }
    }
  }
  if (lastErr) return jsonError(lastErr.message, lastErr.status, lastErr.code);
  return jsonError("OpenRouter: all models failed or rate limited.", 429, "ALL_KEYS_EXHAUSTED");
}

// Conservative offline fallback list for HuggingFace text inference.  These
// are the models we trust if live discovery (below) is unavailable or
// returns an empty result.  Order = preference.
const HF_TEXT_MODELS = [
  "meta-llama/Llama-3.3-70B-Instruct",
  "Qwen/Qwen2.5-72B-Instruct",
  "mistralai/Mistral-Nemo-Instruct-2407",
  "deepseek-ai/DeepSeek-R1-Distill-Qwen-32B",
];

const _hfTextCache = { models: null, ts: 0 };
const HF_TEXT_CACHE_TTL = 10 * 60 * 1000;

// Pull the current list of usable text/chat models from the HuggingFace
// Router so we don't have to ship a hardcoded list that will go stale.  The
// router exposes an OpenAI-compatible /v1/models endpoint; we filter for
// non-vision text models and prefer larger context windows.  Falls back to
// HF_TEXT_MODELS on any failure.
async function getHuggingFaceTextModels(apiKey, preferredModel) {
  if (_hfTextCache.models && Date.now() - _hfTextCache.ts < HF_TEXT_CACHE_TTL) {
    const cached = _hfTextCache.models;
    return preferredModel ? [preferredModel, ...cached.filter(m => m !== preferredModel)] : cached;
  }
  try {
    const res = await fetchWithTimeout(
      "https://router.huggingface.co/v1/models",
      { headers: { Authorization: `Bearer ${apiKey}` } },
      8000
    );
    if (!res.ok) throw new Error(`hf models ${res.status}`);
    const json = await res.json();
    const ids = (json.data || [])
      .map(m => m.id)
      .filter(id => typeof id === "string")
      // Skip obvious vision-only / embedding / image-gen models.
      .filter(id => !/(vision|vqa|llava|paligemma|embed|whisper|stable-diffusion|flux|sdxl)/i.test(id))
      // Prefer well-known instruct / chat models.
      .filter(id => /(instruct|chat|nemo|mistral|qwen|llama|deepseek|gpt-oss)/i.test(id))
      .slice(0, 8);
    const result = ids.length > 0 ? ids : HF_TEXT_MODELS;
    _hfTextCache.models = result;
    _hfTextCache.ts = Date.now();
    return preferredModel ? [preferredModel, ...result.filter(m => m !== preferredModel)] : result;
  } catch {
    return preferredModel
      ? [preferredModel, ...HF_TEXT_MODELS.filter(m => m !== preferredModel)]
      : HF_TEXT_MODELS;
  }
}

async function handleHuggingFace(keys, systemPrompt, userPrompt, preferredModel) {
  // Live model discovery uses the first key that's available.  If discovery
  // fails (no network, 4xx) we transparently fall back to HF_TEXT_MODELS.
  const models = await getHuggingFaceTextModels(keys[0], preferredModel);
  let lastErr = null;
  for (const apiKey of keys) {
    for (const model of models) {
      try {
        const res = await fetchWithTimeout("https://router.huggingface.co/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.9,
            max_tokens: 8192,
          }),
        });

        if (res.status === 429) {
          lastErr = new AppError(`HuggingFace rate limit hit on ${model}. Retrying next...`, 429, "PROVIDER_RATE_LIMIT");
          await sleepJitter(2000);
          continue;
        }
        if (res.status === 401 || res.status === 403) {
          lastErr = new AppError("Invalid HuggingFace token.", 401, "PROVIDER_AUTH");
          break;
        }
        if (res.status === 402) {
          lastErr = new AppError("HuggingFace free credits exhausted.", 402, "PROVIDER_RATE_LIMIT");
          continue;
        }
        if (!res.ok) {
          let errMsg = `HuggingFace error (${res.status})`;
          try { const e = await res.json(); if (e?.error) errMsg = typeof e.error === "string" ? e.error : e.error.message || errMsg; } catch { }
          errMsg = extractRetryAfter(res, errMsg);
          lastErr = new AppError(shortenError(errMsg), res.status >= 500 ? 502 : 400, "PROVIDER_ERROR");
          await sleepJitter(1000);
          continue;
        }

        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content || "";
        if (!text) continue;

        return createTextResponse(text, `hf:${model}`);
      } catch (err) {
        lastErr = normalizeThrownError(err);
        if (isRetryableError(lastErr)) {
          await sleepJitter(1500);
          continue;
        }
      }
    }
  }
  if (lastErr) return jsonError(lastErr.message, lastErr.status, lastErr.code);
  return jsonError("HuggingFace: all models failed or rate limited.", 429, "ALL_KEYS_EXHAUSTED");
}

async function callGemini(apiKey, systemPrompt, userPrompt, modelId) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse`;

  const is25Family = modelId.startsWith("gemini-2.5-flash");
  const is3Family = modelId.startsWith("gemini-3");
  const generationConfig = {
    temperature: 1.0,
    topP: 0.95,
    maxOutputTokens: 8192,
    ...(is25Family ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    ...(is3Family ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
  };

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig,
    }),
  });

  if (!res.ok) {
    let errMsg = `Gemini error (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody.error?.message) errMsg = errBody.error.message;
    } catch { }
    errMsg = extractRetryAfter(res, errMsg);
    console.error(`[Gemini] ${modelId} → ${res.status}: ${errMsg}`);
    throw parseProviderError(res.status, errMsg, "Gemini");
  }
  if (!res.body) throw new Error("Provider returned empty stream.");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let failed = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              try {
                const json = JSON.parse(data);
                const parts = json?.candidates?.[0]?.content?.parts || [];
                const text = parts
                  .filter((p) => !p.thought && typeof p.text === "string")
                  .map((p) => p.text)
                  .join("");
                if (text) controller.enqueue(encoder.encode(text));
              } catch { }
            }
          }
        }
      } catch (err) {
        failed = true;
        controller.error(err);
        return;
      } finally {
        if (!failed) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Model-Used": modelId,
    },
  });
}

async function callGroq(apiKey, systemPrompt, userPrompt, modelId) {
  const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.9,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    let errMsg = `Groq error (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody.error?.message) errMsg = errBody.error.message;
    } catch { }
    errMsg = extractRetryAfter(res, errMsg);
    throw parseProviderError(res.status, errMsg, "Groq");
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Groq returned empty response.");

  return createTextResponse(text, modelId);
}

async function callMistral(apiKey, systemPrompt, userPrompt) {
  const res = await fetchWithTimeout("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL_IDS.mistral,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.9,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    let errMsg = `Mistral error (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody.error?.message) errMsg = errBody.error.message;
    } catch { }
    errMsg = extractRetryAfter(res, errMsg);
    throw parseProviderError(res.status, errMsg, "Mistral");
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Mistral returned empty response.");

  return createTextResponse(text, "mistral");
}

async function handleCerebras(keys, systemPrompt, userPrompt, modelId) {
  let lastErr = null;
  for (const apiKey of keys) {
    try {
      const res = await fetchWithTimeout("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.9,
          max_tokens: 8192,
        }),
      });

      if (res.status === 429) {
        lastErr = new AppError(`Cerebras rate limit hit on ${modelId}. Retrying next key...`, 429, "PROVIDER_RATE_LIMIT");
        await sleepJitter(2000);
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        lastErr = new AppError("Invalid Cerebras key.", 401, "PROVIDER_AUTH");
        continue;
      }
      if (!res.ok) {
        let errMsg = `Cerebras error (${res.status})`;
        try { const e = await res.json(); if (e?.error?.message) errMsg = e.error.message; } catch { }
        errMsg = extractRetryAfter(res, errMsg);
        lastErr = new AppError(shortenError(errMsg), res.status >= 500 ? 502 : 400, "PROVIDER_ERROR");
        await sleepJitter(1000);
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || "";
      if (!text) continue;

      return createTextResponse(text, `cerebras:${modelId}`);
    } catch (err) {
      lastErr = normalizeThrownError(err);
      if (isRetryableError(lastErr)) {
        await sleepJitter(1500);
        continue;
      }
    }
  }
  if (lastErr) return jsonError(lastErr.message, lastErr.status, lastErr.code);
  return jsonError("Cerebras: all keys failed or rate limited.", 429, "ALL_KEYS_EXHAUSTED");
}

async function handleNvidia(keys, systemPrompt, userPrompt, modelId) {
  let lastErr = null;
  for (const apiKey of keys) {
    try {
      const res = await fetchWithTimeout("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.9,
          max_tokens: 8192,
        }),
      });

      if (res.status === 429) {
        lastErr = new AppError(`NVIDIA NIM rate limit hit on ${modelId}. Retrying next key...`, 429, "PROVIDER_RATE_LIMIT");
        await sleepJitter(2000);
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        lastErr = new AppError("Invalid NVIDIA NIM key.", 401, "PROVIDER_AUTH");
        continue;
      }
      if (!res.ok) {
        let errMsg = `NVIDIA NIM error (${res.status})`;
        try { const e = await res.json(); if (e?.error?.message) errMsg = e.error.message; } catch { }
        errMsg = extractRetryAfter(res, errMsg);
        lastErr = new AppError(shortenError(errMsg), res.status >= 500 ? 502 : 400, "PROVIDER_ERROR");
        await sleepJitter(1000);
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || "";
      if (!text) continue;

      return createTextResponse(text, `nvidia:${modelId}`);
    } catch (err) {
      lastErr = normalizeThrownError(err);
      if (isRetryableError(lastErr)) {
        await sleepJitter(1500);
        continue;
      }
    }
  }
  if (lastErr) return jsonError(lastErr.message, lastErr.status, lastErr.code);
  return jsonError("NVIDIA NIM: all keys failed or rate limited.", 429, "ALL_KEYS_EXHAUSTED");
}

async function handleGitHub(keys, systemPrompt, userPrompt, modelId) {
  let lastErr = null;
  for (const apiKey of keys) {
    try {
      const res = await fetchWithTimeout("https://models.github.ai/inference/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.9,
          max_tokens: 8192,
        }),
      });

      if (res.status === 429) {
        lastErr = new AppError(`GitHub Models rate limit hit on ${modelId}. Retrying next key...`, 429, "PROVIDER_RATE_LIMIT");
        await sleepJitter(2000);
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        lastErr = new AppError("Invalid GitHub Models PAT.", 401, "PROVIDER_AUTH");
        continue;
      }
      if (!res.ok) {
        let errMsg = `GitHub Models error (${res.status})`;
        let errCode = "PROVIDER_ERROR";
        try {
          const e = await res.json();
          if (e?.error?.message) errMsg = e.error.message;
          // Azure content filter — retrying with another key won't help;
          // the same prompt will be rejected every time. Return immediately.
          if (e?.error?.code === "content_filter") {
            return { __contentFiltered: true };
          }
        } catch { }
        errMsg = extractRetryAfter(res, errMsg);
        lastErr = new AppError(shortenError(errMsg), res.status >= 500 ? 502 : 400, errCode);
        await sleepJitter(1000);
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || "";
      if (!text) continue;

      return createTextResponse(text, `github:${modelId}`);
    } catch (err) {
      lastErr = normalizeThrownError(err);
      if (isRetryableError(lastErr)) {
        await sleepJitter(1500);
        continue;
      }
    }
  }
  if (lastErr) return jsonError(lastErr.message, lastErr.status, lastErr.code);
  return jsonError("GitHub Models: all keys failed or rate limited.", 429, "ALL_KEYS_EXHAUSTED");
}








