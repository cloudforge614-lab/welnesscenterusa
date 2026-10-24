import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { redirectIfMoved } from "@/lib/redirects/lookup";
import { ProductGrid } from "@/components/public/product-card";
import { LandingPage } from "@/components/landing/landing-page";
import { buildLanding } from "@/lib/landing/build";
import { siteUrl } from "@/lib/env";
import { safeJsonLd } from "@/lib/content/json-ld";
import { ogImages, TWITTER_CARD, twitterImages } from "@/lib/seo/og";
import { ContentLinkSection } from "@/components/public/content-link-section";
import {
  getProductSeoMetadata,
  getPublicProduct,
  getPublicProductHasLink,
  getRelatedProducts,
  type PublicProductDetail,
} from "@/lib/products/public-queries";
import { getProductReviews } from "@/lib/reviews/public-queries";
import { getProductGuides } from "@/lib/guides/public-queries";
import { getProductArticles } from "@/lib/articles/public-queries";

// Publicly cacheable. Editorial actions invalidate this immediately through
// the cache tags declared on the queries below, so this TTL is only a
// backstop for change made outside the application (a direct database edit,
// or an invalidation that did not reach this instance). 300s = the
// single-entity policy in src/lib/cache/public-cache.ts.
export const revalidate = 300;

export async function generateMetadata(props: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getPublicProduct(slug);
  // No explicit `robots` here: calling notFound() in the page itself already
  // makes Next.js inject its own <meta name="robots" content="noindex">
  // automatically (documented behavior) — adding another would just duplicate it.
  if (!product) return { title: "Product not found" };

  const seo = await getProductSeoMetadata(product.id);
  // Canonical always points at this site's own product URL, never overridden
  // by seo_metadata — /go/[slug] must never be treated as canonical.
  const canonical = `${siteUrl}/products/${product.slug}`;
  const title = seo?.title || product.name;
  const description = seo?.metaDescription || product.heroSubtitle || product.overview || `Learn about ${product.name} at Wellness Center USA.`;
  const ogImage = seo?.ogImagePath || product.images[0]?.url;
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
      type: "website",
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

export default async function ProductPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const product = await getPublicProduct(slug);
  if (!product) {
    // This slug resolves to nothing now — but it may be a URL that used to
    // work before a slug change. redirectIfMoved() sends the visitor on only
    // if the destination is currently publicly eligible; otherwise this falls
    // through to the ordinary 404.
    await redirectIfMoved(`/products/${slug}`);
    notFound();
  }

  // Parallel, not sequential: none of these depend on each other's result,
  // only on product.id / slug (already known).
  const [related, productReviews, productGuides, productArticles, hasAffiliateLink] = await Promise.all([
    getRelatedProducts(
      product.id,
      product.categories.map((c) => c.id),
    ),
    getProductReviews(product.id),
    getProductGuides(product.id),
    getProductArticles(product.id),
    // Only a boolean: the page never sees the affiliate destination, it links
    // to /go/[slug], which resolves the destination server-side.
    getPublicProductHasLink(product.slug),
  ]);
  const canonical = `${siteUrl}/products/${product.slug}`;
  const { data } = buildLanding(product, { mode: "public", hasAffiliateLink });
  const jsonLd = buildJsonLd(product, canonical);
  const category = product.categories[0] ?? null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <LandingPage
        data={data}
        breadcrumb={
          <nav aria-label="Breadcrumb" className="text-sm text-[var(--lp-muted)]">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/products" className="inline-flex min-h-11 items-center hover:text-[var(--lp-text)] focus-visible:outline-2 focus-visible:outline-[var(--lp-text)]">
                  Products
                </Link>
              </li>
              {category && (
                <>
                  <li aria-hidden>/</li>
                  <li>
                    <Link
                      href={`/categories/${category.slug}`}
                      className="inline-flex min-h-11 items-center hover:text-[var(--lp-text)] focus-visible:outline-2 focus-visible:outline-[var(--lp-text)]"
                    >
                      {category.name}
                    </Link>
                  </li>
                </>
              )}
              <li aria-hidden>/</li>
              <li className="text-[var(--lp-text)]" aria-current="page">
                {product.name}
              </li>
            </ol>
          </nav>
        }
        related={
          <>
            {related.length > 0 && (
              <section className="border-t border-black/10 pt-10" aria-labelledby="related-heading">
                <h2 id="related-heading" className="font-display text-2xl text-[var(--lp-primary)]">
                  Related products
                </h2>
                <div className="mt-6">
                  <ProductGrid products={related} />
                </div>
              </section>
            )}
            {productReviews.length > 0 && (
              <ContentLinkSection id="reviews-heading" title="Reviews" items={productReviews} hrefFor={(r) => `/reviews/${r.slug}`} labelFor={(r) => r.title} />
            )}
            {productGuides.length > 0 && (
              <ContentLinkSection id="guides-heading" title="Featured in guides" items={productGuides} hrefFor={(g) => `/guides/${g.slug}`} labelFor={(g) => g.title} />
            )}
            {productArticles.length > 0 && (
              <ContentLinkSection id="articles-heading" title="Related reading" items={productArticles} hrefFor={(a) => `/blog/${a.slug}`} labelFor={(a) => a.title} />
            )}
          </>
        }
      />
    </>
  );
}

function buildJsonLd(product: PublicProductDetail, canonical: string) {
  const image = product.images[0]?.url;
  const category = product.categories[0] ?? null;
  const description = product.heroSubtitle || product.overview;

  // Only fields backed by real, published editorial content are emitted. No
  // offers, price, availability, sku or aggregateRating: this site does not
  // sell the product or hold verified ratings, and fabricating any of that
  // would violate Google's structured data guidelines and this project's
  // content rules. Brand only when an editor recorded it.
  const productLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url: canonical,
    ...(description ? { description } : {}),
    ...(image ? { image: product.images.map((i) => i.url).slice(0, 6) } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(product.manufacturer ? { manufacturer: { "@type": "Organization", name: product.manufacturer } } : {}),
    ...(category ? { category: category.name } : {}),
  };

  const crumbs = [{ name: "Products", item: `${siteUrl}/products` }];
  if (category) crumbs.push({ name: category.name, item: `${siteUrl}/categories/${category.slug}` });
  crumbs.push({ name: product.name, item: canonical });
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.item })),
  };

  const graph: unknown[] = [productLd, breadcrumbLd];

  // FAQPage mirrors the FAQ that is visibly rendered on the page, verbatim.
  if (product.faqs.length > 0) {
    graph.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: product.faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });
  }

  return graph;
}
