import { siteUrl } from "@/lib/env";
import { listPublicProducts } from "@/lib/products/public-queries";

// /llms.txt — an EXPERIMENTAL, optional discovery aid (llmstxt.org proposal):
// a plain-Markdown map of the site for language-model tools. It is not a
// ranking signal, Google Search ignores it, and nothing depends on it.
//
// Only publicly eligible content appears: products come from the same public
// query (two-gate RLS: active product + published content) that powers
// /products, so drafts, unapproved, paused, archived and deleted products can
// never be listed here. It links product pages only, never /go/ redirects.
export const revalidate = 300;

const MAX_PAGES = 20;

export async function GET() {
  const first = await listPublicProducts(1);
  const items = [...first.items];
  for (let page = 2; page <= Math.min(first.pageCount, MAX_PAGES); page++) {
    items.push(...(await listPublicProducts(page)).items);
  }

  const oneLine = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const lines = [
    "# Wellness Center USA",
    "",
    "> Independent editorial overviews of wellness products. Manufacturer statements are attributed as such, sources are cited on each product page, and nothing here is medical advice. Some outbound links are affiliate links; see the affiliate disclosure.",
    "",
    "## Products",
    "",
    // The directory also lists active products whose page is not published
    // yet (hasDetailPage false); only pages that exist are listed here.
    ...items
      .filter((p) => p.hasDetailPage !== false)
      .map((p) => `- [${p.name}](${siteUrl}/products/${p.slug})${p.excerpt ? `: ${oneLine(p.excerpt)}` : ""}`),
    "",
    "## Site",
    "",
    `- [All products](${siteUrl}/products)`,
    `- [Categories](${siteUrl}/categories)`,
    `- [Reviews](${siteUrl}/reviews)`,
    `- [Guides](${siteUrl}/guides)`,
    `- [Comparisons](${siteUrl}/comparisons)`,
    `- [Blog](${siteUrl}/blog)`,
    "",
    "## Policies",
    "",
    `- [Affiliate disclosure](${siteUrl}/affiliate-disclosure)`,
    `- [About](${siteUrl}/about)`,
    `- [Privacy policy](${siteUrl}/privacy-policy)`,
    `- [Terms](${siteUrl}/terms)`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  });
}
