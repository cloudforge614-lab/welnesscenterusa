import Link from "next/link";
import { notFound } from "next/navigation";
import { ComparisonEditor } from "@/components/agency/comparison-editor";
import { Badge } from "@/components/admin/ui";
import { getAgencyComparison } from "@/lib/comparisons/agency-queries";
import { getAgencySession } from "@/lib/auth/agency";
import { contentMeta } from "@/lib/products/status";

export async function generateMetadata(props: PageProps<"/agency/comparisons/[id]">) {
  const { id } = await props.params;
  const comparison = await getAgencyComparison(id);
  return { title: comparison?.title ?? "Comparison" };
}

export default async function AgencyComparisonPage(props: PageProps<"/agency/comparisons/[id]">) {
  const { id } = await props.params;
  const [comparison, session] = await Promise.all([getAgencyComparison(id), getAgencySession()]);
  if (!comparison) notFound();
  if (session.state !== "agency") notFound();

  const meta = contentMeta(comparison.status);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <Link href="/agency/comparisons" className="text-sm font-medium text-ink-muted hover:text-ink">
          ← Comparisons
        </Link>
        <div className="mt-3 min-w-0">
          <h1 className="break-words font-display text-3xl text-ink">{comparison.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
        </div>
        <p className="mt-3 rounded-xl border border-line bg-sunken/60 px-4 py-3 text-sm text-ink-muted">
          Publishing here makes this comparison visible on the public site immediately. Each compared product only
          appears publicly while it&apos;s itself eligible — a paused, archived, or unpublished product is skipped,
          not shown.
        </p>
      </div>

      <ComparisonEditor comparison={comparison} role={session.role} />
    </div>
  );
}
