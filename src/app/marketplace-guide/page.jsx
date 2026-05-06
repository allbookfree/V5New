"use client";

import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Store, Image, Palette, Video, Star, Check, X, ChevronDown, ChevronUp, ExternalLink, TrendingUp, DollarSign, Globe, Shield, LayoutGrid } from "lucide-react";

const CONTENT_TYPES = [
  { id: "image", icon: Image, color: "#6366f1" },
  { id: "vector", icon: Palette, color: "#10b981" },
  { id: "video", icon: Video, color: "#f43f5e" },
];

const MARKETPLACES = [
  {
    id: "adobe",
    name: "Adobe Stock",
    url: "https://stock.adobe.com",
    logo: "🅰️",
    color: "#FF0000",
    earnings: "33%",
    review: "1-7 days",
    payout: "$25 min",
    strengths: { en: "Largest buyer base, integrated with Creative Cloud", bn: "সবচেয়ে বড় ক্রেতা বেস, Creative Cloud-এ সংযুক্ত" },
    image: {
      support: true,
      rating: 5,
      bestModes: ["auto", "engineer", "surreal", "background-texture", "wall-art", "mockup"],
      tips: {
        en: "Adobe buyers prefer clean, commercial images. Surreal and Wall Art sell well. Use high-quality keywords.",
        bn: "Adobe ক্রেতারা পরিষ্কার, বাণিজ্যিক ছবি পছন্দ করেন। Surreal ও Wall Art ভালো বিক্রি হয়। ভালো keyword ব্যবহার করুন।"
      }
    },
    vector: {
      support: true,
      rating: 5,
      bestModes: ["icon-pack", "pattern", "logo-element", "clipart-bundle", "infographic", "social-template"],
      tips: {
        en: "Vector is Adobe's strongest category. Icon packs, patterns, and logo elements sell consistently. Keep designs versatile.",
        bn: "ভেক্টর Adobe-এর সবচেয়ে শক্তিশালী ক্যাটাগরি। Icon pack, pattern ও logo element ধারাবাহিকভাবে বিক্রি হয়।"
      }
    },
    video: {
      support: true,
      rating: 4,
      bestModes: ["auto", "engineer", "collection"],
      tips: {
        en: "Video clips and motion graphics are growing. Focus on 4K quality. Business and nature themes are popular.",
        bn: "ভিডিও ক্লিপ ও মোশন গ্রাফিক্স বাড়ছে। 4K মানে ফোকাস করুন। ব্যবসা ও প্রকৃতি থিম জনপ্রিয়।"
      }
    }
  },
  {
    id: "shutterstock",
    name: "Shutterstock",
    url: "https://submit.shutterstock.com",
    logo: "📷",
    color: "#EE2D24",
    earnings: "$0.10-$0.33/download",
    review: "Instant AI review",
    payout: "$35 min",
    strengths: { en: "Fastest review, huge buyer network, AI-generated content accepted", bn: "সবচেয়ে দ্রুত রিভিউ, বিশাল ক্রেতা নেটওয়ার্ক, AI-generated content গ্রহণযোগ্য" },
    image: {
      support: true,
      rating: 5,
      bestModes: ["auto", "engineer", "surreal", "background-texture", "mockup"],
      tips: {
        en: "Shutterstock accepts AI-generated images with proper disclosure. Volume strategy works — upload many variations.",
        bn: "Shutterstock সঠিক প্রকাশনা সহ AI-generated ছবি গ্রহণ করে। ভলিউম কৌশল কাজ করে — অনেক ভেরিয়েশন আপলোড করুন।"
      }
    },
    vector: {
      support: true,
      rating: 4,
      bestModes: ["icon-pack", "pattern", "sticker-pack", "clipart-bundle", "social-template"],
      tips: {
        en: "Submit EPS/SVG format. Sticker packs and social templates are trending. Seasonal content does well.",
        bn: "EPS/SVG ফরম্যাটে সাবমিট করুন। Sticker pack ও social template ট্রেন্ডিং। সিজনাল কন্টেন্ট ভালো করে।"
      }
    },
    video: {
      support: true,
      rating: 5,
      bestModes: ["auto", "engineer", "collection"],
      tips: {
        en: "Shutterstock is the #1 stock video marketplace. Focus on trending topics. 4K and drone footage command premium prices.",
        bn: "Shutterstock #1 স্টক ভিডিও মার্কেটপ্লেস। ট্রেন্ডিং টপিকে ফোকাস করুন। 4K ও ড্রোন ফুটেজ প্রিমিয়াম দাম পায়।"
      }
    }
  },
  {
    id: "freepik",
    name: "Freepik",
    url: "https://contributor.freepik.com",
    logo: "🎨",
    color: "#0062FF",
    earnings: "30-60%",
    review: "1-3 days",
    payout: "$100 min",
    strengths: { en: "Best for vectors and illustrations, huge organic traffic, AI content accepted", bn: "ভেক্টর ও ইলাস্ট্রেশনের জন্য সেরা, বিশাল অর্গানিক ট্রাফিক, AI কন্টেন্ট গ্রহণযোগ্য" },
    image: {
      support: true,
      rating: 3,
      bestModes: ["auto", "background-texture", "mockup"],
      tips: {
        en: "Freepik's image section is growing but competition is high. Focus on unique mockups and backgrounds.",
        bn: "Freepik-এর ছবি বিভাগ বাড়ছে কিন্তু প্রতিযোগিতা বেশি। ইউনিক mockup ও background-এ ফোকাস করুন।"
      }
    },
    vector: {
      support: true,
      rating: 5,
      bestModes: ["icon-pack", "pattern", "sticker-pack", "clipart-bundle", "logo-element", "infographic", "social-template", "web-ui-icons", "background-texture"],
      tips: {
        en: "Freepik is THE best for vectors. All vector modes work great here. Upload AI-SVG format. Quantity wins.",
        bn: "Freepik ভেক্টরের জন্য সেরা। সব ভেক্টর মোড এখানে ভালো কাজ করে। AI-SVG ফরম্যাটে আপলোড করুন। পরিমাণ জয়ী।"
      }
    },
    video: {
      support: true,
      rating: 2,
      bestModes: ["auto"],
      tips: {
        en: "Video support is limited on Freepik. Better to focus on image and vector here.",
        bn: "Freepik-এ ভিডিও সাপোর্ট সীমিত। এখানে ছবি ও ভেক্টরে ফোকাস করুন।"
      }
    }
  },
  {
    id: "getty",
    name: "Getty Images / iStock",
    url: "https://www.gettyimages.com/workwithus",
    logo: "📸",
    color: "#000000",
    earnings: "15-45%",
    review: "3-14 days",
    payout: "$100 min",
    strengths: { en: "Premium marketplace, highest per-download earnings, editorial content", bn: "প্রিমিয়াম মার্কেটপ্লেস, সর্বোচ্চ প্রতি-ডাউনলোড আয়, সম্পাদকীয় কন্টেন্ট" },
    image: {
      support: true,
      rating: 4,
      bestModes: ["auto", "engineer", "wall-art", "surreal"],
      tips: {
        en: "Getty demands highest quality. Focus on unique, editorial-style content. AI disclosure required. Premium pricing.",
        bn: "Getty সর্বোচ্চ মান চায়। ইউনিক, সম্পাদকীয়-শৈলীর কন্টেন্টে ফোকাস করুন। AI প্রকাশনা বাধ্যতামূলক। প্রিমিয়াম দাম।"
      }
    },
    vector: {
      support: true,
      rating: 3,
      bestModes: ["icon-pack", "infographic", "logo-element"],
      tips: {
        en: "iStock has a decent vector market. Professional, business-oriented designs sell best.",
        bn: "iStock-এ ভালো ভেক্টর মার্কেট আছে। পেশাদার, ব্যবসা-ভিত্তিক ডিজাইন সবচেয়ে ভালো বিক্রি হয়।"
      }
    },
    video: {
      support: true,
      rating: 5,
      bestModes: ["auto", "engineer", "collection"],
      tips: {
        en: "Getty is premium for video. High earnings per clip. Focus on cinematic quality and trending news topics.",
        bn: "Getty ভিডিওর জন্য প্রিমিয়াম। প্রতি ক্লিপে উচ্চ আয়। সিনেমাটিক মান ও ট্রেন্ডিং নিউজ টপিকে ফোকাস করুন।"
      }
    }
  },
  {
    id: "dreamstime",
    name: "Dreamstime",
    url: "https://www.dreamstime.com/sell",
    logo: "💭",
    color: "#00BF63",
    earnings: "25-50%",
    review: "1-5 days",
    payout: "$100 min",
    strengths: { en: "Good acceptance rate, exclusive content bonus, established marketplace", bn: "ভালো গ্রহণযোগ্যতা হার, এক্সক্লুসিভ কন্টেন্ট বোনাস, প্রতিষ্ঠিত মার্কেটপ্লেস" },
    image: {
      support: true,
      rating: 4,
      bestModes: ["auto", "engineer", "surreal", "background-texture", "wall-art"],
      tips: {
        en: "Dreamstime has a good acceptance rate for AI content. Exclusive uploads earn more. Tag carefully.",
        bn: "Dreamstime-এ AI কন্টেন্টের ভালো গ্রহণযোগ্যতা আছে। এক্সক্লুসিভ আপলোড বেশি আয় করে। সাবধানে ট্যাগ করুন।"
      }
    },
    vector: {
      support: true,
      rating: 3,
      bestModes: ["icon-pack", "pattern", "clipart-bundle"],
      tips: {
        en: "Decent vector market. Less competition than Adobe/Freepik. Good for niche content.",
        bn: "ভালো ভেক্টর মার্কেট। Adobe/Freepik-এর চেয়ে কম প্রতিযোগিতা। নিশ কন্টেন্টের জন্য ভালো।"
      }
    },
    video: {
      support: true,
      rating: 3,
      bestModes: ["auto", "collection"],
      tips: {
        en: "Growing video section. Less competition. Good option for diversification.",
        bn: "ক্রমবর্ধমান ভিডিও বিভাগ। কম প্রতিযোগিতা। বৈচিত্র্যের জন্য ভালো অপশন।"
      }
    }
  },
  {
    id: "vecteezy",
    name: "Vecteezy",
    url: "https://www.vecteezy.com/contributors",
    logo: "✨",
    color: "#FF6B35",
    earnings: "50%",
    review: "1-3 days",
    payout: "$50 min",
    strengths: { en: "High commission rate (50%), growing platform, easy to start", bn: "উচ্চ কমিশন (৫০%), ক্রমবর্ধমান প্ল্যাটফর্ম, শুরু করা সহজ" },
    image: {
      support: true,
      rating: 3,
      bestModes: ["auto", "background-texture", "mockup"],
      tips: {
        en: "Good for backgrounds and textures. Less competition than major platforms.",
        bn: "ব্যাকগ্রাউন্ড ও টেক্সচারের জন্য ভালো। বড় প্ল্যাটফর্মের চেয়ে কম প্রতিযোগিতা।"
      }
    },
    vector: {
      support: true,
      rating: 5,
      bestModes: ["icon-pack", "pattern", "sticker-pack", "clipart-bundle", "logo-element", "social-template"],
      tips: {
        en: "Vecteezy specializes in vectors! 50% commission is excellent. Upload consistently for best results.",
        bn: "Vecteezy ভেক্টরে বিশেষজ্ঞ! ৫০% কমিশন চমৎকার। ধারাবাহিকভাবে আপলোড করুন।"
      }
    },
    video: {
      support: true,
      rating: 2,
      bestModes: ["auto"],
      tips: {
        en: "Limited video support. Better to focus vectors here.",
        bn: "সীমিত ভিডিও সাপোর্ট। এখানে ভেক্টরে ফোকাস করুন।"
      }
    }
  },
  {
    id: "pond5",
    name: "Pond5",
    url: "https://www.pond5.com/sell-media",
    logo: "🎬",
    color: "#FF4F00",
    earnings: "40-60%",
    review: "Instant-7 days",
    payout: "$25 min",
    strengths: { en: "Best for video/music/SFX, you set the price, highest video earnings", bn: "ভিডিও/মিউজিক/SFX-এর জন্য সেরা, আপনি দাম নির্ধারণ করেন, সর্বোচ্চ ভিডিও আয়" },
    image: {
      support: true,
      rating: 2,
      bestModes: ["auto"],
      tips: {
        en: "Pond5 is primarily a video platform. Image sales are secondary.",
        bn: "Pond5 মূলত ভিডিও প্ল্যাটফর্ম। ছবির বিক্রি গৌণ।"
      }
    },
    vector: {
      support: true,
      rating: 2,
      bestModes: ["icon-pack"],
      tips: {
        en: "Vector support exists but Pond5 shines with video. Upload vectors as supplementary.",
        bn: "ভেক্টর সাপোর্ট আছে কিন্তু Pond5 ভিডিওতে উজ্জ্বল। ভেক্টর সম্পূরক হিসেবে আপলোড করুন।"
      }
    },
    video: {
      support: true,
      rating: 5,
      bestModes: ["auto", "engineer", "collection"],
      tips: {
        en: "Pond5 is THE best for video. You set your own prices! After Effects templates and 4K clips earn the most.",
        bn: "Pond5 ভিডিওর জন্য সেরা। আপনি নিজের দাম নির্ধারণ করেন! After Effects টেমপ্লেট ও 4K ক্লিপ সবচেয়ে বেশি আয় করে।"
      }
    }
  },
  {
    id: "123rf",
    name: "123RF",
    url: "https://www.123rf.com/contributors",
    logo: "🖼️",
    color: "#0078FF",
    earnings: "30-60%",
    review: "1-3 days",
    payout: "$50 min",
    strengths: { en: "Growing Asian market, good commission structure, AI content friendly", bn: "ক্রমবর্ধমান এশিয়ান মার্কেট, ভালো কমিশন, AI কন্টেন্ট বান্ধব" },
    image: {
      support: true,
      rating: 3,
      bestModes: ["auto", "engineer", "background-texture"],
      tips: {
        en: "123RF is popular in Asia. Good for niche content targeting Asian markets.",
        bn: "123RF এশিয়ায় জনপ্রিয়। এশিয়ান মার্কেট টার্গেটিং নিশ কন্টেন্টের জন্য ভালো।"
      }
    },
    vector: {
      support: true,
      rating: 3,
      bestModes: ["icon-pack", "pattern", "clipart-bundle", "social-template"],
      tips: {
        en: "Decent vector market with less competition. Good for consistent uploaders.",
        bn: "কম প্রতিযোগিতায় ভালো ভেক্টর মার্কেট। ধারাবাহিক আপলোডারদের জন্য ভালো।"
      }
    },
    video: {
      support: true,
      rating: 3,
      bestModes: ["auto", "collection"],
      tips: {
        en: "Video section is growing. Good supplementary marketplace.",
        bn: "ভিডিও বিভাগ বাড়ছে। ভালো সম্পূরক মার্কেটপ্লেস।"
      }
    }
  },
  {
    id: "canva",
    name: "Canva Creators",
    url: "https://www.canva.com/creators/",
    logo: "🎯",
    color: "#00C4CC",
    earnings: "$0.35/use (templates)",
    review: "7-14 days",
    payout: "$10 min",
    strengths: { en: "Massive user base (170M+), template-based earnings, passive income potential", bn: "বিশাল ইউজার বেস (১৭০M+), টেমপ্লেট-ভিত্তিক আয়, প্যাসিভ আয়ের সম্ভাবনা" },
    image: {
      support: false,
      rating: 0,
      bestModes: [],
      tips: { en: "Canva Creators is for templates, not raw images.", bn: "Canva Creators টেমপ্লেটের জন্য, raw ছবির জন্য নয়।" }
    },
    vector: {
      support: true,
      rating: 4,
      bestModes: ["social-template", "infographic", "logo-element", "icon-pack", "pattern"],
      tips: {
        en: "Design Canva templates using your vectors. Social media templates are extremely popular. $0.35 per use adds up fast!",
        bn: "আপনার ভেক্টর দিয়ে Canva টেমপ্লেট ডিজাইন করুন। সোশ্যাল মিডিয়া টেমপ্লেট চরম জনপ্রিয়। প্রতি ব্যবহারে $0.35 দ্রুত যোগ হয়!"
      }
    },
    video: {
      support: false,
      rating: 0,
      bestModes: [],
      tips: { en: "Canva Creators doesn't accept raw video clips.", bn: "Canva Creators raw ভিডিও ক্লিপ গ্রহণ করে না।" }
    }
  },
  {
    id: "etsy",
    name: "Etsy (Digital Downloads)",
    url: "https://www.etsy.com/sell",
    logo: "🛍️",
    color: "#F56400",
    earnings: "You set price (minus 6.5% + $0.20)",
    review: "Instant",
    payout: "Weekly",
    strengths: { en: "You control pricing, huge buyer base, best for bundles and printables", bn: "আপনি দাম নিয়ন্ত্রণ করেন, বিশাল ক্রেতা বেস, বান্ডেল ও প্রিন্টেবলের জন্য সেরা" },
    image: {
      support: true,
      rating: 3,
      bestModes: ["wall-art", "background-texture", "mockup"],
      tips: {
        en: "Sell wall art prints, digital wallpapers, and mockup templates. Bundle them for higher value.",
        bn: "ওয়াল আর্ট প্রিন্ট, ডিজিটাল ওয়ালপেপার ও mockup টেমপ্লেট বিক্রি করুন। বান্ডেল করে উচ্চ মূল্য পান।"
      }
    },
    vector: {
      support: true,
      rating: 5,
      bestModes: ["icon-pack", "pattern", "sticker-pack", "clipart-bundle", "logo-element", "social-template", "web-ui-icons"],
      tips: {
        en: "Etsy is AMAZING for vector bundles! Sell clipart bundles, icon packs, pattern collections. Price $5-$50 per bundle. Passive income gold.",
        bn: "Etsy ভেক্টর বান্ডেলের জন্য অসাধারণ! Clipart বান্ডেল, icon pack, pattern collection বিক্রি করুন। প্রতি বান্ডেল $5-$50। প্যাসিভ আয়ের সোনা।"
      }
    },
    video: {
      support: false,
      rating: 0,
      bestModes: [],
      tips: { en: "Etsy doesn't support video downloads directly.", bn: "Etsy সরাসরি ভিডিও ডাউনলোড সাপোর্ট করে না।" }
    }
  },
  {
    id: "creative-market",
    name: "Creative Market",
    url: "https://creativemarket.com/sell",
    logo: "💎",
    color: "#48A7F2",
    earnings: "50%",
    review: "Application required",
    payout: "$20 min",
    strengths: { en: "Premium design marketplace, 50% commission, design-savvy buyers", bn: "প্রিমিয়াম ডিজাইন মার্কেটপ্লেস, ৫০% কমিশন, ডিজাইন-সচেতন ক্রেতা" },
    image: {
      support: true,
      rating: 3,
      bestModes: ["background-texture", "mockup", "wall-art"],
      tips: {
        en: "Focus on texture packs, mockup templates, and artistic backgrounds. Bundle for higher prices.",
        bn: "টেক্সচার প্যাক, mockup টেমপ্লেট ও শৈল্পিক ব্যাকগ্রাউন্ডে ফোকাস করুন। বান্ডেল করে উচ্চ দাম পান।"
      }
    },
    vector: {
      support: true,
      rating: 5,
      bestModes: ["icon-pack", "pattern", "logo-element", "social-template", "web-ui-icons", "infographic"],
      tips: {
        en: "Creative Market buyers pay premium for quality design assets. Icon packs ($15-$40) and pattern collections ($10-$30) sell best.",
        bn: "Creative Market ক্রেতারা মানসম্পন্ন ডিজাইনের জন্য প্রিমিয়াম দেন। Icon pack ($15-$40) ও pattern collection ($10-$30) সবচেয়ে ভালো বিক্রি হয়।"
      }
    },
    video: {
      support: false,
      rating: 0,
      bestModes: [],
      tips: { en: "Creative Market focuses on design assets, not video.", bn: "Creative Market ডিজাইন সম্পদে ফোকাস করে, ভিডিও নয়।" }
    }
  },
  {
    id: "gumroad",
    name: "Gumroad",
    url: "https://gumroad.com",
    logo: "🚀",
    color: "#FF90E8",
    earnings: "You set price (minus 10%)",
    review: "Instant",
    payout: "Weekly",
    strengths: { en: "Complete pricing freedom, zero listing fees, direct customer relationship", bn: "সম্পূর্ণ দাম নির্ধারণের স্বাধীনতা, শূন্য তালিকা ফি, সরাসরি গ্রাহক সম্পর্ক" },
    image: {
      support: true,
      rating: 3,
      bestModes: ["wall-art", "background-texture", "mockup"],
      tips: {
        en: "Sell curated image packs. Build an audience on social media to drive sales.",
        bn: "কিউরেটেড ইমেজ প্যাক বিক্রি করুন। সোশ্যাল মিডিয়ায় অডিয়েন্স তৈরি করে বিক্রি বাড়ান।"
      }
    },
    vector: {
      support: true,
      rating: 4,
      bestModes: ["icon-pack", "sticker-pack", "clipart-bundle", "pattern", "social-template"],
      tips: {
        en: "Gumroad is great for selling vector mega-bundles at your own price. No approval needed. Market via Twitter/Instagram.",
        bn: "Gumroad ভেক্টর মেগা-বান্ডেল নিজের দামে বিক্রির জন্য চমৎকার। কোনো অনুমোদন লাগে না।"
      }
    },
    video: {
      support: true,
      rating: 3,
      bestModes: ["auto", "collection"],
      tips: {
        en: "Sell video template packs, LUTs, and motion graphics bundles.",
        bn: "ভিডিও টেমপ্লেট প্যাক, LUT ও মোশন গ্রাফিক্স বান্ডেল বিক্রি করুন।"
      }
    }
  }
];

const MODE_LABELS = {
  en: {
    "auto": "Auto", "engineer": "Engineer", "surreal": "Surreal", "background-texture": "BG/Texture",
    "wall-art": "Wall Art", "mockup": "Mockup", "icon-pack": "Icon Pack", "web-ui-icons": "Web UI Icons",
    "pattern": "Pattern", "sticker-pack": "Sticker Pack", "clipart-bundle": "Clipart", "logo-element": "Logo Element",
    "infographic": "Infographic", "social-template": "Social Template", "collection": "Collection"
  },
  bn: {
    "auto": "অটো", "engineer": "ইঞ্জিনিয়ার", "surreal": "সুরিয়াল", "background-texture": "BG/টেক্সচার",
    "wall-art": "ওয়াল আর্ট", "mockup": "মকআপ", "icon-pack": "আইকন প্যাক", "web-ui-icons": "ওয়েব UI আইকন",
    "pattern": "প্যাটার্ন", "sticker-pack": "স্টিকার প্যাক", "clipart-bundle": "ক্লিপআর্ট", "logo-element": "লোগো এলিমেন্ট",
    "infographic": "ইনফোগ্রাফিক", "social-template": "সোশ্যাল টেমপ্লেট", "collection": "কালেকশন"
  }
};

function StarRating({ rating, size = 14 }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size} fill={i <= rating ? "#f59e0b" : "transparent"} color={i <= rating ? "#f59e0b" : "var(--border)"} />
      ))}
    </div>
  );
}

export default function MarketplaceGuidePage() {
  const { t, lang } = useLanguage();
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedMarket, setExpandedMarket] = useState(null);
  const [sortBy, setSortBy] = useState("rating");

  const labels = {
    title: lang === "bn" ? "মার্কেটপ্লেস গাইড" : "Marketplace Guide",
    subtitle: lang === "bn" ? "কোন কন্টেন্ট কোথায় বিক্রি করবেন — সম্পূর্ণ গাইড" : "Where to sell your content — Complete Guide",
    filterAll: lang === "bn" ? "সব" : "All",
    filterImage: lang === "bn" ? "ছবি" : "Image",
    filterVector: lang === "bn" ? "ভেক্টর" : "Vector",
    filterVideo: lang === "bn" ? "ভিডিও" : "Video",
    earnings: lang === "bn" ? "আয়" : "Earnings",
    review: lang === "bn" ? "রিভিউ" : "Review",
    payout: lang === "bn" ? "পেআউট" : "Payout",
    bestModes: lang === "bn" ? "সেরা মোড" : "Best Modes",
    tips: lang === "bn" ? "পরামর্শ" : "Tips",
    notSupported: lang === "bn" ? "সাপোর্ট করে না" : "Not Supported",
    supported: lang === "bn" ? "সাপোর্ট করে" : "Supported",
    sortByRating: lang === "bn" ? "রেটিং অনুসারে" : "By Rating",
    sortByEarnings: lang === "bn" ? "আয় অনুসারে" : "By Earnings",
    topPicks: lang === "bn" ? "সেরা পছন্দ" : "Top Picks",
    quickSummary: lang === "bn" ? "দ্রুত সারাংশ" : "Quick Summary",
    imageTopPick: lang === "bn" ? "ছবি বিক্রির জন্য সেরা" : "Best for selling images",
    vectorTopPick: lang === "bn" ? "ভেক্টর বিক্রির জন্য সেরা" : "Best for selling vectors",
    videoTopPick: lang === "bn" ? "ভিডিও বিক্রির জন্য সেরা" : "Best for selling videos",
    bundleTopPick: lang === "bn" ? "বান্ডেল/সেট বিক্রির জন্য সেরা" : "Best for selling bundles",
    visit: lang === "bn" ? "ভিজিট করুন" : "Visit",
  };

  const filteredMarkets = MARKETPLACES.filter(m => {
    if (activeFilter === "all") return true;
    return m[activeFilter]?.support;
  }).sort((a, b) => {
    if (sortBy === "rating" && activeFilter !== "all") {
      return (b[activeFilter]?.rating || 0) - (a[activeFilter]?.rating || 0);
    }
    return 0;
  });

  return (
    <div className="generator-page" style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--accent-soft)", color: "var(--accent)", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
          <Store size={14} /> {lang === "bn" ? `${MARKETPLACES.length}টি প্ল্যাটফর্ম` : `${MARKETPLACES.length} platforms`}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", margin: "8px 0" }}>{labels.title}</h1>
        <p style={{ color: "var(--text2)", fontSize: 14, maxWidth: 500, margin: "0 auto" }}>{labels.subtitle}</p>
      </div>

      {/* Top Picks Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: labels.imageTopPick, icon: "📸", items: "Adobe Stock, Shutterstock", color: "#6366f1" },
          { label: labels.vectorTopPick, icon: "🎨", items: "Freepik, Etsy, Vecteezy", color: "#10b981" },
          { label: labels.videoTopPick, icon: "🎬", items: "Pond5, Shutterstock, Getty", color: "#f43f5e" },
          { label: labels.bundleTopPick, icon: "📦", items: "Etsy, Creative Market, Gumroad", color: "#f59e0b" },
        ].map((pick, idx) => (
          <div key={idx} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", borderLeft: `3px solid ${pick.color}` }}>
            <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <span aria-hidden="true">{pick.icon}</span>
              <span>{pick.label}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{pick.items}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { id: "all", label: labels.filterAll, icon: LayoutGrid, color: "#6b7280" },
          { id: "image", label: labels.filterImage, icon: Image, color: "#6366f1" },
          { id: "vector", label: labels.filterVector, icon: Palette, color: "#10b981" },
          { id: "video", label: labels.filterVideo, icon: Video, color: "#f43f5e" },
        ].map(f => (
          <button key={f.id} type="button" onClick={() => setActiveFilter(f.id)}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
              border: activeFilter === f.id ? `2px solid ${f.color || "var(--accent)"}` : "1px solid var(--border)",
              background: activeFilter === f.id ? (f.color ? `${f.color}15` : "var(--accent-soft)") : "var(--card)",
              color: activeFilter === f.id ? (f.color || "var(--accent)") : "var(--text2)",
              display: "flex", alignItems: "center", gap: 6
            }}>
            {f.icon && <f.icon size={12} />} {f.label}
          </button>
        ))}
      </div>

      {/* Marketplace Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {filteredMarkets.map(market => {
          const isExpanded = expandedMarket === market.id;
          const contentTypes = activeFilter === "all" ? ["image", "vector", "video"] : [activeFilter];

          return (
            <div key={market.id} style={{
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14,
              overflow: "hidden", transition: "all 0.2s ease"
            }}>
              {/* Market Header */}
              <button type="button" onClick={() => setExpandedMarket(isExpanded ? null : market.id)}
                style={{
                  width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14,
                  cursor: "pointer", border: "none", background: "transparent", textAlign: "left"
                }}>
                <span style={{ fontSize: 28 }}>{market.logo}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{market.name}</h3>
                    {CONTENT_TYPES.map(ct => {
                      const data = market[ct.id];
                      if (!data?.support) return null;
                      return (
                        <span key={ct.id} style={{
                          display: "inline-flex", alignItems: "center", gap: 3,
                          fontSize: 10, padding: "2px 6px", borderRadius: 4,
                          background: `${ct.color}15`, color: ct.color, fontWeight: 600
                        }}>
                          <ct.icon size={10} /> {ct.id === "image" ? "IMG" : ct.id === "vector" ? "VEC" : "VID"}
                        </span>
                      );
                    })}
                    {(["adobe", "shutterstock", "freepik", "getty", "dreamstime", "vecteezy", "pond5", "creative-market", "creativemarket"].includes(market.id)) ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        fontSize: 10, padding: "2px 6px", borderRadius: 4,
                        background: "rgba(16, 185, 129, 0.12)", color: "#10b981", fontWeight: 700,
                        border: "1px solid rgba(16, 185, 129, 0.3)"
                      }} title={lang === "bn" ? "এই প্ল্যাটফর্মের জন্য প্রম্পট জেনারেটর + মেটাডেটা জেনারেটর সরাসরি অপ্টিমাইজ করতে পারে" : "Prompt generator + metadata generator can directly tune output for this platform"}>
                        ✓ {lang === "bn" ? "অপ্টিমাইজড" : "Optimized"}
                      </span>
                    ) : (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        fontSize: 10, padding: "2px 6px", borderRadius: 4,
                        background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", fontWeight: 700,
                        border: "1px solid rgba(245, 158, 11, 0.3)"
                      }} title={lang === "bn" ? "শুধু গাইড — প্রম্পট/মেটাডেটা জেনারেটরে এই প্ল্যাটফর্মের নিজস্ব অপ্টিমাইজেশন এখনো নেই (\"All Marketplaces\" বা মিলিয়ে একটা সিলেক্ট করো)" : "Guide-only — prompt/metadata generator does not have a dedicated optimization profile for this platform yet (use \"All Marketplaces\" or pick a similar one)"}>
                        {lang === "bn" ? "শুধু গাইড" : "Guide-only"}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text3)" }}>
                    {market.strengths[lang] || market.strengths.en}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "var(--text3)" }}>{labels.earnings}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{market.earnings}</div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} color="var(--text3)" /> : <ChevronDown size={16} color="var(--text3)" />}
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border)" }}>
                  {/* Quick Info */}
                  <div style={{ display: "flex", gap: 16, padding: "12px 0", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <DollarSign size={12} color="var(--text3)" />
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>{labels.earnings}:</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{market.earnings}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Shield size={12} color="var(--text3)" />
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>{labels.review}:</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{market.review}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <TrendingUp size={12} color="var(--text3)" />
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>{labels.payout}:</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)" }}>{market.payout}</span>
                    </div>
                    <a href={market.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent)", fontWeight: 600, textDecoration: "none", marginLeft: "auto" }}>
                      <ExternalLink size={11} /> {labels.visit}
                    </a>
                  </div>

                  {/* Content Type Sections */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {contentTypes.map(ctId => {
                      const ct = CONTENT_TYPES.find(c => c.id === ctId);
                      const data = market[ctId];
                      if (!data) return null;

                      return (
                        <div key={ctId} style={{
                          background: "var(--bg2)", borderRadius: 10, padding: "14px 16px",
                          border: `1px solid ${data.support ? `${ct.color}33` : "var(--border)"}`
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <ct.icon size={16} color={ct.color} />
                              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                                {ctId === "image" ? (lang === "bn" ? "ছবি" : "Image") : ctId === "vector" ? (lang === "bn" ? "ভেক্টর" : "Vector") : (lang === "bn" ? "ভিডিও" : "Video")}
                              </span>
                              {data.support ? (
                                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#10b98122", color: "#10b981", fontWeight: 600 }}>
                                  <Check size={9} style={{ verticalAlign: "middle" }} /> {labels.supported}
                                </span>
                              ) : (
                                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#ef444422", color: "#ef4444", fontWeight: 600 }}>
                                  <X size={9} style={{ verticalAlign: "middle" }} /> {labels.notSupported}
                                </span>
                              )}
                            </div>
                            {data.support && <StarRating rating={data.rating} />}
                          </div>

                          {data.support && (
                            <>
                              {/* Best Modes */}
                              {data.bestModes.length > 0 && (
                                <div style={{ marginBottom: 8 }}>
                                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", marginBottom: 4 }}>{labels.bestModes}:</div>
                                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {data.bestModes.map(mode => (
                                      <span key={mode} style={{
                                        fontSize: 10, padding: "2px 8px", borderRadius: 6,
                                        background: `${ct.color}12`, color: ct.color, fontWeight: 600,
                                        border: `1px solid ${ct.color}25`
                                      }}>
                                        {(MODE_LABELS[lang] || MODE_LABELS.en)[mode] || mode}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Tips */}
                              <p style={{ margin: 0, fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>
                                {data.tips[lang] || data.tips.en}
                              </p>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
