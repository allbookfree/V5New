/** @type {import('next').NextConfig} */

// Production security headers. Each header is documented inline so anyone
// reviewing this file can understand the intent and tighten it further if
// needed. The CSP is deliberately permissive enough to keep the app working
// out-of-the-box (Next.js inline runtime, Google Fonts, our API providers)
// while blocking obvious XSS, framing, and protocol-downgrade vectors.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js needs unsafe-inline + unsafe-eval for its dev runtime and
      // some lazy-loaded chunks. Tighten in production only if you also drop
      // all client-side `eval`-style code paths.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' fonts.gstatic.com data:",
      // Allow our API routes (same-origin) and direct browser calls if any.
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // HSTS: enforce HTTPS for 2 years, include subdomains, allow preload list
  // submission. Only takes effect over HTTPS so it's harmless in local dev.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Apply to every route. /api routes still get the headers but the
        // CSP is mostly relevant to HTML responses; this is intentional —
        // having the headers everywhere is safer than trying to scope.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
