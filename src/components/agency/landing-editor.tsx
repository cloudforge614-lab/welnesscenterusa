"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateLandingFields } from "@/app/agency/actions";
import type { AgencyProductDetail } from "@/lib/products/agency-queries";
import { landingWordCount, parseSections, parseSources, SOURCE_KINDS, WORD_TARGET } from "@/lib/landing/content";
import { DEFAULT_THEME, resolveTheme, THEME_KEYS, type ThemeKey } from "@/lib/landing/theme";
import { validateSectionsJson, validateSources, validateTheme, type SourceInput } from "@/lib/landing/validate";
import { buttonStyles, cx, inputStyles, Spinner } from "@/components/admin/ui";

// Agency editor for the landing-page fields (migration 0026). Every check
// shown here (section shape, source URLs, colour contrast) runs again in the
// server action and, for shape, in the database, so this UI is guidance only.

const THEME_LABELS: Record<ThemeKey, string> = {
  primary: "Primary (headings, links)",
  secondary: "Highlight panels",
  accent: "Accent (icons)",
  background: "Page background",
  surface: "Cards",
  text: "Body text",
  muted: "Secondary text",
  cta: "Button",
  ctaText: "Button text",
};

const SOURCE_KIND_LABELS: Record<string, string> = {
  manufacturer: "Manufacturer",
  independent: "Independent research",
  regulatory: "Regulatory",
  retailer: "Retailer listing",
  other: "Other",
};

const SECTION_TEMPLATES: Record<string, object> = {
  prose: { kind: "prose", heading: "Heading", intro: "", body: "Markdown text…", sourceRefs: [] },
  checklist: { kind: "checklist", heading: "Heading", items: ["First point", "Second point"], sourceRefs: [] },
  steps: { kind: "steps", heading: "Heading", items: ["Step one", "Step two"], sourceRefs: [] },
  comparison: { kind: "comparison", heading: "Heading", columns: ["", "Option A", "Option B"], rows: [["Row", "…", "…"]], note: "", sourceRefs: [] },
  specs: { kind: "specs", heading: "Specifications", rows: [["Label", "Value"]], sourceRefs: [] },
  callout: { kind: "callout", heading: "Heading", tone: "info", body: "Short note…", sourceRefs: [] },
  // A+ kinds. Headings accept *starred text* for the italic accent line.
  stats: { kind: "stats", placement: "band", eyebrow: "By the numbers", heading: "Product by the numbers", items: [{ value: "21.3 in", label: "Length" }, { value: "36.9 oz", label: "Weight" }], sourceRefs: [] },
  cards: { kind: "cards", eyebrow: "Why it matters", heading: "First line, *accent line.*", items: [{ icon: "spine", title: "Card title", body: "Card text." }, { icon: "moon", title: "Card title", body: "Card text." }], sourceRefs: [] },
  contrast: { kind: "contrast", eyebrow: "Compared", heading: "Option A, or *option B?*", items: [{ tag: "Typical", tone: "problem", title: "Title", points: ["Point"] }, { tag: "Product", tone: "product", title: "Title", points: ["Point"] }], sourceRefs: [] },
  features: { kind: "features", eyebrow: "What's inside", heading: "Built around *how you use it.*", items: [{ icon: "layers", title: "Feature", body: "What the manufacturer says, attributed.", chip: "Short fact" }], sourceRefs: [] },
  reviews: { kind: "reviews", eyebrow: "Customer reviews", heading: "What *buyers say.*", items: [{ name: "Name as published", location: "", rating: 5, title: "", text: "Quoted exactly from the published review.", sourceRef: 1 }] },
  guarantee: { kind: "guarantee", eyebrow: "Returns", heading: "What the *return policy says.*", body: "The seller's terms, as published.", items: ["Term one", "Term two"], sourceRefs: [] },
};

function sourcesFrom(raw: unknown): SourceInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const o = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
    const t = (v: unknown) => (typeof v === "string" ? v : "");
    return { label: t(o.label), url: t(o.url), kind: t(o.kind) || "manufacturer", accessed: t(o.accessed) };
  });
}

function themeFrom(raw: unknown): Record<ThemeKey, string> {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = {} as Record<ThemeKey, string>;
  for (const k of THEME_KEYS) out[k] = typeof o[k] === "string" ? (o[k] as string) : "";
  return out;
}

export function WordCount({ product, sectionsJson, sources }: { product: AgencyProductDetail; sectionsJson?: string; sources?: SourceInput[] }) {
  const c = product.content;
  const count = useMemo(() => {
    let sectionsRaw: unknown = c?.sections ?? [];
    if (sectionsJson !== undefined) {
      try {
        sectionsRaw = JSON.parse(sectionsJson || "[]");
      } catch {
        sectionsRaw = [];
      }
    }
    const sourceCount = sources ? sources.length : parseSources(c?.sources).length;
    return landingWordCount({
      heroHeadline: c?.heroHeadline,
      heroSubtitle: c?.heroSubtitle,
      overview: c?.overview,
      howItWorks: c?.howItWorks,
      usage: c?.usage,
      whoItsFor: c?.whoItsFor,
      considerations: c?.considerations,
      sections: parseSections(sectionsRaw, sourceCount),
      benefits: product.benefits,
      ingredients: product.ingredients,
      faqs: product.faqs,
    });
  }, [c, product.benefits, product.ingredients, product.faqs, sectionsJson, sources]);

  const tone = count < WORD_TARGET.min ? "text-amber-ink" : count > WORD_TARGET.max ? "text-sky-ink" : "text-brand-700";
  return (
    <p className="text-sm text-ink-muted" aria-live="polite">
      <span className={cx("font-semibold", tone)}>{count.toLocaleString()} words</span> of editorial content · target{" "}
      {WORD_TARGET.min.toLocaleString()}–{WORD_TARGET.max.toLocaleString()} (guidance only — never pad)
    </p>
  );
}

export function LandingEditor({ product, readOnly }: { product: AgencyProductDetail; readOnly: boolean }) {
  const c = product.content;
  const [pending, startTransition] = useTransition();
  const [sectionsJson, setSectionsJson] = useState(() => {
    const raw = Array.isArray(c?.sections) ? c.sections : [];
    return raw.length ? JSON.stringify(raw, null, 2) : "";
  });
  const [sources, setSources] = useState<SourceInput[]>(() => sourcesFrom(c?.sources));
  const [theme, setTheme] = useState<Record<ThemeKey, string>>(() => themeFrom(c?.theme));

  const sourceCheck = validateSources(sources);
  const sectionCheck = validateSectionsJson(sectionsJson, sources.length);
  const themeCheck = validateTheme(theme);
  const resolved = resolveTheme(Object.fromEntries(Object.entries(theme).filter(([, v]) => /^#[0-9a-f]{6}$/i.test(v))));
  const sectionHeadings = sectionCheck.ok ? parseSections(sectionCheck.value, sources.length).map((s) => `${s.kind}: ${s.heading}`) : [];

  function save(form: FormData) {
    startTransition(async () => {
      const result = await updateLandingFields({
        productId: product.id,
        announcement: form.get("announcement"),
        heroHeadline: form.get("heroHeadline"),
        heroSubtitle: form.get("heroSubtitle"),
        brand: form.get("brand"),
        manufacturer: form.get("manufacturer"),
        sectionsJson,
        sources,
        theme,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(new FormData(e.currentTarget));
      }}
      className="space-y-8"
    >
      <WordCount product={product} sectionsJson={sectionsJson} sources={sources} />

      <fieldset disabled={readOnly || pending} className="space-y-8">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h3 className="font-display text-lg text-ink">Hero and identity</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="brand" label="Brand" defaultValue={c?.brand ?? ""} maxLength={120} hint="As the manufacturer names it. Used in the CTA label and structured data." />
            <Field id="manufacturer" label="Manufacturer / seller" defaultValue={c?.manufacturer ?? ""} maxLength={160} hint="The legal entity, only if verified." />
          </div>
          <Field id="heroHeadline" label="Hero headline" defaultValue={c?.heroHeadline ?? ""} maxLength={140} />
          <Field id="heroSubtitle" label="Hero subtitle" defaultValue={c?.heroSubtitle ?? ""} maxLength={400} multiline hint="Also used as the meta description when the SEO tab has none." />
          <Field id="announcement" label="Announcement bar (optional)" defaultValue={c?.announcement ?? ""} maxLength={200} hint="No unverified discounts, prices or guarantees." />
        </section>

        {/* ── Sources ───────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h3 className="font-display text-lg text-ink">Sources</h3>
          <p className="text-sm text-ink-muted">Every factual claim should trace to one of these. Sections cite them by number (sourceRefs).</p>
          <ol className="space-y-3">
            {sources.map((src, i) => (
              <li key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[2rem_1fr_1fr_10rem_8rem_auto] sm:items-center">
                <span className="text-sm font-semibold text-ink-muted">[{i + 1}]</span>
                <input aria-label={`Source ${i + 1} label`} placeholder="Label" value={src.label} maxLength={200} className={inputStyles} onChange={(e) => setSources(sources.map((s, j) => (j === i ? { ...s, label: e.target.value } : s)))} />
                <input aria-label={`Source ${i + 1} URL`} placeholder="https://…" value={src.url} maxLength={2048} className={inputStyles} onChange={(e) => setSources(sources.map((s, j) => (j === i ? { ...s, url: e.target.value } : s)))} />
                <select aria-label={`Source ${i + 1} type`} value={src.kind} className={inputStyles} onChange={(e) => setSources(sources.map((s, j) => (j === i ? { ...s, kind: e.target.value } : s)))}>
                  {SOURCE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {SOURCE_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <input aria-label={`Source ${i + 1} accessed`} placeholder="Accessed (e.g. Oct 2026)" value={src.accessed} maxLength={40} className={inputStyles} onChange={(e) => setSources(sources.map((s, j) => (j === i ? { ...s, accessed: e.target.value } : s)))} />
                <button type="button" className={buttonStyles.ghost} onClick={() => setSources(sources.filter((_, j) => j !== i))}>
                  <span className="text-rose-ink">Remove</span>
                </button>
              </li>
            ))}
          </ol>
          {sources.length < 40 && (
            <button type="button" className={buttonStyles.secondary} onClick={() => setSources([...sources, { label: "", url: "", kind: "manufacturer", accessed: "" }])}>
              Add source
            </button>
          )}
          <Problems result={sourceCheck} />
        </section>

        {/* ── Sections ──────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h3 className="font-display text-lg text-ink">Page sections</h3>
          <p className="text-sm text-ink-muted">
            An ordered JSON list of A+ bands. Put *stars* around the part of a heading that should be the italic accent line, and add an
            optional eyebrow. A stats section with placement &quot;hero&quot; becomes the hero&apos;s stat strip. Every number must be a
            verifiable fact with sourceRefs; reviews are shown only when each one cites where it was published. Insert a template, then
            edit it.
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.keys(SECTION_TEMPLATES).map((kind) => (
              <button
                key={kind}
                type="button"
                className={buttonStyles.secondary}
                onClick={() => {
                  let list: unknown[] = [];
                  try {
                    const parsed = JSON.parse(sectionsJson || "[]");
                    if (Array.isArray(parsed)) list = parsed;
                  } catch {
                    toast.error("Fix the JSON before inserting a template.");
                    return;
                  }
                  setSectionsJson(JSON.stringify([...list, SECTION_TEMPLATES[kind]], null, 2));
                }}
              >
                + {kind}
              </button>
            ))}
          </div>
          <label htmlFor="sectionsJson" className="sr-only">
            Sections JSON
          </label>
          <textarea
            id="sectionsJson"
            value={sectionsJson}
            onChange={(e) => setSectionsJson(e.target.value)}
            rows={18}
            spellCheck={false}
            className={cx(inputStyles, "resize-y font-mono text-xs leading-relaxed")}
          />
          <Problems result={sectionCheck} />
          {sectionHeadings.length > 0 && (
            <ol className="list-decimal space-y-0.5 pl-5 text-sm text-ink-muted">
              {sectionHeadings.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ol>
          )}
        </section>

        {/* ── Theme ─────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h3 className="font-display text-lg text-ink">Theme</h3>
          <p className="text-sm text-ink-muted">Use the brand&apos;s verified colours. Leave a field empty for the site default. Every pair must pass WCAG AA contrast to save.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {THEME_KEYS.map((key) => (
              <div key={key} className="space-y-1">
                <label htmlFor={`theme-${key}`} className="block text-sm font-medium text-ink">
                  {THEME_LABELS[key]}
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    aria-label={`${THEME_LABELS[key]} picker`}
                    value={/^#[0-9a-f]{6}$/i.test(theme[key]) ? theme[key] : DEFAULT_THEME[key]}
                    onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-surface"
                  />
                  <input
                    id={`theme-${key}`}
                    value={theme[key]}
                    placeholder={DEFAULT_THEME[key]}
                    maxLength={7}
                    onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}
                    className={cx(inputStyles, "font-mono")}
                  />
                </div>
              </div>
            ))}
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-ink-muted">
                <th className="py-1 font-medium">Pair</th>
                <th className="py-1 font-medium">Contrast</th>
                <th className="py-1 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {resolved.checks.map((ch) => (
                <tr key={ch.label} className="border-t border-line">
                  <td className="py-1.5 text-ink">{ch.label}</td>
                  <td className="py-1.5 font-mono text-ink-muted">
                    {ch.ratio.toFixed(2)}:1 (min {ch.min}:1)
                  </td>
                  <td className={cx("py-1.5 font-medium", ch.ok ? "text-brand-700" : "text-rose-ink")}>{ch.ok ? "Pass" : "Fails"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Problems result={themeCheck} />
        </section>
      </fieldset>

      {!readOnly && (
        <div className="flex justify-end">
          <button type="submit" className={buttonStyles.primary} disabled={pending || !sourceCheck.ok || !sectionCheck.ok || !themeCheck.ok}>
            {pending && <Spinner />}
            Save landing page
          </button>
        </div>
      )}
      {readOnly && <p className="text-sm text-ink-subtle">Your role doesn&apos;t have write access to product content.</p>}
    </form>
  );
}

function Problems({ result }: { result: { ok: true } | { ok: false; errors: string[] } }) {
  if (result.ok) return null;
  return (
    <ul role="alert" className="space-y-1 rounded-xl border border-rose-soft bg-rose-soft/40 px-4 py-3 text-sm text-rose-ink">
      {result.errors.map((e, i) => (
        <li key={i}>{e}</li>
      ))}
    </ul>
  );
}

function Field({
  id,
  label,
  defaultValue,
  maxLength,
  multiline,
  hint,
}: {
  id: string;
  label: string;
  defaultValue: string;
  maxLength: number;
  multiline?: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {multiline ? (
        <textarea id={id} name={id} defaultValue={defaultValue} maxLength={maxLength} rows={3} className={cx(inputStyles, "resize-y disabled:opacity-60")} />
      ) : (
        <input id={id} name={id} defaultValue={defaultValue} maxLength={maxLength} className={cx(inputStyles, "disabled:opacity-60")} />
      )}
      {hint && <p className="text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}
