import { Inter } from "next/font/google";
import { cookies, headers } from "next/headers";
import "./globals.css";
import "@/styles/sidebar.css";
import "@/styles/components.css";
import "@/styles/modal.css";
import "@/styles/pages.css";
import "@/styles/home.css";
import "@/styles/metadata.css";
// debug.css is no longer imported here. Its 313 lines target `.dbg-*`
// classes that are not referenced anywhere in the JSX tree, so the file
// was shipping ~5KB of dead CSS to every visitor. The file remains in
// src/styles/ for ad-hoc local debugging — re-add the import here if and
// only if you re-introduce a debug panel in development.
import ClientLayout from "@/components/ClientLayout";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  // Drop unused 300 weight; keep 400/500/600/700/800 (all used in CSS).
  weight: ["400", "500", "600", "700", "800"],
});

const SITE_URL = (
  process.env.NEXT_PUBLIC_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
  ""
).replace(/\/+$/, "");

export const metadata = {
  metadataBase: SITE_URL ? new URL(SITE_URL) : undefined,
  title: {
    default: "PromptStudio — AI Prompt & Metadata Generator",
    template: "%s — PromptStudio",
  },
  description:
    "Halal-first AI prompt and microstock metadata generator. Optimized for Adobe Stock, Shutterstock, Freepik, Getty, Dreamstime, Vecteezy, Pond5 and Creative Market.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PromptStudio",
  },
  openGraph: {
    type: "website",
    siteName: "PromptStudio",
    url: SITE_URL || undefined,
    title: "PromptStudio — AI Prompt & Metadata Generator",
    description:
      "Halal-first AI prompt and microstock metadata generator. Optimized for 8 major stock marketplaces.",
  },
  twitter: {
    card: "summary_large_image",
    title: "PromptStudio — AI Prompt & Metadata Generator",
    description:
      "Halal-first AI prompt and microstock metadata generator.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,

  viewportFit: "cover",
};

const SUPPORTED_LANGS = ["en", "bn"];
const SUPPORTED_THEMES = ["light", "dark"];

async function resolveInitialLang() {
  try {
    const cookieStore = await cookies();
    const cookieLang = cookieStore.get("ai-prompt-studio-lang")?.value;
    if (cookieLang && SUPPORTED_LANGS.includes(cookieLang)) return cookieLang;

    const headerStore = await headers();
    const accept = headerStore.get("accept-language") || "";
    const primary = accept.split(",")[0]?.trim().toLowerCase() || "";
    if (primary.startsWith("bn")) return "bn";
  } catch {}
  return "en";
}

async function resolveInitialTheme() {
  try {
    const cookieStore = await cookies();
    const cookieTheme = cookieStore.get("ai-prompt-studio-theme")?.value;
    if (cookieTheme && SUPPORTED_THEMES.includes(cookieTheme)) return cookieTheme;
  } catch {}
  return "light";
}

export default async function RootLayout({ children }) {
  const [initialLang, initialTheme] = await Promise.all([
    resolveInitialLang(),
    resolveInitialTheme(),
  ]);
  return (
    <html
      lang={initialLang}
      data-theme={initialTheme}
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full" suppressHydrationWarning>
        <ClientLayout initialLang={initialLang} initialTheme={initialTheme}>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
