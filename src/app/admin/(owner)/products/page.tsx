import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AddProductButton } from "@/components/admin/add-product-dialog";
import { ProductTable } from "@/components/admin/product-table";
import { buttonStyles, Card, cx, EmptyState, formatNumber, inputStyles, PageHeader } from "@/components/admin/ui";
import { listProducts, PAGE_SIZE, sanitizeSearch } from "@/lib/products/queries";
import { parseStatusFilter, STATUS_FILTERS, type StatusFilter } from "@/lib/products/status";

export const metadata = { title: "Products" };

function hrefFor(params: { q: string; status: StatusFilter; page?: number }) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status !== "all") search.set("status", params.status);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return qs ? `/admin/products?${qs}` : "/admin/products";
}

export default async function ProductsPage(props: PageProps<"/admin/products">) {
  const searchParams = await props.searchParams;
  const q = sanitizeSearch(searchParams.q);
  const status = parseStatusFilter(searchParams.status);
  const requestedPage = Number.parseInt(String(searchParams.page ?? "1"), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10_000) : 1;

  const { items, totalCount, pageCount, outOfRange } = await listProducts({ q, filter: status, page });
  if (outOfRange && totalCount > 0) redirect(hrefFor({ q, status, page: pageCount }));
  const firstRow = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, totalCount);
  const filtered = q !== "" || status !== "all";

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader
        title="Products"
        description="Everything you've added. Click a product to edit its name, link or status."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/products/bulk-import" className={buttonStyles.secondary}>
              Bulk import
            </Link>
            <AddProductButton />
          </div>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:p-5">
          <Form action="/admin/products" className="flex gap-2" role="search">
            {status !== "all" && <input type="hidden" name="status" value={status} />}
            <label htmlFor="product-search" className="sr-only">
              Search products
            </label>
            <div className="relative flex-1">
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                id="product-search"
                name="q"
                type="search"
                defaultValue={q}
                key={q}
                placeholder="Search by name or URL slug"
                className={cx(inputStyles, "py-2 pl-9")}
                maxLength={100}
              />
            </div>
            <button type="submit" className={buttonStyles.secondary}>
              Search
            </button>
          </Form>

          <nav aria-label="Filter by status" className="-mx-1 flex gap-1 overflow-x-auto pb-0.5">
            {STATUS_FILTERS.map((filter) => {
              const active = filter.value === status;
              return (
                <Link
                  key={filter.value}
                  href={hrefFor({ q, status: filter.value })}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition",
                    active ? "bg-brand-700 text-white" : "text-ink-muted hover:bg-sunken hover:text-ink",
                  )}
                >
                  {filter.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {items.length > 0 ? (
          <ProductTable items={items} />
        ) : filtered ? (
          <EmptyState
            title="No matching products"
            description={q ? `Nothing matches “${q}” with this filter.` : "No products have this status right now."}
            action={
              <Link href="/admin/products" className={buttonStyles.secondary}>
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="No products yet"
            description="Add a product with its name and affiliate link — it shows up here immediately."
            action={<AddProductButton label="Add your first product" />}
          />
        )}

        {totalCount > 0 && (
          <div className="flex items-center justify-between gap-4 border-t border-line px-5 py-3 text-sm text-ink-muted">
            <p>
              {formatNumber(firstRow)}–{formatNumber(lastRow)} of {formatNumber(totalCount)}
            </p>
            {pageCount > 1 && (
              <div className="flex gap-2">
                <PageLink href={hrefFor({ q, status, page: page - 1 })} disabled={page <= 1}>
                  Previous
                </PageLink>
                <PageLink href={hrefFor({ q, status, page: page + 1 })} disabled={page >= pageCount}>
                  Next
                </PageLink>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: string }) {
  if (disabled) {
    return (
      <span aria-disabled className={cx(buttonStyles.secondary, "pointer-events-none opacity-50")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={buttonStyles.secondary}>
      {children}
    </Link>
  );
}
