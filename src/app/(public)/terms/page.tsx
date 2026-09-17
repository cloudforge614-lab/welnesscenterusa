import type { Metadata } from "next";
import Link from "next/link";
import { StaticPage, StaticSection } from "@/components/public/static-page";
import { siteUrl } from "@/lib/env";
import { ogImages, TWITTER_CARD, twitterImages } from "@/lib/seo/og";

// Scoped to what this site actually is: an informational product-discovery
// site that links out to merchants. It deliberately makes no claim about
// governing law, jurisdiction, arbitration, warranties, refunds, or company
// registration, because none of those facts are established — asserting them
// would be inventing legal detail, and an unenforceable term is worse than an
// absent one. Add them only when the operating entity and its legal review
// are real.

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The terms that apply to using Wellness Center USA: an informational product-discovery site that links to third-party merchants and does not sell products.",
  alternates: { canonical: `${siteUrl}/terms` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Terms of Use · Wellness Center USA",
    description:
      "The terms that apply to using Wellness Center USA: an informational product-discovery site that links to third-party merchants and does not sell products.",
    url: `${siteUrl}/terms`,
    type: "website",
    images: ogImages(),
  },
  twitter: {
    card: TWITTER_CARD,
    title: "Terms of Use · Wellness Center USA",
    description:
      "The terms that apply to using Wellness Center USA: an informational product-discovery site that links to third-party merchants and does not sell products.",
    images: twitterImages(),
  },
};

const UPDATED = "September 17, 2026";

export default function TermsPage() {
  return (
    <StaticPage
      title="Terms of Use"
      lead="These terms apply to your use of the Wellness Center USA website."
      updated={UPDATED}
    >
      <StaticSection title="Accepting these terms">
        <p>
          By using this site, you agree to these terms. If you do not agree with them, please do not use the site.
          We may update them from time to time, as described at the end of this page.
        </p>
      </StaticSection>

      <StaticSection title="What this site is">
        <p>
          Wellness Center USA is an informational website. It organizes health and wellness products so you can read
          about them in one place, and it links out to the merchants who actually sell them.
        </p>
        <p>
          <strong>We do not sell products.</strong> You cannot buy anything on this site, there is no cart or
          checkout here, and we do not take payment, hold stock, ship orders, or handle returns. Every purchase
          happens on a merchant&apos;s own website, under that merchant&apos;s terms.
        </p>
      </StaticSection>

      <StaticSection title="This is not medical advice">
        <p>
          Content on this site is general information only. It is not medical advice, and using this site does not
          create any kind of doctor–patient or professional relationship. Nothing here is intended to diagnose,
          treat, cure, or prevent any condition.
        </p>
        <p>
          Talk to a qualified healthcare professional before starting any new health or wellness product,
          particularly if you are pregnant or nursing, have a medical condition, or take medication. If you think
          you may have a medical emergency, contact emergency services.
        </p>
      </StaticSection>

      <StaticSection title="Affiliate links and merchants">
        <p>
          Some links on this site are affiliate links, and we may earn a commission when someone buys through one.
          This is explained in full in our <Link href="/affiliate-disclosure">affiliate disclosure</Link>.
        </p>
        <p>
          When you follow a link to a merchant, your dealings are with that merchant. They control their prices,
          shipping, availability, payment processing, order fulfillment, guarantees, and returns — we do not, and we
          are not a party to your transaction. Any dispute about an order is between you and the merchant.
        </p>
      </StaticSection>

      <StaticSection title="Accuracy of information">
        <p>
          We aim to describe products clearly and factually. Even so, product information on this site is drawn in
          part from manufacturer and merchant claims, and details change: prices, formulations, packaging, and
          availability can all change without us knowing.
        </p>
        <p>
          The merchant&apos;s own page is always the authoritative source for current price and availability. Please
          check it, and read the product&apos;s label and ingredients, before you buy.
        </p>
      </StaticSection>

      <StaticSection title="Using the site">
        <p>Please use the site reasonably. In particular, do not:</p>
        <ul>
          <li>attempt to gain unauthorized access to any part of the site, its accounts, or its systems</li>
          <li>interfere with the site&apos;s normal operation, or place an unreasonable load on it</li>
          <li>harvest content in bulk for republication</li>
          <li>use the site for anything unlawful, or misrepresent your relationship with us</li>
        </ul>
      </StaticSection>

      <StaticSection title="Content and intellectual property">
        <p>
          The written content, layout, and design of this site belong to its operators, unless stated otherwise.
          Please do not republish substantial portions of it without permission. You are of course welcome to link
          to our pages.
        </p>
        <p>
          Product names, brand names, logos, and images belong to their respective owners. They appear here to
          identify the products being described, and their appearance does not imply any endorsement of this site by
          those owners.
        </p>
      </StaticSection>

      <StaticSection title="Links to other sites">
        <p>
          This site links to third-party websites, including merchants. We do not control those sites and are not
          responsible for their content, products, or practices. A link is not an endorsement or a guarantee of
          anything found on the other side of it.
        </p>
      </StaticSection>

      <StaticSection title="Availability and disclaimer">
        <p>
          The site is provided on an &ldquo;as is&rdquo; basis. We do not guarantee that it will always be
          available, uninterrupted, or free of errors, or that the information on it is complete or current at any
          given moment.
        </p>
        <p>
          To the extent permitted by applicable law, we are not liable for loss arising from your use of this site,
          from information on it, or from any product you buy from a merchant you reached through it. Nothing in
          these terms limits any liability that cannot lawfully be limited.
        </p>
      </StaticSection>

      <StaticSection title="Changes to these terms">
        <p>
          We may update these terms as the site develops. When we do, the date at the top of this page changes.
          Continuing to use the site after an update means you accept the revised terms.
        </p>
      </StaticSection>

      <StaticSection title="Contact">
        <p>
          Questions about these terms can be sent through our <Link href="/contact">contact page</Link>. See also
          our <Link href="/privacy-policy">privacy policy</Link> for how information is handled.
        </p>
      </StaticSection>
    </StaticPage>
  );
}
