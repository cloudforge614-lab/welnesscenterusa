import "server-only";

import { updateTag } from "next/cache";

// The shared vocabulary between "what a public query reads" and "what an
// editorial action changed". Query modules declare the tags their data depends
// on; mutations declare the tags they invalidated. Neither side needs to know
// anything about routes, which is what keeps this from becoming a hand-
// maintained list of paths that silently rots as pages are added.
//
// Tags are deliberately per-entity-type rather than per-row. Per-row tags would
// invalidate less, but they would also have to be threaded through every
// caller, and the failure mode of getting one wrong is serving stale published
// content — far worse than re-rendering a handful of pages that did not need
// it. Entity-type granularity is still precise: publishing a guide does not
// touch a single review or comparison cache entry.
export const TAGS = {
  /**
   * Product rows, product_content, product images, and anything derived from
   * the two-gate eligibility rule.
   *
   * Note this is also attached to every *content* detail query, because those
   * pages embed related products and re-check each one's eligibility at read
   * time. A product being paused has to drop it from the comparison and guide
   * pages that list it, not just from the product pages.
   */
  products: "public:products",
  reviews: "public:reviews",
  guides: "public:guides",
  articles: "public:articles",
  comparisons: "public:comparisons",
  /** Category rows and product↔category assignments. */
  categories: "public:categories",
  /** seo_metadata rows, which feed generateMetadata on public routes. */
  seo: "public:seo",
  /**
   * Historical-slug redirects. Written automatically by the
   * record_slug_change() trigger (migration 0019) whenever a slug changes, so
   * the editorial actions that can cause a slug change invalidate this too.
   */
  redirects: "public:redirects",
} as const;

export type CacheTag = (typeof TAGS)[keyof typeof TAGS];

/**
 * Invalidates public cache entries for the given tags.
 *
 * Uses updateTag rather than revalidateTag deliberately. revalidateTag's
 * recommended "max" profile is stale-while-revalidate: the first request after
 * the call is still served the OLD content while fresh content regenerates in
 * the background. For an editorial workflow that is wrong twice over — an
 * editor would not see their own publish, and, far worse, a guide that was
 * just *unpublished* would still be served to the next visitor. updateTag
 * expires immediately and makes the next request wait for fresh data, so
 * withdrawing content takes effect at once.
 *
 * updateTag may only be called from a Server Action, which is the only place
 * this function is used — every caller is an owner/agency editorial action.
 */
export function revalidatePublic(...tags: CacheTag[]): void {
  for (const tag of new Set(tags)) {
    updateTag(tag);
  }
}
