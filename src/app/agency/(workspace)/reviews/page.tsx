import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AddReviewButton } from "@/components/agency/add-review-dialog";
import { Badge, buttonStyles, Card, cx, EmptyState, formatDate, formatNumber, inputStyles, PageHeader } from "@/components/admin/ui";
import { contentMeta } from "@/lib/products/status";
import { PAGE_SIZE, sanitizeSearch } from "@/lib/products/queries";
import { listAgencyReviews } from "@/lib/reviews/agency-queries";

export const metadata = { title: "Reviews" };

function hrefFor(params: { q: string; page?: number }) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return qs ? `/agency/reviews?${qs}` : "/agency/reviews";
}

export default async function AgencyReviewsPage(props: PageProps<"/agency/reviews">) {
  const searchParams = await props.searchParams;
  const q = sanitizeSearch(searchParams.q);
  const requestedPage = Number.parseInt(String(searchParams.page ?? "1"), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10_000) : 1;

  const { items, totalCount, pageCount, outOfRange } = await listAgencyReviews({ q, page });
  if (outOfRange && totalCount > 0) redirect(hrefFor({ q, page: pageCount }));
  const firstRow = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div className="space-y-6 animate-fade-up">
      <PageHeader title="Reviews" description="Independent product reviews. Publishing here makes a review public immediately." action={<AddReviewButton />} />

      <Card>
        <div className="border-b border-line p-4 sm:p-5">
          <Form action="/agency/reviews" className="flex gap-2" role="search">
            <label htmlFor="review-search" className="sr-only">
              Search reviews
            </label>
            <input id="review-search" name="q" type="search" defaultValue={q} key={q} placeholder="Search by title or slug" className={cx(inputStyles, "py-2")} maxLength={100} />
            <button type="submit" className={buttonStyles.secondary}>
              Search
            </button>
          </Form>
        </div>

        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  <th className="px-5 py-3">Review</th>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Last updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((r) => {
                  const meta = contentMeta(r.status);
                  return (
                    <tr key={r.id} className="transition hover:bg-sunken">
                      <td className="px-5 py-3.5">
                        <Link href={`/agency/reviews/${r.id}`} className="font-medium text-ink hover:text-brand-700">
                          {r.title}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted">{r.product.name}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-ink-muted">{formatDate(r.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : q ? (
          <EmptyState title="No matching reviews" description={`Nothing matches “${q}”.`} action={<Link href="/agency/reviews" className={buttonStyles.secondary}>Clear search</Link>} />
        ) : (
          <EmptyState title="No reviews yet" description="Add your first review — pick a product and start writing." action={<AddReviewButton />} />
        )}

        {totalCount > 0 && (
          <div className="flex items-center justify-between gap-4 border-t border-line px-5 py-3 text-sm text-ink-muted">
            <p>
              {formatNumber(firstRow)}–{formatNumber(lastRow)} of {formatNumber(totalCount)}
            </p>
            {pageCount > 1 && (
              <div className="flex gap-2">
                <PageLink href={hrefFor({ q, page: page - 1 })} disabled={page <= 1}>
                  Previous
                </PageLink>
                <PageLink href={hrefFor({ q, page: page + 1 })} disabled={page >= pageCount}>
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
