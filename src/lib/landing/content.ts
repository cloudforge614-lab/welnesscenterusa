// Landing-page content model: parsing the stored sections and sources into
// typed, render-safe values, and counting visible editorial words.
//
// Pure (no imports). The database already constrains the shape (migration
// 0026); this is the second, stricter pass the renderer relies on. Anything
// malformed is dropped rather than rendered, so a bad row degrades to a
// shorter page, never a broken or unsafe one.

export const SECTION_KINDS = [
  "prose",
  "checklist",
  "steps",
  "comparison",
  "specs",
  "callout",
  // A+ kinds (migration 0027)
  "stats",
  "cards",
  "contrast",
  "features",
  "reviews",
  "guarantee",
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

type Base = {
  /** Stable anchor id, derived from the heading (unique within the page). */
  id: string;
  heading: string;
  /** Small uppercase label above the heading ("The root cause"). */
  eyebrow: string | null;
  /** Optional lead-in paragraph (markdown). */
  intro: string | null;
  /** 1-based indices into the page's sources list, for claim attribution. */
  sourceRefs: number[];
};

export type LandingSection =
  | (Base & { kind: "prose"; body: string })
  | (Base & { kind: "checklist" | "steps"; items: string[] })
  | (Base & { kind: "comparison"; columns: string[]; rows: string[][]; note: string | null })
  | (Base & { kind: "specs"; rows: [string, string][] })
  | (Base & { kind: "callout"; body: string; tone: "info" | "caution" })
  // A row of headline numbers. "hero" renders inside the hero as a trust
  // strip; "band" is a full-width coloured band. Every value must be a
  // verifiable fact (cite it with sourceRefs), never an invented statistic.
  | (Base & { kind: "stats"; placement: "hero" | "band"; items: { value: string; label: string }[] })
  // Icon cards, with an optional pull quote that must cite a source.
  | (Base & { kind: "cards"; items: { icon: IconName; title: string; body: string }[]; quote: { text: string; cite: string; sourceRef: number } | null })
  // Side-by-side cards with a status tag, e.g. "Flat pillow" vs the product.
  | (Base & { kind: "contrast"; items: { tag: string; tone: "problem" | "neutral" | "product"; title: string; points: string[] }[] })
  // Numbered feature rows (01, 02, ...) with an optional fact chip.
  | (Base & { kind: "features"; items: { icon: IconName; title: string; body: string; chip: string | null }[] })
  // Customer reviews. Rendered ONLY with a source: every review must cite
  // where it was published (sourceRef), so nothing invented can appear.
  | (Base & { kind: "reviews"; items: { name: string; location: string | null; rating: number; title: string | null; text: string; sourceRef: number }[] })
  // Return/guarantee terms as stated by the seller (cite the policy).
  | (Base & { kind: "guarantee"; body: string; items: string[] });

/** Fixed icon set (inline SVG in the renderer); no arbitrary markup is ever stored. */
export const ICON_NAMES = ["spine", "moon", "shield", "leaf", "snow", "wash", "ruler", "weight", "check", "star", "truck", "clock", "heart", "layers", "alert", "sparkle"] as const;
export type IconName = (typeof ICON_NAMES)[number];

function icon(value: unknown): IconName {
  return (ICON_NAMES as readonly string[]).includes(value as string) ? (value as IconName) : "check";
}

export const SOURCE_KINDS = ["manufacturer", "independent", "regulatory", "retailer", "other"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
export type LandingSource = { label: string; url: string; kind: SourceKind; accessed: string | null };

const MAX_ITEMS = 20;
const MAX_ROWS = 15;

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v && v.length <= max ? v : null;
}

function strList(value: unknown, maxItems: number, maxLen: number): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxItems) return null;
  const out: string[] = [];
  for (const item of value) {
    const s = str(item, maxLen);
    if (!s) return null;
    out.push(s);
  }
  return out;
}

/** Turns a heading into a URL-fragment-safe id. */
export function anchorId(heading: string): string {
  const base = heading
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
  return base || "section";
}

/**
 * Parses the stored `sections` JSON into typed sections. Unknown kinds and
 * malformed entries are dropped; ids are made unique.
 */
export function parseSections(raw: unknown, sourceCount: number): LandingSection[] {
  if (!Array.isArray(raw)) return [];
  const used = new Set<string>();
  const out: LandingSection[] = [];

  for (const entry of raw.slice(0, 30)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const e = entry as Record<string, unknown>;
    const kind = e.kind;
    const heading = str(e.heading, 160);
    if (!heading || typeof kind !== "string" || !(SECTION_KINDS as readonly string[]).includes(kind)) continue;

    let id = anchorId(heading);
    for (let n = 2; used.has(id); n++) id = `${anchorId(heading)}-${n}`;

    const refs = Array.isArray(e.sourceRefs)
      ? [...new Set(e.sourceRefs.filter((r): r is number => Number.isInteger(r) && r >= 1 && r <= sourceCount))].slice(0, 8)
      : [];
    const base: Base = { id, heading, eyebrow: str(e.eyebrow, 60), intro: str(e.intro, 2000), sourceRefs: refs };
    const objs = (value: unknown, min: number, max: number): Record<string, unknown>[] | null =>
      Array.isArray(value) && value.length >= min && value.length <= max && value.every((v) => v && typeof v === "object" && !Array.isArray(v))
        ? (value as Record<string, unknown>[])
        : null;
    const ref = (value: unknown): number | null => (Number.isInteger(value) && (value as number) >= 1 && (value as number) <= sourceCount ? (value as number) : null);

    let section: LandingSection | null = null;
    if (kind === "prose") {
      const body = str(e.body, 12000);
      if (body) section = { ...base, kind, body };
    } else if (kind === "checklist" || kind === "steps") {
      const items = strList(e.items, MAX_ITEMS, 600);
      if (items) section = { ...base, kind, items };
    } else if (kind === "comparison") {
      const columns = strList(e.columns, 5, 80);
      const rows = Array.isArray(e.rows) && e.rows.length > 0 && e.rows.length <= MAX_ROWS ? e.rows.map((r) => strList(r, 5, 300)) : null;
      if (columns && columns.length >= 2 && rows && rows.every((r) => r && r.length === columns.length)) {
        section = { ...base, kind, columns, rows: rows as string[][], note: str(e.note, 600) };
      }
    } else if (kind === "specs") {
      const rows = Array.isArray(e.rows) && e.rows.length > 0 && e.rows.length <= MAX_ROWS ? e.rows.map((r) => strList(r, 2, 300)) : null;
      if (rows && rows.every((r) => r && r.length === 2)) section = { ...base, kind, rows: rows as [string, string][] };
    } else if (kind === "callout") {
      const body = str(e.body, 2000);
      if (body) section = { ...base, kind, body, tone: e.tone === "caution" ? "caution" : "info" };
    } else if (kind === "stats") {
      const raw = objs(e.items, 2, 6);
      const items = raw?.map((i) => ({ value: str(i.value, 24), label: str(i.label, 60) }));
      if (items && items.every((i) => i.value && i.label)) {
        section = { ...base, kind, placement: e.placement === "hero" ? "hero" : "band", items: items as { value: string; label: string }[] };
      }
    } else if (kind === "cards") {
      const raw = objs(e.items, 2, 8);
      const items = raw?.map((i) => ({ icon: icon(i.icon), title: str(i.title, 120), body: str(i.body, 600) }));
      let quote: { text: string; cite: string; sourceRef: number } | null = null;
      if (e.quote && typeof e.quote === "object") {
        const q = e.quote as Record<string, unknown>;
        const text = str(q.text, 400);
        const cite = str(q.cite, 160);
        const sourceRef = ref(q.sourceRef);
        if (text && cite && sourceRef) quote = { text, cite, sourceRef };
      }
      if (items && items.every((i) => i.title && i.body)) section = { ...base, kind, items: items as { icon: IconName; title: string; body: string }[], quote };
    } else if (kind === "contrast") {
      const raw = objs(e.items, 2, 3);
      const items = raw?.map((i) => ({
        tag: str(i.tag, 40),
        tone: (i.tone === "problem" || i.tone === "product" ? i.tone : "neutral") as "problem" | "neutral" | "product",
        title: str(i.title, 120),
        points: strList(i.points, 6, 200),
      }));
      if (items && items.every((i) => i.tag && i.title && i.points)) section = { ...base, kind, items: items as { tag: string; tone: "problem" | "neutral" | "product"; title: string; points: string[] }[] };
    } else if (kind === "features") {
      const raw = objs(e.items, 1, 6);
      const items = raw?.map((i) => ({ icon: icon(i.icon), title: str(i.title, 120), body: str(i.body, 1200), chip: str(i.chip, 60) }));
      if (items && items.every((i) => i.title && i.body)) section = { ...base, kind, items: items as { icon: IconName; title: string; body: string; chip: string | null }[] };
    } else if (kind === "reviews") {
      const raw = objs(e.items, 1, 12);
      const items = raw?.map((i) => ({
        name: str(i.name, 80),
        location: str(i.location, 80),
        rating: Number.isInteger(i.rating) && (i.rating as number) >= 1 && (i.rating as number) <= 5 ? (i.rating as number) : null,
        title: str(i.title, 120),
        text: str(i.text, 1500),
        sourceRef: ref(i.sourceRef),
      }));
      // A review without a valid source is dropped, never shown.
      const valid = items?.filter((i) => i.name && i.rating && i.text && i.sourceRef);
      if (valid && valid.length > 0) section = { ...base, kind, items: valid as { name: string; location: string | null; rating: number; title: string | null; text: string; sourceRef: number }[] };
    } else if (kind === "guarantee") {
      const body = str(e.body, 2000);
      const items = strList(e.items, 8, 200);
      if (body && items) section = { ...base, kind, body, items };
    }

    if (section) {
      used.add(id);
      out.push(section);
    }
  }
  return out;
}

/** Parses the stored `sources` JSON. Only https URLs survive. */
export function parseSources(raw: unknown): LandingSource[] {
  if (!Array.isArray(raw)) return [];
  const out: LandingSource[] = [];
  for (const entry of raw.slice(0, 40)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const e = entry as Record<string, unknown>;
    const label = str(e.label, 200);
    const url = str(e.url, 2048);
    const kind = (SOURCE_KINDS as readonly string[]).includes(e.kind as string) ? (e.kind as SourceKind) : null;
    if (!label || !url || !kind) continue;
    try {
      if (new URL(url).protocol !== "https:") continue;
    } catch {
      continue;
    }
    out.push({ label, url, kind, accessed: str(e.accessed, 40) });
  }
  return out;
}

// ── Word count ────────────────────────────────────────────────────────────
//
// Counts the words a visitor actually reads as editorial content: headings,
// prose, list items, table cells, benefits, ingredients, FAQs. Excluded:
// navigation, button labels, the affiliate disclosure boilerplate, related
// products, and the source list (citations, not prose). Markdown syntax is
// stripped first, so link URLs and emphasis markers are not counted.

/** Removes markdown syntax, keeping the readable text. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`~|]/g, " ");
}

export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const words = plainText(text).match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu);
  return words ? words.length : 0;
}

export type WordCountInput = {
  heroHeadline?: string | null;
  heroSubtitle?: string | null;
  overview?: string | null;
  howItWorks?: string | null;
  usage?: string | null;
  whoItsFor?: string | null;
  considerations?: string | null;
  sections: LandingSection[];
  benefits: { title: string; description: string | null }[];
  ingredients: { name: string; description: string | null }[];
  faqs: { question: string; answer: string }[];
};

export function landingWordCount(c: WordCountInput): number {
  let n = 0;
  // considerations is stored but not shown on the page, so it is not counted.
  for (const t of [c.heroHeadline, c.heroSubtitle, c.overview, c.howItWorks, c.usage, c.whoItsFor]) n += countWords(t);
  for (const s of c.sections) {
    n += countWords(s.heading) + countWords(s.intro);
    if (s.kind === "prose" || s.kind === "callout") n += countWords(s.body);
    else if (s.kind === "checklist" || s.kind === "steps") for (const i of s.items) n += countWords(i);
    else if (s.kind === "comparison") {
      for (const col of s.columns) n += countWords(col);
      for (const row of s.rows) for (const cell of row) n += countWords(cell);
      n += countWords(s.note);
    } else if (s.kind === "specs") for (const [k, v] of s.rows) n += countWords(k) + countWords(v);
    else if (s.kind === "stats") for (const i of s.items) n += countWords(i.value) + countWords(i.label);
    else if (s.kind === "cards") {
      for (const i of s.items) n += countWords(i.title) + countWords(i.body);
      if (s.quote) n += countWords(s.quote.text);
    } else if (s.kind === "contrast") for (const i of s.items) n += countWords(i.title) + i.points.reduce((a, p) => a + countWords(p), 0);
    else if (s.kind === "features") for (const i of s.items) n += countWords(i.title) + countWords(i.body);
    else if (s.kind === "reviews") for (const i of s.items) n += countWords(i.title) + countWords(i.text);
    else if (s.kind === "guarantee") n += countWords(s.body) + s.items.reduce((a, p) => a + countWords(p), 0);
    n += countWords(s.eyebrow);
  }
  for (const b of c.benefits) n += countWords(b.title) + countWords(b.description);
  for (const i of c.ingredients) n += countWords(i.name) + countWords(i.description);
  for (const f of c.faqs) n += countWords(f.question) + countWords(f.answer);
  return n;
}

/** The editorial target band, used for reporting only (never to block or pad). */
export const WORD_TARGET = { min: 2000, max: 2300 } as const;
