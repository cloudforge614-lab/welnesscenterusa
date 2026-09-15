import type { Metadata } from "next";
import { PlaceholderNotice, StaticPage, StaticSection } from "@/components/public/static-page";
import { contactEmail, siteUrl } from "@/lib/env";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Wellness Center USA.",
  alternates: { canonical: `${siteUrl}/contact` },
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return (
    <StaticPage title="Contact" lead="Get in touch with Wellness Center USA.">
      <StaticSection title="Reach out">
        {contactEmail ? (
          <p>
            For questions about this site or a product listed on it, email us at{" "}
            <a href={`mailto:${contactEmail}`} className="font-medium text-brand-700 hover:text-brand-800">
              {contactEmail}
            </a>
            .
          </p>
        ) : (
          <PlaceholderNotice>
            A contact email hasn&apos;t been configured for this site yet. This page will list a real way to reach
            us once one is set up — we won&apos;t publish a placeholder address or a form that doesn&apos;t
            actually go anywhere.
          </PlaceholderNotice>
        )}
      </StaticSection>

      <StaticSection title="What to include">
        <p>
          If you&apos;re reaching out about a specific product, please mention the product name or the page URL so
          we can find it quickly.
        </p>
      </StaticSection>
    </StaticPage>
  );
}
