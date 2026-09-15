import Link from "next/link";
import { contentMeta, isLive, STATUS_META } from "@/lib/products/status";
import type { ProductListItem } from "@/lib/products/queries";
import { Badge, formatDate, formatNumber } from "./ui";

export function ProductTable({ items, compact = false }: { items: ProductListItem[]; compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-xs font-medium uppercase tracking-wide text-ink-subtle">
            <th scope="col" className="px-5 py-3 font-medium">
              Product
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              Status
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              Content
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              Clicks
            </th>
            {!compact && (
              <th scope="col" className="px-5 py-3 text-right font-medium">
                Added
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((product) => {
            const status = STATUS_META[product.status];
            const content = contentMeta(product.contentStatus);
            const live = isLive(product.status, product.contentStatus);
            return (
              <tr key={product.id} className="group transition hover:bg-canvas">
                <td className="px-5 py-3.5">
                  <Link href={`/admin/products/${product.id}`} className="block focus-visible:outline-none">
                    <span className="flex items-center gap-2 font-medium text-ink group-hover:text-brand-700">
                      {product.name}
                      {live && (
                        <span className="rounded-full bg-brand-600 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-white">
                          Live
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block font-mono text-xs text-ink-subtle">/products/{product.slug}</span>
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <Badge tone={status.tone}>{status.label}</Badge>
                </td>
                <td className="px-5 py-3.5">
                  <Badge tone={content.tone} dot={false}>
                    {content.label}
                  </Badge>
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-ink">{formatNumber(product.clicks)}</td>
                {!compact && <td className="px-5 py-3.5 text-right text-ink-muted">{formatDate(product.createdAt)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
