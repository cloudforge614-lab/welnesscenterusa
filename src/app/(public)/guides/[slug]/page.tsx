import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redirectIfMoved } from "@/lib/redirects/lookup";
import { CategoryChip, PlaceholderImage } from "@/components/public/ui";
import { ProductGrid } from "@/components/public/product-card";
import { siteUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { safeJsonLd } from "@/lib/content/json-ld";
import { renderMarkdown } from "@/lib/content/markdown";
import { getGuideSeoMetadata, getPublicGuide, type PublicGuideDetail } from "@/lib/guides/public-queries";

// Publicly cacheable. Editorial actions invalidate this immediately through
// the cache tags declared on the queries below, so this TTL is only a
// backstop for change made outside the application (a direct database edit,
// or an invalidation that did not reach this instance). 300s = the
// single-entity policy in src/lib/cache/public-cache.ts.
export const revalidate = 300;

export async function generateMetadata(props: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const guide = await getPublicGuide(slug);
  if (!guide) return { title: "Guide not found" };

  const seo = await getGuideSeoMetadata(guide.id);
  const canonical = `${siteUrl}/guides/${guide.slug}`;
  const title = seo?.title || guide.title;
  const description = seo?.metaDescription || `${guide.title} — a guide from Wellness Center USA.`;
  const ogImage = seo?.ogImagePath || guide.featuredImagePath;
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
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function GuidePage(props: PageProps<"/guides/[slug]">) {
  const { slug } = await props.params;
  const guide = await getPublicGuide(slug);
  if (!guide) {
    // This slug resolves to nothing now — but it may be a URL that used to
    // work before a slug change. redirectIfMoved() sends the visitor on only
    // if the destination is currently publicly eligible; otherwise this falls
    // through to the ordinary 404.
    await redirectIfMoved(`/guides/${slug}`);
    notFound();
  }

  const canonical = `${siteUrl}/guides/${guide.slug}`;
  const jsonLd = buildJsonLd(guide, canonical);
  const html = renderMarkdown(guide.content);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/guides" className="hover:text-ink">
              Guides
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-ink" aria-current="page">
            {guide.title}
          </li>
        </ol>
      </nav>

      {guide.category && (
        <div className="mt-4">
          <CategoryChip>{guide.category.name}</CategoryChip>
        </div>
      )}
      <h1 className="mt-3 font-display text-3xl leading-tight text-ink sm:text-4xl">{guide.title}</h1>
      {guide.publishedAt && <p className="mt-2 text-sm text-ink-muted">{formatDate(guide.publishedAt)}</p>}

      {guide.featuredImagePath && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="aspect-video w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external host, see src/lib/products/image.ts */}
            <img src={guide.featuredImagePath} alt={guide.title} className="h-full w-full object-cover" />
          </div>
        </div>
      )}

      {html ? (
        <div className="prose-content mt-8 text-[16px] leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="mt-8 text-[15px] italic text-ink-subtle">
          <PlaceholderImage className="hidden" />
          Full guide coming soon.
        </p>
      )}

      {guide.relatedProducts.length > 0 && (
        <section className="mt-14 border-t border-line pt-10" aria-labelledby="related-products-heading">
          <h2 id="related-products-heading" className="font-display text-2xl text-ink">
            Related products
          </h2>
          <div className="mt-6">
            <ProductGrid
              products={guide.relatedProducts.map((p) => ({
                id: p.id,
                name: p.name,
                slug: p.slug,
                excerpt: null,
                imagePath: p.imagePath,
                imageAlt: null,
                categories: [],
              }))}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function buildJsonLd(guide: PublicGuideDetail, canonical: string) {
  // No FAQPage: guides have no structured FAQ table, so there is no genuine
  // FAQ content to mark up — fabricating one from prose would violate the
  // "only real data" rule just as much as a fabricated rating would.
  const articleLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    url: canonical,
    author: { "@type": "Organization", name: "Wellness Center USA" },
    ...(guide.publishedAt ? { datePublished: guide.publishedAt } : {}),
    dateModified: guide.updatedAt,
    ...(guide.featuredImagePath ? { image: guide.featuredImagePath } : {}),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Guides", item: `${siteUrl}/guides` },
      { "@type": "ListItem", position: 2, name: guide.title, item: canonical },
    ],
  };

  return [articleLd, breadcrumbLd];
}
