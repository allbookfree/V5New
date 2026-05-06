// Heuristic quality scoring for generated prompts.
//
// We deliberately avoid an LLM round-trip here — this runs client-side on
// every render, so it has to be fast and deterministic.  The score is a
// signal, not a verdict: it surfaces obviously-weak prompts (too short, too
// repetitive, missing visual descriptors) so the user can refine or
// regenerate, but we never silently filter the model's output.
//
// Score is 0-100 with the following bands:
//   90-100 strong   — highly detailed, varied, sellable
//   70-89  good     — usable, minor gaps
//   50-69  okay     — generic, could be sharper
//   <50    weak     — too short / repetitive / off-topic
//
// We expose the individual sub-scores too so the UI can explain *why* a
// prompt got flagged ("too short", "low visual detail").

const VISUAL_KEYWORDS = [
  // lighting + atmosphere
  "light", "lit", "lighting", "shadow", "glow", "golden hour", "ambient", "dramatic", "soft", "neon", "sunset", "sunrise", "dusk", "dawn", "moody",
  // composition + camera
  "composition", "framing", "angle", "perspective", "close-up", "macro", "wide", "aerial", "overhead", "depth of field", "bokeh", "cinematic",
  // color
  "palette", "color", "colour", "warm", "cool", "vibrant", "muted", "pastel", "monochrome", "saturated",
  // texture + material
  "texture", "tactile", "matte", "glossy", "rough", "smooth", "fabric", "wood", "metal", "stone", "grain",
  // mood + style
  "minimalist", "elegant", "vintage", "modern", "futuristic", "rustic", "editorial",
];

const STYLE_KEYWORDS = [
  "photo", "photograph", "photorealistic", "illustration", "vector", "watercolor", "oil painting", "digital art",
  "3d render", "isometric", "flat design", "hand-drawn", "line art", "anime", "comic",
];

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function uniqueWordRatio(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return 0;
  const unique = new Set(tokens);
  return unique.size / tokens.length;
}

function countMatches(text, keywords) {
  const lower = String(text || "").toLowerCase();
  let count = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) count += 1;
  }
  return count;
}

// Score a single prompt string (0-100).  Returns { score, band, reasons }.
export function scorePrompt(prompt) {
  const text = String(prompt || "").trim();
  const reasons = [];

  if (text.length === 0) {
    return { score: 0, band: "weak", reasons: ["empty"] };
  }

  // --- Length signal (target ~12-50 words / 80-400 chars) -----------------
  const wordCount = tokenize(text).length;
  let lengthScore;
  if (wordCount < 6) {
    lengthScore = 10;
    reasons.push("too short");
  } else if (wordCount < 12) {
    lengthScore = 50;
    reasons.push("could be more descriptive");
  } else if (wordCount <= 60) {
    lengthScore = 100;
  } else if (wordCount <= 90) {
    lengthScore = 80;
  } else {
    lengthScore = 60;
    reasons.push("very long — may be hard for the model to parse");
  }

  // --- Visual descriptor density ------------------------------------------
  const visualHits = countMatches(text, VISUAL_KEYWORDS);
  let visualScore;
  if (visualHits === 0) {
    visualScore = 30;
    reasons.push("no visual descriptors (lighting, color, mood, etc.)");
  } else if (visualHits === 1) {
    visualScore = 60;
  } else if (visualHits <= 4) {
    visualScore = 90;
  } else {
    visualScore = 100;
  }

  // --- Style / medium hint ------------------------------------------------
  const styleHits = countMatches(text, STYLE_KEYWORDS);
  const styleScore = styleHits > 0 ? 100 : 70;
  if (styleHits === 0) reasons.push("no medium / style mentioned");

  // --- Diversity (unique-word ratio) --------------------------------------
  const ratio = uniqueWordRatio(text);
  let diversityScore;
  if (ratio >= 0.85) diversityScore = 100;
  else if (ratio >= 0.7) diversityScore = 85;
  else if (ratio >= 0.55) diversityScore = 65;
  else {
    diversityScore = 40;
    reasons.push("repetitive wording");
  }

  // --- Compose -------------------------------------------------------------
  const score = Math.round(
    lengthScore * 0.25 +
      visualScore * 0.35 +
      styleScore * 0.15 +
      diversityScore * 0.25
  );

  let band;
  if (score >= 90) band = "strong";
  else if (score >= 70) band = "good";
  else if (score >= 50) band = "okay";
  else band = "weak";

  return { score, band, reasons };
}

// Score a list of prompts and report aggregate signals (collection score and
// pairwise similarity to surface internal repetition across the set).
export function scoreCollection(prompts) {
  const list = (prompts || []).map(p => String(p || "").trim()).filter(Boolean);
  if (list.length === 0) {
    return { collectionScore: 0, individual: [], duplicates: 0 };
  }

  const individual = list.map(scorePrompt);
  const avg = individual.reduce((s, r) => s + r.score, 0) / individual.length;

  // Pairwise duplicate detection — first-12-words signature.  Cheap and
  // catches the common "model lazily varied a single adjective" failure mode.
  const sigs = new Map();
  let duplicates = 0;
  for (const p of list) {
    const sig = tokenize(p).slice(0, 12).join(" ");
    sigs.set(sig, (sigs.get(sig) || 0) + 1);
  }
  for (const count of sigs.values()) {
    if (count > 1) duplicates += count - 1;
  }

  // Penalty: each duplicate drags collection score down.
  const dupPenalty = Math.min(30, duplicates * 5);
  const collectionScore = Math.max(0, Math.round(avg - dupPenalty));

  return { collectionScore, individual, duplicates };
}
