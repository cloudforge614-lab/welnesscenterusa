import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentEditor } from "@/components/agency/content-editor";
import { Badge } from "@/components/admin/ui";
import { getAgencyProduct } from "@/lib/products/agency-queries";
import { getAgencySession } from "@/lib/auth/agency";
import { contentMeta, isLive, STATUS_META } from "@/lib/products/status";

export async function generateMetadata(props: PageProps<"/agency/products/[id]">) {
  const { id } = await props.params;
  const product = await getAgencyProduct(id);
  return { title: product?.name ?? "Product" };
}

export default async function AgencyProductPage(props: PageProps<"/agency/products/[id]">) {
  const { id } = await props.params;
  const [product, session] = await Promise.all([getAgencyProduct(id), getAgencySession()]);
  if (!product) notFound();
  if (session.state !== "agency") notFound();

  const status = STATUS_META[product.productStatus];
  const content = contentMeta(product.content?.status ?? null);
  const live = isLive(product.productStatus, product.content?.status ?? null);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <Link href="/agency/products" className="text-sm font-medium text-ink-muted hover:text-ink">
          ← Products
        </Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words font-display text-3xl text-ink">{product.name}</h1>
            <p className="mt-1 font-mono text-sm text-ink-subtle">/products/{product.slug}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={status.tone}>{status.label}</Badge>
              <Badge tone={content.tone} dot={false}>
                {content.label}
              </Badge>
              {live ? (
                <Badge tone="brand" dot={false}>
                  Live on site
                </Badge>
              ) : (
                <span className="text-xs text-ink-subtle">Not on the public site yet</span>
              )}
            </div>
          </div>
        </div>
        <p className="mt-3 rounded-xl border border-line bg-sunken/60 px-4 py-3 text-sm text-ink-muted">
          Product name, URL, and active/paused/archived status are owner-controlled and read-only here. Publishing your
          content here makes it visible on the site only if the owner has also activated the product.
        </p>
      </div>

      <ContentEditor product={product} role={session.role} />
    </div>
  );
}
