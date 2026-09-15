// Reusable placeholder: standard, generic FTC-style affiliate disclosure
// copy, not site-specific legal language. Swap the text for approved legal
// copy in one place when that's finalized — every product page already
// renders through this component.
export function AffiliateDisclosure({ className }: { className?: string }) {
  return (
    <p className={className}>
      Wellness Center USA may earn a commission from qualifying purchases made through links on this page, at no
      additional cost to you. This supports our independent research and does not influence which products we
      cover.
    </p>
  );
}
