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
    console.error("[agency comparisons action] unexpected error", error);
    return fail("Something went wrong. Please try again.");
  }
}

function clip(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return v ? v.slice(0, max) : null;
}

function refresh(comparisonId?: string) {
  // Public cache: Includes comparison_products ordering and membership.
  // TAGS.redirects: a slug change writes a historical-redirect row via the
  // record_slug_change() trigger (0019), so the same action has to invalidate
  // the redirect lookup alongside the content it changed.
  revalidatePublic(TAGS.comparisons, TAGS.seo, TAGS.redirects);
  revalidatePath("/agency/comparisons");
  if (comparisonId) revalidatePath(`/agency/comparisons/${comparisonId}`);
}

// Reuses the same product picker Reviews/Guides/Articles all use.
export async function searchProductsForComparison(query: string) {
  return withAgency<{ id: string; name: string; status: string }[]>(async () => {
    await assertAgency();
    const results = await searchProductsForPicker(query);
    return { ok: true, message: "", data: results };
  });
}

export async function createComparison(input: { title: unknown }) {
  return withAgency<{ id: string }>(async () => {
    const title = clip(input.title, 200);
    if (!title) return fail("Enter a comparison title.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't create comparisons.");

    const { data, error } = await supabase
      .from("comparisons")
      // slug: "" — comparisons_before_insert_slug fills a real slug from the
      // title; the generated Insert type doesn't know about that trigger.
      .insert({ title, slug: "" })
      .select("id")
      .single();
    if (error) return fail("Couldn't create that comparison. Please try again.");

    refresh();
    return { ok: true, message: "Comparison created", data: { id: data.id } };
  });
}

export async function updateComparisonContent(input: { comparisonId: unknown; content: unknown }) {
  return withAgency(async () => {
    const comparisonId = typeof input?.comparisonId === "string" ? input.comparisonId : "";
    if (!isUuid(comparisonId)) return fail("That comparison doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't edit comparison content.");

    const { error } = await supabase.from("comparisons").update({ content: clip(input.content, 20000) }).eq("id", comparisonId);
    if (error) return fail("Something went wrong saving your change. Please try again.");

    refresh(comparisonId);
    return { ok: true, message: "Saved" };
  });
}

export async function setComparisonStatus(input: { comparisonId: unknown; status: "draft" | "published" }) {
  return withAgency(async () => {
    const comparisonId = typeof input?.comparisonId === "string" ? input.comparisonId : "";
    if (!isUuid(comparisonId)) return fail("That comparison doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't publish comparisons.");

    const { error } = await supabase
      .from("comparisons")
      .update(input.status === "published" ? { status: input.status, published_at: new Date().toISOString() } : { status: input.status })
      .eq("id", comparisonId);
    if (error) return fail("Something went wrong. Please try again.");

    refresh(comparisonId);
    return { ok: true, message: input.status === "published" ? "Comparison published" : "Comparison moved back to draft" };
  });
}

export async function updateComparisonSeo(input: {
  comparisonId: unknown;
  title: unknown;
  metaDescription: unknown;
  ogTitle: unknown;
  ogDescription: unknown;
  robotsIndex: unknown;
  robotsFollow: unknown;
}) {
  return withAgency(async () => {
    const comparisonId = typeof input?.comparisonId === "string" ? input.comparisonId : "";
    if (!isUuid(comparisonId)) return fail("That comparison doesn't exist.");
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
      .eq("entity_type", "comparison")
      .eq("entity_id", comparisonId)
      .maybeSingle();
    if (existingErr) return fail("Something went wrong saving SEO metadata.");

    const result = existing
      ? await supabase.from("seo_metadata").update(fields).eq("entity_type", "comparison").eq("entity_id", comparisonId)
      : await supabase.from("seo_metadata").insert({ entity_type: "comparison", entity_id: comparisonId, ...fields });
    if (result.error) return fail("Something went wrong saving SEO metadata.");

    refresh(comparisonId);
    return { ok: true, message: "SEO metadata saved" };
  });
}

export async function addComparisonProduct(input: { comparisonId: unknown; productId: unknown }) {
  return withAgency(async () => {
    const comparisonId = typeof input?.comparisonId === "string" ? input.comparisonId : "";
    const productId = typeof input?.productId === "string" ? input.productId : "";
    if (!isUuid(comparisonId) || !isUuid(productId)) return fail("That product doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't manage compared products.");

    const { count } = await supabase.from("comparison_products").select("product_id", { count: "exact", head: true }).eq("comparison_id", comparisonId);
    const { error } = await supabase.from("comparison_products").insert({ comparison_id: comparisonId, product_id: productId, position: count ?? 0 });
    if (error) return fail("Couldn't add that product.");

    refresh(comparisonId);
    return { ok: true, message: "Product added" };
  });
}

export async function removeComparisonProduct(input: { comparisonId: unknown; productId: unknown }) {
  return withAgency(async () => {
    const comparisonId = typeof input?.comparisonId === "string" ? input.comparisonId : "";
    const productId = typeof input?.productId === "string" ? input.productId : "";
    if (!isUuid(comparisonId) || !isUuid(productId)) return fail("That product doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't manage compared products.");

    const { error } = await supabase.from("comparison_products").delete().eq("comparison_id", comparisonId).eq("product_id", productId);
    if (error) return fail("Couldn't remove that product.");

    refresh(comparisonId);
    return { ok: true, message: "Product removed" };
  });
}

// Swaps this product's position with its immediate neighbor in the
// requested direction — the smallest change that gives a stable, gap-free
// reorder without renumbering the whole list.
export async function moveComparisonProduct(input: { comparisonId: unknown; productId: unknown; direction: "up" | "down" }) {
  return withAgency(async () => {
    const comparisonId = typeof input?.comparisonId === "string" ? input.comparisonId : "";
    const productId = typeof input?.productId === "string" ? input.productId : "";
    if (!isUuid(comparisonId) || !isUuid(productId)) return fail("That product doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't manage compared products.");

    const { data: rows, error: listError } = await supabase
      .from("comparison_products")
      .select("product_id, position")
      .eq("comparison_id", comparisonId)
      .order("position", { ascending: true });
    if (listError || !rows) return fail("Couldn't reorder that product.");

    const index = rows.findIndex((r) => r.product_id === productId);
    const swapIndex = input.direction === "up" ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= rows.length) return { ok: true, message: "Already at the edge" };

    const a = rows[index];
    const b = rows[swapIndex];
    const [err1, err2] = await Promise.all([
      supabase.from("comparison_products").update({ position: b.position }).eq("comparison_id", comparisonId).eq("product_id", a.product_id).then((r) => r.error),
      supabase.from("comparison_products").update({ position: a.position }).eq("comparison_id", comparisonId).eq("product_id", b.product_id).then((r) => r.error),
    ]);
    if (err1 || err2) return fail("Couldn't reorder that product.");

    refresh(comparisonId);
    return { ok: true, message: "Order updated" };
  });
}
