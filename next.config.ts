import type { NextConfig } from "next";

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
};

export default nextConfig;
