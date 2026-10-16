import { landingWordCount, parseSections, parseSources } from "./content";
import type { LandingMode, LandingPageData } from "./page-data";
import { resolveTheme, type ResolvedTheme } from "./theme";

// Turns stored product data into the landing template's input. Used by the
// public route (published content, anon client) and the authenticated agency
// preview (draft content, staff session), so a preview renders exactly what
// will be published.
//
// Every JSON column is parsed and validated here: malformed sections and
// sources are dropped, and the theme is resolved to a complete, readable
// palette. Nothing un-validated reaches the template.

export type LandingInput = {
  id: string;
  name: string;
  slug: string;
  categories: { id: string; name: string; slug: string }[];
  images: { url: string; alt: string | null }[];
  overview: string | null;
  howItWorks: string | null;
  usage: string | null;
  whoItsFor: string | null;
  considerations: string | null;
  benefits: { id: string; title: string; description: string | null }[];
  ingredients: { id: string; name: string; description: string | null }[];
  faqs: { id: string; question: string; answer: string }[];
  announcement: string | null;
  heroHeadline: string | null;
  heroSubtitle: string | null;
  brand: string | null;
  manufacturer: string | null;
  sections: unknown;
  theme: unknown;
  sources: unknown;
  lastReviewedAt: string | null;
};

export type BuiltLanding = {
  data: LandingPageData;
  theme: ResolvedTheme;
  wordCount: number;
};

export function buildLanding(
  input: LandingInput,
  options: { mode: LandingMode; hasAffiliateLink: boolean },
): BuiltLanding {
  const sources = parseSources(input.sources);
  const sections = parseSections(input.sections, sources.length);
  const theme = resolveTheme(input.theme);

  const data: LandingPageData = {
    mode: options.mode,
    product: { id: input.id, name: input.name, slug: input.slug, categories: input.categories },
    brand: input.brand,
    manufacturer: input.manufacturer,
    announcement: input.announcement,
    heroHeadline: input.heroHeadline,
    heroSubtitle: input.heroSubtitle,
    images: input.images,
    overview: input.overview,
    howItWorks: input.howItWorks,
    usage: input.usage,
    whoItsFor: input.whoItsFor,
    considerations: input.considerations,
    sections,
    benefits: input.benefits,
    ingredients: input.ingredients,
    faqs: input.faqs,
    sources,
    theme: theme.theme,
    hasAffiliateLink: options.hasAffiliateLink,
    lastReviewedAt: input.lastReviewedAt,
  };

  const wordCount = landingWordCount({
    heroHeadline: input.heroHeadline,
    heroSubtitle: input.heroSubtitle,
    overview: input.overview,
    howItWorks: input.howItWorks,
    usage: input.usage,
    whoItsFor: input.whoItsFor,
    considerations: input.considerations,
    sections,
    benefits: input.benefits,
    ingredients: input.ingredients,
    faqs: input.faqs,
  });

  return { data, theme, wordCount };
}
