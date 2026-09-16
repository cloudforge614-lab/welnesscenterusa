import "server-only";

import { unstable_cache } from "next/cache";
import type { CacheTag } from "./tags";

// Time-to-live policy. These are backstops, not the primary freshness
// mechanism: every editorial action invalidates the relevant tags immediately,
// so a publish is live on the next request regardless of TTL. What a TTL
// actually protects against is change this application never saw — a row edited
// straight in the Supabase dashboard, or (on a multi-instance deploy) an
// invalidation that fired on one instance and not another.
// Five minutes everywhere. The value is uniform on purpose, so the guarantee
// can be stated in one sentence: no public page reflects an out-of-band change
// more than five minutes late.
//
// Detail pages were initially given an hour, on the reasoning that their
// dependency is narrow and their invalidation exact. Testing changed that:
// pausing a product directly in the database — an urgent withdrawal, say, or a
// merchant pulling an offer — left it publicly purchasable for the rest of the
// hour. The performance difference between five minutes and an hour is
// negligible under continuous traffic, because on-demand invalidation is what
// actually keeps these caches fresh and both windows sit idle between writes.
// The safety difference is not negligible, so the shorter ceiling wins.
const PUBLIC_TTL = 300;

export const TTL = {
  /** Aggregates: homepage feeds and listing pages. */
  feed: PUBLIC_TTL,
  /** Single-entity detail pages. */
  detail: PUBLIC_TTL,
  /** Sitemap. */
  sitemap: PUBLIC_TTL,
} as const;

// Next.js never caches *pages* in development, so that content changes show up
// immediately. Caching the data underneath them would defeat exactly that, and
// would also mean the development site disagreed with the database for minutes
// at a time. Matching the framework's behaviour keeps the two consistent.
const CACHE_ENABLED = process.env.NODE_ENV === "production";

/**
 * Wraps a public read so its result is cached across requests and carries the
 * tags that editorial actions invalidate.
 *
 * The wrapped function must not read cookies or headers — Next.js does not
 * allow request-time APIs inside a cache scope. That is why public reads go
 * through createPublicClient() (no cookies) rather than the session-bound
 * client, and it is also what makes the surrounding route prerenderable.
 *
 * `key` only has to be unique across the app; arguments are part of the cache
 * key automatically.
 */
export function cachedPublic<A extends unknown[], R>(
  key: string,
  tags: CacheTag[],
  revalidate: number,
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  if (!CACHE_ENABLED) return fn;
  return unstable_cache(fn, [key], { tags: [...tags], revalidate });
}
