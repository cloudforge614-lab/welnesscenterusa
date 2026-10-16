// Per-product landing-page theme: validation, accessibility checks, and
// conversion to scoped CSS custom properties.
//
// Pure (no imports), so it runs identically in the page, the agency editor's
// live contrast warnings, and plain-Node unit tests.
//
// SAFETY
// Values come from the database, where a CHECK constraint already limits them
// to known keys and 6-digit hex colours (migration 0026). They are validated
// again here because this is the last step before they reach a style
// attribute: only a value matching the hex pattern can ever be emitted, so no
// stored value can carry CSS syntax into the page.
//
// SCOPE
// The tokens are applied as custom properties on the landing page's own
// wrapper element. Nothing global changes; the homepage, admin and agency
// keep the site palette.

export const THEME_KEYS = ["primary", "secondary", "accent", "background", "surface", "text", "muted", "cta", "ctaText"] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];
export type ProductTheme = Record<ThemeKey, string>;

const HEX = /^#[0-9a-f]{6}$/i;

/** The site palette (globals.css). Used for any token a product does not set or that fails a check. */
export const DEFAULT_THEME: ProductTheme = {
  primary: "#244f37",
  secondary: "#d7e8dc",
  accent: "#2f6445",
  background: "#faf8f4",
  surface: "#ffffff",
  text: "#1c2420",
  muted: "#5b6660",
  cta: "#244f37",
  ctaText: "#ffffff",
};

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG 2.x contrast ratio between two #rrggbb colours (1..21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Pairs that must stay readable, with the WCAG AA threshold each needs.
 * 4.5 for body-size text, 3 for large display text and UI accents.
 */
export const CONTRAST_RULES: { fg: ThemeKey; bg: ThemeKey; min: number; label: string }[] = [
  { fg: "text", bg: "background", min: 4.5, label: "Body text on page background" },
  { fg: "text", bg: "surface", min: 4.5, label: "Body text on cards" },
  { fg: "muted", bg: "background", min: 4.5, label: "Secondary text on page background" },
  { fg: "muted", bg: "surface", min: 4.5, label: "Secondary text on cards" },
  { fg: "ctaText", bg: "cta", min: 4.5, label: "Button text on button" },
  // primary is also used for links and source references (small text), so it
  // must meet the body-text ratio, not just the large-heading one.
  { fg: "primary", bg: "background", min: 4.5, label: "Headings and links on page background" },
  { fg: "primary", bg: "surface", min: 4.5, label: "Links on cards" },
  { fg: "primary", bg: "secondary", min: 3, label: "Headings on highlight panels" },
  { fg: "text", bg: "secondary", min: 4.5, label: "Text on highlight panels" },
  { fg: "muted", bg: "secondary", min: 4.5, label: "Secondary text on highlight panels" },
  { fg: "accent", bg: "surface", min: 3, label: "Icons on cards" },
  // A+ layout: italic accent headlines and eyebrow labels sit on both
  // backgrounds; stat bands and the final CTA put light text on primary.
  { fg: "accent", bg: "background", min: 3, label: "Accent headlines on page background" },
  { fg: "accent", bg: "secondary", min: 3, label: "Accent headlines on highlight panels" },
  { fg: "surface", bg: "primary", min: 4.5, label: "Text on dark bands" },
];

export type ThemeCheck = { label: string; ratio: number; min: number; ok: boolean };

export type ResolvedTheme = {
  theme: ProductTheme;
  /** Every contrast rule, evaluated on the colours as SUBMITTED. */
  checks: ThemeCheck[];
  /** Tokens replaced by the site default because they were invalid or failed a check. */
  replaced: ThemeKey[];
};

/**
 * Turns a stored theme into a complete, safe, readable one.
 *
 * Invalid or missing tokens take the site default. Then each contrast rule is
 * checked; when a pair fails, BOTH tokens of that pair revert to the site
 * defaults (which pass every rule), so the page is always readable even if an
 * editor saved a poor combination.
 */
export function resolveTheme(raw: unknown): ResolvedTheme {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const theme: ProductTheme = { ...DEFAULT_THEME };
  const replaced = new Set<ThemeKey>();

  for (const key of THEME_KEYS) {
    const value = input[key];
    if (typeof value === "string" && HEX.test(value)) theme[key] = value.toLowerCase();
    else if (value !== undefined) replaced.add(key);
  }

  const checks: ThemeCheck[] = CONTRAST_RULES.map((rule) => {
    const ratio = contrastRatio(theme[rule.fg], theme[rule.bg]);
    return { label: rule.label, ratio: Math.round(ratio * 100) / 100, min: rule.min, ok: ratio >= rule.min };
  });

  for (const [i, rule] of CONTRAST_RULES.entries()) {
    if (checks[i].ok) continue;
    theme[rule.fg] = DEFAULT_THEME[rule.fg];
    theme[rule.bg] = DEFAULT_THEME[rule.bg];
    replaced.add(rule.fg);
    replaced.add(rule.bg);
  }

  // A revert can itself break a pair that passed before (they share tokens).
  // The defaults are a known-good set, so a second failure falls back fully.
  const stillFailing = CONTRAST_RULES.some((rule) => contrastRatio(theme[rule.fg], theme[rule.bg]) < rule.min);
  if (stillFailing) return { theme: { ...DEFAULT_THEME }, checks, replaced: [...THEME_KEYS] };

  return { theme, checks, replaced: [...replaced] };
}

/** CSS custom properties for the landing wrapper. Every value is a validated hex colour. */
export function themeStyle(theme: ProductTheme): Record<string, string> {
  return {
    "--lp-primary": theme.primary,
    "--lp-secondary": theme.secondary,
    "--lp-accent": theme.accent,
    "--lp-background": theme.background,
    "--lp-surface": theme.surface,
    "--lp-text": theme.text,
    "--lp-muted": theme.muted,
    "--lp-cta": theme.cta,
    "--lp-cta-text": theme.ctaText,
  };
}
