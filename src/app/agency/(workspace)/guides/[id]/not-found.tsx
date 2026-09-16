import Link from "next/link";
import { buttonStyles, Card } from "@/components/admin/ui";

export default function AgencyGuideNotFound() {
  return (
    <Card className="mx-auto max-w-lg px-6 py-12 text-center">
      <h1 className="font-display text-2xl text-ink">Guide not found</h1>
      <p className="mt-2 text-sm text-ink-muted">It may have been removed, or the link is incorrect.</p>
      <Link href="/agency/guides" className={`${buttonStyles.secondary} mt-6`}>
        Back to guides
      </Link>
    </Card>
  );
}
