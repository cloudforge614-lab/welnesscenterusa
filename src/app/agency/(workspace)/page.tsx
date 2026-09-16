import Link from "next/link";
import { Card, EmptyState, formatDate, formatNumber, PageHeader } from "@/components/admin/ui";
import { contentMeta } from "@/lib/products/status";
import { getAgencyDashboardStats, listAgencyProducts } from "@/lib/products/agency-queries";

export const metadata = { title: "Dashboard" };

export default async function AgencyDashboardPage() {
  const [stats, recent] = await Promise.all([
    getAgencyDashboardStats(),
    listAgencyProducts({ q: "", filter: "all", page: 1 }),
  ]);

  return (
    <div className="space-y-8 animate-fade-up">
      <PageHeader title="Dashboard" description="Content status across every product. No affiliate or click data lives here." />

      <section aria-label="Content summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total products" value={stats.total} href="/agency/products" />
        <StatCard label="Needs content" value={stats.needsContent} href="/agency/products?filter=needs_content" tone="amber" />
        <StatCard label="Draft" value={stats.draft} href="/agency/products?filter=draft" tone="sky" />
        <StatCard label="Published" value={stats.published} href="/agency/products?filter=published" tone="brand" />
      </section>

      <Card>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-xl text-ink">Recently updated</h2>
            <p className="text-sm text-ink-muted">Most recently touched content, newest first</p>
          </div>
          {recent.totalCount > 0 && (
            <Link href="/agency/products" className="text-sm font-medium text-brand-700 hover:text-brand-800">
              View all →
            </Link>
          )}
        </div>
        {recent.items.length > 0 ? (
          <ul className="divide-y divide-line">
            {recent.items.slice(0, 8).map((item) => {
              const meta = contentMeta(item.contentStatus);
              return (
                <li key={item.id}>
                  <Link
                    href={`/agency/products/${item.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-sunken"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                      <p className="text-xs text-ink-subtle">Updated {formatDate(item.updatedAt)}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.tone === "brand" ? "bg-brand-50 text-brand-700" : meta.tone === "sky" ? "bg-sky-soft text-sky-ink" : "bg-amber-soft text-amber-ink"}`}
                    >
                      {meta.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="No products yet" description="Once the owner adds a product, it appears here for you to write content." />
        )}
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: number;
  href: string;
  tone?: "default" | "brand" | "amber" | "sky";
}) {
  const accent = { default: "bg-line-strong", brand: "bg-brand-500", amber: "bg-amber-ink/60", sky: "bg-sky-ink/60" }[tone];
  return (
    <Link
      href={href}
      className="relative block rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:border-line-strong hover:shadow-pop focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
    >
      <span className={`absolute inset-x-5 top-0 h-0.5 rounded-b-full ${accent}`} aria-hidden />
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums leading-none text-ink">{formatNumber(value)}</p>
    </Link>
  );
}
