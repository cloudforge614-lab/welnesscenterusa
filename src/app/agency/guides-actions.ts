"use server";

import { revalidatePath } from "next/cache";
import { assertAgency, assertSeoWriter, NotAgencyError } from "@/lib/auth/agency";
import { isUuid } from "@/lib/products/queries";
import { searchProductsForPicker } from "@/lib/reviews/agency-queries";
import { listCategoriesForPicker } from "@/lib/guides/agency-queries";

export type ActionResult<T = unknown> = { ok: true; message: string; data?: T } | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

async function withAgency<T>(run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof NotAgencyError) return fail("Your account doesn't have access to do that.");
    console.error("[agency guides action] unexpected error", error);
    return fail("Something went wrong. Please try again.");
  }
}

function clip(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return v ? v.slice(0, max) : null;
}

function refresh(guideId?: string) {
  revalidatePath("/agency/guides");
  if (guideId) revalidatePath(`/agency/guides/${guideId}`);
}

export async function searchProductsForGuide(query: string) {
  return withAgency<{ id: string; name: string; status: string }[]>(async () => {
    await assertAgency();
    const results = await searchProductsForPicker(query);
    return { ok: true, message: "", data: results };
  });
}

export async function listCategories() {
  return withAgency<{ id: string; name: string }[]>(async () => {
    await assertAgency();
    const results = await listCategoriesForPicker();
    return { ok: true, message: "", data: results };
  });
}

export async function createGuide(input: { title: unknown; categoryId: unknown }) {
  return withAgency<{ id: string }>(async () => {
    const title = clip(input.title, 200);
    if (!title) return fail("Enter a guide title.");
    const categoryId = typeof input.categoryId === "string" && isUuid(input.categoryId) ? input.categoryId : null;
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't create guides.");

    const { data, error } = await supabase
      .from("guides")
      // slug: "" — guides_before_insert_slug fills a real slug from the
      // title; the generated Insert type doesn't know about that trigger.
      .insert({ title, slug: "", category_id: categoryId, author_id: session.userId })
      .select("id")
      .single();
    if (error) return fail("Couldn't create that guide. Please try again.");

    refresh();
    return { ok: true, message: "Guide created", data: { id: data.id } };
  });
}

export async function updateGuideContent(input: { guideId: unknown; content: unknown; categoryId: unknown }) {
  return withAgency(async () => {
    const guideId = typeof input?.guideId === "string" ? input.guideId : "";
    if (!isUuid(guideId)) return fail("That guide doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't edit guide content.");

    const categoryId = typeof input.categoryId === "string" && isUuid(input.categoryId) ? input.categoryId : null;
    const { error } = await supabase.from("guides").update({ content: clip(input.content, 20000), category_id: categoryId }).eq("id", guideId);
    if (error) return fail("Something went wrong saving your change. Please try again.");

    refresh(guideId);
    return { ok: true, message: "Saved" };
  });
}

export async function setGuideStatus(input: { guideId: unknown; status: "draft" | "published" }) {
  return withAgency(async () => {
    const guideId = typeof input?.guideId === "string" ? input.guideId : "";
    if (!isUuid(guideId)) return fail("That guide doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't publish guides.");

    const { error } = await supabase
      .from("guides")
      .update(input.status === "published" ? { status: input.status, published_at: new Date().toISOString() } : { status: input.status })
      .eq("id", guideId);
    if (error) return fail("Something went wrong. Please try again.");

    refresh(guideId);
    return { ok: true, message: input.status === "published" ? "Guide published" : "Guide moved back to draft" };
  });
}

export async function updateGuideSeo(input: {
  guideId: unknown;
  title: unknown;
  metaDescription: unknown;
  ogTitle: unknown;
  ogDescription: unknown;
  robotsIndex: unknown;
  robotsFollow: unknown;
}) {
  return withAgency(async () => {
    const guideId = typeof input?.guideId === "string" ? input.guideId : "";
    if (!isUuid(guideId)) return fail("That guide doesn't exist.");
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
      .eq("entity_type", "guide")
      .eq("entity_id", guideId)
      .maybeSingle();
    if (existingErr) return fail("Something went wrong saving SEO metadata.");

    const result = existing
      ? await supabase.from("seo_metadata").update(fields).eq("entity_type", "guide").eq("entity_id", guideId)
      : await supabase.from("seo_metadata").insert({ entity_type: "guide", entity_id: guideId, ...fields });
    if (result.error) return fail("Something went wrong saving SEO metadata.");

    refresh(guideId);
    return { ok: true, message: "SEO metadata saved" };
  });
}

export async function addRelatedProduct(input: { guideId: unknown; productId: unknown }) {
  return withAgency(async () => {
    const guideId = typeof input?.guideId === "string" ? input.guideId : "";
    const productId = typeof input?.productId === "string" ? input.productId : "";
    if (!isUuid(guideId) || !isUuid(productId)) return fail("That product doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't manage related products.");

    const { error } = await supabase.from("guide_related_products").insert({ guide_id: guideId, product_id: productId });
    if (error) return fail("Couldn't add that related product.");

    refresh(guideId);
    return { ok: true, message: "Related product added" };
  });
}

export async function removeRelatedProduct(input: { guideId: unknown; productId: unknown }) {
  return withAgency(async () => {
    const guideId = typeof input?.guideId === "string" ? input.guideId : "";
    const productId = typeof input?.productId === "string" ? input.productId : "";
    if (!isUuid(guideId) || !isUuid(productId)) return fail("That product doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't manage related products.");

    const { error } = await supabase.from("guide_related_products").delete().eq("guide_id", guideId).eq("product_id", productId);
    if (error) return fail("Couldn't remove that related product.");

    refresh(guideId);
    return { ok: true, message: "Related product removed" };
  });
}

// ── Featured image ──────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function uploadGuideImage(formData: FormData) {
  return withAgency(async () => {
    const guideId = String(formData.get("guideId") ?? "");
    const file = formData.get("file");
    if (!isUuid(guideId)) return fail("That guide doesn't exist.");
    if (!(file instanceof File) || file.size === 0) return fail("Choose an image file.");
    if (file.size > MAX_IMAGE_BYTES) return fail("Images must be 5 MB or smaller.");
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) return fail("Only JPEG, PNG, or WebP images are allowed.");

    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't upload images.");

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    // guides/{guideId}/... — matches the path convention storage.objects'
    // RLS policies check (0015/0016_storage_path_scoping): the top folder
    // must be "guides" and the id segment must be a real guide row, or the
    // upload is rejected at the database layer regardless of role.
    const path = `guides/${guideId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (uploadError) return fail("Couldn't upload that image. Please try again.");

    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    const { error: updateError } = await supabase.from("guides").update({ featured_image_path: pub.publicUrl }).eq("id", guideId);
    if (updateError) {
      await supabase.storage.from("product-images").remove([path]);
      return fail("Couldn't save that image. Please try again.");
    }

    refresh(guideId);
    return { ok: true, message: "Image uploaded" };
  });
}

export async function deleteGuideImage(input: { guideId: unknown; storagePath: unknown }) {
  return withAgency(async () => {
    const guideId = typeof input?.guideId === "string" ? input.guideId : "";
    if (!isUuid(guideId)) return fail("That guide doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't remove images.");

    const { error } = await supabase.from("guides").update({ featured_image_path: null }).eq("id", guideId);
    if (error) return fail("Couldn't remove that image.");

    if (typeof input.storagePath === "string") {
      const marker = "/object/public/product-images/";
      const idx = input.storagePath.indexOf(marker);
      if (idx !== -1) {
        const objectPath = input.storagePath.slice(idx + marker.length);
        await supabase.storage.from("product-images").remove([objectPath]).catch(() => {});
      }
    }

    refresh(guideId);
    return { ok: true, message: "Image removed" };
  });
}
