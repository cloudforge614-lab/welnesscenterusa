import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redirectIfMoved } from "@/lib/redirects/lookup";
import { PlaceholderImage } from "@/components/public/ui";
import { siteUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { safeJsonLd } from "@/lib/content/json-ld";
import { ORGANIZATION_REF } from "@/lib/seo/structured-data";
import { ogImages, TWITTER_CARD, twitterImages } from "@/lib/seo/og";
import { renderMarkdown } from "@/lib/content/markdown";
import { getComparisonSeoMetadata, getPublicComparison, type PublicComparisonDetail } from "@/lib/comparisons/public-queries";

// Publicly cacheable. Editorial actions invalidate this immediately through
// the cache tags declared on the queries below, so this TTL is only a
// backstop for change made outside the application (a direct database edit,
// or an invalidation that did not reach this instance). 300s = the
// single-entity policy in src/lib/cache/public-cache.ts.
export const revalidate = 300;

export async function generateMetadata(props: PageProps<"/comparisons/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const comparison = await getPublicComparison(slug);
  if (!comparison) return { title: "Comparison not found" };

  const seo = await getComparisonSeoMetadata(comparison.id);
  const canonical = `${siteUrl}/comparisons/${comparison.slug}`;
  const title = seo?.title || comparison.title;
  const description = seo?.metaDescription || `${comparison.title} — an independent comparison from Wellness Center USA.`;
  const indexable = (seo?.robotsIndex ?? true) && (seo?.robotsFollow ?? true);

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: indexable, follow: seo?.robotsFollow ?? true },
    openGraph: {
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      url: canonical,
      type: "article",
      images: ogImages(seo?.ogImagePath),
    },
    twitter: {
      card: TWITTER_CARD,
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      images: twitterImages(seo?.ogImagePath),
    },
  };
}

export default async function ComparisonPage(props: PageProps<"/comparisons/[slug]">) {
  const { slug } = await props.params;
  const comparison = await getPublicComparison(slug);
  if (!comparison) {
    // This slug resolves to nothing now — but it may be a URL that used to
    // work before a slug change. redirectIfMoved() sends the visitor on only
    // if the destination is currently publicly eligible; otherwise this falls
    // through to the ordinary 404.
    await redirectIfMoved(`/comparisons/${slug}`);
    notFound();
  }

  const canonical = `${siteUrl}/comparisons/${comparison.slug}`;
  const jsonLd = buildJsonLd(comparison, canonical);
  const html = renderMarkdown(comparison.content);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/comparisons" className="inline-flex min-h-11 items-center hover:text-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">
              Comparisons
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-ink" aria-current="page">
            {comparison.title}
          </li>
        </ol>
      </nav>

      <h1 className="mt-3 font-display text-3xl leading-tight text-ink sm:text-4xl">{comparison.title}</h1>
      {comparison.publishedAt && <p className="mt-2 text-sm text-ink-muted">{formatDate(comparison.publishedAt)}</p>}

      {comparison.products.length > 0 && (
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {comparison.products.map((p, i) => (
            <li key={p.id} className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
              <Link href={`/products/${p.slug}`} className="block">
                <div className="aspect-square w-full bg-sunken">
                  {p.imagePath ? (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary external host, see src/lib/products/image.ts
                    <img src={p.imagePath} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <PlaceholderImage className="h-full w-full" />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs text-ink-subtle">#{i + 1}</p>
                  <p className="mt-0.5 text-sm font-medium text-ink">{p.name}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {html ? (
        <div className="prose-content mt-8 text-[16px] leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="mt-8 text-[15px] italic text-ink-subtle">Full comparison coming soon.</p>
      )}
    </div>
  );
}

function buildJsonLd(comparison: PublicComparisonDetail, canonical: string) {
  // Article for the written comparison itself (real title/dates only, no
  // fabricated author identity beyond the Organization — same rule as
  // Reviews/Guides/Articles). ItemList for the compared products: there is
  // no schema.org "Comparison" type, so a plain ordered list of the real
  // products (name + url only, no price/rating/brand — none of that exists
  // in the schema) is the honest representation, not a fabricated one.
  const articleLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: comparison.title,
    url: canonical,
    // Attribution is the publisher, referenced by @id into the Organization
    // node the public layout emits — one entity, stated once. Individual
    // bylines remain deferred; see ORGANIZATION_ID in src/lib/seo/
    // structured-data.ts for why that is a security decision.
    author: ORGANIZATION_REF,
    publisher: ORGANIZATION_REF,
    ...(comparison.publishedAt ? { datePublished: comparison.publishedAt } : {}),
    dateModified: comparison.updatedAt,
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Comparisons", item: `${siteUrl}/comparisons` },
      { "@type": "ListItem", position: 2, name: comparison.title, item: canonical },
    ],
  };

  const graph: unknown[] = [articleLd, breadcrumbLd];

  if (comparison.products.length > 0) {
    graph.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: comparison.products.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: p.name,
        url: `${siteUrl}/products/${p.slug}`,
      })),
    });
  }

  return graph;
}
