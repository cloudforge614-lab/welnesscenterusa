import "server-only";

import { permanentRedirect, redirect } from "next/navigation";
import { cachedPublic, TTL } from "@/lib/cache/public-cache";
import { TAGS } from "@/lib/cache/tags";
import { createPublicClient } from "@/lib/supabase/public";
import { getPublicProduct, getPublicCategory } from "@/lib/products/public-queries";
import { getPublicReview } from "@/lib/reviews/public-queries";
import { getPublicGuide } from "@/lib/guides/public-queries";
import { getPublicArticle } from "@/lib/articles/public-queries";
import { getPublicComparison } from "@/lib/comparisons/public-queries";

// Historical-URL redirects (Phase 7.9).
//
// THIS IS NOT THE AFFILIATE REDIRECT. /go/[slug] resolves a merchant
// destination through get_active_affiliate_link() and is untouched by any of
// this. Nothing here reads affiliate_links, and a destination_path is always
// an internal path on this site — the database enforces that with a CHECK
// constraint (migration 0019), so a row pointing off-site cannot even be
// stored.
//
// WHERE THIS RUNS, AND WHY THERE
// Only on the 404 path of the six public slug routes, immediately before they
// would have called notFound(). That placement matters:
//   • a request for a page that exists never pays for it at all
//   • the proxy matcher is untouched, so the auth boundary it guards is not
//     reopened for every public request
//   • no public page becomes dynamic, so Step 7.5's caching is unaffected —
//     this runs inside the route's existing render, and the outcome is cached
//     with it
// A middleware implementation would have had to query for every request,
// including the overwhelming majority that resolve fine, because middleware
// cannot know in advance that a page is about to 404.

const CACHE_TTL = TTL.detail;

type Resolver = (slug: string) => Promise<unknown | null>;

// A destination is only honoured if the entity it names is currently, publicly
// eligible — each resolver is the same function the corresponding public route
// uses, so "eligible" means exactly what it means everywhere else (two-gate
// rule for products, published status for content). Keeping this in one place
// rather than in six routes means the guarantee is enforced once.
const RESOLVERS: { prefix: string; resolve: Resolver }[] = [
  { prefix: "/products/", resolve: (s) => getPublicProduct(s) },
  { prefix: "/categories/", resolve: (s) => getPublicCategory(s) },
  { prefix: "/reviews/", resolve: (s) => getPublicReview(s) },
  { prefix: "/guides/", resolve: (s) => getPublicGuide(s) },
  { prefix: "/blog/", resolve: (s) => getPublicArticle(s) },
  { prefix: "/comparisons/", resolve: (s) => getPublicComparison(s) },
];

/**
 * Looks up an active redirect for a path. Returns only the destination and
 * type — never the row, never anything else from the table.
 *
 * Uses the cookie-free public client so the lookup can live inside a cached,
 * statically-rendered route. anon may SELECT active redirects
 * (redirects_public_select, 0011); it may not write them.
 */
const findRedirect = cachedPublic(
  "redirects:findRedirect",
  [TAGS.redirects],
  CACHE_TTL,
  async (sourcePath: string): Promise<{ destination: string; permanent: boolean } | null> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("redirects")
      .select("destination_path, redirect_type")
      .eq("source_path", sourcePath)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw new Error(`Failed to look up redirect: ${error.message}`);
    if (!data) return null;
    return { destination: data.destination_path, permanent: data.redirect_type === "301" };
  },
);

/**
 * Belt-and-braces check that a stored destination is an internal path.
 *
 * The database CHECK constraint already guarantees this for anything written
 * after migration 0019, and is the real boundary. This exists because the
 * value is about to become a Location header: if a constraint were ever
 * dropped, or a row predated it, this is the last thing standing between a
 * stored string and an open redirect, and it costs one regex.
 */
function isInternalPath(path: string): boolean {
  return /^\/[A-Za-z0-9][-A-Za-z0-9._~/]*$/.test(path) && !path.includes("//") && !path.includes("..");
}

/**
 * If `sourcePath` has an active redirect whose destination currently resolves
 * to publicly eligible content, redirects there and never returns. Otherwise
 * returns, leaving the caller to carry on to notFound().
 *
 * Status codes: a '301' row issues Next's permanentRedirect() (308) and a
 * '302' row issues redirect() (307). Next.js does not emit literal 301/302
 * from a page, and 308/307 are the better pair regardless — they preserve the
 * request method, where 301/302 historically let browsers rewrite POST to
 * GET. Search engines treat 308 as equivalent to 301 for consolidating a
 * moved URL, which is what a slug change needs.
 */
export async function redirectIfMoved(sourcePath: string): Promise<void> {
  const hit = await findRedirect(sourcePath);
  if (!hit) return;

  if (!isInternalPath(hit.destination)) return;

  // A redirect must never be a way into content the public cannot otherwise
  // see. The destination is re-checked through the ordinary public query for
  // its type, so a move that points at something draft, paused, unpublished
  // or soft-deleted simply does not redirect — the visitor gets the normal
  // 404 for the URL they asked for, rather than a redirect into a dead end or
  // (worse) a bypass of the eligibility gates.
  const entry = RESOLVERS.find((r) => hit.destination.startsWith(r.prefix));
  if (!entry) return;

  const slug = hit.destination.slice(entry.prefix.length);
  if (!slug || slug.includes("/")) return;
  if (!(await entry.resolve(slug))) return;

  if (hit.permanent) permanentRedirect(hit.destination);
  redirect(hit.destination);
}
