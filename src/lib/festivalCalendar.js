// Festival calendar with multi-year accurate dates for moveable holidays.
//
// Lunar/Hijri/Hindu/Eastern-Christian holidays drift each year in the
// Gregorian calendar.  Islamic dates are now derived **dynamically** from the
// Um Al-Qura Hijri calendar via the `hijri-converter` package so the calendar
// stays accurate forever (no per-year tables to maintain).  Hindu / Chinese /
// Christian moveable feasts still use a per-year table because their
// calculations require additional ephemeris data; the table covers 2026-2030
// with a wider approximation window for years outside the table.
//
// Fixed-date holidays (Christmas, Valentine's Day, Earth Day, etc.) keep a
// simple month/day window because they are anchored to the Gregorian calendar.

import { toGregorian } from "hijri-converter";

// Compute the Gregorian range (start, end) for an Islamic event identified by
// its first Hijri month/day and its duration in days.  Some events span the
// last days of the previous Hijri year (e.g. Shab-e-Barat falls in Sha'ban,
// the 8th Hijri month), so we accept an offset and let the caller pass the
// correct Hijri month for the *current* Gregorian year.
function hijriRange(hijriMonth, hijriDay, durationDays, gYear) {
  // The same Gregorian year usually contains TWO different Hijri-year
  // anchors (because the Hijri year is ~11 days shorter).  We pick whichever
  // candidate Hijri year places the event inside the current Gregorian year.
  const candidates = [];
  for (const hy of [gYear - 579, gYear - 578, gYear - 577]) {
    try {
      const g = toGregorian(hy, hijriMonth, hijriDay);
      if (g && g.gy === gYear) {
        const startDate = new Date(Date.UTC(g.gy, g.gm - 1, g.gd));
        const endDate = new Date(startDate);
        endDate.setUTCDate(endDate.getUTCDate() + Math.max(0, durationDays - 1));
        candidates.push({
          start: [startDate.getUTCMonth() + 1, startDate.getUTCDate()],
          end: [endDate.getUTCMonth() + 1, endDate.getUTCDate()],
        });
      }
    } catch {}
  }
  return candidates[0] || null;
}

function islamicWindow(name, gYear) {
  // Moon-sighting can shift Islamic events by ±1 day from astronomical
  // calculations.  We err on the side of a slightly wider window (extra day
  // each side) so the festival mode triggers reliably.
  let raw = null;
  switch (name) {
    case "Ramadan":
      raw = hijriRange(9, 1, 30, gYear);
      break;
    case "Eid ul-Fitr":
      raw = hijriRange(10, 1, 4, gYear); // Shawwal 1-4
      break;
    case "Eid ul-Adha":
      raw = hijriRange(12, 10, 5, gYear); // Dhul-Hijjah 10-14
      break;
    case "Muharram":
      raw = hijriRange(1, 1, 15, gYear); // first half of Muharram
      break;
    case "Shab-e-Barat":
      raw = hijriRange(8, 14, 3, gYear); // Sha'ban 14-16
      break;
    default:
      return null;
  }
  if (!raw) return null;
  // Widen by one day on each side to absorb local moon-sighting variance.
  const widen = (md, days) => {
    const d = new Date(Date.UTC(gYear, md[0] - 1, md[1] + days));
    return [d.getUTCMonth() + 1, d.getUTCDate()];
  };
  return { start: widen(raw.start, -1), end: widen(raw.end, 1) };
}

const MOVEABLE = {
  // Islamic holidays — derived dynamically from Hijri calendar (see
  // islamicWindow above).  No per-year table needed; works for any year.
  Ramadan: { __hijri: true },
  "Eid ul-Fitr": { __hijri: true },
  "Eid ul-Adha": { __hijri: true },
  Muharram: { __hijri: true },
  "Shab-e-Barat": { __hijri: true },
  Holi: {
    2026: { start: [3, 1], end: [3, 4] },
    2027: { start: [3, 19], end: [3, 22] },
    2028: { start: [3, 8], end: [3, 11] },
    2029: { start: [2, 27], end: [3, 1] },
    2030: { start: [3, 16], end: [3, 19] },
  },
  Diwali: {
    2026: { start: [11, 5], end: [11, 11] },
    2027: { start: [10, 26], end: [11, 1] },
    2028: { start: [11, 14], end: [11, 19] },
    2029: { start: [11, 2], end: [11, 7] },
    2030: { start: [10, 23], end: [10, 28] },
  },
  Navratri: {
    2026: { start: [10, 11], end: [10, 19] },
    2027: { start: [9, 30], end: [10, 8] },
    2028: { start: [10, 18], end: [10, 26] },
    2029: { start: [10, 8], end: [10, 16] },
    2030: { start: [9, 27], end: [10, 5] },
  },
  "Durga Puja": {
    2026: { start: [10, 15], end: [10, 21] },
    2027: { start: [10, 5], end: [10, 11] },
    2028: { start: [10, 23], end: [10, 29] },
    2029: { start: [10, 13], end: [10, 19] },
    2030: { start: [10, 2], end: [10, 8] },
  },
  "Chinese New Year": {
    2026: { start: [2, 13], end: [2, 19] },
    2027: { start: [2, 2], end: [2, 8] },
    2028: { start: [1, 22], end: [1, 28] },
    2029: { start: [2, 9], end: [2, 15] },
    2030: { start: [1, 30], end: [2, 5] },
  },
  "Mid-Autumn Festival": {
    2026: { start: [9, 22], end: [9, 27] },
    2027: { start: [9, 13], end: [9, 17] },
    2028: { start: [10, 1], end: [10, 5] },
    2029: { start: [9, 20], end: [9, 24] },
    2030: { start: [9, 10], end: [9, 14] },
  },
  "Dragon Boat Festival": {
    2026: { start: [6, 17], end: [6, 21] },
    2027: { start: [6, 7], end: [6, 11] },
    2028: { start: [5, 26], end: [5, 30] },
    2029: { start: [6, 14], end: [6, 18] },
    2030: { start: [6, 4], end: [6, 8] },
  },
  Easter: {
    2026: { start: [4, 1], end: [4, 6] },
    2027: { start: [3, 24], end: [3, 29] },
    2028: { start: [4, 12], end: [4, 17] },
    2029: { start: [3, 28], end: [4, 2] },
    2030: { start: [4, 17], end: [4, 22] },
  },
  "Good Friday": {
    2026: { start: [4, 3], end: [4, 3] },
    2027: { start: [3, 26], end: [3, 26] },
    2028: { start: [4, 14], end: [4, 14] },
    2029: { start: [3, 30], end: [3, 30] },
    2030: { start: [4, 19], end: [4, 19] },
  },
  Thanksgiving: {
    2026: { start: [11, 26], end: [11, 26] },
    2027: { start: [11, 25], end: [11, 25] },
    2028: { start: [11, 23], end: [11, 23] },
    2029: { start: [11, 22], end: [11, 22] },
    2030: { start: [11, 28], end: [11, 28] },
  },
  "Mother's Day": {
    2026: { start: [5, 10], end: [5, 10] },
    2027: { start: [5, 9], end: [5, 9] },
    2028: { start: [5, 14], end: [5, 14] },
    2029: { start: [5, 13], end: [5, 13] },
    2030: { start: [5, 12], end: [5, 12] },
  },
  "Father's Day": {
    2026: { start: [6, 21], end: [6, 21] },
    2027: { start: [6, 20], end: [6, 20] },
    2028: { start: [6, 18], end: [6, 18] },
    2029: { start: [6, 17], end: [6, 17] },
    2030: { start: [6, 16], end: [6, 16] },
  },
};

// Approximate fallback windows when the year is outside the table.
// Lunar holidays drift ~11 days/year; we widen the window so users still see
// a hint, but the year-specific table above is the source of truth for accuracy.
const FALLBACK_WINDOW = {
  Ramadan: { month: 2, startDay: 1, endDay: 31 },
  "Eid ul-Fitr": { month: 3, startDay: 1, endDay: 31 },
  "Eid ul-Adha": { month: 5, startDay: 1, endDay: 31 },
  Muharram: { month: 6, startDay: 1, endDay: 30 },
  "Shab-e-Barat": { month: 1, startDay: 15, endDay: 31 },
  Holi: { month: 3, startDay: 1, endDay: 22 },
  Diwali: { month: 10, startDay: 25, endDay: 30 },
  Navratri: { month: 10, startDay: 1, endDay: 25 },
  "Durga Puja": { month: 10, startDay: 5, endDay: 25 },
  "Chinese New Year": { month: 1, startDay: 25, endDay: 31 },
  "Mid-Autumn Festival": { month: 9, startDay: 15, endDay: 30 },
  "Dragon Boat Festival": { month: 6, startDay: 1, endDay: 20 },
  Easter: { month: 4, startDay: 1, endDay: 25 },
  "Good Friday": { month: 4, startDay: 1, endDay: 22 },
  Thanksgiving: { month: 11, startDay: 22, endDay: 28 },
  "Mother's Day": { month: 5, startDay: 8, endDay: 14 },
  "Father's Day": { month: 6, startDay: 14, endDay: 21 },
};

const FESTIVALS = [
  { name: "New Year", namebn: "নববর্ষ", month: 1, startDay: 1, endDay: 7, region: "global", keywords: ["fireworks", "countdown clock", "festive juice glasses", "confetti", "calendar page turning", "midnight sky", "sparklers", "party decorations", "golden ornaments", "new beginnings nature"] },
  { name: "Chinese New Year", namebn: "চাইনিজ নববর্ষ", region: "chinese", keywords: ["red lanterns hanging", "dragon decoration golden", "lucky red envelope", "plum blossom branch", "firecrackers decoration", "mandarin oranges pile", "spring couplets calligraphy", "lion dance costume head", "dumpling making process", "cherry blossom spring"] },
  { name: "Valentine's Day", namebn: "ভ্যালেন্টাইন ডে", month: 2, startDay: 1, endDay: 14, region: "western", keywords: ["red roses bouquet", "heart-shaped chocolates", "love letters", "romantic dinner table setting", "pink petals scattered", "gift boxes with ribbons", "candle-lit ambiance", "romantic garden path", "heart balloons", "valentines card craft"] },
  { name: "Shab-e-Barat", namebn: "শবে বরাত", region: "islamic", keywords: ["mosque at night full moon", "candle-lit prayer space", "Islamic geometric lantern", "crescent above minaret", "night sky stars mosque", "Quran and prayer beads", "halwa sweets plate", "fireworks over mosque", "oil lamp row glowing", "full moon night landscape"] },
  { name: "Ramadan", namebn: "রমজান", region: "islamic", keywords: ["crescent moon night sky", "ornate lantern glowing", "dates on silver tray", "iftar table spread", "mosque silhouette at dusk", "prayer beads tasbih", "Quran on wooden stand", "Arabic calligraphy art", "geometric Islamic pattern", "suhoor pre-dawn meal", "Ramadan kareem decoration", "fanous lantern ornamental"] },
  { name: "International Women's Day", namebn: "আন্তর্জাতিক নারী দিবস", month: 3, startDay: 1, endDay: 8, region: "international", keywords: ["purple flowers arrangement", "empowerment symbols", "diversity illustration", "equal sign art", "women day poster background", "purple ribbon", "mimosa flowers", "inspiring quote board", "floral wreath purple", "celebration decorations purple"] },
  { name: "Holi", namebn: "হোলি", region: "hindu", keywords: ["colorful powder piles", "gulal powder bowls", "rangoli art pattern", "color splash abstract", "thandai drink glass", "gujiya sweets plate", "bonfire wood stack", "colored water balloons", "spring flowers bloom", "vibrant abstract splashes"] },
  { name: "Eid ul-Fitr", namebn: "ঈদ উল ফিতর", region: "islamic", keywords: ["Eid mubarak calligraphy", "crescent moon and star", "festive lanterns lit", "dates and sweets tray", "mosque dome golden hour", "gift boxes wrapped", "henna pattern design", "geometric star pattern", "festive table spread", "Eid decorations gold", "sheer khurma dessert bowl", "Islamic geometric art"] },
  { name: "Good Friday", namebn: "গুড ফ্রাইডে", region: "christian", keywords: ["wooden cross silhouette sunset", "olive branch peaceful", "church stained glass window", "candle vigil arrangement", "crown of thorns still life", "purple fabric draped", "stone pathway ancient", "sunset sky dramatic clouds", "white lily on dark background", "old wooden church door"] },
  { name: "Easter", namebn: "ইস্টার", region: "christian", keywords: ["decorated Easter eggs", "spring flowers basket", "Easter bunny chocolate", "pastel color palette", "spring garden bloom", "egg hunt basket", "hot cross buns", "lily flowers white", "Easter wreath on door", "nest with colored eggs"] },
  { name: "Earth Day", namebn: "পৃথিবী দিবস", month: 4, startDay: 15, endDay: 22, region: "international", keywords: ["green planet illustration", "seedling growing in soil", "recycling symbols", "renewable energy icons", "forest canopy aerial", "ocean conservation", "wildflower meadow", "solar panels on roof", "wind turbines field", "eco-friendly products"] },
  { name: "Pohela Boishakh", namebn: "পহেলা বৈশাখ", month: 4, startDay: 10, endDay: 14, region: "global", keywords: ["alpona floor art", "clay pot decoration", "festive sweets platter", "mango motif pattern", "brass water vessel", "tropical flower garland", "fair stall colorful", "traditional mask art", "red and white fabric", "new year calendar art"] },
  { name: "Mother's Day", namebn: "মা দিবস", region: "western", keywords: ["flower bouquet gift", "breakfast tray setup", "greeting card handmade", "garden roses pink", "gift wrapped with bow", "tea set with flowers", "heart decoration", "perfume bottle elegant", "potted plant gift", "cake with flowers decoration"] },
  { name: "Eid ul-Adha", namebn: "ঈদ উল আযহা", region: "islamic", keywords: ["mosque silhouette sunrise", "crescent moon star", "Eid decoration gold green", "calligraphy bismillah", "lanterns ornate brass", "Islamic geometric tiles", "date palm grove", "prayer mat ornamental", "festive bakery sweets", "henna art pattern", "incense burner traditional", "arabesque floral design"] },
  { name: "World Environment Day", namebn: "বিশ্ব পরিবেশ দিবস", month: 6, startDay: 1, endDay: 5, region: "international", keywords: ["tropical rainforest canopy", "coral reef underwater", "wildflower garden", "tree planting ceremony", "solar energy panels", "clean river flowing", "endangered species", "sustainable farming", "green city aerial", "biodiversity collage nature"] },
  { name: "Dragon Boat Festival", namebn: "ড্রাগন বোট উৎসব", region: "chinese", keywords: ["dragon boat on river", "zongzi rice dumplings", "bamboo leaves wrapping", "dragon head carved boat", "river race scenery", "lotus flowers summer", "traditional knot decoration", "traditional tea vessel", "drum on boat deck", "five-color thread bracelet"] },
  { name: "Father's Day", namebn: "বাবা দিবস", region: "western", keywords: ["necktie gift box", "watch and cufflinks", "toolbox vintage", "coffee mug on desk", "leather wallet", "greeting card", "grilling barbecue setup", "fishing rod reel", "book and glasses", "workshop tools organized"] },
  { name: "Muharram", namebn: "মুহাররম", region: "islamic", keywords: ["mosque dome twilight", "crescent moon thin", "Islamic calligraphy gold", "prayer beads close-up", "lantern soft glow", "Quran open page", "minaret at sunset", "geometric tile pattern", "incense smoke wisps", "dates and water simple"] },
  { name: "Mid-Autumn Festival", namebn: "মধ্য-শরৎ উৎসব", region: "chinese", keywords: ["mooncakes on plate", "full moon night sky", "red lanterns hanging", "lotus seed paste", "moon rabbit illustration", "tea set traditional", "pomelo fruit cut", "lantern festival lights", "osmanthus flowers", "family dinner table round"] },
  { name: "Navratri", namebn: "নবরাত্রি", region: "hindu", keywords: ["colorful garba sticks", "dandiya decoration", "marigold garland", "oil lamp diya row", "rangoli pattern vibrant", "festive flowers arrangement", "traditional fabric drape", "brass pot decorated", "color powder piles", "temple bell ornamental"] },
  { name: "Durga Puja", namebn: "দুর্গা পূজা", region: "hindu", keywords: ["marigold garland decoration", "festive lights pandal", "dhunuchi incense burner", "sindoor vermillion bowl", "traditional sweets platter", "brass bell and lamp", "autumn flower arrangement", "decorative alpona floor art", "festive market lights", "red hibiscus flowers"] },
  { name: "World Food Day", namebn: "বিশ্ব খাদ্য দিবস", month: 10, startDay: 10, endDay: 16, region: "international", keywords: ["world cuisine variety", "fresh produce market", "grain harvest golden", "sustainable agriculture", "food photography setup", "spice collection display", "bread baking process", "fruit arrangement colorful", "kitchen garden harvest", "farm to table concept"] },
  { name: "Halloween", namebn: "হ্যালোইন", month: 10, startDay: 15, endDay: 31, region: "western", keywords: ["carved pumpkin jack-o-lantern", "autumn leaves orange", "spooky forest fog", "haunted house silhouette", "spider web with dew", "black cat silhouette", "witch hat and broomstick", "candy corn pile", "bat silhouettes at dusk", "skeleton decoration funny"] },
  { name: "Diwali", namebn: "দিওয়ালি", region: "hindu", keywords: ["oil lamp diya row glowing", "rangoli pattern colorful", "fireworks night sky", "marigold flower garland", "lantern string lights", "sweets box mithai", "candle arrangement", "sparkler light trails", "peacock feather decoration", "lotus candle floating"] },
  { name: "Thanksgiving", namebn: "থ্যাংকসগিভিং", region: "western", keywords: ["autumn harvest table", "pumpkin pie golden", "cornucopia horn of plenty", "fall leaves wreath", "turkey dinner table setup", "maple syrup pour", "cranberry sauce bowl", "autumn farm landscape", "gratitude journal notebook", "cozy fireplace scene"] },
  { name: "Christmas", namebn: "বড়দিন", month: 12, startDay: 1, endDay: 25, region: "christian", keywords: ["Christmas tree decorated", "gift boxes under tree", "snow globe scene", "gingerbread house", "candy cane red white", "winter wreath on door", "stockings by fireplace", "ornament ball golden", "hot cocoa with marshmallows", "snowflake crystal macro", "pine cone arrangement", "Christmas lights bokeh"] },
  { name: "Winter Solstice", namebn: "শীতকালীন অয়নান্ত", month: 12, startDay: 18, endDay: 31, region: "global", keywords: ["frozen lake landscape", "snow-covered pine trees", "cozy cabin in snow", "fireplace warm glow", "winter berries on branch", "icicle formations", "snowfall in forest", "warm knit blanket", "hot drink steaming cup", "winter sunset golden"] },
  { name: "Spring Season", namebn: "বসন্তকাল", month: 3, startDay: 15, endDay: 31, region: "seasonal", keywords: ["cherry blossom petals falling", "spring meadow wildflowers", "garden sprouts emerging", "rain on flower buds", "butterfly on spring flower", "fresh green leaves", "bird nest with eggs", "morning dew on grass", "tulip garden rows", "spring river flowing"] },
  { name: "Summer Season", namebn: "গ্রীষ্মকাল", month: 6, startDay: 15, endDay: 30, region: "seasonal", keywords: ["tropical beach sunset", "sunflower field golden", "ice cream cones colorful", "swimming pool aerial", "summer fruits basket", "lemonade pitcher glass", "beach umbrella colorful", "coral reef underwater", "summer garden bloom", "hammock between palms"] },
  { name: "Autumn Season", namebn: "শরৎকাল", month: 9, startDay: 20, endDay: 30, region: "seasonal", keywords: ["autumn maple leaves red", "pumpkin patch farm", "harvest wheat golden", "foggy forest morning", "apple orchard basket", "mushrooms on forest floor", "acorn and oak leaves", "autumn vineyard colors", "cozy reading nook", "cinnamon and spice arrangement"] },
  { name: "Winter Season", namebn: "শীতকাল", month: 12, startDay: 1, endDay: 31, region: "seasonal", keywords: ["snowy mountain peak", "frozen waterfall ice", "northern lights aurora", "pine forest snow", "winter birds on branch", "frost on window pane", "sleigh in snow landscape", "ice crystal macro", "warm fireplace cozy", "snow-covered village scene"] },
];

function resolveDateRange(fest, year) {
  const moveable = MOVEABLE[fest.name];
  if (moveable) {
    if (moveable.__hijri) {
      const w = islamicWindow(fest.name, year);
      if (w) {
        const [sm, sd] = w.start;
        const [em, ed] = w.end;
        return {
          start: new Date(year, sm - 1, sd),
          end: new Date(year, em - 1, ed, 23, 59, 59),
        };
      }
      // Fall through to FALLBACK_WINDOW if Hijri conversion failed.
    }
    const exact = moveable[year];
    if (exact) {
      const [sm, sd] = exact.start;
      const [em, ed] = exact.end;
      return {
        start: new Date(year, sm - 1, sd),
        end: new Date(year, em - 1, ed, 23, 59, 59),
      };
    }
    const fb = FALLBACK_WINDOW[fest.name];
    if (fb) {
      return {
        start: new Date(year, fb.month - 1, fb.startDay),
        end: new Date(year, fb.month - 1, fb.endDay, 23, 59, 59),
      };
    }
  }
  if (typeof fest.month === "number" && typeof fest.startDay === "number") {
    return {
      start: new Date(year, fest.month - 1, fest.startDay),
      end: new Date(year, fest.month - 1, fest.endDay ?? fest.startDay, 23, 59, 59),
    };
  }
  return null;
}

export function getUpcomingFestivals(daysAhead = 30) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const results = [];

  for (const fest of FESTIVALS) {
    let range = resolveDateRange(fest, currentYear);
    if (!range) continue;

    if (range.start < now && range.end < now) {
      range = resolveDateRange(fest, currentYear + 1) || range;
    }

    const daysUntilStart = Math.ceil((range.start - now) / (1000 * 60 * 60 * 24));
    const isActive = now >= range.start && now <= range.end;

    if (isActive || (daysUntilStart >= 0 && daysUntilStart <= daysAhead)) {
      results.push({
        ...fest,
        startDate: range.start,
        endDate: range.end,
        daysUntil: isActive ? 0 : daysUntilStart,
        isActive,
      });
    }
  }

  results.sort((a, b) => a.daysUntil - b.daysUntil);
  return results;
}

export function getFestivalSubjects(festival) {
  return festival.keywords || [];
}

export function getFestivalContext(festivals) {
  if (!festivals || festivals.length === 0) return "";
  const top = festivals.slice(0, 3);
  const lines = top.map(f => {
    const status = f.isActive ? "NOW ACTIVE" : `in ${f.daysUntil} days`;
    return `- ${f.name} (${status}): themes — ${f.keywords.slice(0, 6).join(", ")}`;
  });
  return `\n\n[FESTIVAL/SEASONAL MODE — COMMERCIAL PRIORITY]
Stock platforms see 200-400% demand spikes for seasonal content uploaded 2-4 weeks BEFORE events.
Upcoming festivals/seasons to target:
${lines.join("\n")}

IMPORTANT: Bias your prompts toward these festival/seasonal themes. Create commercially valuable content that buyers will search for around these events. Mix festival elements with the subject naturally — decorations, food, colors, symbols, atmosphere. Remember: NO human figures, focus on objects, decorations, food, nature, architecture, patterns.`;
}
