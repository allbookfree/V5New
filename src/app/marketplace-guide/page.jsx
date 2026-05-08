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
    aiPolicy: "direct",
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
    aiPolicy: "manual",
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
    aiPolicy: "direct",
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
    aiPolicy: "manual",
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
    aiPolicy: "direct",
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
    aiPolicy: "direct",
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
    aiPolicy: "manual",
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
    aiPolicy: "direct",
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
    aiPolicy: "direct",
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
    aiPolicy: "direct",
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
    aiPolicy: "manual",
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
    aiPolicy: "direct",
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
  },
  {
    id: "depositphotos",
    name: "Depositphotos",
    url: "https://contributor.depositphotos.com",
    logo: "🗂️",
    color: "#00B0FF",
    aiPolicy: "manual",
    earnings: "34-42%",
    review: "1-7 days",
    payout: "$50 min",
    strengths: { en: "Established global stock — pure AI rejected through main portal, but vectors and human-curated content welcome", bn: "প্রতিষ্ঠিত গ্লোবাল স্টক — মূল পোর্টালে pure AI বাতিল, কিন্তু ভেক্টর ও মানুষের ছোঁয়া দেওয়া কন্টেন্ট গ্রহণযোগ্য" },
    image: {
      support: true,
      rating: 3,
      bestModes: ["engineer", "background-texture", "mockup"],
      tips: {
        en: "Apply your own edit pass before upload — Depositphotos rejects raw AI through the standard portal. Vectors and curated retouches do well.",
        bn: "আপলোডের আগে নিজের এডিট পাস দিন — Depositphotos স্ট্যান্ডার্ড পোর্টালে raw AI বাতিল করে। ভেক্টর ও কিউরেটেড রিটাচ ভালো করে।"
      }
    },
    vector: {
      support: true,
      rating: 4,
      bestModes: ["icon-pack", "pattern", "clipart-bundle", "social-template"],
      tips: {
        en: "Vectors are the safest path here. Clean designer-grade icon packs and patterns sell consistently.",
        bn: "এখানে ভেক্টরই সবচেয়ে নিরাপদ পথ। পরিষ্কার ডিজাইনার-গ্রেড আইকন প্যাক ও প্যাটার্ন ধারাবাহিকভাবে বিক্রি হয়।"
      }
    },
    video: {
      support: true,
      rating: 3,
      bestModes: ["auto", "engineer"],
      tips: {
        en: "Stable, professional-looking clips only — apply a real edit/grade pass to hide AI tells.",
        bn: "শুধু স্থিতিশীল, প্রফেশনাল-লুকিং ক্লিপ — AI চিহ্ন লুকাতে আসল এডিট/গ্রেড পাস দিন।"
      }
    }
  },
  {
    id: "envato",
    name: "Envato Elements",
    url: "https://elements.envato.com/become-an-author",
    logo: "🟢",
    color: "#82B541",
    aiPolicy: "manual",
    earnings: "Subscription share",
    review: "Curation required",
    payout: "Monthly",
    strengths: { en: "Subscription marketplace for templates, graphics, video, music — pure raw AI not accepted; curated and edited assets only", bn: "টেমপ্লেট, গ্রাফিক্স, ভিডিও ও মিউজিকের সাবস্ক্রিপশন মার্কেটপ্লেস — pure raw AI গ্রহণযোগ্য নয়; শুধু কিউরেটেড ও এডিটেড সম্পদ" },
    image: {
      support: true,
      rating: 2,
      bestModes: ["engineer", "background-texture", "mockup"],
      tips: {
        en: "Heavy curation pass required. Envato favours polished, ready-to-use assets — never upload unedited AI output.",
        bn: "ভারী কিউরেশন পাস প্রয়োজন। Envato পলিশড, রেডি-টু-ইউজ সম্পদ পছন্দ করে — কখনোই unedited AI আউটপুট আপলোড করবেন না।"
      }
    },
    vector: {
      support: true,
      rating: 4,
      bestModes: ["icon-pack", "pattern", "logo-element", "social-template", "infographic"],
      tips: {
        en: "Strong vector market. Editable, layered, well-organised files do best.",
        bn: "শক্তিশালী ভেক্টর মার্কেট। এডিটেবল, লেয়ারড, সুসংগঠিত ফাইল সবচেয়ে ভালো করে।"
      }
    },
    video: {
      support: true,
      rating: 3,
      bestModes: ["motion-graphics", "engineer", "collection"],
      tips: {
        en: "Motion graphics templates and stock footage do well — but every clip needs a human edit/grade pass before submission.",
        bn: "মোশন গ্রাফিক্স টেমপ্লেট ও স্টক ফুটেজ ভালো করে — কিন্তু সাবমিশনের আগে প্রতিটি ক্লিপে মানুষের এডিট/গ্রেড পাস লাগবে।"
      }
    }
  },
  {
    id: "wirestock",
    name: "Wirestock",
    url: "https://wirestock.io",
    logo: "🔌",
    color: "#7C3AED",
    aiPolicy: "direct",
    earnings: "Aggregator share",
    review: "Aggregator-managed",
    payout: "Varies",
    strengths: { en: "AI-friendly aggregator that submits to multiple stock sites in one upload — great for AI creators", bn: "AI-বান্ধব অ্যাগ্রিগেটর — এক আপলোডে একাধিক স্টক সাইটে সাবমিট করে, AI ক্রিয়েটরদের জন্য চমৎকার" },
    image: {
      support: true,
      rating: 4,
      bestModes: ["engineer", "background-texture", "mockup", "wall-art"],
      tips: {
        en: "Wirestock submits one upload to many networks. AI is welcome — disclose properly and let the aggregator handle distribution.",
        bn: "Wirestock এক আপলোড অনেক নেটওয়ার্কে পাঠায়। AI স্বাগত — সঠিকভাবে প্রকাশ করুন এবং অ্যাগ্রিগেটরকে বিতরণ করতে দিন।"
      }
    },
    vector: {
      support: true,
      rating: 3,
      bestModes: ["icon-pack", "pattern", "clipart-bundle"],
      tips: {
        en: "Vectors flow through the aggregator into multiple downstream marketplaces.",
        bn: "ভেক্টর অ্যাগ্রিগেটরের মাধ্যমে একাধিক ডাউনস্ট্রিম মার্কেটপ্লেসে প্রবাহিত হয়।"
      }
    },
    video: {
      support: true,
      rating: 3,
      bestModes: ["auto", "b-roll", "loopable"],
      tips: {
        en: "Short clips and loops fan out across the network — good way to monetise AI video output at scale.",
        bn: "ছোট ক্লিপ ও লুপ নেটওয়ার্ক জুড়ে ছড়িয়ে পড়ে — স্কেলে AI ভিডিও আউটপুট মনিটাইজ করার ভালো উপায়।"
      }
    }
  },
  {
    id: "redbubble",
    name: "Redbubble / Teepublic",
    url: "https://www.redbubble.com/sell",
    logo: "👕",
    color: "#E41B23",
    aiPolicy: "direct",
    earnings: "10-30% margin",
    review: "Instant",
    payout: "$20 min",
    strengths: { en: "Print-on-demand giant — apparel, stickers, prints, home goods. AI welcome; designs need to scale across product surfaces", bn: "Print-on-demand দৈত্য — পোশাক, স্টিকার, প্রিন্ট, হোম গুডস। AI স্বাগত; ডিজাইন প্রোডাক্ট সারফেস জুড়ে স্কেল করতে হবে" },
    image: {
      support: true,
      rating: 3,
      bestModes: ["wall-art", "print-on-demand", "background-texture"],
      tips: {
        en: "Wall art and graphics that translate to mugs, totes, and shirts. Transparent backgrounds where possible.",
        bn: "ওয়াল আর্ট ও গ্রাফিক্স যা মগ, টোট ও শার্টে অনুবাদ করা যায়। সম্ভব হলে স্বচ্ছ ব্যাকগ্রাউন্ড।"
      }
    },
    vector: {
      support: true,
      rating: 5,
      bestModes: ["t-shirt-graphic", "sticker-pack", "logo-element", "character-mascot"],
      tips: {
        en: "T-shirt graphics, stickers, and decorative vectors are Redbubble's core. Bold silhouettes that work at any size win.",
        bn: "টি-শার্ট গ্রাফিক্স, স্টিকার ও ডেকোরেটিভ ভেক্টর Redbubble-এর কোর। যেকোনো সাইজে কাজ করা bold silhouette জেতে।"
      }
    },
    video: {
      support: false,
      rating: 0,
      bestModes: [],
      tips: { en: "POD platform — no video products.", bn: "POD প্ল্যাটফর্ম — কোনো ভিডিও প্রোডাক্ট নেই।" }
    }
  },
  {
    id: "society6",
    name: "Society6",
    url: "https://society6.com/become-an-artist",
    logo: "🎨",
    color: "#EF4444",
    aiPolicy: "direct",
    earnings: "10% base + custom margins",
    review: "Instant",
    payout: "Monthly",
    strengths: { en: "Curated POD home-goods and art-print marketplace — AI accepted; designs must look gallery-grade", bn: "কিউরেটেড POD হোম-গুডস ও আর্ট-প্রিন্ট মার্কেটপ্লেস — AI গ্রহণযোগ্য; ডিজাইন গ্যালারি-গ্রেড দেখাতে হবে" },
    image: {
      support: true,
      rating: 4,
      bestModes: ["wall-art", "print-on-demand", "background-texture"],
      tips: {
        en: "Strong palettes and gallery-grade compositions. Designs must hold up at small sticker AND large wall-art scale.",
        bn: "শক্তিশালী প্যালেট ও গ্যালারি-গ্রেড কম্পোজিশন। ডিজাইন ছোট স্টিকার এবং বড় ওয়াল-আর্ট স্কেল উভয়ে কাজ করতে হবে।"
      }
    },
    vector: {
      support: true,
      rating: 4,
      bestModes: ["pattern", "clipart-bundle", "logo-element", "sticker-pack"],
      tips: {
        en: "Decorative patterns and bold motifs do well across mugs, throw pillows, and apparel.",
        bn: "ডেকোরেটিভ প্যাটার্ন ও bold মোটিফ মগ, থ্রো পিলো ও পোশাকে ভালো করে।"
      }
    },
    video: {
      support: false,
      rating: 0,
      bestModes: [],
      tips: { en: "Society6 is a print/home-goods platform — no video.", bn: "Society6 প্রিন্ট/হোম-গুডস প্ল্যাটফর্ম — কোনো ভিডিও নেই।" }
    }
  },
  {
    id: "pixta",
    name: "Pixta (Asia / Global)",
    url: "https://creator.pixtastock.com",
    logo: "🌏",
    color: "#0EA5E9",
    aiPolicy: "direct",
    earnings: "22-58%",
    review: "1-3 days",
    payout: "¥5000 min",
    strengths: { en: "Japan-headquartered global stock — strong demand for Asian and lifestyle subjects, AI accepted with disclosure", bn: "জাপান-ভিত্তিক গ্লোবাল স্টক — এশিয়ান ও লাইফস্টাইল বিষয়ের শক্তিশালী চাহিদা, প্রকাশসহ AI গ্রহণযোগ্য" },
    image: {
      support: true,
      rating: 4,
      bestModes: ["engineer", "seasonal", "background-texture"],
      tips: {
        en: "Big opportunity for under-supplied non-Western themes — halal, South Asian, Southeast Asian lifestyle. Disclose AI.",
        bn: "কম-সরবরাহ থাকা non-Western থিমের জন্য বড় সুযোগ — halal, দক্ষিণ এশিয়ান, দক্ষিণ-পূর্ব এশিয়ান লাইফস্টাইল। AI প্রকাশ করুন।"
      }
    },
    vector: {
      support: true,
      rating: 3,
      bestModes: ["icon-pack", "pattern", "social-template"],
      tips: {
        en: "Crisp, polite design aesthetic with multilingual usability does well.",
        bn: "মাল্টিলিঙ্গুয়াল ব্যবহারযোগ্যতা সহ পরিষ্কার, মার্জিত ডিজাইন aesthetic ভালো করে।"
      }
    },
    video: {
      support: true,
      rating: 3,
      bestModes: ["auto", "b-roll", "engineer"],
      tips: {
        en: "Clean, story-first motion suitable for Japanese and global advertising.",
        bn: "জাপানিজ ও গ্লোবাল বিজ্ঞাপনের জন্য পরিষ্কার, গল্প-প্রধান motion।"
      }
    }
  },
  {
    id: "pixabay",
    name: "Pixabay (Free + Content Plus)",
    url: "https://pixabay.com",
    logo: "🌐",
    color: "#10B981",
    aiPolicy: "direct",
    earnings: "Content Plus revenue share",
    review: "1-3 days",
    payout: "Stripe-based",
    strengths: { en: "Massive free media platform with paid Content Plus tier — AI welcome with disclosure; great audience builder", bn: "বিশাল ফ্রি মিডিয়া প্ল্যাটফর্ম এবং পেইড Content Plus টিয়ার — প্রকাশসহ AI স্বাগত; দারুণ অডিয়েন্স বিল্ডার" },
    image: {
      support: true,
      rating: 3,
      bestModes: ["background-texture", "engineer", "wall-art"],
      tips: {
        en: "Bright, broadly-usable photography and texture/background frames travel furthest.",
        bn: "উজ্জ্বল, ব্যাপক-ব্যবহারযোগ্য ফটোগ্রাফি ও টেক্সচার/ব্যাকগ্রাউন্ড ফ্রেম সবচেয়ে দূরে পৌঁছায়।"
      }
    },
    vector: {
      support: true,
      rating: 3,
      bestModes: ["icon-pack", "pattern", "social-template"],
      tips: {
        en: "Clean SVG-friendly vectors usable in web, blog and social.",
        bn: "ওয়েব, ব্লগ ও সোশ্যালে ব্যবহারযোগ্য পরিষ্কার SVG-বান্ধব ভেক্টর।"
      }
    },
    video: {
      support: true,
      rating: 2,
      bestModes: ["auto", "loopable"],
      tips: {
        en: "Light, social-friendly clips with universal appeal.",
        bn: "সর্বজনীন আবেদনসম্পন্ন হালকা, সোশ্যাল-বান্ধব ক্লিপ।"
      }
    }
  },
  {
    id: "amazon-kdp",
    name: "Amazon KDP (Books / Covers)",
    url: "https://kdp.amazon.com",
    logo: "📚",
    color: "#FF9900",
    aiPolicy: "manual",
    earnings: "35-70% royalty",
    review: "Instant",
    payout: "Monthly",
    strengths: { en: "Self-publishing giant for books, journals and low-content notebooks — AI covers/interiors allowed with disclosure but require a clear human edit pass", bn: "বই, জার্নাল ও low-content নোটবুকের জন্য self-publishing দৈত্য — প্রকাশসহ AI কভার/ইন্টেরিয়র অনুমোদিত, কিন্তু স্পষ্ট মানব এডিট পাস দরকার" },
    image: {
      support: true,
      rating: 3,
      bestModes: ["wall-art", "print-on-demand", "engineer"],
      tips: {
        en: "Cover art, journal interiors, and low-content notebook backgrounds. Disclose AI in KDP form. Run a real human curation pass.",
        bn: "কভার আর্ট, জার্নাল ইন্টেরিয়র ও low-content নোটবুক ব্যাকগ্রাউন্ড। KDP ফর্মে AI প্রকাশ করুন। আসল মানব কিউরেশন পাস চালান।"
      }
    },
    vector: {
      support: true,
      rating: 4,
      bestModes: ["pattern", "clipart-bundle", "social-template", "logo-element"],
      tips: {
        en: "Vector cover art, page borders and patterns are KDP's sweet spot — they reproduce flawlessly at any trim size.",
        bn: "ভেক্টর কভার আর্ট, পেজ বর্ডার ও প্যাটার্ন KDP-র sweet spot — যেকোনো ট্রিম সাইজে নিখুঁতভাবে পুনরুৎপাদন হয়।"
      }
    },
    video: {
      support: false,
      rating: 0,
      bestModes: [],
      tips: { en: "KDP is a print/eBook platform — no video.", bn: "KDP প্রিন্ট/eBook প্ল্যাটফর্ম — কোনো ভিডিও নেই।" }
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
                    {market.aiPolicy === "direct" ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        fontSize: 10, padding: "2px 6px", borderRadius: 4,
                        background: "rgba(16, 185, 129, 0.12)", color: "#10b981", fontWeight: 700,
                        border: "1px solid rgba(16, 185, 129, 0.3)"
                      }} title={lang === "bn" ? "এই মার্কেটপ্লেস AI কন্টেন্ট প্রকাশসহ সরাসরি গ্রহণ করে — সরাসরি আপলোড করা যাবে।" : "This marketplace officially accepts AI content with disclosure — upload directly."}>
                        ✅ {lang === "bn" ? "AI সরাসরি" : "AI Direct"}
                      </span>
                    ) : market.aiPolicy === "manual" ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        fontSize: 10, padding: "2px 6px", borderRadius: 4,
                        background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b", fontWeight: 700,
                        border: "1px solid rgba(245, 158, 11, 0.3)"
                      }} title={lang === "bn" ? "এই মার্কেটপ্লেস সরাসরি AI আউটপুট গ্রহণ করে না — আপলোডের আগে নিজের হাতের ছোঁয়ায় এডিট/কিউরেশন পাস দিতে হবে।" : "This marketplace doesn't accept raw AI output — apply your own manual edit/curation pass before upload."}>
                        ⚠️ {lang === "bn" ? "হাতের ছোঁয়া দরকার" : "Manual Touch"}
                      </span>
                    ) : null}
                    {(["adobe", "shutterstock", "freepik", "getty", "dreamstime", "vecteezy", "pond5", "creative-market", "creativemarket", "depositphotos", "envato", "wirestock", "redbubble", "society6", "pixta", "pixabay", "amazon-kdp", "123rf", "etsy"].includes(market.id)) ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        fontSize: 10, padding: "2px 6px", borderRadius: 4,
                        background: "rgba(99, 102, 241, 0.12)", color: "#6366f1", fontWeight: 700,
                        border: "1px solid rgba(99, 102, 241, 0.3)"
                      }} title={lang === "bn" ? "প্রম্পট জেনারেটর এই মার্কেটপ্লেসের জন্য নির্দিষ্ট aesthetic গাইডেন্স ও AI পলিসি সম্বন্ধে জানে।" : "Prompt generator has a tailored aesthetic + AI-policy profile for this marketplace."}>
                        ✓ {lang === "bn" ? "অপ্টিমাইজড" : "Optimized"}
                      </span>
                    ) : null}
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

      {/* ── AI Provider Comparison for Marketplace Sellers ────────────────── */}
      <div style={{ marginTop: 40, borderTop: "1px solid var(--border)", paddingTop: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#6366f115", color: "#6366f1", padding: "4px 12px", borderRadius: 16, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
            <TrendingUp size={12} /> {lang === "bn" ? "AI প্রোভাইডার তুলনা" : "AI Provider Comparison"}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: "4px 0" }}>
            {lang === "bn" ? "কোন AI প্রোভাইডার আপনার জন্য সেরা?" : "Which AI Provider is Best for You?"}
          </h2>
          <p style={{ fontSize: 13, color: "var(--text2)", maxWidth: 500, margin: "0 auto" }}>
            {lang === "bn"
              ? "আপনার মার্কেটপ্লেস কন্টেন্ট তৈরির জন্য সেরা প্রোভাইডার বেছে নিন"
              : "Choose the best provider for your marketplace content creation workflow"}
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {[
            { name: "Gemini", emoji: "🔵", speed: lang === "bn" ? "দ্রুত" : "Fast", cost: lang === "bn" ? "বিনামূল্যে" : "Free", best: lang === "bn" ? "সব ধরনের কন্টেন্ট — সেরা সামগ্রিক পছন্দ" : "All content types — best overall choice", models: "Flash, Flash-Lite, Pro", verdict: lang === "bn" ? "শুরু করার জন্য সেরা" : "Best to start with" },
            { name: "Groq", emoji: "🔴", speed: lang === "bn" ? "অতি দ্রুত" : "Ultra fast", cost: lang === "bn" ? "বিনামূল্যে" : "Free", best: lang === "bn" ? "বাল্ক কন্টেন্ট তৈরি — দ্রুত ও বড় পরিমাণে" : "Bulk content creation — fast & high volume", models: "7 models incl. Kimi K2, GPT-OSS 120B", verdict: lang === "bn" ? "গতির জন্য সেরা" : "Best for speed" },
            { name: "GitHub Models", emoji: "⬛", speed: lang === "bn" ? "মাঝারি" : "Moderate", cost: lang === "bn" ? "বিনামূল্যে (PAT)" : "Free (PAT)", best: lang === "bn" ? "উচ্চ মানের কন্টেন্ট — GPT-5, o4-mini রিজনিং" : "High quality content — GPT-5, o4-mini reasoning", models: "GPT-5, GPT-4o, Phi-4, o4-mini", verdict: lang === "bn" ? "মানের জন্য সেরা" : "Best for quality" },
            { name: "OpenRouter", emoji: "🟣", speed: lang === "bn" ? "পরিবর্তনশীল" : "Variable", cost: lang === "bn" ? "বিনামূল্যে" : "Free", best: lang === "bn" ? "বিভিন্ন মডেল চেষ্টা করা — ২৯+ ফ্রি মডেল" : "Trying various models — 29+ free models", models: "Auto-router, Nemotron, DeepSeek R1", verdict: lang === "bn" ? "বৈচিত্র্যের জন্য সেরা" : "Best for variety" },
            { name: "Mistral", emoji: "🟠", speed: lang === "bn" ? "দ্রুত" : "Fast", cost: lang === "bn" ? "বিনামূল্যে" : "Free tier", best: lang === "bn" ? "মেটাডাটা জেনারেশন — Pixtral ভিশন মডেল" : "Metadata generation — Pixtral vision model", models: "Small 4, Pixtral 12B, Nemo", verdict: lang === "bn" ? "ভিশনের জন্য সেরা" : "Best for vision" },
            { name: "NVIDIA NIM", emoji: "🟢", speed: lang === "bn" ? "দ্রুত" : "Fast", cost: lang === "bn" ? "ফ্রি ক্রেডিট" : "Free credits", best: lang === "bn" ? "ভিশন টাস্ক — Maverick, Llama 3.2 Vision" : "Vision tasks — Maverick, Llama 3.2 Vision", models: "Maverick, Llama 3.2, Nemotron", verdict: lang === "bn" ? "ভিশনের জন্য ভালো" : "Good for vision" },
          ].map((p, i) => (
            <div key={i} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>{p.emoji}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{p.name}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11, marginBottom: 10 }}>
                <div><span style={{ color: "var(--text3)" }}>{lang === "bn" ? "গতি:" : "Speed:"}</span> <span style={{ fontWeight: 600, color: "var(--text)" }}>{p.speed}</span></div>
                <div><span style={{ color: "var(--text3)" }}>{lang === "bn" ? "খরচ:" : "Cost:"}</span> <span style={{ fontWeight: 600, color: "#10b981" }}>{p.cost}</span></div>
              </div>
              <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color: "var(--text3)" }}>{lang === "bn" ? "সেরা:" : "Best for:"}</span> {p.best}
              </div>
              <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 8 }}>{p.models}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", background: "#6366f110", padding: "4px 10px", borderRadius: 8, textAlign: "center" }}>
                {p.verdict}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
