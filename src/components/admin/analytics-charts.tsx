import Link from "next/link";
import { cx, formatNumber } from "./ui";
import type { ClickBreakdownItem, ClickTrendPoint, ProductBreakdownItem } from "@/lib/analytics/owner-clicks";

// No charting library exists anywhere in this project (checked package.json)
// and this dashboard needs exactly two shapes — a day-by-day trend and a
// ranked breakdown — so both are built as plain, server-rendered SVG/CSS
// rather than adding a dependency for two chart types.

const CHART_HEIGHT = 120;

/** A day-by-day click trend as a bar chart. Server-rendered SVG — no client JS. */
export function TrendChart({ points }: { points: ClickTrendPoint[] }) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => p.count));
  const barWidth = 100 / points.length;

  return (
    <div>
      <svg
        viewBox={`0 0 100 ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-32 w-full overflow-visible"
        role="img"
        aria-label={`Clicks per day, ${points[0].day} to ${points[points.length - 1].day}`}
      >
        {points.map((p, i) => {
          const barHeight = (p.count / max) * (CHART_HEIGHT - 4);
          const x = i * barWidth;
          return (
            <rect
              key={p.day}
              x={x + barWidth * 0.12}
              y={CHART_HEIGHT - barHeight}
              width={Math.max(0.4, barWidth * 0.76)}
              height={Math.max(barHeight, p.count > 0 ? 1.5 : 0)}
              rx={barWidth > 3 ? 0.6 : 0}
              className={p.count > 0 ? "fill-brand-500" : "fill-line"}
            >
              <title>
                {p.day}: {formatNumber(p.count)} click{p.count === 1 ? "" : "s"}
              </title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-ink-subtle">
        <span>{points[0].day}</span>
        {points.length > 2 && <span>{points[points.length - 1].day}</span>}
      </div>
    </div>
  );
}

type RankedItem = ClickBreakdownItem | ProductBreakdownItem;

function isProductItem(item: RankedItem): item is ProductBreakdownItem {
  return "productId" in item;
}

/** A ranked horizontal-bar breakdown — product, CTA, device, referrer, or UTM value vs. click count. */
export function RankedList({
  items,
  emptyMessage,
  linkForProduct,
}: {
  items: RankedItem[];
  emptyMessage: string;
  /** When items are ProductBreakdownItem, renders each row's label as a link using this. */
  linkForProduct?: (productId: string) => string;
}) {
  if (items.length === 0) {
    return <p className="px-5 py-6 text-sm text-ink-subtle">{emptyMessage}</p>;
  }

  const max = Math.max(...items.map((i) => i.count));

  return (
    <ul className="divide-y divide-line">
      {items.map((item, i) => {
        const key = isProductItem(item) ? item.productId : `${item.value}-${i}`;
        const label = isProductItem(item) ? item.name : item.value;
        const href = isProductItem(item) && linkForProduct ? linkForProduct(item.productId) : undefined;
        const widthPct = Math.max(4, (item.count / max) * 100);

        return (
          <li key={key} className="relative px-5 py-2.5">
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 bg-brand-50"
              style={{ width: `${widthPct}%` }}
            />
            <div className="relative flex items-center justify-between gap-3">
              {href ? (
                <Link href={href} className="min-w-0 truncate text-sm font-medium text-ink hover:text-brand-700" title={label}>
                  {label}
                </Link>
              ) : (
                <span className="min-w-0 truncate text-sm text-ink" title={label}>
                  {label}
                </span>
              )}
              <span className="shrink-0 text-sm font-medium tabular-nums text-ink-muted">{formatNumber(item.count)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function SummaryStat({ label, value, footnote, className }: { label: string; value: number; footnote?: string; className?: string }) {
  return (
    <div className={cx("relative rounded-2xl border border-line bg-surface p-5 shadow-card", className)}>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 font-display text-4xl tabular-nums leading-none text-ink">{formatNumber(value)}</p>
      {footnote && <p className="mt-2 text-xs text-ink-subtle">{footnote}</p>}
    </div>
  );
}
