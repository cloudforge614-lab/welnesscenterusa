import type { Metadata } from "next";
import { PlaceholderNotice, StaticPage, StaticSection } from "@/components/public/static-page";
import { siteUrl } from "@/lib/env";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Wellness Center USA.",
  alternates: { canonical: `${siteUrl}/privacy-policy` },
  robots: { index: true, follow: true },
};

const SECTIONS = [
  {
    title: "Information we collect",
    body: "This section will describe what information the site collects from visitors, such as pages visited and the affiliate-click data described below.",
  },
  {
    title: "How we use information",
    body: "This section will describe how collected information is used, for example to measure which products visitors are interested in.",
  },
  {
    title: "Affiliate links and tracking",
    body: "This site records basic data when a visitor clicks a “View official offer” link — such as the product, timestamp, and referring page — to measure interest in individual products. See our affiliate disclosure for how these links work.",
  },
  {
    title: "Cookies",
    body: "This section will describe any cookies used by the site, if applicable.",
  },
  {
    title: "Third-party links",
    body: "This site links to third-party merchant websites. Those sites have their own privacy practices, which this policy does not cover.",
  },
  {
    title: "Changes to this policy",
    body: "This section will describe how visitors are notified of updates to this policy.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <StaticPage
      title="Privacy Policy"
      lead="This page describes how Wellness Center USA handles information from visitors to this site."
    >
      <PlaceholderNotice>
        This is a working draft of our privacy policy structure. It will be replaced with final, legally reviewed
        copy before this site handles any personal data beyond what&apos;s described below. Nothing on this page
        should be read as a specific regulatory compliance claim (for example GDPR or CCPA) unless stated
        explicitly after legal review.
      </PlaceholderNotice>

      {SECTIONS.map((section) => (
        <StaticSection key={section.title} title={section.title}>
          <p>{section.body}</p>
        </StaticSection>
      ))}

      <StaticSection title="Contact us">
        <p>Questions about this policy can be sent through our contact page.</p>
      </StaticSection>
    </StaticPage>
  );
}
