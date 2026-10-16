import type { ReactNode } from "react";
import { renderMarkdown } from "@/lib/content/markdown";
import type { IconName, LandingSection, LandingSource } from "@/lib/landing/content";
import { cx } from "@/lib/format";

// Renderers for the typed A+ landing sections (src/lib/landing/content.ts).
//
// Every editor-written string either goes through renderMarkdown (sanitised
// to a narrow allowlist, links forced to nofollow) or is rendered as a plain
// React text node, which React escapes. Nothing is ever injected raw. Icons
// come from the fixed set below; no markup is ever stored.
//
// Each section is a full-width band; `band` alternates the background so the
// page reads as a sequence of distinct A+ panels.

export type Band = "plain" | "tint" | "dark";

const ICON_PATHS: Record<IconName, string> = {
  spine: "M12 3v18M9 6h6M8.5 10h7M9 14h6M9.5 18h5",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Zm-3 9 2 2 4-4",
  leaf: "M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19l7-7",
  snow: "M12 2v20M4.9 6.5l14.2 11M4.9 17.5l14.2-11",
  wash: "M3 6h18l-2 13H5L3 6Zm3 5c2 1.5 4 1.5 6 0s4-1.5 6 0",
  ruler: "M3 17 17 3l4 4L7 21l-4-4Zm4-4 2 2m2-6 2 2m2-6 2 2",
  weight: "M6 8h12l2 12H4L6 8Zm3 0a3 3 0 1 1 6 0",
  check: "m5 13 4 4L19 7",
  star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z",
  truck: "M3 6h11v10H3V6Zm11 4h4l3 3v3h-7v-6ZM7 17.5a1.5 1.5 0 1 0 0 .01M17 17.5a1.5 1.5 0 1 0 0 .01",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
  layers: "m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
  alert: "M12 3 2 20h20L12 3Zm0 6v5m0 3v.01",
  sparkle: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("size-6 shrink-0", className)} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d={ICON_PATHS[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** "Shaped for *how you sleep*." — the *starred* part renders as the italic accent line. */
export function AccentHeading({ text }: { text: string }) {
  const parts = text.split(/\*([^*]+)\*/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <em key={i} className="block font-display italic text-[var(--lp-accent)]">
            {part}
          </em>
        ) : (
          part && <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** Plain text of an accent heading (for captions, TOC labels, aria). */
export function headingText(text: string) {
  return text.replace(/\*([^*]+)\*/g, "$1");
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  return <div className={cx("prose-content lp-prose", className)} dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />;
}

export function Eyebrow({ children, onDark = false }: { children: ReactNode; onDark?: boolean }) {
  return (
    <p className={cx("text-xs font-semibold uppercase tracking-[0.2em]", onDark ? "text-[var(--lp-surface)]/80" : "text-[var(--lp-accent)]")}>{children}</p>
  );
}

const BAND_BG: Record<Band, string> = {
  plain: "bg-[var(--lp-background)]",
  tint: "bg-[var(--lp-secondary)]",
  dark: "bg-[var(--lp-primary)] text-[var(--lp-surface)]",
};

/** A full-width A+ band with the standard header (eyebrow, accent heading, intro). */
export function Band({
  id,
  band,
  eyebrow,
  heading,
  intro,
  center = false,
  narrow = false,
  children,
}: {
  id: string;
  band: Band;
  eyebrow?: string | null;
  heading: string;
  intro?: string | null;
  center?: boolean;
  narrow?: boolean;
  children?: ReactNode;
}) {
  const dark = band === "dark";
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cx("scroll-mt-20 py-16 sm:py-24", BAND_BG[band])}>
      <div className={cx("mx-auto px-4 sm:px-6", narrow ? "max-w-3xl" : "max-w-6xl")}>
        <header className={cx("max-w-3xl", center && "mx-auto text-center")}>
          {eyebrow && <Eyebrow onDark={dark}>{eyebrow}</Eyebrow>}
          <h2
            id={`${id}-heading`}
            className={cx(
              "mt-3 font-display text-3xl leading-[1.1] tracking-tight sm:text-5xl [overflow-wrap:anywhere]",
              dark ? "text-[var(--lp-surface)]" : "text-[var(--lp-primary)]",
            )}
          >
            <AccentHeading text={heading} />
          </h2>
          {intro && <Markdown source={intro} className={cx("mt-5 text-lg", dark && "lp-prose-dark")} />}
        </header>
        {children && <div className="mt-10 sm:mt-12">{children}</div>}
      </div>
    </section>
  );
}

const CARD = "rounded-3xl border border-black/[0.07] bg-[var(--lp-surface)] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)] sm:p-7";

function IconTile({ name }: { name: IconName }) {
  return (
    <span className="grid size-12 place-items-center rounded-2xl bg-[var(--lp-secondary)] text-[var(--lp-accent)]">
      <Icon name={name} />
    </span>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5 text-[#b7791f]" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" className="size-4" fill={n <= rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d={ICON_PATHS.star} strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  );
}

/** Comparison cell: ✓ / ✗ / ~ render as symbols, anything else as text. */
function Cell({ value }: { value: string }) {
  const v = value.trim();
  if (v === "✓" || v.toLowerCase() === "yes")
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-[#1f6b45]">
        <Icon name="check" className="size-5" />
        <span className="sr-only">Yes</span>
      </span>
    );
  // "✓ (cover only)" — a tick with a qualifier.
  if (v.startsWith("✓ "))
    return (
      <span className="inline-flex items-center gap-1.5">
        <Icon name="check" className="size-5 text-[#1f6b45]" />
        <span>
          <span className="sr-only">Yes, </span>
          {v.slice(2)}
        </span>
      </span>
    );
  if (v === "✗" || v.toLowerCase() === "no")
    return (
      <span className="inline-flex items-center font-semibold text-[#9b3326]">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
        <span className="sr-only">No</span>
      </span>
    );
  if (v === "~")
    return (
      <span className="font-semibold text-[#8a5a0b]">
        ~<span className="sr-only"> Partly</span>
      </span>
    );
  return <>{value}</>;
}

const TAG_TONE = {
  problem: "bg-[#f9e6e3] text-[#9b3326]",
  neutral: "bg-[#fbf1dc] text-[#8a5a0b]",
  product: "bg-[var(--lp-cta)] text-[var(--lp-cta-text)]",
} as const;

export function LandingSectionView({ section, band, sources }: { section: LandingSection; band: Band; sources: LandingSource[] }) {
  const head = { id: section.id, eyebrow: section.eyebrow, heading: section.heading, intro: section.intro };

  switch (section.kind) {
    case "prose":
      return (
        <Band {...head} band={band} narrow>
          <Markdown source={section.body} />
        </Band>
      );

    case "checklist":
      return (
        <Band {...head} band={band}>
          <ul className="grid gap-4 sm:grid-cols-2">
            {section.items.map((item, i) => (
              <li key={i} className={cx(CARD, "flex gap-4 !p-5")}>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--lp-secondary)] text-[var(--lp-accent)]">
                  <Icon name="check" className="size-4" />
                </span>
                <span className="pt-1 leading-relaxed [overflow-wrap:anywhere]">{item}</span>
              </li>
            ))}
          </ul>
        </Band>
      );

    case "steps":
      return (
        <Band {...head} band={band}>
          <ol className="grid gap-5 md:grid-cols-3">
            {section.items.map((item, i) => (
              <li key={i} className={cx(CARD, "relative")}>
                <span aria-hidden className="font-display text-5xl leading-none text-[var(--lp-accent)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-4 leading-relaxed [overflow-wrap:anywhere]">{item}</p>
              </li>
            ))}
          </ol>
        </Band>
      );

    case "comparison":
      return (
        <Band {...head} band={band}>
          {/* Horizontal scroll inside the table wrapper, never the page.
              `relative` makes the wrapper the containing block for the cells'
              absolutely-positioned sr-only labels, so they are clipped too. */}
          <div className="relative overflow-x-auto rounded-3xl border border-black/[0.07] bg-[var(--lp-surface)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.12)]">
            <table className="w-full min-w-[560px] border-collapse text-left text-[15px]">
              <caption className="sr-only">{headingText(section.heading)}</caption>
              <thead>
                <tr>
                  {section.columns.map((col, i) => (
                    <th
                      key={i}
                      scope="col"
                      className={cx(
                        "px-5 py-4 text-sm font-semibold",
                        i === 1 ? "bg-[var(--lp-cta)] text-[var(--lp-cta-text)]" : "bg-[var(--lp-secondary)] text-[var(--lp-text)]",
                      )}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, r) => (
                  <tr key={r} className="border-t border-black/[0.07] align-top">
                    {row.map((cell, c) =>
                      c === 0 ? (
                        <th key={c} scope="row" className="px-5 py-4 font-medium text-[var(--lp-text)]">
                          {cell}
                        </th>
                      ) : (
                        <td key={c} className={cx("px-5 py-4 leading-relaxed", c === 1 ? "font-medium text-[var(--lp-text)]" : "text-[var(--lp-muted)]")}>
                          <Cell value={cell} />
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {section.note && <p className="mt-4 text-sm leading-relaxed text-[var(--lp-muted)]">{section.note}</p>}
        </Band>
      );

    case "specs":
      return (
        <Band {...head} band={band}>
          <dl className="grid gap-px overflow-hidden rounded-3xl border border-black/[0.07] bg-black/[0.07] sm:grid-cols-2">
            {section.rows.map(([label, value], i) => (
              <div key={i} className="bg-[var(--lp-surface)] px-6 py-5">
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lp-muted)]">{label}</dt>
                <dd className="mt-1.5 font-medium text-[var(--lp-text)] [overflow-wrap:anywhere]">{value}</dd>
              </div>
            ))}
          </dl>
        </Band>
      );

    case "callout":
      return (
        <section id={section.id} aria-labelledby={`${section.id}-heading`} className={cx("scroll-mt-20 py-12 sm:py-16", BAND_BG[band === "dark" ? "plain" : band])}>
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div
              className={cx(
                "rounded-3xl border p-6 sm:p-8",
                section.tone === "caution" ? "lp-callout-caution border-[#8a5a0b]/20 bg-amber-soft text-amber-ink" : "border-black/[0.07] bg-[var(--lp-surface)] text-[var(--lp-text)]",
              )}
            >
              <div className="flex items-start gap-4">
                <Icon name={section.tone === "caution" ? "alert" : "sparkle"} className="mt-1 size-7" />
                <div className="min-w-0">
                  {section.eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">{section.eyebrow}</p>}
                  <h2 id={`${section.id}-heading`} className="font-display text-2xl leading-tight sm:text-3xl">
                    {headingText(section.heading)}
                  </h2>
                  <div className="mt-4 text-[15px] leading-relaxed">
                    <Markdown source={section.body} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      );

    case "stats":
      // placement "hero" is rendered by the hero itself (StatStrip).
      return (
        <section id={section.id} aria-labelledby={`${section.id}-heading`} className="scroll-mt-20 bg-[var(--lp-primary)] py-14 text-[var(--lp-surface)] sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id={`${section.id}-heading`} className={cx(section.eyebrow ? "text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--lp-surface)]/80" : "sr-only")}>
              {section.eyebrow ?? headingText(section.heading)}
            </h2>
            <dl className={cx("grid grid-cols-2 gap-y-10 lg:grid-cols-4", section.eyebrow && "mt-8")}>
              {section.items.map((item, i) => (
                <div key={i} className={cx("flex flex-col-reverse px-4 text-center", i % 2 === 1 && "border-l border-white/20", i >= 1 && "lg:border-l lg:border-white/20")}>
                  <dt className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lp-surface)]/80">{item.label}</dt>
                  <dd className="text-4xl font-black leading-none tracking-tight sm:text-6xl [overflow-wrap:anywhere]">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      );

    case "cards":
      return (
        <Band {...head} band={band}>
          <ul className={cx("grid gap-5 sm:grid-cols-2", section.items.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
            {section.items.map((item, i) => (
              <li key={i} className={CARD}>
                <IconTile name={item.icon} />
                <h3 className="mt-5 text-lg font-semibold leading-snug text-[var(--lp-text)]">{item.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--lp-muted)]">{item.body}</p>
              </li>
            ))}
          </ul>
          {section.quote && (
            <figure className="mt-10 rounded-3xl border border-black/[0.07] bg-[var(--lp-surface)] p-7 sm:p-10">
              <blockquote className="font-display text-2xl italic leading-snug text-[var(--lp-text)] sm:text-3xl">&ldquo;{section.quote.text}&rdquo;</blockquote>
              <figcaption className="mt-5 text-sm font-medium text-[var(--lp-muted)]">
                —{" "}
                {sources[section.quote.sourceRef - 1] ? (
                  <a href={sources[section.quote.sourceRef - 1].url} rel="nofollow noopener noreferrer" target="_blank" className="underline underline-offset-2">
                    {section.quote.cite}
                  </a>
                ) : (
                  section.quote.cite
                )}
              </figcaption>
            </figure>
          )}
        </Band>
      );

    case "contrast":
      return (
        <Band {...head} band={band}>
          <ul className={cx("grid gap-5", section.items.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
            {section.items.map((item, i) => (
              <li key={i} className={cx(CARD, item.tone === "product" && "ring-2 ring-[var(--lp-cta)] md:-translate-y-2")}>
                <span className={cx("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]", TAG_TONE[item.tone])}>{item.tag}</span>
                <h3 className="mt-4 text-xl font-semibold leading-snug text-[var(--lp-text)]">{item.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {item.points.map((p, j) => (
                    <li key={j} className="flex gap-2.5 text-[15px] leading-relaxed text-[var(--lp-muted)]">
                      <span className={cx("mt-1 shrink-0", item.tone === "product" ? "text-[#1f6b45]" : item.tone === "problem" ? "text-[#9b3326]" : "text-[#8a5a0b]")}>
                        <Icon name={item.tone === "product" ? "check" : "alert"} className="size-4" />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Band>
      );

    case "features":
      return (
        <Band {...head} band={band}>
          <ol className="divide-y divide-black/[0.08] border-y border-black/[0.08]">
            {section.items.map((item, i) => (
              <li key={i} className="grid gap-5 py-8 sm:grid-cols-[5rem_1fr] sm:py-10 lg:grid-cols-[5rem_1fr_auto] lg:items-start">
                <span aria-hidden className="font-display text-5xl leading-none text-[var(--lp-accent)] sm:text-6xl">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <IconTile name={item.icon} />
                    <h3 className="text-xl font-semibold leading-snug text-[var(--lp-text)] sm:text-2xl">{item.title}</h3>
                  </div>
                  <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[var(--lp-muted)]">{item.body}</p>
                </div>
                {item.chip && (
                  <span className="justify-self-start rounded-full border border-[var(--lp-accent)]/30 bg-[var(--lp-surface)] px-4 py-2 text-sm font-semibold text-[var(--lp-text)] sm:col-start-2 lg:col-start-3">
                    {item.chip}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Band>
      );

    case "reviews":
      return (
        <Band {...head} band={band}>
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {section.items.map((r, i) => {
              const src = sources[r.sourceRef - 1];
              return (
                <li key={i} className={cx(CARD, "flex flex-col")}>
                  <Stars rating={r.rating} />
                  {r.title && <h3 className="mt-4 font-semibold text-[var(--lp-text)]">{r.title}</h3>}
                  <p className="mt-3 flex-1 text-[15px] leading-relaxed text-[var(--lp-muted)]">&ldquo;{r.text}&rdquo;</p>
                  <p className="mt-5 text-sm font-semibold text-[var(--lp-text)]">
                    {r.name}
                    {r.location && <span className="font-normal text-[var(--lp-muted)]"> · {r.location}</span>}
                  </p>
                  {src && (
                    <p className="mt-1 text-xs text-[var(--lp-muted)]">
                      Published on{" "}
                      <a href={src.url} rel="nofollow noopener noreferrer" target="_blank" className="underline underline-offset-2">
                        {src.label}
                      </a>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Band>
      );

    case "guarantee":
      return (
        <Band {...head} band={band} center>
          <div className={cx(CARD, "mx-auto max-w-3xl text-left")}>
            <div className="flex items-start gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[var(--lp-cta)] text-[var(--lp-cta-text)]">
                <Icon name="shield" className="size-7" />
              </span>
              <Markdown source={section.body} className="pt-1" />
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {section.items.map((item, i) => (
                <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed">
                  <Icon name="check" className="mt-0.5 size-5 text-[#1f6b45]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Band>
      );
  }
}

/** The compact hero trust strip (a stats section with placement "hero"). */
export function StatStrip({ items }: { items: { value: string; label: string }[] }) {
  return (
    <div className="mt-10">
      <dl className={cx("grid grid-cols-2 gap-y-6", items.length >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
        {items.map((item, i) => (
          <div key={i} className={cx("flex flex-col-reverse pr-4", i % 2 === 1 && "border-l border-black/10 pl-4", i > 0 && "sm:border-l sm:border-black/10 sm:pl-5")}>
            <dt className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--lp-muted)]">{item.label}</dt>
            <dd className="text-2xl font-bold tracking-tight text-[var(--lp-text)] lg:text-[1.7rem]">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
