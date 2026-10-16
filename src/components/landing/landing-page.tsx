import type { ReactNode } from "react";
import { ProductImage } from "@/components/public/product-image";
import { PlaceholderImage } from "@/components/public/ui";
import { formatDate } from "@/lib/format";
import type { LandingPageData } from "@/lib/landing/page-data";
import { themeStyle } from "@/lib/landing/theme";
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
// THEME: the product's validated palette is applied as CSS custom properties
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
    <div className="lp bg-[var(--lp-background)] pb-24 text-[var(--lp-text)] lg:pb-0" style={themeStyle(data.theme)}>
      {mode === "preview" && (
        <div role="status" className="bg-amber-soft px-4 py-2.5 text-center text-sm font-medium text-amber-ink">
          Preview — this draft is not public. Links to the official site are disabled.
        </div>
      )}

      {data.announcement && (
        <p className="bg-[var(--lp-primary)] px-4 py-2.5 text-center text-sm font-medium text-[var(--lp-surface)]">{data.announcement}</p>
      )}

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-[linear-gradient(160deg,var(--lp-secondary)_0%,var(--lp-background)_55%)]">
        {breadcrumb && <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">{breadcrumb}</div>}
        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14 lg:pb-24">
          <div>
            <h1 className="[overflow-wrap:anywhere]">
              <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--lp-accent)]">
                {[data.brand, category?.name].filter(Boolean).join(" · ") || "Product overview"}
              </span>
              <span className="mt-4 block font-display text-4xl leading-[1.05] tracking-tight text-[var(--lp-primary)] sm:text-6xl">
                {product.name}
              </span>
            </h1>
            {data.heroHeadline && (
              <p className="mt-5 font-display text-2xl leading-snug tracking-tight text-[var(--lp-text)] sm:text-3xl">
                <AccentHeading text={data.heroHeadline} />
              </p>
            )}
            {data.heroSubtitle && <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[var(--lp-muted)]">{data.heroSubtitle}</p>}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              {showCta && <LandingCta slug={product.slug} mode={mode} location="product-page-primary" label={ctaLabel} />}
              {firstAnchor && (
                <a
                  href={`#${firstAnchor}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/15 bg-[var(--lp-surface)]/70 px-6 text-base font-medium text-[var(--lp-text)] transition hover:bg-[var(--lp-surface)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--lp-text)]"
                >
                  Read the details
                </a>
              )}
            </div>
            {showCta && (
              <p className="mt-3 text-xs leading-relaxed text-[var(--lp-muted)]">Opens the official store. We may earn a commission if you buy through our links.</p>
            )}
            {data.benefits.length > 0 && (
              <ul className="mt-7 flex flex-wrap gap-2" aria-label="Highlights">
                {data.benefits.slice(0, 4).map((b) => (
                  <li key={b.id} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-[var(--lp-surface)]/80 px-3 py-1.5 text-xs font-medium text-[var(--lp-text)]">
                    <Icon name="check" className="size-3.5 text-[var(--lp-accent)]" />
                    {b.title}
                  </li>
                ))}
              </ul>
            )}
            {heroStats?.kind === "stats" && <StatStrip items={heroStats.items} />}
          </div>
          <div>
            <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] border border-black/[0.07] bg-white shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)]">
              {primaryImage ? (
                <ProductImage src={primaryImage.url} alt={primaryImage.alt ?? product.name} sizes="(min-width: 1024px) 520px, 92vw" priority className="p-6 sm:p-8" />
              ) : (
                <PlaceholderImage className="h-full w-full" />
              )}
            </div>
            {data.lastReviewedAt && (
              <p className="mt-4 text-center text-xs text-[var(--lp-muted)]">
                Last reviewed <time dateTime={data.lastReviewedAt}>{formatDate(data.lastReviewedAt)}</time> by the Wellness Center USA editorial team
              </p>
            )}
          </div>
        </div>
      </header>

      {/* ── Editorial bands (editor-ordered) ─────────────────────────────── */}
      {body.map((s, i) => (
        <div key={s.id}>
          <LandingSectionView section={s} band={bandFor(s.kind)} sources={data.sources} />
          {i === midCtaAfter && showCta && (
            <div className="bg-[var(--lp-background)] px-4 py-10">
              <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 rounded-3xl border border-black/[0.07] bg-[var(--lp-surface)] p-6 text-center sm:flex-row sm:justify-between sm:p-8 sm:text-left">
                <p className="font-display text-xl text-[var(--lp-primary)]">Want to check current availability and details?</p>
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
              <li key={b.id} className="rounded-3xl border border-black/[0.07] bg-[var(--lp-surface)] p-6 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)]">
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
              <div key={ing.id} className="rounded-3xl border border-black/[0.07] bg-[var(--lp-surface)] p-6">
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
                <section key={d.id} id={d.id} aria-labelledby={`${d.id}-heading`} className="scroll-mt-20 rounded-3xl border border-black/[0.07] bg-[var(--lp-surface)] p-6 sm:p-8">
                  <h2 id={`${d.id}-heading`} className="font-display text-2xl text-[var(--lp-primary)] sm:text-3xl">
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
          <div className="divide-y divide-black/[0.08] rounded-3xl border border-black/[0.07] bg-[var(--lp-surface)]">
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

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      {showCta && (
        <section aria-labelledby="final-cta-heading" className="bg-[var(--lp-primary)] py-20 text-[var(--lp-surface)] sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 id="final-cta-heading" className="font-display text-3xl leading-tight tracking-tight sm:text-5xl">
              See {product.name} <em className="block italic opacity-90">on the official site.</em>
            </h2>
            <p className="mx-auto mt-5 max-w-xl leading-relaxed text-[var(--lp-surface)]/85">
              Prices, availability and current return terms are set by the seller and can change — check them on the official site before you
              buy.
            </p>
            <div className="mt-8">
              <LandingCta slug={product.slug} mode={mode} location="product-page-final" label={ctaLabel} />
            </div>
            <p className="mt-4 text-xs text-[var(--lp-surface)]/80">We may earn a commission if you buy through our links.</p>
          </div>
        </section>
      )}

      {/* ── Editorial note + related ─────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-12 sm:px-6">
        <div>
          <div className="rounded-3xl border border-black/[0.07] bg-[var(--lp-surface)] p-6 text-sm leading-relaxed text-[var(--lp-muted)]">
            <h2 className="font-display text-base text-[var(--lp-text)]">Editorial note</h2>
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
