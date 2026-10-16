// Save-time validation for the agency landing-page editor.
//
// The renderer (content.ts, theme.ts) is forgiving: it drops malformed
// entries so a bad row degrades to a shorter page. The editor must be strict
// instead, so an editor never saves something that silently disappears.
// These functions report every problem in plain language and return the
// cleaned value to store.
//
// Pure (no imports beyond the landing modules), so the editor can run the
// same checks live in the browser before the server action runs them again.

import { parseSections, parseSources, SECTION_KINDS, SOURCE_KINDS } from "./content";
import { resolveTheme, THEME_KEYS, type ProductTheme, type ThemeKey } from "./theme";

export type Validated<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const HEX = /^#[0-9a-f]{6}$/i;

/** Sections arrive as JSON text from the editor. */
export function validateSectionsJson(text: string, sourceCount: number): Validated<unknown[]> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch (e) {
    return { ok: false, errors: [`Sections are not valid JSON: ${(e as Error).message}`] };
  }
  if (!Array.isArray(raw)) return { ok: false, errors: ["Sections must be a JSON array of section objects."] };
  if (raw.length > 30) return { ok: false, errors: ["A page can have at most 30 sections."] };

  const errors: string[] = [];
  raw.forEach((entry, i) => {
    const n = i + 1;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`Section ${n} is not an object.`);
      return;
    }
    const e = entry as Record<string, unknown>;
    if (!(SECTION_KINDS as readonly string[]).includes(e.kind as string)) {
      errors.push(`Section ${n}: "kind" must be one of ${SECTION_KINDS.join(", ")}.`);
      return;
    }
    if (Array.isArray(e.sourceRefs)) {
      for (const r of e.sourceRefs) {
        if (!Number.isInteger(r) || (r as number) < 1 || (r as number) > sourceCount) {
          errors.push(`Section ${n}: source reference ${JSON.stringify(r)} does not match a saved source (1–${sourceCount}).`);
        }
      }
    }
    // The renderer's parser is the source of truth for shape; anything it
    // would drop is an error here.
    const parsed = parseSections([entry], sourceCount)[0];
    if (!parsed) {
      errors.push(`Section ${n} ("${typeof e.heading === "string" ? e.heading : "no heading"}") is incomplete or too long for a ${String(e.kind)} section.`);
      return;
    }
    // Reviews and quotes must each cite a saved source. The renderer drops
    // uncited ones; the editor refuses them so nothing silently disappears.
    if (parsed.kind === "reviews" && Array.isArray(e.items) && parsed.items.length !== e.items.length) {
      errors.push(`Section ${n}: every review needs a name, a 1–5 rating, text and a sourceRef pointing to where it was published.`);
    }
    if (parsed.kind === "cards" && e.quote && !parsed.quote) {
      errors.push(`Section ${n}: the quote needs text, a cite line and a sourceRef to a saved source.`);
    }
  });
  if (JSON.stringify(raw).length > 200_000) errors.push("Sections are too large to save.");
  return errors.length ? { ok: false, errors } : { ok: true, value: raw };
}

export type SourceInput = { label: string; url: string; kind: string; accessed: string };

export function validateSources(rows: SourceInput[]): Validated<{ label: string; url: string; kind: string; accessed?: string }[]> {
  if (rows.length > 40) return { ok: false, errors: ["A page can cite at most 40 sources."] };
  const errors: string[] = [];
  const value: { label: string; url: string; kind: string; accessed?: string }[] = [];
  rows.forEach((r, i) => {
    const n = i + 1;
    const entry = {
      label: r.label.trim(),
      url: r.url.trim(),
      kind: r.kind,
      ...(r.accessed.trim() ? { accessed: r.accessed.trim() } : {}),
    };
    if (!entry.label) errors.push(`Source ${n} needs a label.`);
    if (!(SOURCE_KINDS as readonly string[]).includes(entry.kind)) errors.push(`Source ${n} needs a type.`);
    if (!/^https:\/\/\S+$/.test(entry.url) || entry.url.length < 12 || entry.url.length > 2048) {
      errors.push(`Source ${n} needs a full https:// address.`);
    } else if (parseSources([entry]).length === 0) {
      errors.push(`Source ${n} is not a valid source.`);
    }
    value.push(entry);
  });
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

/**
 * Theme: only known tokens with hex values, and the submitted palette must
 * pass every contrast rule as entered (the page would otherwise silently
 * swap colours, which an editor should see and fix instead).
 */
export function validateTheme(input: Partial<Record<string, string>>): Validated<Partial<ProductTheme>> {
  const errors: string[] = [];
  const value: Partial<ProductTheme> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!(THEME_KEYS as readonly string[]).includes(key)) {
      errors.push(`Unknown colour "${key}".`);
      continue;
    }
    const v = (raw ?? "").trim();
    if (!v) continue; // empty = use the site default
    if (!HEX.test(v)) errors.push(`${key} must be a 6-digit hex colour like #1b2a54.`);
    else value[key as ThemeKey] = v.toLowerCase();
  }
  if (errors.length) return { ok: false, errors };
  const resolved = resolveTheme(value);
  for (const c of resolved.checks) {
    if (!c.ok) errors.push(`${c.label}: contrast ${c.ratio.toFixed(2)}:1, needs at least ${c.min}:1.`);
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
