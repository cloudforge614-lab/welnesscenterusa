import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";
import { getAgencySession } from "@/lib/auth/agency";
import { loadLandingPreview } from "@/lib/landing/preview-data";

// Authenticated draft preview of a product landing page. Renders the exact
// public template in preview mode (inert CTAs, preview banner). Never
// indexable: noindex here, X-Robots-Tag from the proxy for every /agency
// route, and /agency is disallowed in robots.txt. Signed-out visitors are sent
// to the login page by the proxy before this runs.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false, nocache: true },
};

export default async function LandingPreviewPage(props: PageProps<"/agency/preview/[id]">) {
  const { id } = await props.params;
  const session = await getAgencySession();
  if (session.state !== "agency") notFound();
  const preview = await loadLandingPreview(id);
  if (!preview) notFound();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-ink px-4 py-2 text-sm text-white">
        <span>
          Previewing <strong>{preview.name}</strong> · {preview.wordCount.toLocaleString()} words
          {preview.theme.replaced.length > 0 && " · some theme colours were replaced for contrast"}
        </span>
        <a href={`/agency/products/${id}`} className="underline underline-offset-2">
          Back to the editor
        </a>
      </div>
      <LandingPage data={preview.data} />
    </>
  );
}
