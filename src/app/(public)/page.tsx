import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import heroProducts from "./_assets/hero-products.webp";
import { ProductGrid } from "@/components/public/product-card";
import { ContentLinkSection } from "@/components/public/content-link-section";
import { CategoryChip, EmptyState, Skeleton } from "@/components/public/ui";
import { siteUrl } from "@/lib/env";
import { ogImages, TWITTER_CARD, twitterImages } from "@/lib/seo/og";
import { getLatestPublicProducts, getPublicCategoriesWithProducts } from "@/lib/products/public-queries";
import { getLatestPublicReviews } from "@/lib/reviews/public-queries";
import { getLatestPublicGuides } from "@/lib/guides/public-queries";
import { getLatestPublicArticles } from "@/lib/articles/public-queries";

// Publicly cacheable. Editorial actions invalidate this immediately through
// the cache tags declared on the queries below, so this TTL is only a
// backstop for change made outside the application (a direct database edit,
// or an invalidation that did not reach this instance). 300s = the
// aggregate policy in src/lib/cache/public-cache.ts.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Health & Wellness Product Discovery",
  description:
    "Wellness Center USA researches and organizes health and wellness products so you can make informed decisions.",
  alternates: { canonical: siteUrl },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Wellness Center USA — Health & Wellness Product Discovery",
    description:
      "Wellness Center USA researches and organizes health and wellness products so you can make informed decisions.",
    url: siteUrl,
    type: "website",
    images: ogImages(),
  },
  twitter: {
    card: TWITTER_CARD,
    title: "Wellness Center USA — Health & Wellness Product Discovery",
    description:
      "Wellness Center USA researches and organizes health and wellness products so you can make informed decisions.",
    images: twitterImages(),
  },
};

export default function HomePage() {
  return (
    <div>
      <Hero />

      <Suspense fallback={<ProductsSkeleton />}>
        <DiscoverySections />
      </Suspense>

      <TrustSection />
    </div>
  );
}

// hero-products.webp (src/app/(public)/_assets/) is an UNMODIFIED crop of the
// supplied reference photography — no blur, no sharpening, no filters of any
// kind; measured detail matches the original crop. It was cropped from a
// larger reference mockup that also contained a fabricated review count, a
// fabricated discount badge, and cart/account icons this site has no
// equivalent of (no accounts, no cart — /go/[slug] is the only purchase
// path, and it leaves this site entirely). None of that is in the crop.
//
// The packaging in the photo carries its own printed text. That is part of
// the supplied image and is deliberately NOT hidden by blurring: the
// headline, copy and CTAs below are the site's only claims, and the
// homepage catalogue is rendered from real database rows only.
//
// Layout note: the clean part of the source is only 295px tall. Stretching it
// to fill a ~530px hero with object-fit:cover upscales it 2x and softens any
// image, so the photo is laid out as a full-width band instead (220px tall on
// phones, 270px from 640px up, object-cover cropping the sides). At those
// heights the image is scaled DOWN at every width up to ~1650px, and only
// mildly up beyond that. The top edge is masked into the brand green so
// the band reads as part of the hero rather than a pasted strip; the mask is
// pure alpha compositing, not a filter, and nothing sits on top of the photo.
function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line bg-brand-900">
      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6 sm:pb-16 sm:pt-28">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-200">Health &amp; Wellness</p>
          <h1 className="mt-4 font-display text-4xl leading-tight text-white sm:text-5xl">
            Product discovery, <span className="text-brand-200">researched first.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-brand-100/80">
            We research health and wellness products and organize what we find in one place — so you can explore
            with clarity before you buy.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-[15px] font-semibold text-brand-900 shadow-pop transition hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
            >
              Browse products
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              href="/categories"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 px-6 py-3 text-[15px] font-medium text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
            >
              Explore categories
            </Link>
          </div>
        </div>
      </div>

      {/* The photograph itself: no filter, no overlay, no placeholder (Next's
          placeholder="blur" would also be refused by the CSP — img-src has no
          data:). pointer-events-none so the transparent masked top edge can
          never intercept clicks meant for the CTAs above it. */}
      <div className="pointer-events-none relative -mt-6 sm:-mt-10">
        <Image
          src={heroProducts}
          alt=""
          priority
          sizes="100vw"
          className="h-[220px] w-full object-cover object-center [mask-image:linear-gradient(to_bottom,transparent,black_38%)] sm:h-[270px]"
        />
      </div>
    </section>
  );
}

async function DiscoverySections() {
  const [latest, categories, latestReviews, latestGuides, latestArticles] = await Promise.all([
    getLatestPublicProducts(8),
    getPublicCategoriesWithProducts(),
    getLatestPublicReviews(4),
    getLatestPublicGuides(4),
    getLatestPublicArticles(4),
  ]);

  if (latest.length === 0) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <EmptyState
          title="We're just getting started"
          description="New products are being researched and added. Check back soon."
          action={
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium text-ink shadow-card transition hover:bg-sunken"
            >
              Visit the product directory
            </Link>
          }
        />
      </section>
    );
  }

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-labelledby="latest-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="latest-heading" className="font-display text-2xl text-ink sm:text-3xl">
              Latest products
            </h2>
            <p className="mt-2 text-[15px] text-ink-muted">Recently added to our directory.</p>
            <p className="mt-1 text-xs text-ink-subtle">
              Some links are affiliate links.{" "}
              <Link href="/affiliate-disclosure" className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800">
                Read our disclosure
              </Link>
              .
            </p>
          </div>
          <Link href="/products" className="hidden min-h-11 shrink-0 items-center text-sm font-medium text-brand-700 hover:text-brand-800 sm:inline-flex">
            View all →
          </Link>
        </div>
        <div className="mt-8">
          <ProductGrid products={latest} />
        </div>
        <Link href="/products" className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-brand-700 hover:text-brand-800 sm:hidden">
          View all products →
        </Link>
      </section>

      {categories.length > 0 && (
        <section className="border-t border-line bg-sunken/40 py-16" aria-labelledby="categories-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="categories-heading" className="font-display text-3xl text-ink">
              Browse by category
            </h2>
            <p className="mt-2 text-[15px] text-ink-muted">Find products organized by what they support.</p>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/categories/${category.slug}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop"
                  >
                    <span className="font-medium text-ink">{category.name}</span>
                    <CategoryChip>{category.productCount}</CategoryChip>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {latestReviews.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ContentLinkSection id="latest-reviews-heading" title="Latest reviews" items={latestReviews} hrefFor={(r) => `/reviews/${r.slug}`} labelFor={(r) => r.title} viewAllHref="/reviews" />
        </div>
      )}
      {latestGuides.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <ContentLinkSection id="latest-guides-heading" title="Latest guides" items={latestGuides} hrefFor={(g) => `/guides/${g.slug}`} labelFor={(g) => g.title} viewAllHref="/guides" />
        </div>
      )}
      {latestArticles.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <ContentLinkSection id="latest-articles-heading" title="Latest from the blog" items={latestArticles} hrefFor={(a) => `/blog/${a.slug}`} labelFor={(a) => a.title} viewAllHref="/blog" />
        </div>
      )}
    </>
  );
}

function ProductsSkeleton() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-5 w-72" />
      <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="space-y-2 p-5">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TrustSection() {
  return (
    <section className="border-t border-line py-16" aria-labelledby="trust-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 id="trust-heading" className="font-display text-2xl text-ink">
          How we work
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <TrustCard
            icon="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            title="Independent research"
            body="Every product on this site is researched before it's published, with sourcing you can review on its own page."
          />
          <TrustCard
            icon="M12 21c-4.5-2.5-7-6-7-10 3 0 5.5 1.2 7 3.5C13.5 12.2 16 11 19 11c0 4-2.5 7.5-7 10Z"
            title="Editorial, not promotional"
            body="We aim for clear, honest descriptions — not exaggerated claims or manufactured urgency."
          />
        </div>
      </div>
    </section>
  );
}

function TrustCard({ icon, title, body, href }: { icon: string; title: string; body: string; href?: string }) {
  const content = (
    <>
      <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d={icon} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <h3 className="mt-4 font-display text-lg text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
      {href && <span className="mt-3 inline-block text-sm font-medium text-brand-700">Read more →</span>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-2xl border border-line bg-surface p-6 shadow-card transition hover:shadow-pop">
        {content}
      </Link>
    );
  }
  return <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">{content}</div>;
}
