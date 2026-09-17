import { siteUrl } from "@/lib/env";

// Open Graph / Twitter image resolution (Step 7.10).
//
// Before this, a public page with no image of its own emitted no og:image at
// all, so every listing page, both legal pages, the search page and any
// product or article without an uploaded image shared as a bare grey card.
// Every public page now resolves to an image: its own when it has one, the
// site default otherwise.
//
// The default is generated at src/app/og-default.png/route.tsx. Its URL is
// built from siteUrl rather than written as a path, because og:image must be
// absolute — relative values are ignored by several scrapers, and the ones
// that do resolve them cannot, since they are fetching the page from a URL
// they may have normalised. siteUrl is the same NEXT_PUBLIC_SITE_URL that
// canonical URLs and the sitemap use, so the origin cannot drift between them.

export const DEFAULT_OG_ALT = "Wellness Center USA — independent health and wellness product research";

export const DEFAULT_OG_IMAGE_URL = `${siteUrl}/og-default.png`;

/**
 * Resolves the Open Graph images for a page.
 *
 * `specific` is whatever the page has of its own — a seo_metadata og_image_path
 * or an uploaded product/article image — and is used when present. It is
 * always a public image URL; nothing here ever touches an affiliate
 * destination, which lives only in affiliate_links and is resolved server-side
 * by /go/[slug].
 */
export function ogImages(specific?: string | null): { url: string; width?: number; height?: number; alt?: string }[] {
  if (specific) return [{ url: specific }];
  return [{ url: DEFAULT_OG_IMAGE_URL, width: 1200, height: 630, alt: DEFAULT_OG_ALT }];
}

/**
 * The Twitter image list for a page. Twitter does fall back to og:image on its
 * own, but only when no twitter:image is present at all — and these pages set
 * a twitter block explicitly, so the value is supplied explicitly too rather
 * than relying on a scraper-side fallback we do not control.
 */
export function twitterImages(specific?: string | null): string[] {
  return [specific || DEFAULT_OG_IMAGE_URL];
}

/**
 * Always "summary_large_image": there is now always an image, and the default
 * is a 1200×630 card built for that layout. The previous conditional downgrade
 * to "summary" existed only because an image might be missing.
 */
export const TWITTER_CARD = "summary_large_image" as const;
