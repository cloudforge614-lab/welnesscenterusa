import Link from "next/link";
import { notFound } from "next/navigation";
import { GuideEditor } from "@/components/agency/guide-editor";
import { Badge } from "@/components/admin/ui";
import { getAgencyGuide } from "@/lib/guides/agency-queries";
import { getAgencySession } from "@/lib/auth/agency";
import { contentMeta } from "@/lib/products/status";

export async function generateMetadata(props: PageProps<"/agency/guides/[id]">) {
  const { id } = await props.params;
  const guide = await getAgencyGuide(id);
  return { title: guide?.title ?? "Guide" };
}

export default async function AgencyGuidePage(props: PageProps<"/agency/guides/[id]">) {
  const { id } = await props.params;
  const [guide, session] = await Promise.all([getAgencyGuide(id), getAgencySession()]);
  if (!guide) notFound();
  if (session.state !== "agency") notFound();

  const meta = contentMeta(guide.status);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <Link href="/agency/guides" className="text-sm font-medium text-ink-muted hover:text-ink">
          ← Guides
        </Link>
        <div className="mt-3 min-w-0">
          <h1 className="break-words font-display text-3xl text-ink">{guide.title}</h1>
          {guide.category && <p className="mt-1 text-sm text-ink-subtle">{guide.category.name}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
        </div>
        <p className="mt-3 rounded-xl border border-line bg-sunken/60 px-4 py-3 text-sm text-ink-muted">
          Publishing here makes this guide visible on the public site immediately — a guide does not depend on any
          product&apos;s status. Related products only appear publicly while they&apos;re themselves eligible.
        </p>
      </div>

      <GuideEditor guide={guide} role={session.role} />
    </div>
  );
}
