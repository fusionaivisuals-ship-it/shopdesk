// G10 Security headers on every response (SECURITY.md).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // Next.js inline bootstrap; no third-party scripts at all
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",                // the page can only talk to this site: no data sent elsewhere
  "frame-ancestors 'none'",            // can't be framed (clickjacking)
  "form-action 'self'",
  "base-uri 'none'",
  "object-src 'none'",
].join("; ");

export default {
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      ],
    }];
  },
};
