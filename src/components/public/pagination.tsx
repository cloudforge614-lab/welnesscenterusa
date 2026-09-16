import Link from "next/link";
import { cx, formatNumber } from "@/lib/format";

export function Pagination({
  page,
  pageCount,
  totalCount,
  pageSize,
  basePath,
  query,
  itemLabel = "products",
}: {
  page: number;
  pageCount: number;
  totalCount: number;
  pageSize: number;
  basePath: string;
  /** Extra query params to preserve across page links, e.g. { q: "vitamin" }. */
  query?: Record<string, string>;
  /** Plural noun for the count line, e.g. "reviews", "guides". Defaults to "products". */
  itemLabel?: string;
}) {
  if (totalCount === 0) return null;

  const firstRow = (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, totalCount);
  const href = (p: number) => {
    const params = new URLSearchParams(query);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <nav aria-label={`${itemLabel} pages`} className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <p className="text-sm text-ink-muted">
        {formatNumber(firstRow)}–{formatNumber(lastRow)} of {formatNumber(totalCount)} {itemLabel}
      </p>
      {pageCount > 1 && (
        <div className="flex gap-2">
          <PageLink href={href(page - 1)} disabled={page <= 1}>
            Previous
          </PageLink>
          <PageLink href={href(page + 1)} disabled={page >= pageCount}>
            Next
          </PageLink>
        </div>
      )}
    </nav>
  );
}

const linkStyles =
  "inline-flex items-center justify-center rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium text-ink shadow-card transition hover:bg-sunken focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100";

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: string }) {
  if (disabled) {
    return (
      <span aria-disabled className={cx(linkStyles, "pointer-events-none opacity-50")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={linkStyles}>
      {children}
    </Link>
  );
}
