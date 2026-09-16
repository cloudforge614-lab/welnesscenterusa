import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AffiliateDisclosure } from "@/components/public/disclosure";
import { siteUrl } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { safeJsonLd } from "@/lib/content/json-ld";
import { renderMarkdown } from "@/lib/content/markdown";
import { getPublicReview, getReviewSeoMetadata, type PublicReviewDetail } from "@/lib/reviews/public-queries";

export async function generateMetadata(props: PageProps<"/reviews/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const review = await getPublicReview(slug);
  if (!review) return { title: "Review not found" };

  const seo = await getReviewSeoMetadata(review.id);
  const canonical = `${siteUrl}/reviews/${review.slug}`;
  const title = seo?.title || `${review.title} Review`;
  const description = seo?.metaDescription || `An independent review of ${review.product.name} by Wellness Center USA.`;
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
    },
    twitter: {
      card: "summary",
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
    },
  };
}

export default async function ReviewPage(props: PageProps<"/reviews/[slug]">) {
  const { slug } = await props.params;
  const review = await getPublicReview(slug);
  if (!review) notFound();

  const canonical = `${siteUrl}/reviews/${review.slug}`;
  const jsonLd = buildJsonLd(review, canonical);
  const html = renderMarkdown(review.content);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/reviews" className="hover:text-ink">
              Reviews
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-ink" aria-current="page">
            {review.title}
          </li>
        </ol>
      </nav>

      <h1 className="mt-4 font-display text-3xl leading-tight text-ink sm:text-4xl">{review.title}</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Reviewing{" "}
        <Link href={`/products/${review.product.slug}`} className="font-medium text-brand-700 hover:text-brand-800">
          {review.product.name}
        </Link>
        {review.publishedAt && <> · {formatDate(review.publishedAt)}</>}
      </p>

      {html ? (
        <div className="prose-content mt-8 text-[16px] leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="mt-8 text-[15px] italic text-ink-subtle">Full review coming soon.</p>
      )}

      {review.pros.length > 0 && (
        <section className="mt-8" aria-labelledby="pros-heading">
          <h2 id="pros-heading" className="font-display text-lg text-ink">
            What stood out
          </h2>
          <ul className="mt-3 space-y-2">
            {review.pros.map((p, i) => (
              <li key={i} className="flex gap-2.5 text-[15px] text-ink-muted">
                <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.considerations.length > 0 && (
        <section className="mt-8" aria-labelledby="considerations-heading">
          <h2 id="considerations-heading" className="font-display text-lg text-ink">
            Things to consider
          </h2>
          <ul className="mt-3 space-y-2">
            {review.considerations.map((c, i) => (
              <li key={i} className="flex gap-2.5 text-[15px] text-ink-muted">
                <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-amber-ink" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10">
        <a
          href={`/go/${review.product.slug}?cta=review-page`}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 py-3.5 text-base font-semibold text-white shadow-pop transition hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
        >
          View official offer
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <p className="mt-2 text-xs text-ink-subtle">You&apos;ll be redirected to the official merchant to complete your purchase.</p>
      </div>

      <div className="mt-10 rounded-xl border border-line bg-sunken/60 p-5">
        <h2 className="font-display text-base text-ink">Affiliate disclosure</h2>
        <AffiliateDisclosure className="mt-2 text-sm leading-relaxed text-ink-muted" />
      </div>
    </div>
  );
}

function buildJsonLd(review: PublicReviewDetail, canonical: string) {
  // No reviewRating: the reviews table has no rating column, so one is
  // never fabricated. author is the publication, not an internal profile —
  // profiles.full_name is an internal identity, never surfaced publicly.
  const reviewLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Review",
    headline: review.title,
    url: canonical,
    itemReviewed: { "@type": "Product", name: review.product.name, url: `${siteUrl}/products/${review.product.slug}` },
    author: { "@type": "Organization", name: "Wellness Center USA" },
    ...(review.publishedAt ? { datePublished: review.publishedAt } : {}),
    dateModified: review.updatedAt,
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Reviews", item: `${siteUrl}/reviews` },
      { "@type": "ListItem", position: 2, name: review.title, item: canonical },
    ],
  };

  return [reviewLd, breadcrumbLd];
}
