import type { ReactNode } from "react";
import { ProductImage } from "@/components/public/product-image";
import { PlaceholderImage } from "@/components/public/ui";
import { formatDate } from "@/lib/format";
import type { LandingPageData } from "@/lib/landing/page-data";
import { LANDING_THEME, themeStyle } from "@/lib/landing/theme";
import { REVIEWER, ReviewerCard } from "./clinical-reviewer";
import { LandingCta } from "./landing-cta";
import { AccentHeading, Band, Eyebrow, Icon, LandingSectionView, StatStrip, type Band as BandTone } from "./landing-sections";

// The A+ product landing page: one shared template for every product.
//
// Layout: a hero (eyebrow, accent headline, CTAs, trust badges, stat strip),
// then the editor's ordered sections as full-width alternating bands, then
// key features, materials, the details, FAQ and a dark final CTA. Sources are
// kept with the content for editorial review but are not listed on the page.
//
// Server Component throughout. The only interactivity (FAQ disclosure) uses
// native <details>, and the mobile sticky CTA is plain CSS, so the page ships
// no client JavaScript of its own.
//
// THEME: every product uses LANDING_THEME, applied as CSS custom properties
// on this wrapper only (.lp). Nothing global changes.
//
// HEADINGS: exactly one <h1> (it carries the product name, so the page's
// primary topic is the product entity), then an <h2> per band.

export function LandingPage({
  data,
  breadcrumb,
  related,
}: {
  data: LandingPageData;
  /** Rendered above the hero (the route's breadcrumb navigation). */
  breadcrumb?: ReactNode;
  /** Rendered after the disclosure: the site's related-content blocks and related products. */
  related?: ReactNode;
}) {
  const { product, mode } = data;
  const primaryImage = data.images[0] ?? null;
  const gallery = data.images.slice(1, 7);
  const ctaLabel = `Visit the official ${data.brand ?? product.name} website`;
  const showCta = data.hasAffiliateLink;
  const category = product.categories[0] ?? null;

  const heroStats = data.sections.find((s) => s.kind === "stats" && s.placement === "hero");
  const body = data.sections.filter((s) => s !== heroStats);

  // Alternate plain/tint so consecutive bands read as distinct panels. Stat
  // bands are always dark and don't break the rhythm.
  let toggle = 0;
  const bandFor = (kind: string): BandTone => (kind === "stats" ? "dark" : toggle++ % 2 === 0 ? "plain" : "tint");
  const nextBand = (): BandTone => (toggle++ % 2 === 0 ? "plain" : "tint");

  // A contextual CTA after the first third of the editorial sections.
  const midCtaAfter = body.length >= 3 ? Math.ceil(body.length / 3) - 1 : -1;
  const details = [
    { id: "overview", title: "Overview", body: data.overview },
    { id: "how-it-works", title: "How it works", body: data.howItWorks },
    { id: "who-its-for", title: "Who it's for", body: data.whoItsFor },
    { id: "usage", title: "Usage", body: data.usage },
  ].filter((d) => d.body);
  const firstAnchor = body[0]?.id ?? details[0]?.id ?? null;

  return (
    <div className="lp bg-[var(--lp-background)] pb-24 text-[var(--lp-text)] lg:pb-0" style={themeStyle(LANDING_THEME)}>
      {mode === "preview" && (
        <div role="status" className="bg-amber-soft px-4 py-2.5 text-center text-sm font-medium text-amber-ink">
          Preview — this draft is not public. Links to the official site are disabled.
        </div>
      )}

      {/* Announcement bar: honest copy only (no discounts, deadlines or stock claims). */}
      <div className="bg-[linear-gradient(90deg,var(--lp-primary),#15803d)] px-4 py-2.5 text-center text-sm font-medium text-[var(--lp-surface)]">
        {data.announcement ?? `Independent, evidence-first overview of ${product.name}`}
        {showCta && mode !== "preview" && (
          <>
            {" "}
            <a href={`/go/${product.slug}?cta=announcement`} rel="sponsored nofollow noopener" className="font-bold underline underline-offset-2 hover:opacity-90">
              Visit the official site &rarr;
            </a>
          </>
        )}
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="lp-hero-bg relative overflow-hidden">
        {breadcrumb && <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">{breadcrumb}</div>}
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-8 sm:px-6 sm:pt-12 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14 lg:pb-20">
          <div>
            <p className="inline-flex rounded-full bg-[var(--lp-secondary)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--lp-primary)]">
              {[data.brand, category?.name].filter(Boolean).join(" · ") || "Product overview"}
            </p>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-[var(--lp-primary)] sm:text-6xl [overflow-wrap:anywhere]">
              {product.name}
            </h1>
            {data.heroHeadline && (
              <p className="mt-4 font-display text-2xl font-bold leading-snug tracking-tight text-[var(--lp-text)] sm:text-3xl">
                <AccentHeading text={data.heroHeadline} />
              </p>
            )}
            {data.heroSubtitle && <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[var(--lp-muted)]">{data.heroSubtitle}</p>}
            {data.benefits.length > 0 && (
              <ul className="mt-6 space-y-2.5" aria-label="Highlights">
                {data.benefits.slice(0, 4).map((b) => (
                  <li key={b.id} className="flex items-start gap-3 text-[16px] font-medium text-[var(--lp-text)]">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#d1fae5] text-[#166534]">
                      <Icon name="check" className="size-3.5" />
                    </span>
                    {b.title}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              {showCta && <LandingCta slug={product.slug} mode={mode} location="product-page-primary" label={ctaLabel} className="lp-pulse" />}
              {firstAnchor && (
                <a
                  href={`#${firstAnchor}`}
                  className="inline-flex min-h-13 items-center justify-center rounded-full border-2 border-[var(--lp-primary)] px-7 py-3 font-display text-base font-semibold text-[var(--lp-primary)] transition hover:bg-[var(--lp-secondary)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-text)]"
                >
                  Learn more
                </a>
              )}
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--lp-muted)]" aria-label="About this page">
              {["Independent overview", "Opens the official store", "Terms are set by the seller"].map((t) => (
                <li key={t} className="inline-flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-[var(--lp-secondary)] text-[var(--lp-primary)]">
                    <Icon name="shield" className="size-3.5" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="lp-glass relative aspect-square w-full overflow-hidden rounded-[28px] shadow-[0_24px_60px_rgba(0,0,0,0.14)]">
              {primaryImage ? (
                <ProductImage src={primaryImage.url} alt={primaryImage.alt ?? product.name} sizes="(min-width: 1024px) 520px, 92vw" priority className="p-6 sm:p-8" />
              ) : (
                <PlaceholderImage className="h-full w-full" />
              )}
              <a
                href="#clinical-reviewer"
                className="lp-glass absolute bottom-4 left-4 flex max-w-[calc(100%-2rem)] items-center gap-2.5 rounded-2xl px-3 py-2 text-xs text-[var(--lp-text)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 32px static avatar */}
                <img src={REVIEWER.image} alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
                <span className="leading-snug">
                  Clinical review by{" "}
                  <strong>
                    {REVIEWER.name}, {REVIEWER.credentials}
                  </strong>
                </span>
              </a>
            </div>
            {data.lastReviewedAt && (
              <p className="mt-4 text-center text-xs text-[var(--lp-muted)]">
                Last reviewed <time dateTime={data.lastReviewedAt}>{formatDate(data.lastReviewedAt)}</time> by the Wellness Center USA editorial team
              </p>
            )}
          </div>
        </div>
      </header>

      {heroStats?.kind === "stats" && <StatStrip items={heroStats.items} />}

      {/* ── Editorial bands (editor-ordered) ─────────────────────────────── */}
      {body.map((s, i) => (
        <div key={s.id}>
          <LandingSectionView section={s} band={bandFor(s.kind)} sources={data.sources} />
          {i === midCtaAfter && showCta && (
            <div className="bg-[var(--lp-background)] px-4 py-10">
              <div className="lp-glass mx-auto flex max-w-4xl flex-col items-center gap-4 rounded-[20px] p-6 text-center sm:flex-row sm:justify-between sm:p-8 sm:text-left">
                <p className="font-display text-xl font-bold text-[var(--lp-primary)]">Want to check current availability and details?</p>
                <LandingCta slug={product.slug} mode={mode} location="product-page-mid" label={ctaLabel} size="md" />
              </div>
            </div>
          )}
        </div>
      ))}

      {/* ── Key features ─────────────────────────────────────────────────── */}
      {data.benefits.length > 0 && (
        <Band id="key-features" band={nextBand()} eyebrow="At a glance" heading="Key features">
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.benefits.map((b) => (
              <li key={b.id} className="lp-glass rounded-[20px] p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-[var(--lp-secondary)] text-[var(--lp-accent)]">
                  <Icon name="check" className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold leading-snug text-[var(--lp-text)]">{b.title}</h3>
                {b.description && <p className="mt-2 text-[15px] leading-relaxed text-[var(--lp-muted)]">{b.description}</p>}
              </li>
            ))}
          </ul>
        </Band>
      )}

      {/* ── Materials ────────────────────────────────────────────────────── */}
      {data.ingredients.length > 0 && (
        <Band id="materials" band={nextBand()} eyebrow="What it's made of" heading="Ingredients & materials">
          <dl className="grid gap-5 md:grid-cols-2">
            {data.ingredients.map((ing) => (
              <div key={ing.id} className="lp-glass rounded-[20px] p-6">
                <dt className="flex items-center gap-3 text-lg font-semibold text-[var(--lp-text)]">
                  <Icon name="layers" className="text-[var(--lp-accent)]" />
                  {ing.name}
                </dt>
                {ing.description && <dd className="mt-2 text-[15px] leading-relaxed text-[var(--lp-muted)]">{ing.description}</dd>}
              </div>
            ))}
          </dl>
        </Band>
      )}

      {/* ── The details (overview, how it works, who it's for, usage) ────── */}
      {details.length > 0 && (
        <section aria-label="The details" className={nextBand() === "plain" ? "bg-[var(--lp-background)] py-16 sm:py-24" : "bg-[var(--lp-secondary)] py-16 sm:py-24"}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Eyebrow>The details</Eyebrow>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {details.map((d) => (
                <section key={d.id} id={d.id} aria-labelledby={`${d.id}-heading`} className="lp-glass scroll-mt-20 rounded-[20px] p-6 sm:p-8">
                  <h2 id={`${d.id}-heading`} className="font-display text-2xl font-extrabold text-[var(--lp-primary)] sm:text-3xl">
                    {d.title}
                  </h2>
                  <p className="mt-4 whitespace-pre-line text-[16px] leading-relaxed">{d.body}</p>
                </section>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Gallery ──────────────────────────────────────────────────────── */}
      {gallery.length > 0 && (
        <Band id="gallery" band={nextBand()} eyebrow="Gallery" heading="Product images">
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {gallery.map((img, i) => (
              <li key={i} className="relative aspect-square overflow-hidden rounded-3xl border border-black/[0.07] bg-white">
                <ProductImage src={img.url} alt={img.alt ?? product.name} sizes="(min-width: 640px) 300px, 45vw" className="p-3" />
              </li>
            ))}
          </ul>
        </Band>
      )}

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      {data.faqs.length > 0 && (
        <Band id="faq" band={nextBand()} eyebrow="Common questions" heading="Frequently asked questions" narrow>
          {/* Native <details>: no JavaScript, keyboard- and screen-reader-accessible,
              and every answer stays in the HTML for crawlers. */}
          <div className="lp-glass divide-y divide-black/[0.08] rounded-[20px]">
            {data.faqs.map((f) => (
              <details key={f.id} className="group px-6 py-1">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 focus-visible:outline-2 focus-visible:outline-[var(--lp-text)]">
                  <h3 className="text-base font-semibold leading-snug sm:text-lg">{f.question}</h3>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--lp-secondary)] text-[var(--lp-accent)] transition group-open:rotate-45">
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  </span>
                </summary>
                <p className="whitespace-pre-line pb-5 text-[15px] leading-relaxed text-[var(--lp-muted)]">{f.answer}</p>
              </details>
            ))}
          </div>
        </Band>
      )}

      {/* ── What happens after you click (generic, true for every product) ─ */}
      {showCta && (
        <Band id="after-click" band={nextBand()} eyebrow="Before you go" heading="What happens when *you click the button?*" center>
          <ol className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
            {[
              ["You go to the official store", "The button opens the seller's official page. This site never takes your payment details."],
              ["Check the details there", "Price, availability, shipping and the guarantee are set by the seller and can change, so confirm them before you order."],
              ["The seller handles your order", "Checkout, delivery and any refund request go through the seller and its customer support, not through us."],
            ].map(([title, body], i) => (
              <li key={i} className="lp-glass rounded-[20px] p-6 text-left">
                <span aria-hidden className="grid size-10 place-items-center rounded-full bg-[var(--lp-primary)] font-display text-lg font-bold text-[var(--lp-surface)]">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-display text-lg font-bold leading-snug text-[var(--lp-primary)]">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--lp-muted)]">{body}</p>
              </li>
            ))}
          </ol>
        </Band>
      )}

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      {showCta && (
        <section aria-labelledby="final-cta-heading" className="lp-dark-bg py-20 text-[var(--lp-surface)] sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 id="final-cta-heading" className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              See {product.name} <span className="block text-[#86efac]">on the official site.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl leading-relaxed text-[var(--lp-surface)]/85">
              Prices, availability and current return terms are set by the seller and can change — check them on the official site before you
              buy.
            </p>
            <div className="mt-8">
              <LandingCta slug={product.slug} mode={mode} location="product-page-final" label={ctaLabel} className="lp-pulse" />
            </div>
          </div>
        </section>
      )}

      {/* ── Editorial note + related ─────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-12 sm:px-6">
        <ReviewerCard />
        <div>
          <div className="lp-glass rounded-[20px] p-6 text-sm leading-relaxed text-[var(--lp-muted)]">
            <h2 className="font-display text-base font-bold text-[var(--lp-text)]">Editorial note</h2>
            <p className="mt-2">
              Information on this page reflects manufacturer statements, which are attributed as such, and our own research. It is provided for
              informational purposes and is not medical advice.
            </p>
          </div>
        </div>
        {related}
      </div>

      {/* ── Mobile sticky CTA (CSS only) ─────────────────────────────────── */}
      {showCta && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-[var(--lp-surface)]/95 px-4 py-3 shadow-pop lg:hidden">
          <LandingCta slug={product.slug} mode={mode} location="product-page-sticky" label="Visit official website" size="md" fullWidth />
        </div>
      )}
    </div>
  );
}
