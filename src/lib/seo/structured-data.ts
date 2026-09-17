import { contactEmail, siteUrl } from "@/lib/env";

// Site-level structured data (Step 7.10).
//
// Emitted once from the public layout, so it is present on every public page
// and on none of the staff pages. Page-level graphs (Product, Article, Review,
// FAQPage, BreadcrumbList) stay where they are and are unaffected — these two
// nodes describe the publisher and the site itself, which no single page can.
//
// WHAT IS DELIBERATELY ABSENT
// Nothing here is invented. There is no address, telephone, founder,
// foundingDate, logo, sameAs, aggregateRating, award, or medical credential,
// because none of those facts exist anywhere in this project's configuration
// or database. Structured data asserting them would be a claim the site
// cannot support — and for a health/wellness site, fabricated credentials or
// ratings are exactly the kind of claim that draws a manual action. `email`
// appears only when NEXT_PUBLIC_CONTACT_EMAIL is actually configured, on the
// same rule the contact page follows.
//
// @id values give the two nodes stable identifiers so the WebSite can point at
// its publisher by reference instead of restating the Organization inline.

/**
 * Stable identifier for the site's Organization node, which the public layout
 * emits on every public page.
 *
 * Content pages reference it by @id for their author/publisher rather than
 * restating the organization inline, so a consumer resolves one entity instead
 * of several look-alike copies.
 *
 * AUTHORS ARE DELIBERATELY ORGANIZATION-LEVEL (Step 7.10.4)
 * Individual bylines are not implemented, and that is a security decision, not
 * an oversight. The schema has author_id on the content tables, but `profiles`
 * has no anon SELECT policy at all (0011) and holds no public-facing author
 * data — only id, role, full_name (an internal staff identity), and
 * timestamps. There is no bio, no avatar, no display name meant for
 * publication, and no "publish this person" flag. Emitting real bylines would
 * therefore require either opening profiles to anon — publishing every staff
 * member's name and, by correlation, their role — or inventing a second,
 * unreviewed public read path for the same rows. Neither is worth an SEO
 * signal, so attribution stays with the publisher, which is both accurate and
 * honest: this content is published by the organization.
 */
export const ORGANIZATION_ID = `${siteUrl}/#organization`;

/**
 * The author/publisher node used by every content page. A reference, so the
 * organization's actual fields are stated once, in the layout.
 */
export const ORGANIZATION_REF = { "@id": ORGANIZATION_ID } as const;
const WEBSITE_ID = `${siteUrl}/#website`;

const ORGANIZATION_DESCRIPTION =
  "Wellness Center USA researches health and wellness products and organizes what it finds so visitors can explore with clarity.";

export function buildSiteStructuredData(): unknown[] {
  const organization: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "Wellness Center USA",
    url: siteUrl,
    description: ORGANIZATION_DESCRIPTION,
    ...(contactEmail ? { email: contactEmail } : {}),
  };

  const website: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: "Wellness Center USA",
    url: siteUrl,
    description: ORGANIZATION_DESCRIPTION,
    inLanguage: "en-US",
    publisher: { "@id": ORGANIZATION_ID },
    // The real public search route, which exists and accepts exactly this
    // parameter (src/app/(public)/search/page.tsx reads searchParams.q).
    // /search is noindex, which is correct and unrelated: a SearchAction
    // describes where a query is submitted, not a page to be indexed. The
    // query itself is sanitised server-side by sanitizePublicSearch(), and no
    // private or staff-only surface is reachable through it — public search
    // only ever queries publicly eligible content.
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return [organization, website];
}
