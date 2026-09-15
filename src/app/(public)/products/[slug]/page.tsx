import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AffiliateDisclosure } from "@/components/public/disclosure";
import { ProductGrid } from "@/components/public/product-card";
import { CategoryChip, PlaceholderImage } from "@/components/public/ui";
import { siteUrl } from "@/lib/env";
import { getProductSeoMetadata, getPublicProduct, getRelatedProducts, type PublicProductDetail } from "@/lib/products/public-queries";

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
  const description = seo?.metaDescription || product.overview || `Learn about ${product.name} at Wellness Center USA.`;
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

export default async function ProductPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const product = await getPublicProduct(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(
    product.id,
    product.categories.map((c) => c.id),
  );
  const canonical = `${siteUrl}/products/${product.slug}`;
  const primaryImage = product.images[0] ?? null;

  const jsonLd = buildJsonLd(product, canonical);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/products" className="hover:text-ink">
              Products
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-ink" aria-current="page">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="aspect-square w-full">
              {primaryImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary external host, see src/lib/products/image.ts
                <img src={primaryImage.url} alt={primaryImage.alt ?? product.name} className="h-full w-full object-cover" />
              ) : (
                <PlaceholderImage className="h-full w-full" />
              )}
            </div>
          </div>
          {product.images.length > 1 && (
            <ul className="mt-3 grid grid-cols-4 gap-3">
              {product.images.slice(1, 5).map((img, i) => (
                <li key={i} className="aspect-square overflow-hidden rounded-lg border border-line bg-surface">
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external host, see src/lib/products/image.ts */}
                  <img src={img.url} alt={img.alt ?? product.name} className="h-full w-full object-cover" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          {product.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.categories.map((c) => (
                <CategoryChip key={c.id}>{c.name}</CategoryChip>
              ))}
            </div>
          )}
          <h1 className="mt-3 font-display text-3xl leading-tight text-ink sm:text-4xl">{product.name}</h1>

          {product.overview ? (
            <p className="mt-4 text-[17px] leading-relaxed text-ink-muted">{product.overview}</p>
          ) : (
            <p className="mt-4 text-[15px] italic text-ink-subtle">Full product overview coming soon.</p>
          )}

          <div className="mt-8">
            {/*
              Plain <a>, not next/link: /go/[slug] is a server Route Handler
              that performs a real off-site 302, not a client-side app route.
              Link's automatic prefetching would otherwise fire a real
              request at /go/[slug] — and get it to actually execute,
              recording a click via record_affiliate_click() — the instant
              this link scrolls into view or is hovered, before the visitor
              ever clicks it (confirmed empirically: page view alone, zero
              clicks, produced two recorded click rows). A plain anchor gets
              no such prefetch treatment.
            */}
            <a
              href={`/go/${product.slug}?cta=product-page-primary`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 py-3.5 text-base font-semibold text-white shadow-pop transition hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 sm:w-auto"
            >
              View official offer
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <p className="mt-2 text-xs text-ink-subtle">You&apos;ll be redirected to the official merchant to complete your purchase.</p>
          </div>

          {product.benefits.length > 0 && (
            <section className="mt-8" aria-labelledby="benefits-heading">
              <h2 id="benefits-heading" className="font-display text-lg text-ink">
                Benefits
              </h2>
              <ul className="mt-3 space-y-3">
                {product.benefits.map((b) => (
                  <li key={b.id} className="flex gap-2.5">
                    <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <div>
                      <p className="font-medium text-ink">{b.title}</p>
                      {b.description && <p className="text-sm text-ink-muted">{b.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <div className="mt-14 grid gap-10 lg:grid-cols-[2fr_1fr] lg:gap-14">
        <div className="space-y-10">
          <ContentSection title="How it works" body={product.howItWorks} />
          <ContentSection title="Who it's for" body={product.whoItsFor} />
          <ContentSection title="Usage" body={product.usage} />
          <ContentSection title="Things to consider" body={product.considerations} />

          {product.ingredients.length > 0 && (
            <section aria-labelledby="ingredients-heading">
              <h2 id="ingredients-heading" className="font-display text-xl text-ink">
                Ingredients
              </h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {product.ingredients.map((i) => (
                  <li key={i.id} className="rounded-xl border border-line bg-surface p-4">
                    <p className="font-medium text-ink">{i.name}</p>
                    {i.description && <p className="mt-1 text-sm text-ink-muted">{i.description}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {product.faqs.length > 0 && (
            <section aria-labelledby="faq-heading">
              <h2 id="faq-heading" className="font-display text-xl text-ink">
                Frequently asked questions
              </h2>
              <dl className="mt-4 divide-y divide-line rounded-xl border border-line bg-surface">
                {product.faqs.map((f) => (
                  <div key={f.id} className="p-4">
                    <dt className="font-medium text-ink">{f.question}</dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-ink-muted">{f.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-line bg-sunken/60 p-5">
            <h2 className="font-display text-base text-ink">Affiliate disclosure</h2>
            <AffiliateDisclosure className="mt-2 text-sm leading-relaxed text-ink-muted" />
          </div>
          <div className="rounded-xl border border-line bg-sunken/60 p-5 text-sm leading-relaxed text-ink-muted">
            <h2 className="font-display text-base text-ink">Editorial note</h2>
            <p className="mt-2">
              Information on this page reflects manufacturer claims and our own research. It is provided for
              informational purposes and is not medical advice.
            </p>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-16 border-t border-line pt-10" aria-labelledby="related-heading">
          <h2 id="related-heading" className="font-display text-2xl text-ink">
            Related products
          </h2>
          <div className="mt-6">
            <ProductGrid products={related} />
          </div>
        </section>
      )}
    </div>
  );
}

function ContentSection({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <section>
      <h2 className="font-display text-xl text-ink">{title}</h2>
      <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-muted">{body}</p>
    </section>
  );
}

function buildJsonLd(product: PublicProductDetail, canonical: string) {
  const image = product.images[0]?.url;

  // Only fields backed by real database content are emitted. No price,
  // availability, brand, sku, or aggregateRating — none of that exists in
  // the schema, and fabricating it would violate Google's structured data
  // guidelines as well as this project's content rules.
  const productLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url: canonical,
    ...(product.overview ? { description: product.overview } : {}),
    ...(image ? { image } : {}),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Products", item: `${siteUrl}/products` },
      { "@type": "ListItem", position: 2, name: product.name, item: canonical },
    ],
  };

  const graph: unknown[] = [productLd, breadcrumbLd];

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
