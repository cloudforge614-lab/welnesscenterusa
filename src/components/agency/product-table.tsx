import Link from "next/link";
import { Badge, formatDate } from "@/components/admin/ui";
import { STATUS_META, contentMeta } from "@/lib/products/status";
import type { AgencyProductListItem } from "@/lib/products/agency-queries";

export function AgencyProductTable({ items }: { items: AgencyProductListItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-ink-subtle">
            <th className="px-5 py-3">Product</th>
            <th className="px-5 py-3">Owner status</th>
            <th className="px-5 py-3">Content</th>
            <th className="px-5 py-3">Last updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((item) => {
            const productStatus = STATUS_META[item.productStatus];
            const content = contentMeta(item.contentStatus);
            return (
              <tr key={item.id} className="transition hover:bg-sunken">
                <td className="px-5 py-3.5">
                  <Link href={`/agency/products/${item.id}`} className="font-medium text-ink hover:text-brand-700">
                    {item.name}
                  </Link>
                  <p className="text-xs text-ink-subtle">/{item.slug}</p>
                </td>
                <td className="px-5 py-3.5">
                  <Badge tone={productStatus.tone}>{productStatus.label}</Badge>
                </td>
                <td className="px-5 py-3.5">
                  <Badge tone={content.tone}>{content.label}</Badge>
                </td>
                <td className="px-5 py-3.5 text-ink-muted">{formatDate(item.updatedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
