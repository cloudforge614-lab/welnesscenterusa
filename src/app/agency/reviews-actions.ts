"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublic, TAGS } from "@/lib/cache/tags";
import { assertAgency, assertSeoWriter, NotAgencyError } from "@/lib/auth/agency";
import { isUuid } from "@/lib/products/queries";
import { searchProductsForPicker } from "@/lib/reviews/agency-queries";

export type ActionResult<T = unknown> = { ok: true; message: string; data?: T } | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

async function withAgency<T>(run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof NotAgencyError) return fail("Your account doesn't have access to do that.");
    console.error("[agency reviews action] unexpected error", error);
    return fail("Something went wrong. Please try again.");
  }
}

function clip(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return v ? v.slice(0, max) : null;
}

function stringList(raw: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .slice(0, maxItems)
    .map((v) => v.trim().slice(0, maxLen));
}

function refresh(reviewId?: string) {
  // Public cache: A review's own status gates it; its parent product's eligibility is
  // re-checked at read time, so no product tag is needed here.
  // TAGS.redirects: a slug change writes a historical-redirect row via the
  // record_slug_change() trigger (0019), so the same action has to invalidate
  // the redirect lookup alongside the content it changed.
  revalidatePublic(TAGS.reviews, TAGS.seo, TAGS.redirects);
  revalidatePath("/agency/reviews");
  if (reviewId) revalidatePath(`/agency/reviews/${reviewId}`);
}

export async function searchProductsForReview(query: string) {
  return withAgency<{ id: string; name: string; status: string }[]>(async () => {
    await assertAgency();
    const results = await searchProductsForPicker(query);
    return { ok: true, message: "", data: results };
  });
}

export async function createReview(input: { productId: unknown; title: unknown }) {
  return withAgency<{ id: string }>(async () => {
    const productId = typeof input?.productId === "string" ? input.productId : "";
    const title = clip(input.title, 200);
    if (!isUuid(productId)) return fail("Choose a product to review.");
    if (!title) return fail("Enter a review title.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't create reviews.");

    const { data, error } = await supabase
      .from("reviews")
      // slug: "" — the reviews_before_insert_slug trigger fills a real slug
      // from the title when it sees an empty/null value; the generated
      // Insert type doesn't know about that DB-side default, so it must be
      // passed explicitly.
      .insert({ product_id: productId, title, author_id: session.userId, slug: "" })
      .select("id")
      .single();
    if (error) return fail("Couldn't create that review. Please try again.");

    refresh();
    return { ok: true, message: "Review created", data: { id: data.id } };
  });
}

export async function updateReviewContent(input: { reviewId: unknown; content: unknown; pros: unknown; considerations: unknown }) {
  return withAgency(async () => {
    const reviewId = typeof input?.reviewId === "string" ? input.reviewId : "";
    if (!isUuid(reviewId)) return fail("That review doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't edit review content.");

    const { error } = await supabase
      .from("reviews")
      .update({
        content: clip(input.content, 20000),
        pros: stringList(input.pros, 20, 200),
        considerations: stringList(input.considerations, 20, 200),
      })
      .eq("id", reviewId);
    if (error) return fail("Something went wrong saving your change. Please try again.");

    refresh(reviewId);
    return { ok: true, message: "Saved" };
  });
}

export async function setReviewStatus(input: { reviewId: unknown; status: "draft" | "published" }) {
  return withAgency(async () => {
    const reviewId = typeof input?.reviewId === "string" ? input.reviewId : "";
    if (!isUuid(reviewId)) return fail("That review doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't publish reviews.");

    const { error } = await supabase
      .from("reviews")
      .update(
        input.status === "published"
          ? { status: input.status, published_at: new Date().toISOString() }
          : { status: input.status },
      )
      .eq("id", reviewId);
    if (error) return fail("Something went wrong. Please try again.");

    refresh(reviewId);
    return { ok: true, message: input.status === "published" ? "Review published" : "Review moved back to draft" };
  });
}

export async function updateReviewSeo(input: {
  reviewId: unknown;
  title: unknown;
  metaDescription: unknown;
  ogTitle: unknown;
  ogDescription: unknown;
  robotsIndex: unknown;
  robotsFollow: unknown;
}) {
  return withAgency(async () => {
    const reviewId = typeof input?.reviewId === "string" ? input.reviewId : "";
    if (!isUuid(reviewId)) return fail("That review doesn't exist.");
    const { session, supabase } = await assertSeoWriter();

    const fields = {
      title: clip(input.title, 70),
      meta_description: clip(input.metaDescription, 160),
      og_title: clip(input.ogTitle, 70),
      og_description: clip(input.ogDescription, 160),
      robots_index: input.robotsIndex !== false,
      robots_follow: input.robotsFollow !== false,
      updated_by: session.userId,
    };

    const { data: existing, error: existingErr } = await supabase
      .from("seo_metadata")
      .select("id")
      .eq("entity_type", "review")
      .eq("entity_id", reviewId)
      .maybeSingle();
    if (existingErr) return fail("Something went wrong saving SEO metadata.");

    const result = existing
      ? await supabase.from("seo_metadata").update(fields).eq("entity_type", "review").eq("entity_id", reviewId)
      : await supabase.from("seo_metadata").insert({ entity_type: "review", entity_id: reviewId, ...fields });
    if (result.error) return fail("Something went wrong saving SEO metadata.");

    refresh(reviewId);
    return { ok: true, message: "SEO metadata saved" };
  });
}
