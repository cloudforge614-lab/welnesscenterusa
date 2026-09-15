import type { Metadata } from "next";
import Link from "next/link";
import { StaticPage, StaticSection } from "@/components/public/static-page";
import { siteUrl } from "@/lib/env";

export const metadata: Metadata = {
  title: "Affiliate Disclosure",
  description: "How Wellness Center USA uses affiliate links.",
  alternates: { canonical: `${siteUrl}/affiliate-disclosure` },
  robots: { index: true, follow: true },
};

export default function AffiliateDisclosurePage() {
  return (
    <StaticPage title="Affiliate Disclosure" lead="How this site is supported, and what that means for you.">
      <StaticSection title="We use affiliate links">
        <p>
          Wellness Center USA participates in affiliate programs. When you click a &ldquo;View official offer&rdquo;
          link on a product page and go on to make a purchase, we may earn a commission from the merchant. This
          happens at no additional cost to you — the price you pay is not affected by whether you came from our
          site.
        </p>
      </StaticSection>

      <StaticSection title="How this affects our content">
        <p>
          Whether a product has an affiliate relationship does not determine whether or how we describe it. Our aim
          is to give clear, factual information regardless of commission.
        </p>
      </StaticSection>

      <StaticSection title="How the links work">
        <p>
          Every &ldquo;View official offer&rdquo; link on this site routes through our own redirect
          (<code className="rounded bg-sunken px-1.5 py-0.5 text-[13px]">/go/…</code>) before sending you to the
          merchant&apos;s site. This lets us track which products people are interested in; it does not add any
          extra step or cost for you, and the destination is always the product&apos;s official page.
        </p>
      </StaticSection>

      <StaticSection title="Not medical advice">
        <p>
          Content on this site, including any product descriptions, is for general informational purposes and is
          not medical advice. Always consult a qualified healthcare professional before starting any new health or
          wellness product.
        </p>
      </StaticSection>

      <StaticSection title="Questions">
        <p>
          If you have questions about this disclosure or about a specific product page, see our{" "}
          <Link href="/contact" className="font-medium text-brand-700 hover:text-brand-800">
            contact page
          </Link>
          .
        </p>
      </StaticSection>
    </StaticPage>
  );
}
