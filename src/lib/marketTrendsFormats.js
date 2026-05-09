// Per-format relevance heuristics. Used by the /market-trends UI to
// highlight which trends are most likely to land on each creator
// format (image / vector / video / POD). Pure regex pattern matching,
// no LLM call — fast enough to run on every render.
//
// The "all" format returns 1 for every input so the tab acts as a
// no-op filter. Other formats return a score in [0, 1] based on how
// many positive / negative keyword matches the title carries.

const FORMAT_PATTERNS = {
  image: {
    positive: [
      /\b(photo|photograph|landscape|portrait|sunset|sunrise|aerial|skyline|cityscape|wedding|food|drink|lifestyle|travel|nature|wildlife|flora|fauna|interior|architectural|model|fashion shoot|product shot)\b/i,
      /\b(beach|mountain|forest|ocean|sky|cloud|fog|mist|reflection|silhouette|bokeh|hdr|long exposure|macro|aerial|drone)\b/i,
    ],
    negative: [
      /\b(icon|svg|vector|line art|flat design|infographic|emoji|sticker pack)\b/i,
      /\b(timelapse|loop|reel|short|tiktok|youtube short)\b/i,
    ],
  },
  vector: {
    positive: [
      /\b(icon|icons|svg|vector|illustration|line art|flat design|outline|minimal|geometric|pattern|seamless|wallpaper|infographic|logo|emblem|monogram|silhouette|clipart|sticker)\b/i,
      /\b(typography|lettering|calligraphy|hand-drawn|doodle|sketch|cartoon|character|mascot|emoji|badge|crest|mandala|abstract shapes?|gradient mesh)\b/i,
    ],
    negative: [
      /\b(photograph|raw photo|cinematic|drone footage|shutter speed|hdr|bokeh|long exposure)\b/i,
    ],
  },
  video: {
    positive: [
      /\b(video|footage|motion|animation|animated|loop|reel|short|timelapse|hyperlapse|slow.?motion|cinematic|b.?roll|vlog|youtube|tiktok|reel|stock footage|drone|aerial)\b/i,
      /\b(transition|montage|trailer|teaser|advert|ad spot|commercial|montage|gif|3d animation|2d animation|mograph|motion graphics|kinetic typography)\b/i,
    ],
    negative: [
      /\b(static photo|wall print|poster|sticker|svg|icon set)\b/i,
    ],
  },
  pod: {
    positive: [
      /\b(t.?shirt|tee|hoodie|sweatshirt|sticker|tote|mug|coffee cup|tumbler|water bottle|phone case|airpod case|laptop sleeve|enamel pin|patch|button|magnet|tote bag|throw pillow|cushion|wall art|wall decor|canvas print|poster|art print|tapestry|blanket|quilt|towel)\b/i,
      /\b(pod|print on demand|redbubble|teespring|spreadshirt|teepublic|society6|zazzle|merch|merchandise|graphic tee|funny|saying|quote|slogan|typography|holiday gift|valentines|christmas gift|fathers? day|mothers? day)\b/i,
    ],
    negative: [
      /\b(timelapse|drone footage|stock video|motion graphics)\b/i,
    ],
  },
};

export const FORMAT_KEYS = ["all", "image", "vector", "video", "pod"];

/**
 * Score how relevant a free-text title is for a given creator format.
 *
 * @param {string} title - the trend title or keyword
 * @param {"all"|"image"|"vector"|"video"|"pod"} format
 * @returns number in [0, 1]
 */
export function scoreFormatRelevance(title, format) {
  if (format === "all") return 1;
  const patterns = FORMAT_PATTERNS[format];
  if (!patterns) return 0.5;
  if (typeof title !== "string" || !title.trim()) return 0.5;

  let positive = 0;
  for (const r of patterns.positive) {
    if (r.test(title)) positive += 1;
  }
  let negative = 0;
  for (const r of patterns.negative) {
    if (r.test(title)) negative += 1;
  }

  if (positive === 0 && negative === 0) return 0.5; // no signal either way
  const raw = (positive - negative) / Math.max(positive + negative, 1);
  // Map [-1, 1] → [0, 1]
  return Math.max(0, Math.min(1, (raw + 1) / 2));
}

/**
 * Filter and sort a list of trends by per-format relevance.
 *
 * @param {Array<{ title: string }>} trends
 * @param {"all"|"image"|"vector"|"video"|"pod"} format
 * @param {number} threshold - 0..1, items below this are dropped (except "all")
 * @returns sorted array (descending relevance) with `.formatScore` attached
 */
export function filterByFormat(trends, format, threshold = 0.5) {
  if (!Array.isArray(trends)) return [];
  if (format === "all") return trends.map((t) => ({ ...t, formatScore: 1 }));
  return trends
    .map((t) => ({ ...t, formatScore: scoreFormatRelevance(t.title || t.alt || "", format) }))
    .filter((t) => t.formatScore >= threshold)
    .sort((a, b) => b.formatScore - a.formatScore);
}
