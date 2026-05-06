export const PROMPT_TEMPLATES = {
  // ─── PHOTO / IMAGE ─────────────────────────────────────────────
  // Photographic concepts only. Each chip pre-loads a starter
  // concept the user can refine. Keep these specifically suited to
  // photo-realistic AI generators (MidJourney, SDXL, DALL·E).
  image: [
    { name: "Business",        prompt: "Professional corporate business scene in modern office" },
    { name: "Technology",      prompt: "Futuristic technology and digital innovation concept" },
    { name: "Healthcare",      prompt: "Medical healthcare professional in clinical setting" },
    { name: "Education",       prompt: "Learning and education environment with study materials" },
    { name: "Real Estate",     prompt: "Luxury modern interior design and architecture" },
    { name: "Food",            prompt: "Gourmet food photography with elegant styled plating" },
    { name: "Nature",          prompt: "Stunning natural landscape with dramatic lighting" },
    { name: "Wellness",        prompt: "Peaceful wellness and self-care lifestyle scene" },
    { name: "Finance",         prompt: "Financial growth and investment concept visualization" },
    { name: "Travel",          prompt: "Breathtaking travel destination with cultural elements" },
    { name: "Remote Work",     prompt: "Modern remote work home office setup with laptop" },
    { name: "Abstract",        prompt: "Vibrant abstract background with flowing geometric shapes" },
    { name: "Portrait",        prompt: "Cinematic portrait with soft natural light and shallow depth of field" },
    { name: "Product",         prompt: "Studio product photography on minimalist background, soft shadows, high detail" },
    { name: "Architecture",    prompt: "Award-winning architectural photography of a striking modern building, golden hour" },
    { name: "Lifestyle",       prompt: "Authentic lifestyle photography, candid everyday moment, natural light" },
  ],

  // ─── VECTOR / ILLUSTRATION ─────────────────────────────────────
  // Vector / illustration / icon-style concepts. Brand Icons /
  // Line Icons / App UI buttons are tuned for visiting-card and
  // website use cases — they ask the model for ORIGINAL silhouettes
  // (no copies of any registered logo).
  vector: [
    { name: "Business",        prompt: "Professional corporate business infographic illustration" },
    { name: "Medical",         prompt: "Healthcare and medical science vector illustration" },
    { name: "Technology",      prompt: "Digital technology and data visualization icons" },
    { name: "Education",       prompt: "Educational learning concept illustration for school" },
    { name: "Social Media",    prompt: "Trendy social media marketing design elements" },
    { name: "Icon Set",        prompt: "Clean flat design icon set for mobile application" },
    {
      name: "Brand Icons",
      // Specifically the use-case the user asked for: unique social /
      // contact / share icons for visiting cards and websites.
      // Hard rule baked into the prompt: ORIGINAL silhouettes, never
      // copies of any registered brand mark.
      prompt:
        "Unique brand-style social, contact and share icon pack — original silhouettes inspired by familiar UI metaphors (chat bubble, phone receiver, envelope, share arrow, location pin, link, camera, globe, play, search) but visually distinct from any specific registered brand mark. Flat vector style, high contrast, single accent color, perfectly aligned to a square pixel grid. Designed for visiting cards, websites and mobile UI. No text, no logos, no human figures.",
    },
    {
      name: "Line Icons",
      prompt:
        "Set of clean line-style icons, uniform stroke weight (2px), rounded caps and joins, geometric construction on a 24×24 grid, monochromatic, designed for use in dashboards and mobile UIs.",
    },
    {
      name: "App UI",
      prompt:
        "Modern mobile app UI illustration — buttons, cards, toggles, badges, navigation bars — in a soft flat style with subtle gradients and rounded corners, ready to drop into a design system.",
    },
    { name: "Pattern",         prompt: "Seamless repeating decorative pattern design" },
    { name: "Isometric",       prompt: "Isometric 3D illustration of modern workspace" },
    // HALAL-safe: keep this template but force NON-HUMAN mascots only.
    { name: "Character",       prompt: "Non-human mascot character set (objects/animals/abstract only), no humans or humanoids" },
    { name: "Logo",            prompt: "Modern minimalist geometric logo design concepts" },
    { name: "Sticker Set",     prompt: "Cute kawaii animal sticker pack with different expressions" },
    { name: "Mockup",          prompt: "Minimalist product mockup with blank surface on styled background" },
    { name: "Social Template", prompt: "Modern social media post template background with text space" },
    { name: "Infographic",     prompt: "Clean flat infographic elements with process flow and charts" },
  ],

  // ─── VIDEO ─────────────────────────────────────────────────────
  // Cinematic / motion concepts. The previous list was only 6
  // entries — extended to cover the formats our users actually
  // produce (tutorial, cinematic story, slow-motion, vertical
  // shorts, motion graphics, travel, sports).
  video: [
    { name: "Product Demo",    prompt: "Smooth cinematic product reveal with rotating camera" },
    { name: "Corporate",       prompt: "Professional corporate brand video with modern office" },
    { name: "Nature",          prompt: "Stunning slow motion nature footage with ambient light" },
    { name: "Aerial",          prompt: "Sweeping drone aerial footage over scenic landscape" },
    { name: "Timelapse",       prompt: "Urban cityscape timelapse from golden hour to night" },
    { name: "Action",          prompt: "Dynamic action sequence with fast tracking camera" },
    { name: "Tutorial",        prompt: "Clean tutorial / explainer video with on-screen step labels and clear demo footage" },
    { name: "Cinematic Story", prompt: "Cinematic narrative film look — anamorphic framing, motivated lighting, slow deliberate camera moves" },
    { name: "Slow Motion",     prompt: "Hyper slow-motion shot at 240fps, water / fabric / dust particles caught mid-air, soft directional light" },
    { name: "Reels / Shorts",  prompt: "Vertical 9:16 short-form clip, fast cuts, bold on-screen text overlays, hook in the first 1.5 seconds" },
    { name: "Motion Graphics", prompt: "Clean motion-graphics sequence — animated icons, kinetic typography, smooth eased transitions, brand-color palette" },
    { name: "Travel",          prompt: "Cinematic travel film footage — wide establishing shots, intimate handheld details, natural ambient sound" },
    { name: "Sports",          prompt: "High-energy sports highlight reel, slow-motion replay shots intercut with real-time action, dynamic camera tracking" },
    { name: "Cooking",         prompt: "Top-down cooking video — clean wooden surface, ingredients in small bowls, hands working in frame, soft daylight" },
  ],
};
