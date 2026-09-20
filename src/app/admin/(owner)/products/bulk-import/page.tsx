import Link from "next/link";
import { BulkImport } from "@/components/admin/bulk-import";
import { buttonStyles, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Bulk import" };

// Owner-only. This page lives under the (owner) route group, whose layout
// runs requireOwnerPage(): a signed-in Agency user gets "Owner access only"
// and never reaches this component, and the proxy bounces signed-out visitors
// to the login page before this renders. The Server Actions it calls check
// the Owner role again themselves.
export default function BulkImportPage() {
  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Bulk import"
        description="Create many products at once from a CSV and a ZIP of images. Nothing is created until the whole batch validates."
        action={
          <Link href="/admin/products" className={buttonStyles.secondary}>
            Back to products
          </Link>
        }
      />

      <section className="rounded-2xl border border-line bg-surface p-5 text-sm leading-relaxed text-ink-muted shadow-card sm:p-6">
        <h2 className="font-display text-base text-ink">CSV format</h2>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-sunken px-3.5 py-3 text-[13px] text-ink">
{`product_name,affiliate_url,image_filename
"Example Product One",https://example.com/offer-one,product-one.jpg
"Example, Two",https://example.com/offer-two,product-two.png`}
        </pre>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Wrap a name that contains a comma in double quotes.</li>
          <li>
            <code>image_filename</code> must match a file in your ZIP (or the images you pick) — JPG, JPEG, PNG or WebP, up to 5 MB each.
          </li>
          <li>Up to 200 products per import. Each product goes live on the homepage as soon as it is created.</li>
          <li>Affiliate links are stored owner-only and are never shown on the public site or to the agency.</li>
        </ul>
      </section>

      <BulkImport />
    </div>
  );
}
