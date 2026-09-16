import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewEditor } from "@/components/agency/review-editor";
import { Badge } from "@/components/admin/ui";
import { getAgencyReview } from "@/lib/reviews/agency-queries";
import { getAgencySession } from "@/lib/auth/agency";
import { contentMeta } from "@/lib/products/status";

export async function generateMetadata(props: PageProps<"/agency/reviews/[id]">) {
  const { id } = await props.params;
  const review = await getAgencyReview(id);
  return { title: review?.title ?? "Review" };
}

export default async function AgencyReviewPage(props: PageProps<"/agency/reviews/[id]">) {
  const { id } = await props.params;
  const [review, session] = await Promise.all([getAgencyReview(id), getAgencySession()]);
  if (!review) notFound();
  if (session.state !== "agency") notFound();

  const meta = contentMeta(review.status);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <Link href="/agency/reviews" className="text-sm font-medium text-ink-muted hover:text-ink">
          ← Reviews
        </Link>
        <div className="mt-3 min-w-0">
          <h1 className="break-words font-display text-3xl text-ink">{review.title}</h1>
          <p className="mt-1 text-sm text-ink-subtle">
            Reviewing{" "}
            <Link href={`/agency/products/${review.product.id}`} className="font-medium text-brand-700 hover:text-brand-800">
              {review.product.name}
            </Link>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </div>
        </div>
        <p className="mt-3 rounded-xl border border-line bg-sunken/60 px-4 py-3 text-sm text-ink-muted">
          The review title, slug, and which product it reviews are set when the review is created. Publishing here
          makes it visible on the public site immediately — a review does not depend on the product&apos;s own
          status.
        </p>
      </div>

      <ReviewEditor review={review} role={session.role} />
    </div>
  );
}
