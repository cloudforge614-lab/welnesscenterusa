import Link from "next/link";
import { notFound } from "next/navigation";
import { EditAffiliateUrlForm, EditNameForm, ProductStatusControls } from "@/components/admin/product-controls";
import { Badge, Card, formatDate, formatDateTime, formatNumber } from "@/components/admin/ui";
import { getProduct, getProductClickStats } from "@/lib/products/queries";
import { contentMeta, isLive, STATUS_META } from "@/lib/products/status";

export async function generateMetadata(props: PageProps<"/admin/products/[id]">) {
  const { id } = await props.params;
  const product = await getProduct(id);
  return { title: product?.name ?? "Product" };
}

export default async function ProductPage(props: PageProps<"/admin/products/[id]">) {
  const { id } = await props.params;
  const product = await getProduct(id);
  if (!product) notFound();

  const clicks = await getProductClickStats(product.id);
  const status = STATUS_META[product.status];
  const content = contentMeta(product.contentStatus);
  const live = isLive(product.status, product.contentStatus);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <Link href="/admin/products" className="text-sm font-medium text-ink-muted hover:text-ink">
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
          <ProductStatusControls
            id={product.id}
            name={product.name}
            status={product.status}
            hasPublishedContent={product.contentStatus === "published"}
          />
        </div>
      </div>

      <VisibilityExplainer status={product.status} contentPublished={product.contentStatus === "published"} />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card className="divide-y divide-line">
            <div className="p-5">
              <EditNameForm id={product.id} name={product.name} />
            </div>
            <div className="p-5">
              <EditAffiliateUrlForm id={product.id} url={product.activeUrl} />
            </div>
          </Card>

          <Card>
            <div className="border-b border-line px-5 py-4">
              <h2 className="font-display text-xl text-ink">Affiliate link history</h2>
              <p className="text-sm text-ink-muted">Only the active link receives traffic. Previous links are kept for your records.</p>
            </div>
            {product.linkHistory.length > 0 ? (
              <ul className="divide-y divide-line">
                {product.linkHistory.map((link) => (
                  <li key={link.id} className="flex items-start justify-between gap-4 px-5 py-3">
                    <p className="min-w-0 break-all font-mono text-[13px] text-ink">{link.url}</p>
                    <div className="shrink-0 text-right">
                      {link.isActive ? <Badge tone="brand">Active</Badge> : <Badge tone="stone">Retired</Badge>}
                      <p className="mt-1 text-xs text-ink-subtle">{formatDate(link.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-ink-muted">No affiliate links recorded.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="border-b border-line px-5 py-4">
              <h2 className="font-display text-xl text-ink">Affiliate clicks</h2>
              <p className="text-sm text-ink-muted">Clicks on “View official offer”. Sales are tracked by your affiliate network.</p>
            </div>
            <dl className="grid grid-cols-3 divide-x divide-line">
              {[
                { label: "7 days", value: clicks.last7d },
                { label: "30 days", value: clicks.last30d },
                { label: "All time", value: clicks.allTime },
              ].map((stat) => (
                <div key={stat.label} className="px-4 py-4 text-center">
                  <dt className="text-xs text-ink-subtle">{stat.label}</dt>
                  <dd className="mt-1 font-display text-2xl tabular-nums text-ink">{formatNumber(stat.value)}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-line">
              <p className="px-5 pt-4 text-xs font-medium uppercase tracking-wide text-ink-subtle">Latest clicks</p>
              {clicks.recent.length > 0 ? (
                <ul className="divide-y divide-line px-5 pb-2">
                  {clicks.recent.map((click) => (
                    <li key={click.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-ink">{referrerLabel(click.referrer, click.utmSource)}</p>
                        <p className="text-xs text-ink-subtle">
                          {[click.ctaLocation, click.device !== "unknown" ? click.device : null].filter(Boolean).join(" · ") ||
                            "—"}
                        </p>
                      </div>
                      <time dateTime={click.clickedAt} className="shrink-0 text-xs text-ink-muted">
                        {formatDateTime(click.clickedAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 pb-5 pt-2 text-sm text-ink-muted">No clicks recorded yet.</p>
              )}
            </div>
          </Card>

          <Card className="px-5 py-4 text-sm">
            <dl className="space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Added</dt>
                <dd className="text-ink">{formatDate(product.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Last updated</dt>
                <dd className="text-ink">{formatDate(product.updatedAt)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function referrerLabel(referrer: string | null, utmSource: string | null) {
  if (utmSource) return utmSource;
  if (!referrer) return "Direct / unknown source";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return referrer;
  }
}

function VisibilityExplainer({ status, contentPublished }: { status: string; contentPublished: boolean }) {
  let message: string | null = null;
  if (status === "active" && !contentPublished) {
    message = "Active and ready. It appears on the public site as soon as the agency publishes its content.";
  } else if (status === "new" && contentPublished) {
    message = "The agency has published content. Activate the product to put it live on the site.";
  } else if (status === "new") {
    message = "Waiting for the agency to add content. You can activate it now — it goes live once its content is published.";
  }
  if (!message) return null;
  return <p className="rounded-xl border border-line bg-sunken/60 px-4 py-3 text-sm text-ink-muted">{message}</p>;
}
