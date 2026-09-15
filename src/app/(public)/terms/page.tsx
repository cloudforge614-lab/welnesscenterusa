import type { Metadata } from "next";
import { PlaceholderNotice, StaticPage, StaticSection } from "@/components/public/static-page";
import { siteUrl } from "@/lib/env";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms of Use for Wellness Center USA.",
  alternates: { canonical: `${siteUrl}/terms` },
  robots: { index: true, follow: true },
};

const SECTIONS = [
  {
    title: "Acceptance of terms",
    body: "This section will describe what it means to use this site and agree to these terms.",
  },
  {
    title: "Use of the site",
    body: "This section will describe acceptable use of the site's content and product information.",
  },
  {
    title: "Affiliate links and third-party sites",
    body: "This site contains links to third-party merchant sites, some of which are affiliate links (see our affiliate disclosure). We are not responsible for the content, products, or practices of those third-party sites.",
  },
  {
    title: "No medical advice",
    body: "Content on this site is provided for general informational purposes only and is not medical advice. Always consult a qualified healthcare professional before starting any new health or wellness product.",
  },
  {
    title: "Intellectual property",
    body: "This section will describe ownership of the site's content and design.",
  },
  {
    title: "Disclaimer and limitation of liability",
    body: "This section will describe, following legal review, the extent to which the site's operators are liable for use of the site or products referenced on it.",
  },
  {
    title: "Changes to these terms",
    body: "This section will describe how visitors are notified of updates to these terms.",
  },
];

export default function TermsPage() {
  return (
    <StaticPage title="Terms of Use" lead="These terms govern use of the Wellness Center USA website.">
      <PlaceholderNotice>
        This is a working draft of our terms structure. It will be replaced with final, legally reviewed copy.
        Nothing on this page should be read as a specific legal commitment until that review is complete.
      </PlaceholderNotice>

      {SECTIONS.map((section) => (
        <StaticSection key={section.title} title={section.title}>
          <p>{section.body}</p>
        </StaticSection>
      ))}

      <StaticSection title="Contact us">
        <p>Questions about these terms can be sent through our contact page.</p>
      </StaticSection>
    </StaticPage>
  );
}
