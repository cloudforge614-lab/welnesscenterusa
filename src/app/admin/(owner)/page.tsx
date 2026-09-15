import Link from "next/link";
import type { ReactNode } from "react";
import { AddProductButton } from "@/components/admin/add-product-dialog";
import { ProductTable } from "@/components/admin/product-table";
import { Card, EmptyState, formatNumber, PageHeader } from "@/components/admin/ui";
import { getDashboardStats, listProducts } from "@/lib/products/queries";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [stats, recent] = await Promise.all([
    getDashboardStats(),
    listProducts({ q: "", filter: "all", page: 1 }),
  ]);

  return (
    <div className="space-y-8 animate-fade-up">
      <PageHeader
        title="Dashboard"
        description="Your products at a glance. Add one and the agency takes it from there."
        action={<AddProductButton label="Add product" className="px-5 py-3 text-[15px]" />}
      />

      <section aria-label="Product summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard
          label="Total products"
          value={stats.total}
          href="/admin/products"
          footnote={`${formatNumber(stats.live)} live on site`}
        />
        <StatCard label="Active" value={stats.active} href="/admin/products?status=active" tone="brand" />
        <StatCard
          label="Awaiting agency"
          value={stats.awaitingAgency}
          href="/admin/products?status=awaiting"
          tone="amber"
          footnote="No published content yet"
        />
        <StatCard label="Paused" value={stats.paused} href="/admin/products?status=paused" tone="stone" />
        <StatCard
          label="Affiliate clicks"
          value={stats.clicksAllTime}
          footnote={`${formatNumber(stats.clicks30d)} in the last 30 days`}
          className="col-span-2 lg:col-span-1"
        />
      </section>

      <Card>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-xl text-ink">Recent products</h2>
            <p className="text-sm text-ink-muted">
              {stats.newCount > 0 ? `${formatNumber(stats.newCount)} new, not yet activated` : "Newest first"}
            </p>
          </div>
          {recent.totalCount > 0 && (
            <Link href="/admin/products" className="text-sm font-medium text-brand-700 hover:text-brand-800">
              View all →
            </Link>
          )}
        </div>
        {recent.items.length > 0 ? (
          <ProductTable items={recent.items.slice(0, 6)} compact />
        ) : (
          <EmptyState
            title="No products yet"
            description="Add your first product with just its name and affiliate link. It appears here instantly."
            action={<AddProductButton label="Add your first product" />}
          />
        )}
      </Card>
    </div>
  );
}

const toneAccent = {
  default: "bg-line-strong",
  brand: "bg-brand-500",
  amber: "bg-amber-ink/60",
  stone: "bg-stone-ink/40",
};

function StatCard({
  label,
  value,
  href,
  footnote,
  tone = "default",
  className = "",
}: {
  label: string;
  value: number;
  href?: string;
  footnote?: string;
  tone?: keyof typeof toneAccent;
  className?: string;
}) {
  const body: ReactNode = (
    <>
      <span className={`absolute inset-x-5 top-0 h-0.5 rounded-b-full ${toneAccent[tone]}`} aria-hidden />
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums leading-none text-ink">{formatNumber(value)}</p>
      {footnote && <p className="mt-2 text-xs text-ink-subtle">{footnote}</p>}
    </>
  );

  const base = `relative block rounded-2xl border border-line bg-surface p-5 shadow-card ${className}`;
  return href ? (
    <Link href={href} className={`${base} transition hover:border-line-strong hover:shadow-pop focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100`}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}
