import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redirectIfMoved } from "@/lib/redirects/lookup";
import { CategoryChip, PlaceholderImage } from "@/components/public/ui";
import { ProductGrid } from "@/components/public/product-card";
import { siteUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { safeJsonLd } from "@/lib/content/json-ld";
import { ORGANIZATION_REF } from "@/lib/seo/structured-data";
import { ogImages, TWITTER_CARD, twitterImages } from "@/lib/seo/og";
import { renderMarkdown } from "@/lib/content/markdown";
import { getArticleSeoMetadata, getPublicArticle, type PublicArticleDetail } from "@/lib/articles/public-queries";

// Publicly cacheable. Editorial actions invalidate this immediately through
// the cache tags declared on the queries below, so this TTL is only a
// backstop for change made outside the application (a direct database edit,
// or an invalidation that did not reach this instance). 300s = the
// single-entity policy in src/lib/cache/public-cache.ts.
export const revalidate = 300;

export async function generateMetadata(props: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const article = await getPublicArticle(slug);
  if (!article) return { title: "Article not found" };

  const seo = await getArticleSeoMetadata(article.id);
  const canonical = `${siteUrl}/blog/${article.slug}`;
  const title = seo?.title || article.title;
  const description = seo?.metaDescription || `${article.title} — from Wellness Center USA.`;
  const ogImage = seo?.ogImagePath || article.featuredImagePath;
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
      images: ogImages(ogImage),
    },
    twitter: {
      card: TWITTER_CARD,
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      images: twitterImages(ogImage),
    },
  };
}

export default async function ArticlePage(props: PageProps<"/blog/[slug]">) {
  const { slug } = await props.params;
  const article = await getPublicArticle(slug);
  if (!article) {
    // This slug resolves to nothing now — but it may be a URL that used to
    // work before a slug change. redirectIfMoved() sends the visitor on only
    // if the destination is currently publicly eligible; otherwise this falls
    // through to the ordinary 404.
    await redirectIfMoved(`/blog/${slug}`);
    notFound();
  }

  const canonical = `${siteUrl}/blog/${article.slug}`;
  const jsonLd = buildJsonLd(article, canonical);
  const html = renderMarkdown(article.content);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/blog" className="hover:text-ink">
              Blog
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-ink" aria-current="page">
            {article.title}
          </li>
        </ol>
      </nav>

      {article.category && (
        <div className="mt-4">
          <CategoryChip>{article.category.name}</CategoryChip>
        </div>
      )}
      <h1 className="mt-3 font-display text-3xl leading-tight text-ink sm:text-4xl">{article.title}</h1>
      {article.publishedAt && <p className="mt-2 text-sm text-ink-muted">{formatDate(article.publishedAt)}</p>}

      {article.featuredImagePath && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="aspect-video w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external host, see src/lib/products/image.ts */}
            <img src={article.featuredImagePath} alt={article.title} className="h-full w-full object-cover" />
          </div>
        </div>
      )}

      {html ? (
        <div className="prose-content mt-8 text-[16px] leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="mt-8 text-[15px] italic text-ink-subtle">
          <PlaceholderImage className="hidden" />
          Full article coming soon.
        </p>
      )}

      {article.relatedProducts.length > 0 && (
        <section className="mt-14 border-t border-line pt-10" aria-labelledby="related-products-heading">
          <h2 id="related-products-heading" className="font-display text-2xl text-ink">
            Related products
          </h2>
          <div className="mt-6">
            <ProductGrid
              products={article.relatedProducts.map((p) => ({
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

function buildJsonLd(article: PublicArticleDetail, canonical: string) {
  // No FAQPage: articles have no structured FAQ table, so there is no
  // genuine FAQ content to mark up. author is the publication (an
  // Organization), never an internal profile identity — profiles has no
  // public-facing author field, and RLS blocks anon from reading arbitrary
  // profiles rows anyway.
  const articleLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    url: canonical,
    // Attribution is the publisher, referenced by @id into the Organization
    // node the public layout emits — one entity, stated once. Individual
    // bylines remain deferred; see ORGANIZATION_ID in src/lib/seo/
    // structured-data.ts for why that is a security decision.
    author: ORGANIZATION_REF,
    publisher: ORGANIZATION_REF,
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
    dateModified: article.updatedAt,
    ...(article.featuredImagePath ? { image: article.featuredImagePath } : {}),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Blog", item: `${siteUrl}/blog` },
      { "@type": "ListItem", position: 2, name: article.title, item: canonical },
    ],
  };

  return [articleLd, breadcrumbLd];
}
