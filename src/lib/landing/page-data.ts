// The single data contract between "where landing content comes from" and
// "how a landing page renders". Both the public route (/products/[slug], anon
// client, published content only) and the authenticated agency preview build
// one of these, so the preview is exactly what will be published.
//
// Pure types. There is deliberately no affiliate-destination field: the page
// knows only whether an active link exists, and links to /go/[slug].

import type { LandingSection, LandingSource } from "./content";
import type { ProductTheme } from "./theme";

export type LandingMode = "public" | "preview";

export type LandingPageData = {
  mode: LandingMode;
  product: {
    id: string;
    name: string;
    slug: string;
    categories: { id: string; name: string; slug: string }[];
  };
  brand: string | null;
  manufacturer: string | null;
  announcement: string | null;
  heroHeadline: string | null;
  heroSubtitle: string | null;
  images: { url: string; alt: string | null }[];
  overview: string | null;
  howItWorks: string | null;
  usage: string | null;
  whoItsFor: string | null;
  considerations: string | null;
  sections: LandingSection[];
  benefits: { id: string; title: string; description: string | null }[];
  ingredients: { id: string; name: string; description: string | null }[];
  faqs: { id: string; question: string; answer: string }[];
  sources: LandingSource[];
  theme: ProductTheme;
  hasAffiliateLink: boolean;
  lastReviewedAt: string | null;
};
