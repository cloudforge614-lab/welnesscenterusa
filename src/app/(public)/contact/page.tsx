import type { Metadata } from "next";
import Link from "next/link";
import { PlaceholderNotice, StaticPage, StaticSection } from "@/components/public/static-page";
import { contactEmail, siteUrl } from "@/lib/env";
import { ogImages, TWITTER_CARD, twitterImages } from "@/lib/seo/og";

// There is deliberately no contact form here. A form needs somewhere to send
// what it collects, and this application has no mail transport and no public
// endpoint — building an unauthenticated send endpoint just to make the page
// look complete would add an abuse surface and collect messages that go
// nowhere. When NEXT_PUBLIC_CONTACT_EMAIL is set, the page publishes that
// address; when it is not, it says so plainly rather than inventing one.

export const metadata: Metadata = {
  title: "Contact",
  description:
    "How to reach Wellness Center USA about a product page, a correction, or a question about how this site works.",
  alternates: { canonical: `${siteUrl}/contact` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Contact · Wellness Center USA",
    description:
      "How to reach Wellness Center USA about a product page, a correction, or a question about how this site works.",
    url: `${siteUrl}/contact`,
    type: "website",
    images: ogImages(),
  },
  twitter: {
    card: TWITTER_CARD,
    title: "Contact · Wellness Center USA",
    description:
      "How to reach Wellness Center USA about a product page, a correction, or a question about how this site works.",
    images: twitterImages(),
  },
};

export default function ContactPage() {
  return (
    <StaticPage
      title="Contact"
      lead="Questions about a product page, a correction, or how this site works — here's how to reach us."
    >
      <StaticSection title="Email us">
        {contactEmail ? (
          <>
            <p>
              The best way to reach us is by email:{" "}
              <a href={`mailto:${contactEmail}`} className="font-medium text-brand-700 hover:text-brand-800">
                {contactEmail}
              </a>
              .
            </p>
            <p>
              We read everything that comes in. We are a small team, so a reply may take a few days, and we
              can&apos;t always respond to every message individually.
            </p>
          </>
        ) : (
          <PlaceholderNotice>
            A contact address hasn&apos;t been set up for this site yet, so there is nothing here we could honestly
            publish. We would rather say that than print an address that bounces or a form that quietly goes
            nowhere. As soon as a monitored inbox exists, it will appear on this page.
          </PlaceholderNotice>
        )}
      </StaticSection>

      <StaticSection title="What we can help with">
        <ul>
          <li>a question about a product described on this site</li>
          <li>a correction — if something we&apos;ve written is inaccurate or out of date, we want to know</li>
          <li>a question about how this site works, or how we make money</li>
          <li>press, partnership, or product submission enquiries</li>
        </ul>
        <p>
          If you&apos;re writing about a specific product, including the product name or the page address helps us
          find it straight away.
        </p>
      </StaticSection>

      <StaticSection title="What we can't help with">
        <p>
          <strong>Orders and deliveries.</strong> We don&apos;t sell the products described here. If you have
          bought something, your order, payment, shipping, and returns are handled entirely by the merchant you
          bought from, and they are the only ones who can look it up. Please contact them directly.
        </p>
        <p>
          <strong>Medical questions.</strong> We can&apos;t advise on whether a product is right for you, or on
          interactions, doses, or symptoms. Please speak to a qualified healthcare professional.
        </p>
      </StaticSection>

      <StaticSection title="Before you write">
        <p>
          Two pages answer most of what we&apos;re asked: our{" "}
          <Link href="/affiliate-disclosure">affiliate disclosure</Link> explains how the links on this site work
          and how the site is funded, and our <Link href="/privacy-policy">privacy policy</Link> sets out exactly
          what information is and isn&apos;t collected when you browse.
        </p>
      </StaticSection>
    </StaticPage>
  );
}
