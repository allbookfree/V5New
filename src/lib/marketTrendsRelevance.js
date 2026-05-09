// Stock-image relevance scorer used by /api/market-trends.
//
// Google Trends is general — celebrity gossip, sports results, breaking
// news, finance. Most of those translate poorly to stock-image demand.
// This module exports a lightweight heuristic that scores each trend
// 0-10 based on how likely it is to be useful to a microstock seller.
//
// Negative patterns subtract; positive patterns add. The default base
// score is 5 so a query with no signal stays neutral. We deliberately
// avoid an LLM call here so the page costs nothing extra to render —
// the scoring runs server-side, in-memory, in microseconds.
//
// This file is intentionally framework-agnostic (no @/ aliases, no
// Next-only imports) so it can be unit-tested directly with `node --test`.

export const NEGATIVE_PATTERNS = [
  // Sports — team names, fixtures, results
  /\b(score|fixtures?|results?|game|match|vs\.?|cup|league|championship|tournament|playoffs?|finals?|nfl|nba|mlb|nhl|fifa|uefa|premier league|la liga|bundesliga|serie a|ipl|cricket|football|soccer|baseball|basketball|hockey|tennis|golf|f1|formula 1|nascar)\b/i,
  // Politics — election, parties, leaders, government bodies
  /\b(election|elections?|vote|voted|voting|poll|polls?|senator|congress|parliament|prime minister|president|impeach|impeachment|filibuster|democrat|republican|labour|tory|trump|biden|harris|modi|xi jinping|putin|netanyahu|zelensky)\b/i,
  // Breaking news — death, accidents, crime
  /\b(crash|crashed|killed|dies?|dead|death|shooting|attack|terror|verdict|jury|trial|arrested|charged|murder|stabbing|missing|shot|fired)\b/i,
  // Finance / crypto headlines
  /\b(stock price|nasdaq|dow jones|s&p 500|earnings|ipo|merger|crypto|bitcoin|btc|ethereum|eth|dogecoin|nft|bear market|bull market|recession|inflation rate)\b/i,
  // Disasters / weather alerts
  /\b(hurricane|tornado|earthquake|tsunami|flood warning|wildfire alert|evacuation|state of emergency)\b/i,
  // Reality TV / live entertainment results (often celebrity-driven)
  /\b(eliminated|episode \d|season \d finale|live results|spoiler|recap|rumor|feud|split|divorce|exes?|breakup|cheating scandal)\b/i,
];

export const POSITIVE_PATTERNS = [
  // Aesthetic / design / lifestyle
  /\b(style|fashion|design|decor|art|aesthetic|outfit|recipe|diy|tutorial|inspiration|ideas?|trends?)\b/i,
  // Seasonal / festive (highest stock-image value)
  /\b(wedding|season|holiday|festival|christmas|easter|halloween|valentine|valentines|mother'?s? day|father'?s? day|thanksgiving|new year|hanukkah|diwali|eid|ramadan|chinese new year|lunar new year)\b/i,
  // Nature / scenery / object photography
  /\b(landscape|sunset|sunrise|mountain|beach|ocean|forest|garden|flower|floral|bird|animal|wildlife|food|coffee|tea|cake|cookie|fruit|vegetable|drink|cocktail)\b/i,
  // Interior / home / architecture
  /\b(office|home|kitchen|bedroom|bathroom|interior|exterior|architecture|cottage|cabin|villa|apartment|loft|studio|workspace)\b/i,
  // Wellness / lifestyle / fitness
  /\b(yoga|fitness|workout|meditation|wellness|self-care|self care|spa|retreat|mindful|skincare|beauty)\b/i,
  // Niches that consistently sell on Etsy / Adobe / Shutterstock
  /\b(boho|minimalist|vintage|retro|cottagecore|coastal|farmhouse|scandinavian|nordic|japandi|art deco|mid-century|bohemian|rustic|industrial|tropical)\b/i,
  // Business / corporate stock staples
  /\b(meeting|teamwork|business|corporate|presentation|conference|productivity|remote work|coworking|startup|entrepreneur)\b/i,
];

export function scoreStockRelevance(title, newsItems) {
  if (typeof title !== "string" || !title.trim()) return 5;
  const text = `${title} ${(newsItems || []).map(n => n?.title || "").join(" ")}`;
  let score = 5;
  for (const r of NEGATIVE_PATTERNS) {
    if (r.test(text)) score -= 3;
  }
  for (const r of POSITIVE_PATTERNS) {
    if (r.test(text)) score += 2;
  }
  return Math.max(0, Math.min(10, score));
}
