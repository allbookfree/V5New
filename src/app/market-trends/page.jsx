"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import MarketplaceTrendsSection from "@/components/MarketplaceTrendsSection";
import DiscoverPanel from "@/components/DiscoverPanel";
import AnalysisPanel from "@/components/AnalysisPanel";
import { filterByFormat, FORMAT_KEYS } from "@/lib/marketTrendsFormats";
import {
  TrendingUp, RefreshCw, ExternalLink, Calendar, Store,
  Lightbulb, ChevronDown, ChevronUp, Globe, Sparkles, AlertTriangle,
  Image as ImageIcon, Palette, Video, Filter, Shirt, LayoutGrid,
} from "lucide-react";

// ─── Geo presets for the live Google Trends RSS feed ─────────────────
//
// Kept short and meaningful for the user's likely target markets:
//   • US, GB — primary stock buyer base (Adobe, Shutterstock, Etsy)
//   • IN     — fastest-growing English search market
//   • JP     — Pixta's home turf
//   • BR     — strong on Pond5 / Wirestock for video
//   • BD     — local context for the user
//   • DE, FR — European print-on-demand and Adobe demand

const GEOS = [
  { id: "US", flag: "🇺🇸", label: { en: "United States", bn: "যুক্তরাষ্ট্র" } },
  { id: "GB", flag: "🇬🇧", label: { en: "United Kingdom", bn: "যুক্তরাজ্য" } },
  { id: "IN", flag: "🇮🇳", label: { en: "India", bn: "ভারত" } },
  { id: "DE", flag: "🇩🇪", label: { en: "Germany", bn: "জার্মানি" } },
  { id: "FR", flag: "🇫🇷", label: { en: "France", bn: "ফ্রান্স" } },
  { id: "JP", flag: "🇯🇵", label: { en: "Japan", bn: "জাপান" } },
  { id: "BR", flag: "🇧🇷", label: { en: "Brazil", bn: "ব্রাজিল" } },
  { id: "BD", flag: "🇧🇩", label: { en: "Bangladesh", bn: "বাংলাদেশ" } },
];

// ─── Seasonal niche calendar (curated) ──────────────────────────────
//
// What sells on Etsy / Adobe / Shutterstock in each month, based on the
// last 3 years of marketplace trend reports + Etsy's own seasonal
// calendar. These are the "evergreen" niches that show up year after
// year — pivots happen on top of these, but starting from a calendar
// like this avoids the trap of chasing one-off virality.
//
// Phase 2: replace the static list with a live API once we have access
// to a marketplace's bestseller feed.

const SEASONAL = [
  {
    month: 1, name: { en: "January", bn: "জানুয়ারি" },
    niches: [
      { en: "New Year resolutions, fitness, planners", bn: "নিউ ইয়ার রেজোলিউশন, ফিটনেস, প্ল্যানার" },
      { en: "Winter landscapes, snow scenes, cozy interiors", bn: "শীতের ল্যান্ডস্কেপ, তুষারপাত, কোজি ইন্টিরিয়র" },
      { en: "Chinese New Year (late Jan / Feb)", bn: "চাইনিজ নিউ ইয়ার (জানু শেষ / ফেব)" },
      { en: "Lunar dragon / animal of the year illustrations", bn: "চান্দ্র বছরের প্রাণীর ইলাস্ট্রেশন" },
      { en: "Goal-setting infographics, journaling templates", bn: "গোল-সেটিং ইনফোগ্রাফিক, জার্নাল টেমপ্লেট" },
    ],
  },
  {
    month: 2, name: { en: "February", bn: "ফেব্রুয়ারি" },
    niches: [
      { en: "Valentine's Day — couples, hearts, love quotes, roses", bn: "ভ্যালেন্টাইনস ডে — কাপল, হার্ট, লাভ কোট, গোলাপ" },
      { en: "Black History Month visuals (US/UK)", bn: "ব্ল্যাক হিস্টরি মাস (US/UK)" },
      { en: "Galentine's, friendship-themed art", bn: "গ্যালেন্টাইন, বন্ধুত্বের আর্ট" },
      { en: "Love-themed wall art for Etsy", bn: "Etsy-এর জন্য লাভ-থিম ওয়াল আর্ট" },
      { en: "21st February — Bengali Mother Language Day", bn: "একুশে ফেব্রুয়ারি — মাতৃভাষা দিবস" },
    ],
  },
  {
    month: 3, name: { en: "March", bn: "মার্চ" },
    niches: [
      { en: "Spring florals — tulips, cherry blossom, pastel palettes", bn: "বসন্তের ফুল — টিউলিপ, চেরি ব্লসম, প্যাস্টেল প্যালেট" },
      { en: "St. Patrick's Day — green, leprechauns, shamrock", bn: "সেন্ট প্যাট্রিকস ডে — সবুজ, শ্যামরক" },
      { en: "International Women's Day — empowerment, portraits", bn: "আন্তর্জাতিক নারী দিবস — পোর্ট্রেট" },
      { en: "Ramadan & Iftar food, lantern, mosque silhouette", bn: "রমজান ও ইফতার খাবার, লণ্ঠন, মসজিদ" },
      { en: "Pi Day, Earth Hour, Easter prep starts late March", bn: "পাই ডে, আর্থ আওয়ার, ইস্টার প্রস্তুতি" },
    ],
  },
  {
    month: 4, name: { en: "April", bn: "এপ্রিল" },
    niches: [
      { en: "Easter — eggs, bunnies, pastel patterns", bn: "ইস্টার — ডিম, খরগোশ, প্যাস্টেল প্যাটার্ন" },
      { en: "Eid-ul-Fitr — moon, dates, mosque, family scenes", bn: "ঈদ-উল-ফিতর — চাঁদ, খেজুর, মসজিদ, পারিবারিক দৃশ্য" },
      { en: "Earth Day — sustainability, recycling, green planet", bn: "আর্থ ডে — সাসটেইনেবিলিটি, রিসাইক্লিং, সবুজ গ্রহ" },
      { en: "Spring weddings — invitations, floral templates", bn: "বসন্তের বিয়ে — ইনভিটেশন, ফ্লোরাল টেমপ্লেট" },
      { en: "Pohela Boishakh (Bengali New Year, 14 April)", bn: "পহেলা বৈশাখ (১৪ এপ্রিল)" },
    ],
  },
  {
    month: 5, name: { en: "May", bn: "মে" },
    niches: [
      { en: "Mother's Day — flowers, family, heartfelt quotes", bn: "মাদারস ডে — ফুল, পরিবার, আবেগময় কোট" },
      { en: "Cinco de Mayo (US), Memorial Day weekend", bn: "সিনকো ডে মায়ো (US), মেমোরিয়াল ডে" },
      { en: "Wedding season peak — bouquets, rings, venues", bn: "বিয়ের মৌসুম — বুকে, রিং, ভেন্যু" },
      { en: "Graduation — caps, diplomas, milestone cards", bn: "গ্রাজুয়েশন — ক্যাপ, সার্টিফিকেট, মাইলস্টোন কার্ড" },
      { en: "Spring → Summer transition florals", bn: "বসন্ত → গ্রীষ্মের ফুল" },
    ],
  },
  {
    month: 6, name: { en: "June", bn: "জুন" },
    niches: [
      { en: "Father's Day — tools, fishing, BBQ, masculine art", bn: "ফাদারস ডে — টুল, ফিশিং, BBQ" },
      { en: "Pride Month — rainbow, inclusive imagery", bn: "প্রাইড মাস — রেইনবো, ইনক্লুসিভ ইমেজ" },
      { en: "Summer beach scenes, tropical vacation", bn: "গ্রীষ্মের সমুদ্র সৈকত, ট্রপিক্যাল ভ্যাকেশন" },
      { en: "World Environment Day, Yoga Day", bn: "বিশ্ব পরিবেশ দিবস, যোগ দিবস" },
      { en: "End-of-school-year teacher gifts, classroom art", bn: "স্কুল-শেষ টিচার গিফট, ক্লাসরুম আর্ট" },
    ],
  },
  {
    month: 7, name: { en: "July", bn: "জুলাই" },
    niches: [
      { en: "4th of July — patriotic US imagery, fireworks", bn: "৪ জুলাই — আমেরিকান প্যাট্রিয়টিক, ফায়ারওয়ার্কস" },
      { en: "Summer travel — passports, airplanes, suitcases", bn: "গ্রীষ্মের ভ্রমণ — পাসপোর্ট, প্লেন, স্যুটকেস" },
      { en: "Tropical fruits, ice cream, summer cocktails", bn: "ট্রপিক্যাল ফল, আইসক্রিম, ককটেল" },
      { en: "Eid-ul-Adha — sacrifice, family meal scenes", bn: "ঈদ-উল-আযহা — পরিবারিক ভোজ" },
      { en: "Christmas-in-July (Etsy POD planning)", bn: "ক্রিসমাস-ইন-জুলাই (Etsy প্রস্তুতি)" },
    ],
  },
  {
    month: 8, name: { en: "August", bn: "অগস্ট" },
    niches: [
      { en: "Back-to-school — supplies, classrooms, kids", bn: "ব্যাক-টু-স্কুল — সাপ্লাই, ক্লাসরুম" },
      { en: "Late summer florals — sunflowers, dahlias", bn: "শেষ গ্রীষ্মের ফুল — সূর্যমুখী, ডালিয়া" },
      { en: "End-of-summer travel, last-vacation imagery", bn: "শেষ ছুটির ভ্রমণ" },
      { en: "Independence Day Bangladesh / India themes", bn: "স্বাধীনতা দিবস — বাংলাদেশ / ভারত থিম" },
      { en: "Dog Days — pet portraits, summer pets", bn: "পোষা প্রাণী পোর্ট্রেট" },
    ],
  },
  {
    month: 9, name: { en: "September", bn: "সেপ্টেম্বর" },
    niches: [
      { en: "Autumn leaves, cozy sweaters, pumpkin spice prep", bn: "শরতের পাতা, কোজি সোয়েটার, পাম্পকিন স্পাইস" },
      { en: "Wedding season part 2 (autumn weddings)", bn: "শরতের বিয়ের মৌসুম" },
      { en: "Halloween prep starts — early demand for POD", bn: "হ্যালোউইন প্রস্তুতি শুরু — POD-এর আগাম চাহিদা" },
      { en: "Hispanic Heritage Month (US, mid-Sep to mid-Oct)", bn: "হিস্প্যানিক হেরিটেজ মাস (US)" },
      { en: "Durga Puja prep — goddess motifs, festive prep", bn: "দুর্গা পূজা প্রস্তুতি — দেবী মোটিফ" },
    ],
  },
  {
    month: 10, name: { en: "October", bn: "অক্টোবর" },
    niches: [
      { en: "Halloween — pumpkins, ghosts, witches, spooky", bn: "হ্যালোউইন — কুমড়া, ভূত, ডাইনি" },
      { en: "Autumn / Fall harvest — cornucopia, leaves", bn: "শরৎ ফসল — কর্নুকোপিয়া, পাতা" },
      { en: "Breast Cancer Awareness — pink ribbon", bn: "স্তন ক্যান্সার সচেতনতা — গোলাপি ফিতা" },
      { en: "Diwali prep — lamps, rangoli, fireworks", bn: "দীপাবলি প্রস্তুতি — দীপ, রঙ্গোলি" },
      { en: "Oktoberfest — beer, pretzel, Bavarian patterns", bn: "অক্টোবরফেস্ট — বিয়ার, প্রেটজেল" },
    ],
  },
  {
    month: 11, name: { en: "November", bn: "নভেম্বর" },
    niches: [
      { en: "Thanksgiving — turkey, family table, gratitude", bn: "থ্যাঙ্কসগিভিং — টার্কি, পারিবারিক টেবিল" },
      { en: "Black Friday / Cyber Monday — sale graphics", bn: "ব্ল্যাক ফ্রাইডে / সাইবার মানডে — সেল গ্রাফিক্স" },
      { en: "Christmas content peak demand starts", bn: "ক্রিসমাস কন্টেন্টের চাহিদা চূড়ায়" },
      { en: "Veterans Day, Remembrance Day (US/UK/CA)", bn: "ভেটেরানস ডে / রিমেমব্রান্স ডে" },
      { en: "Cozy autumn interiors, fireplace, hot drinks", bn: "কোজি শরতের ইন্টিরিয়র, ফায়ারপ্লেস" },
    ],
  },
  {
    month: 12, name: { en: "December", bn: "ডিসেম্বর" },
    niches: [
      { en: "Christmas — trees, ornaments, Santa, families", bn: "ক্রিসমাস — গাছ, অলঙ্কার, সান্তা" },
      { en: "Hanukkah — menorah, dreidel, blue/silver palette", bn: "হানুক্কাহ — মেনোরাহ, ড্রেইডেল" },
      { en: "Winter solstice, Yule, snowy landscapes", bn: "শীতকালীন অয়নকাল, ইউল, তুষারময় ল্যান্ডস্কেপ" },
      { en: "New Year's Eve — fireworks, champagne, resolutions", bn: "নিউ ইয়ারস ইভ — ফায়ারওয়ার্কস, শ্যাম্পেন" },
      { en: "Year-end review templates, planner sales spike", bn: "ইয়ার-এন্ড রিভিউ টেমপ্লেট, প্ল্যানার সেল" },
    ],
  },
];

// ─── Marketplace bestseller deep links ───────────────────────────────
//
// Public pages — no auth, no API key, no scraping. Each link points at
// the marketplace's own "popular / bestselling / featured" feed so the
// user can scan what's currently doing well and reverse-engineer
// niches they want to compete in.

const MARKETPLACE_HOOKS = [
  { id: "adobe", name: "Adobe Stock", logo: "🅰️", url: "https://stock.adobe.com/search?filters%5Bcontent_type%3Aphoto%5D=1&filters%5Bcontent_type%3Aillustration%5D=1&order=relevance", tip: { en: "Sort by 'Most Downloaded' inside any keyword search to see what's actually selling.", bn: "যে কোনো keyword সার্চে 'Most Downloaded' সাজান — কোনটা বেশি বিক্রি হচ্ছে দেখুন।" } },
  { id: "shutterstock", name: "Shutterstock", logo: "📷", url: "https://www.shutterstock.com/explore/popular", tip: { en: "Explore → Popular shows the global bestsellers refreshed daily.", bn: "Explore → Popular টপ ডাউনলোড দেখায়, প্রতিদিন রিফ্রেশ।" } },
  { id: "freepik", name: "Freepik", logo: "🎨", url: "https://www.freepik.com/popular-photos", tip: { en: "Popular photos + Popular vectors — separate trending feeds for each format.", bn: "Popular photos + Popular vectors — দুটো ফরম্যাটের আলাদা ট্রেন্ডিং ফিড।" } },
  { id: "getty", name: "Getty / iStock", logo: "📸", url: "https://www.istockphoto.com/popular-photos", tip: { en: "Popular Photos page is editorially curated — high-end commercial demand signals.", bn: "Popular Photos পেজ এডিটোরিয়ালি কিউরেটেড — হাই-এন্ড কমার্শিয়াল চাহিদা।" } },
  { id: "dreamstime", name: "Dreamstime", logo: "💭", url: "https://www.dreamstime.com/popular-stock-photos", tip: { en: "Popular feed plus 'Most Downloaded' filter inside any search.", bn: "Popular ফিড + প্রতিটি সার্চের ভেতরে 'Most Downloaded' ফিল্টার।" } },
  { id: "vecteezy", name: "Vecteezy", logo: "✨", url: "https://www.vecteezy.com/popular-vectors", tip: { en: "Popular vectors page — best signal for what icon / pattern niches are heating up.", bn: "Popular vectors পেজ — কোন icon / pattern niche এখন গরম তা সবচেয়ে ভালো ইঙ্গিত।" } },
  { id: "pond5", name: "Pond5", logo: "🎬", url: "https://www.pond5.com/footage/most-downloaded", tip: { en: "Most-downloaded footage page is the gold standard for video niche discovery.", bn: "Most-downloaded ফুটেজ পেজ — ভিডিও niche খুঁজে বের করার সবচেয়ে নির্ভরযোগ্য জায়গা।" } },
  { id: "depositphotos", name: "Depositphotos", logo: "🗂️", url: "https://depositphotos.com/", tip: { en: "Use the homepage 'Trending' shelves and any keyword search → sort by 'Most relevant' / 'Popular'.", bn: "হোমপেজের 'Trending' শেলফ + যে কোনো keyword সার্চে 'Most relevant' / 'Popular' সাজান।" } },
  { id: "123rf", name: "123RF", logo: "🖼️", url: "https://www.123rf.com/stock-photo/most_downloaded.html", tip: { en: "Most-downloaded stock-photo and vector pages refresh weekly.", bn: "Most-downloaded স্টক-ফটো ও ভেক্টর পেজ সাপ্তাহিক রিফ্রেশ।" } },
  { id: "pixta", name: "Pixta", logo: "🌏", url: "https://www.pixtastock.com/photo", tip: { en: "Browse photo categories and 'Newest Uploads' — strong signal for Asian / lifestyle demand.", bn: "Photo ক্যাটাগরি ও 'Newest Uploads' দেখুন — এশিয়ান / লাইফস্টাইল চাহিদার শক্ত ইঙ্গিত।" } },
  { id: "pixabay", name: "Pixabay", logo: "🌐", url: "https://pixabay.com/photos/?order=popular", tip: { en: "Popular sort works for photos, illustrations, vectors, and video separately.", bn: "Popular সাজানো photo, illustration, vector ও video-এর জন্য আলাদা।" } },
  { id: "wirestock", name: "Wirestock", logo: "🔌", url: "https://wirestock.io/", tip: { en: "Open the homepage → 'Active Challenges' / 'Featured' — shows what AI-curators are actively buying now.", bn: "হোমপেজে 'Active Challenges' / 'Featured' সেকশন — কিউরেটররা এখন কী কিনছে দেখুন।" } },
  { id: "etsy", name: "Etsy (Digital)", logo: "🛍️", url: "https://www.etsy.com/market/digital_download_bestsellers", tip: { en: "'Bestseller' badge filter + 'Digital Downloads' category = pure gold for POD niches.", bn: "'Bestseller' ব্যাজ ফিল্টার + 'Digital Downloads' ক্যাটাগরি = POD niche-এর শুদ্ধ সোনা।" } },
  { id: "redbubble", name: "Redbubble / Teepublic", logo: "👕", url: "https://www.redbubble.com/shop/top+selling+t-shirts", tip: { en: "'Top Selling' sort by category — t-shirts, stickers, posters separately.", bn: "'Top Selling' সাজান ক্যাটাগরি অনুযায়ী — টি-শার্ট, স্টিকার, পোস্টার আলাদা।" } },
  { id: "society6", name: "Society6", logo: "🎨", url: "https://society6.com/wall-art", tip: { en: "Wall Art Decor → 'Sort: Featured' previews what's about to go viral on POD.", bn: "Wall Art Decor → 'Sort: Featured' — POD-এ কোনটা ভাইরাল হবে আগেই দেখুন।" } },
  { id: "creativemarket", name: "Creative Market", logo: "💎", url: "https://creativemarket.com/popular", tip: { en: "Weekly trending bundles — best signal for vector / template / mockup demand.", bn: "সাপ্তাহিক ট্রেন্ডিং বান্ডেল — ভেক্টর / টেমপ্লেট / মকআপ চাহিদার সেরা সংকেত।" } },
  { id: "envato", name: "Envato Elements", logo: "🟢", url: "https://elements.envato.com/graphic-templates", tip: { en: "Graphic Templates with default 'Sort by Popular' — refreshed daily.", bn: "Graphic Templates — ডিফল্ট 'Sort by Popular' — প্রতিদিন রিফ্রেশ।" } },
  { id: "amazon-kdp", name: "Amazon KDP", logo: "📚", url: "https://www.amazon.com/gp/bestsellers/digital-text", tip: { en: "Kindle Bestsellers + Movers & Shakers pages show what readers are buying NOW.", bn: "Kindle Bestsellers + Movers & Shakers পেজ — পাঠকরা এখন কী কিনছে।" } },
];

// ─── Educational copy: how marketplaces actually identify trends ─────

const TECHNIQUES = [
  {
    id: "downloads",
    title: { en: "Download counters & sales velocity", bn: "ডাউনলোড গণনা ও বিক্রির বেগ" },
    body: {
      en: "Every marketplace internally counts downloads / sales per asset. When a single keyword cluster spikes (e.g. 'cottagecore' on Etsy in 2021), the platform's recommendation algorithm boosts similar items — creating the snowball effect you see as 'trending'.",
      bn: "প্রতিটি মার্কেটপ্লেস প্রতিটি asset-এর ডাউনলোড / বিক্রি গোনে। একটা keyword cluster হঠাৎ বাড়লে (যেমন ২০২১-এ Etsy-তে 'cottagecore'), platform-এর recommendation algorithm একই ধরনের জিনিসকে boost করে — এটাই 'trending' snowball effect।",
    },
  },
  {
    id: "search-trends",
    title: { en: "Internal search-query analytics", bn: "ভেতরের সার্চ-কুয়েরি বিশ্লেষণ" },
    body: {
      en: "Buyer-side searches that have NO good results are the most valuable signal. Marketplaces watch for high-volume queries with zero downloads and either commission content or surface the gap to top contributors. You can mimic this by checking Etsy's autocomplete suggestions for terms with thin inventory.",
      bn: "যেসব search-এর ভালো রেজাল্ট নেই — সেগুলোই সবচেয়ে মূল্যবান সংকেত। হাই-ভলিউম কিন্তু ডাউনলোড শূন্য query থাকলে marketplace সেগুলো contributor-দের কাছে পাঠায় বা নিজে commission করে। আপনি Etsy autocomplete-এ patli inventory-এর term গুলো দেখে এই কৌশল নকল করতে পারেন।",
    },
  },
  {
    id: "google-pinterest",
    title: { en: "External signals: Google Trends + Pinterest Trends", bn: "বাইরের সংকেত: Google Trends + Pinterest Trends" },
    body: {
      en: "Google Trends shows search demand 6–12 weeks ahead of stock-image demand (people Google before they buy art). Pinterest Trends is even earlier — Pinterest pins peak ~3 months before Etsy sales. The Live Daily Trends section above pulls the Google side; for Pinterest, manually check trends.pinterest.com.",
      bn: "Google Trends স্টক-ইমেজ চাহিদার ৬–১২ সপ্তাহ আগে দেখায় (মানুষ আর্ট কেনার আগে Google-এ search করে)। Pinterest Trends আরও আগে — Etsy বিক্রির ~৩ মাস আগে Pinterest pin চূড়ায় ওঠে। উপরের Live Daily Trends section Google side দেখায়; Pinterest-এর জন্য manually trends.pinterest.com দেখুন।",
    },
  },
  {
    id: "ai-clustering",
    title: { en: "AI-powered niche clustering", bn: "AI দিয়ে niche ক্লাস্টারিং" },
    body: {
      en: "Adobe and Shutterstock run vision models over their entire catalog every quarter and group near-duplicate concepts into 'demand clusters'. They publish summaries — Adobe's 'Creative Trends' and Shutterstock's 'Color Trends' reports. Reading these once a quarter is the cheapest market research you can do.",
      bn: "Adobe ও Shutterstock প্রতি ৩ মাসে তাদের পুরো catalog-এর উপর vision model চালিয়ে similar concept গুলোকে 'demand cluster' বানায়। Adobe-এর 'Creative Trends' আর Shutterstock-এর 'Color Trends' report পড়লে — এটাই সবচেয়ে সস্তা market research।",
    },
  },
  {
    id: "manual-curation",
    title: { en: "Manual curators & editorial picks", bn: "ম্যানুয়াল কিউরেটর ও এডিটোরিয়াল পিক" },
    body: {
      en: "Getty / iStock / Creative Market still rely heavily on human curators for their 'Featured' / 'Editor's Pick' feeds. These curators are public — read their interviews on the platform's blog and follow their portfolios to learn what they're scouting next.",
      bn: "Getty / iStock / Creative Market এখনও 'Featured' / 'Editor's Pick' ফিডের জন্য মানুষ কিউরেটরের উপর নির্ভর করে। এদের interview platform blog-এ পাবেন — পড়ুন এবং তাদের portfolio follow করুন, আগামীতে কী scout করবেন বুঝবেন।",
    },
  },
  {
    id: "social-signals",
    title: { en: "Social media early-warning signals", bn: "সোশ্যাল মিডিয়া আগাম সংকেত" },
    body: {
      en: "TikTok, Instagram Reels, and YouTube Shorts viral aesthetics show up on stock platforms 4–8 weeks later. Track aesthetic hashtags (#cottagecore, #darkacademia, #coquette, etc.) and you'll be uploading the matching stock content while early-bird buyers are still hungry.",
      bn: "TikTok, Instagram Reels ও YouTube Shorts-এর viral aesthetic ৪–৮ সপ্তাহ পরে stock platform-এ আসে। Aesthetic hashtag (#cottagecore, #darkacademia, #coquette ইত্যাদি) track করুন — early-bird buyer-রা ক্ষুধার্ত থাকা অবস্থাতেই আপনার content প্রস্তুত থাকবে।",
    },
  },
];

const CURRENT_MONTH = new Date().getMonth() + 1; // 1-12

// ─── UI ──────────────────────────────────────────────────────────────

export default function MarketTrendsPage() {
  const { lang } = useLanguage();
  const [geo, setGeo] = useState("US");
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState({ trends: [], fetchedAt: null, loading: true, error: null });
  const [openTechnique, setOpenTechnique] = useState(null);

  const labels = useMemo(() => ({
    title: lang === "bn" ? "মার্কেট ট্রেন্ডস" : "Market Trends",
    subtitle: lang === "bn"
      ? "বর্তমানে কোন niche / keyword / format সবচেয়ে বেশি বিকোচ্ছে — এক জায়গায় দেখুন।"
      : "See at a glance which niches, keywords, and formats are selling right now.",
    liveTitle: lang === "bn" ? "লাইভ Google Search Trends" : "Live Google Search Trends",
    liveDesc: lang === "bn"
      ? "প্রতিদিন আপডেট হওয়া শীর্ষ search query — প্রায় ৬–১২ সপ্তাহ পর এই keyword গুলোর stock-image চাহিদা চূড়ায় উঠবে।"
      : "Daily-updated top search queries. Stock-image demand for these keywords typically peaks 6–12 weeks later.",
    refresh: lang === "bn" ? "রিফ্রেশ" : "Refresh",
    refreshing: lang === "bn" ? "লোড হচ্ছে…" : "Loading…",
    geoLabel: lang === "bn" ? "অঞ্চল" : "Region",
    fetchedAt: lang === "bn" ? "শেষ আপডেট" : "Last updated",
    traffic: lang === "bn" ? "আনুমানিক ট্রাফিক" : "Approx. traffic",
    generateAs: lang === "bn" ? "জেনারেট করুন" : "Generate as",
    image: lang === "bn" ? "ছবি" : "Image",
    vector: lang === "bn" ? "ভেক্টর" : "Vector",
    video: lang === "bn" ? "ভিডিও" : "Video",
    relevanceLow: lang === "bn" ? "স্টক-অপ্রাসঙ্গিক" : "Low stock relevance",
    relevanceHigh: lang === "bn" ? "স্টক-উপযোগী" : "Stock-friendly",
    showAll: lang === "bn" ? "সব দেখান" : "Show all",
    hideLow: lang === "bn" ? "কম-প্রাসঙ্গিক লুকান" : "Hide low-relevance",
    relatedNews: lang === "bn" ? "সম্পর্কিত খবর" : "Related news",
    noTrends: lang === "bn" ? "এখন trend লোড করা যায়নি — কিছুক্ষণ পর আবার চেষ্টা করুন।" : "Couldn't load trends right now — try again in a minute.",
    seasonalTitle: lang === "bn" ? "মৌসুমী niche ক্যালেন্ডার" : "Seasonal niche calendar",
    seasonalDesc: lang === "bn"
      ? "১২ মাসের high-demand niche — গত ৩ বছরের marketplace trend report থেকে curated। চলতি মাস হাইলাইট।"
      : "12-month high-demand niches — curated from the last 3 years of marketplace trend reports. Current month highlighted.",
    currentMonth: lang === "bn" ? "চলতি মাস" : "Current month",
    upcomingMonth: lang === "bn" ? "আসন্ন" : "Upcoming",
    bestsellerTitle: lang === "bn" ? "মার্কেটপ্লেস বেস্টসেলার শর্টকাট" : "Marketplace bestseller shortcuts",
    bestsellerDesc: lang === "bn"
      ? "প্রতিটি মার্কেটপ্লেসের নিজস্ব 'popular / bestselling / most-downloaded' পেজে সরাসরি লিংক — কোন paid API লাগবে না, কোনো scraping নেই।"
      : "Direct links to each marketplace's own popular / bestselling / most-downloaded page. No paid API, no scraping.",
    techniquesTitle: lang === "bn" ? "মার্কেটপ্লেস কীভাবে trend চিহ্নিত করে" : "How marketplaces actually identify trends",
    techniquesDesc: lang === "bn"
      ? "৬টি ফ্রি কৌশল — যেগুলো marketplace ভেতরে ভেতরে চালায় এবং আপনিও নকল করতে পারেন।"
      : "Six free techniques — what marketplaces do behind the scenes, and how you can mimic each one.",
    seeFeature: lang === "bn" ? "Feature Matrix দেখুন" : "Open Feature Matrix",
    seeMarket: lang === "bn" ? "Marketplace Guide দেখুন" : "Open Marketplace Guide",
    visit: lang === "bn" ? "পেজ খুলুন" : "Open page",
    aiNoticeTitle: lang === "bn" ? "মনে রাখুন" : "Heads up",
    aiNotice: lang === "bn"
      ? "Google Trends সাধারণ search trend দেখায় — সব keyword stock-image-এর জন্য উপযুক্ত নয়। সেলিব্রিটির নাম, খেলার ফলাফল ইত্যাদি এড়িয়ে চলুন; aesthetic / lifestyle / seasonal keyword-এ ফোকাস করুন।"
      : "Google Trends shows general search trends — not all keywords translate to stock-image demand. Skip celebrity names and live sports results; focus on aesthetic / lifestyle / seasonal keywords.",
    contextOnly: lang === "bn" ? "context সিগন্যাল" : "Context signal",
    formatAll: lang === "bn" ? "সব" : "All",
    formatImage: lang === "bn" ? "ছবি (Image)" : "Image",
    formatVector: lang === "bn" ? "ভেক্টর / Icon" : "Vector / Icon",
    formatVideo: lang === "bn" ? "ভিডিও" : "Video",
    formatPod: lang === "bn" ? "POD (T-shirt / Sticker)" : "POD (T-shirt / Sticker)",
    formatTabsHint: lang === "bn"
      ? "নিচে সব section এই ফরম্যাটে relevant niche গুলো-ই দেখাবে।"
      : "All sections below will be filtered to niches relevant to this format.",
  }), [lang]);

  // Effect-driven fetch keyed on geo + refreshKey. The synchronous
  // "loading: true" flip happens inside an async IIFE so the
  // react-hooks/set-state-in-effect rule is satisfied (no setState
  // sits in the effect's synchronous body).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setData(prev => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetch(`/api/market-trends?geo=${encodeURIComponent(geo)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (cancelled) return;
        setData({
          trends: Array.isArray(json.trends) ? json.trends : [],
          fetchedAt: json.fetchedAt || null,
          loading: false,
          error: json.ok === false ? (json.error || "load_failed") : null,
        });
      } catch (e) {
        if (cancelled) return;
        setData({ trends: [], fetchedAt: null, loading: false, error: String(e?.message || e) });
      }
    })();
    return () => { cancelled = true; };
  }, [geo, refreshKey]);

  const handleRefresh = () => setRefreshKey(k => k + 1);

  // Per-format deep links into the corresponding generator. The
  // `autorun=1` flag tells the generator page to fire its main Generate
  // handler immediately after the seed is committed, so the user gets
  // a one-click experience from a trending keyword to a generated batch
  // of prompts.
  const generatorHrefFor = (query, fmt) => {
    const path = fmt === "vector"
      ? "/vector-generator"
      : fmt === "video"
        ? "/video-generator"
        : "/prompt-generator";
    return `${path}?seed=${encodeURIComponent(query)}&autorun=1`;
  };

  const [hideLowRelevance, setHideLowRelevance] = useState(true);
  // Per-format filter tab. Persists in URL hash so refresh keeps the
  // tab. We initialise from the hash inside `useState` (lazy init) so
  // we never have to call setState synchronously in an effect.
  const [formatTab, setFormatTabRaw] = useState(() => {
    if (typeof window === "undefined") return "all";
    const hash = window.location.hash.replace(/^#/, "");
    return FORMAT_KEYS.includes(hash) ? hash : "all";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHash = () => {
      const next = window.location.hash.replace(/^#/, "");
      if (FORMAT_KEYS.includes(next)) setFormatTabRaw(next);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const setFormatTab = (key) => {
    setFormatTabRaw(key);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.hash = key === "all" ? "" : key;
      window.history.replaceState(null, "", url.toString());
    }
  };

  // The settings modal lives in the sidebar; we expose its trigger
  // through the `#sidebar-api-keys-btn` button id so any deep-linked
  // "Add API key" CTA can open it without prop-drilling state up.
  const openSettings = useCallback(() => {
    if (typeof document === "undefined") return;
    const btn = document.getElementById("sidebar-api-keys-btn");
    if (btn) btn.click();
  }, []);

  const visibleTrends = useMemo(() => {
    let out = data.trends;
    if (hideLowRelevance) {
      out = out.filter(t => (t.relevanceScore ?? 5) >= 3);
    }
    out = filterByFormat(out, formatTab);
    return out;
  }, [data.trends, hideLowRelevance, formatTab]);

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(244,63,94,0.06) 100%)",
        border: "1px solid var(--border)", borderRadius: 14, padding: "20px 22px", marginBottom: 18,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <TrendingUp size={22} color="#6366f1" />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{labels.title}</h1>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text2)" }}>{labels.subtitle}</p>
        <div style={{
          marginTop: 12, padding: "8px 12px", background: "rgba(245,158,11,0.08)",
          border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8,
          display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <AlertTriangle size={14} color="#f59e0b" style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--text)" }}>{labels.aiNoticeTitle}: </strong>{labels.aiNotice}
          </span>
        </div>
      </div>

      {/* ─── Section 1: Live Google Trends ───────────────────────── */}
      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Globe size={16} color="#10b981" />
            <h2 style={sectionTitleStyle}>{labels.liveTitle}</h2>
          </div>
          <button type="button" onClick={handleRefresh} disabled={data.loading}
            style={refreshBtnStyle(data.loading)}>
            <RefreshCw size={12} className={data.loading ? "spin" : ""} />
            {data.loading ? labels.refreshing : labels.refresh}
          </button>
        </div>
        <p style={sectionDescStyle}>{labels.liveDesc}</p>

        {/* Geo selector */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 14px" }}>
          <span style={{ fontSize: 11, color: "var(--text3)", alignSelf: "center", marginRight: 4 }}>{labels.geoLabel}:</span>
          {GEOS.map(g => {
            const active = g.id === geo;
            return (
              <button key={g.id} type="button" onClick={() => setGeo(g.id)} style={{
                display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px",
                borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${active ? "#10b981" : "var(--border)"}`,
                background: active ? "rgba(16,185,129,0.15)" : "var(--card)",
                color: active ? "#10b981" : "var(--text2)",
              }}>
                <span style={{ fontSize: 13 }}>{g.flag}</span>
                {g.label[lang] || g.label.en}
              </button>
            );
          })}
        </div>

        {/* Relevance filter toggle */}
        {data.trends.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
            fontSize: 11, color: "var(--text3)",
          }}>
            <Filter size={12} />
            <button type="button" onClick={() => setHideLowRelevance(v => !v)}
              style={{
                padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)",
                background: hideLowRelevance ? "rgba(16,185,129,0.10)" : "var(--card)",
                color: hideLowRelevance ? "#10b981" : "var(--text2)",
                fontSize: 11, fontWeight: 600, cursor: "pointer",
              }}>
              {hideLowRelevance ? labels.hideLow : labels.showAll}
            </button>
            <span style={{ color: "var(--text4)" }}>
              ({visibleTrends.length} / {data.trends.length})
            </span>
          </div>
        )}

        {/* Trends list */}
        {data.error && data.trends.length === 0 ? (
          <div style={{
            padding: "14px 16px", borderRadius: 10, border: "1px dashed var(--border)",
            color: "var(--text3)", fontSize: 12, textAlign: "center",
          }}>{labels.noTrends}</div>
        ) : (
          <div style={{
            display: "grid", gap: 10,
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          }}>
            {data.loading && data.trends.length === 0
              ? Array.from({ length: 6 }).map((_, i) => <div key={i} style={skeletonCardStyle} />)
              : visibleTrends.map((t) => {
                const score = t.relevanceScore ?? 5;
                const isLow = score < 3;
                const isHigh = score >= 7;
                return (
                <article key={t.title} style={trendCardStyle}>
                  <div style={{ display: "flex", gap: 10 }}>
                    {t.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.picture} alt="" loading="lazy" referrerPolicy="no-referrer"
                        style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "var(--bg2)" }}
                        onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: 8, background: "var(--bg2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Sparkles size={20} color="var(--text4)" />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", lineHeight: 1.3, wordBreak: "break-word" }}>{t.title}</div>
                      {t.traffic && (
                        <div style={{ fontSize: 11, color: "#10b981", fontWeight: 600, marginTop: 2 }}>
                          {labels.traffic}: {t.traffic}
                        </div>
                      )}
                      {(isLow || isHigh) && (
                        <div style={{
                          marginTop: 4, display: "inline-block",
                          padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                          background: isLow ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
                          color: isLow ? "#f59e0b" : "#10b981",
                        }}>
                          {isLow ? labels.relevanceLow : labels.relevanceHigh}
                        </div>
                      )}
                    </div>
                  </div>
                  {t.newsItems && t.newsItems.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed var(--border)" }}>
                      <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 600, marginBottom: 4 }}>{labels.relatedNews}</div>
                      {t.newsItems.slice(0, 2).map((n) => (
                        <a key={n.url} href={n.url} target="_blank" rel="noopener noreferrer"
                          style={{ display: "block", fontSize: 11, color: "var(--text2)", lineHeight: 1.4, marginBottom: 2, textDecoration: "none" }}
                          title={n.source}>
                          • {n.title} <span style={{ color: "var(--text4)" }}>({n.source})</span>
                        </a>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                      {labels.generateAs}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Link href={generatorHrefFor(t.title, "image")} style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "6px 10px", borderRadius: 8, background: "rgba(99,102,241,0.12)",
                        color: "#6366f1", fontSize: 11, fontWeight: 700, textDecoration: "none",
                      }}>
                        <ImageIcon size={11} /> {labels.image}
                      </Link>
                      <Link href={generatorHrefFor(t.title, "vector")} style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "6px 10px", borderRadius: 8, background: "rgba(6,182,212,0.12)",
                        color: "#06b6d4", fontSize: 11, fontWeight: 700, textDecoration: "none",
                      }}>
                        <Palette size={11} /> {labels.vector}
                      </Link>
                      <Link href={generatorHrefFor(t.title, "video")} style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "6px 10px", borderRadius: 8, background: "rgba(249,115,22,0.12)",
                        color: "#f97316", fontSize: 11, fontWeight: 700, textDecoration: "none",
                      }}>
                        <Video size={11} /> {labels.video}
                      </Link>
                    </div>
                    <AnalysisPanel query={t.title} compact />
                  </div>
                </article>
                );
              })}
          </div>
        )}
        {data.fetchedAt && (
          <p style={{ marginTop: 10, fontSize: 10, color: "var(--text4)" }}>
            {labels.fetchedAt}: {new Date(data.fetchedAt).toLocaleString(lang === "bn" ? "bn-BD" : "en-US")}
          </p>
        )}
      </section>

      {/* ─── Section 1.5: Real Marketplace Trends (live, user-triggered) ─ */}
      <MarketplaceTrendsSection
        generatorHrefFor={generatorHrefFor}
        formatTab={formatTab}
        onOpenSettings={openSettings}
      />

      {/* ─── Section 1.7: Auto-Discover Top 20 sales-relevant niches ─ */}
      <DiscoverPanel
        generatorHrefFor={generatorHrefFor}
        formatTab={formatTab}
      />

      {/* ─── Section 2: Seasonal calendar ─────────────────────────── */}
      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={16} color="#f43f5e" />
            <h2 style={sectionTitleStyle}>{labels.seasonalTitle}</h2>
          </div>
        </div>
        <p style={sectionDescStyle}>{labels.seasonalDesc}</p>
        <div style={{
          display: "grid", gap: 10, marginTop: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        }}>
          {SEASONAL.map(m => {
            const isCurrent = m.month === CURRENT_MONTH;
            const isUpcoming = !isCurrent && (((m.month - CURRENT_MONTH + 12) % 12) <= 2);
            return (
              <div key={m.month} style={{
                padding: 14, borderRadius: 10,
                border: `1px solid ${isCurrent ? "#f43f5e" : "var(--border)"}`,
                background: isCurrent ? "rgba(244,63,94,0.06)" : "var(--card)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: isCurrent ? "#f43f5e" : "var(--text)" }}>
                    {m.name[lang] || m.name.en}
                  </h3>
                  {isCurrent && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: "#f43f5e", color: "#fff" }}>
                      {labels.currentMonth}
                    </span>
                  )}
                  {!isCurrent && isUpcoming && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: "rgba(99,102,241,0.18)", color: "#6366f1" }}>
                      {labels.upcomingMonth}
                    </span>
                  )}
                </div>
                <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 11, lineHeight: 1.55, color: "var(--text2)" }}>
                  {m.niches.map((n, idx) => (
                    <li key={idx}>{n[lang] || n.en}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Section 3: Marketplace bestseller links ──────────────── */}
      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Store size={16} color="#3b82f6" />
            <h2 style={sectionTitleStyle}>{labels.bestsellerTitle}</h2>
          </div>
        </div>
        <p style={sectionDescStyle}>{labels.bestsellerDesc}</p>
        <div style={{
          display: "grid", gap: 10, marginTop: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        }}>
          {MARKETPLACE_HOOKS.map(mp => (
            <a key={mp.id} href={mp.url} target="_blank" rel="noopener noreferrer" style={{
              display: "block", padding: 14, borderRadius: 10, border: "1px solid var(--border)",
              background: "var(--card)", textDecoration: "none", color: "var(--text)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>{mp.logo}</span>
                <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{mp.name}</span>
                <ExternalLink size={12} color="var(--text3)" />
              </div>
              <p style={{ margin: 0, fontSize: 11, color: "var(--text2)", lineHeight: 1.5 }}>
                {mp.tip[lang] || mp.tip.en}
              </p>
            </a>
          ))}
        </div>
      </section>

      {/* ─── Section 4: How marketplaces identify trends ──────────── */}
      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Lightbulb size={16} color="#f59e0b" />
            <h2 style={sectionTitleStyle}>{labels.techniquesTitle}</h2>
          </div>
        </div>
        <p style={sectionDescStyle}>{labels.techniquesDesc}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {TECHNIQUES.map(tech => {
            const open = openTechnique === tech.id;
            return (
              <div key={tech.id} style={{
                border: "1px solid var(--border)", borderRadius: 10, background: "var(--card)",
                overflow: "hidden",
              }}>
                <button type="button" onClick={() => setOpenTechnique(open ? null : tech.id)} style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer",
                  color: "var(--text)", fontSize: 13, fontWeight: 700, textAlign: "left",
                }}>
                  <span>{tech.title[lang] || tech.title.en}</span>
                  {open ? <ChevronUp size={14} color="var(--text3)" /> : <ChevronDown size={14} color="var(--text3)" />}
                </button>
                {open && (
                  <div style={{ padding: "0 14px 14px", fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
                    {tech.body[lang] || tech.body.en}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer cross-links */}
      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/feature-guide" style={footerLinkStyle}>
          <TrendingUp size={14} /> {labels.seeFeature}
        </Link>
        <Link href="/marketplace-guide" style={footerLinkStyle}>
          <Store size={14} /> {labels.seeMarket}
        </Link>
      </div>

      {/* CSS for spinner */}
      <style jsx>{`
        :global(.spin) {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─── Inline style helpers ────────────────────────────────────────────

const sectionStyle = {
  background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
  padding: "16px 18px", marginBottom: 16,
};

const sectionHeaderStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
};

const sectionTitleStyle = {
  margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text)",
};

const sectionDescStyle = {
  margin: "4px 0 0", fontSize: 12, color: "var(--text2)", lineHeight: 1.5,
};

const refreshBtnStyle = (loading) => ({
  display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px",
  borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)",
  color: "var(--text)", fontSize: 11, fontWeight: 600, cursor: loading ? "wait" : "pointer",
  opacity: loading ? 0.7 : 1,
});

const trendCardStyle = {
  padding: 12, borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg2)", display: "flex", flexDirection: "column",
};

const skeletonCardStyle = {
  height: 130, borderRadius: 10, background: "var(--bg2)",
  border: "1px dashed var(--border)",
};

const footerLinkStyle = {
  flex: 1, minWidth: 220, padding: "12px 14px", borderRadius: 10,
  border: "1px solid var(--border)", background: "var(--card)",
  color: "var(--text)", textDecoration: "none", fontSize: 13, fontWeight: 600,
  display: "flex", alignItems: "center", gap: 8,
};

// ─── Format tab bar ──────────────────────────────────────────────────
//
// One global tab bar that filters every section on the page (Google
// Trends, Real Marketplace Trends, Auto-Discover) to the keywords
// most relevant for the chosen output format. The filter is applied
// client-side via `filterByFormat` so it costs zero API quota.

function FormatTabs({ value, onChange, lang }) {
  const labels = {
    all: lang === "bn" ? "সব" : "All",
    image: lang === "bn" ? "ছবি" : "Image",
    vector: lang === "bn" ? "ভেক্টর / Icon" : "Vector / Icon",
    video: lang === "bn" ? "ভিডিও" : "Video",
    pod: lang === "bn" ? "POD" : "POD",
    hint: lang === "bn"
      ? "নিচে সব section এই ফরম্যাটে relevant niche গুলো-ই দেখাবে।"
      : "All sections below filter to niches that sell well in this format.",
  };
  const tabs = [
    { id: "all", label: labels.all, color: "#6366f1", Icon: LayoutGrid },
    { id: "image", label: labels.image, color: "#6366f1", Icon: ImageIcon },
    { id: "vector", label: labels.vector, color: "#06b6d4", Icon: Palette },
    { id: "video", label: labels.video, color: "#f97316", Icon: Video },
    { id: "pod", label: labels.pod, color: "#a855f7", Icon: Shirt },
  ];
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 5,
      background: "var(--bg)", padding: "8px 0", marginBottom: 14,
      borderBottom: "1px solid var(--border)",
    }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", marginRight: 4 }}>
          {lang === "bn" ? "ফরম্যাট:" : "Format:"}
        </span>
        {tabs.map(t => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "6px 12px", borderRadius: 8,
                fontSize: 11, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${active ? t.color : "var(--border)"}`,
                background: active ? `${t.color}22` : "var(--card)",
                color: active ? t.color : "var(--text2)",
              }}
            >
              <t.Icon size={12} />
              {t.label}
            </button>
          );
        })}
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 10, color: "var(--text4)" }}>{labels.hint}</p>
    </div>
  );
}
