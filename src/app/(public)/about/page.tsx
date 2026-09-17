import type { Metadata } from "next";
import Link from "next/link";
import { StaticPage, StaticSection } from "@/components/public/static-page";
import { siteUrl } from "@/lib/env";
import { ogImages, TWITTER_CARD, twitterImages } from "@/lib/seo/og";

export const metadata: Metadata = {
  title: "About",
  description:
    "About Wellness Center USA — a health and wellness product discovery platform.",
  alternates: { canonical: `${siteUrl}/about` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "About · Wellness Center USA",
    description:
      "About Wellness Center USA — a health and wellness product discovery platform.",
    url: `${siteUrl}/about`,
    type: "website",
    images: ogImages(),
  },
  twitter: {
    card: TWITTER_CARD,
    title: "About · Wellness Center USA",
    description:
      "About Wellness Center USA — a health and wellness product discovery platform.",
    images: twitterImages(),
  },
};

export default function AboutPage() {
  return (
    <StaticPage
      title="About Wellness Center USA"
      lead="A health and wellness product discovery platform — built to help people explore products with clarity."
    >
      <StaticSection title="What we do">
        <p>
          Wellness Center USA organizes health and wellness products in one place, so visitors can browse and learn
          about what&apos;s available before deciding what, if anything, to purchase. Each product on this site has
          its own page with the information available for it.
        </p>
      </StaticSection>

      <StaticSection title="How the site works">
        <p>
          Products are added to the site and then researched and written up before they&apos;re published. A
          product only appears publicly once that process is complete — you won&apos;t find placeholder or
          incomplete listings here.
        </p>
        <p>
          Where a product page links out to a merchant, that link may be an affiliate link. See our{" "}
          <Link href="/affiliate-disclosure" className="font-medium text-brand-700 hover:text-brand-800">
            affiliate disclosure
          </Link>{" "}
          for details.
        </p>
      </StaticSection>

      <StaticSection title="Our approach">
        <p>
          We aim for clear, factual descriptions rather than exaggerated marketing claims. Information on this site
          reflects manufacturer claims and our own editorial review; it is provided for general informational
          purposes and is not medical advice. Always consult a qualified healthcare professional before starting
          any new health or wellness product.
        </p>
      </StaticSection>
    </StaticPage>
  );
}
