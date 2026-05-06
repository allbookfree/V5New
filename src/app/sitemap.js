export default function sitemap() {
  // Resolve canonical base URL with sensible fallbacks so the sitemap is
  // never silently published with a localhost reference.
  //   1. NEXT_PUBLIC_BASE_URL  — manual override (preferred)
  //   2. NEXT_PUBLIC_APP_URL    — alias used by some templates
  //   3. VERCEL_URL             — auto-injected by Vercel on every deploy
  //                               (auto-injected by Vercel on deploy)
  //   4. localhost              — final dev fallback
  const explicit =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "";
  const vercelHost = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const raw = explicit || vercelHost || "http://localhost:5000";
  const baseUrl = raw.replace(/\/+$/, "");

  if (!explicit && !vercelHost && process.env.NODE_ENV === "production") {
    console.warn(
      "[sitemap] NEXT_PUBLIC_BASE_URL / NEXT_PUBLIC_APP_URL / VERCEL_URL are all unset — sitemap will reference localhost.",
    );
  }

  const now = new Date();
  return [
    { url: baseUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/prompt-generator`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/vector-generator`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/video-generator`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/metadata-generator`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/marketplace-guide`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/history`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${baseUrl}/analytics`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${baseUrl}/api-status`, lastModified: now, changeFrequency: "daily", priority: 0.4 },
  ];
}
