import type { NextConfig } from "next";

// Security headers (Phase 7.2). Every source below was derived by inspecting
// what this application actually loads in a production build, not copied from
// a template — see the per-directive notes.
//
// WHY next.config.ts AND NOT A NONCE IN proxy.ts:
// Next.js only applies a nonce to its own inline scripts during server-side
// rendering, by reading it off the request's CSP header. Its own docs
// (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md,
// "Static vs Dynamic Rendering with CSP") are explicit that this means
// *every* page must be dynamically rendered: static generation, ISR, CDN
// caching and PPR are all disabled. That would statically break the five
// prerendered pages (/about, /contact, /privacy-policy, /terms,
// /affiliate-disclosure) plus /_not-found, and it would pre-emptively rule
// out Step 7.5's public caching architecture — the single largest
// performance win identified in the Phase 7 inspection. A nonce would also
// still not buy a strict style-src, because sonner injects its stylesheet at
// runtime and exposes no nonce prop. Static headers here cost nothing, break
// nothing, and survive whatever rendering strategy 7.5 settles on.
const isDev = process.env.NODE_ENV === "development";

// Analytics origins are added to the CSP only when a measurement ID is
// actually configured. With analytics unset — local development, CI, any
// deployment that has not opted in — the policy stays exactly as tight as
// Step 7.2 left it, with no Google origins allowed at all.
//
// These are the specific hosts gtag uses, not a google.com wildcard:
//   googletagmanager.com   serves gtag.js
//   *.google-analytics.com receives the collect beacons, including the
//                          regional endpoints (region1.google-analytics.com)
//   *.analytics.google.com the newer collection domain
// img-src already allows https: for product imagery, so GA's pixel fallback
// needs no further grant.
const analyticsConfigured = Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
const GA_SCRIPT_SRC = analyticsConfigured ? " https://www.googletagmanager.com" : "";
const GA_CONNECT_SRC = analyticsConfigured
  ? " https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com"
  : "";

const csp = [
  // Nothing loads from anywhere but this origin unless a directive below
  // widens it. Also covers the directives deliberately not listed
  // (worker-src, manifest-src, …) — none of which this app uses.
  "default-src 'self'",

  // Blocks <base href> injection from redirecting every relative URL on the
  // page, including the form actions used by login and the agency CMS.
  "base-uri 'self'",

  // No <object>/<embed>/<applet> anywhere in src/ — verified.
  "object-src 'none'",

  // No iframes anywhere in src/ — verified. frame-ancestors 'none' is the
  // modern clickjacking defence and is what actually protects /admin and
  // /agency; X-Frame-Options below repeats it for older browsers.
  "frame-ancestors 'none'",
  "frame-src 'none'",

  // No <audio>/<video> anywhere in src/ — verified.
  "media-src 'none'",

  // Every form in the app posts to a same-origin Server Action.
  "form-action 'self'",

  // 'unsafe-inline' is required and unavoidable: Next.js App Router emits the
  // RSC flight payload as inline <script>self.__next_f.push(...)</script>
  // (6 of them on the homepage alone), and the six JSON-LD blocks are inline
  // <script type="application/ld+json"> too — CSP governs those regardless of
  // type. Their content is dynamic per request, so hashes are impossible, and
  // nonces are ruled out above. All *external* scripts are same-origin
  // /_next/static/chunks/* — there is no CDN and no third-party script.
  // 'unsafe-eval' is development-only: React uses eval there to rebuild
  // server error stacks in the browser. Production uses neither.
  `script-src 'self' 'unsafe-inline'${GA_SCRIPT_SRC}${isDev ? " 'unsafe-eval'" : ""}`,

  // 'unsafe-inline' is required: sonner (the toast library used by both the
  // Owner Admin and Agency CMS layouts) injects its stylesheet into the DOM
  // at runtime and has no nonce prop. Without this, every toast in both
  // dashboards renders unpositioned and unstyled. The app's own CSS is a
  // single same-origin Tailwind bundle, and src/ contains no inline style
  // attribute except the one on /go/[slug]'s 404 body, which this also
  // covers.
  "style-src 'self' 'unsafe-inline'",

  // Product/article/guide images come from two real sources: Supabase Storage
  // uploads, and arbitrary external hosts pasted in as `storage_path`
  // (resolveImageUrl in src/lib/products/image.ts accepts any http(s) URL,
  // and the dev database really does contain a third-party host). There is no
  // image proxy to funnel these through, so the host cannot be enumerated —
  // https: is the honest minimum. Images cannot execute, so this is a far
  // weaker grant than it looks. http: is dev-only, for local fixture images.
  `img-src 'self' https:${isDev ? " http:" : ""}`,

  // next/font/google self-hosts both families at build time into
  // /_next/static/media/*.woff2 — verified in the compiled CSS. No Google
  // Fonts domain is needed, despite the import name suggesting otherwise.
  "font-src 'self'",

  // The browser never talks to Supabase: there is no createBrowserClient
  // anywhere, and no client component imports supabase at all. Every query
  // runs server-side. So this only needs to cover Next.js's own same-origin
  // RSC navigation fetches. ws: is dev-only, for hot reload.
  `connect-src 'self'${GA_CONNECT_SRC}${isDev ? " ws: wss:" : ""}`,

  // Production only: on localhost this would rewrite http://localhost fixture
  // image URLs to https and break them.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Stops a response being reinterpreted as a different type than its
  // Content-Type claims — notably relevant because the product-images bucket
  // is public-read.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Redundant with frame-ancestors 'none' for modern browsers; kept for
  // older ones. The Owner Admin and Agency CMS must not be framable.
  { key: "X-Frame-Options", value: "DENY" },
  // Matches what /go/[slug] already sets for itself, now applied everywhere:
  // full URLs are never leaked to another origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // This app requests none of these. File uploads use <input type="file">,
  // which Permissions-Policy does not gate, so the Agency CMS is unaffected.
  // Listed features are kept to widely-recognised ones so browsers don't warn
  // about unknown directives.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // Next.js 16 streams the initial HTML (committing a 200 status) before
  // generateMetadata resolves, by default, for any request it doesn't
  // recognize as an "HTML-limited bot". That means notFound() calls in
  // /products/[slug] (paused/archived/unpublished/deleted/missing products)
  // and /admin/products/[id] render the correct not-found UI but keep the
  // HTTP status at 200 — a soft 404, which is exactly what Google's own
  // guidance says to avoid, and is unacceptable for an SEO-driven affiliate
  // site. Treating every request as "HTML-limited" disables streaming
  // metadata entirely, so the full page (including any notFound() call)
  // resolves before the response starts, restoring a real 404 status.
  htmlLimitedBots: /.*/,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...securityHeaders,
          // HSTS is deliberately production-only. Browsers ignore it on
          // plaintext responses anyway, but emitting it in dev is noise at
          // best and a footgun if a local host ever gets pinned.
          //
          // No `preload`: that requires submitting the apex domain to the
          // browser-vendor preload list, is slow and painful to reverse, and
          // there is no production domain yet. Revisit at Step 7.12, and
          // confirm then that every subdomain really is HTTPS-only before
          // relying on includeSubDomains.
          ...(isDev
            ? []
            : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
        ],
      },
    ];
  },
};

export default nextConfig;
