"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublic, TAGS } from "@/lib/cache/tags";
import { redirect } from "next/navigation";
import { assertAgency, assertSeoWriter, NotAgencyError } from "@/lib/auth/agency";
import { isUuid } from "@/lib/products/queries";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = unknown> = { ok: true; message: string; data?: T } | { ok: false; error: string };

function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

async function withAgency<T>(run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof NotAgencyError) return fail("Your account doesn't have access to do that.");
    console.error("[agency action] unexpected error", error);
    return fail("Something went wrong. Please try again.");
  }
}

function clip(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return v ? v.slice(0, max) : null;
}

function refresh(productId: string) {
  // Public cache: The product editor changes product_content (which gates whether the
  // product is publicly visible at all), images, and category assignments.
  revalidatePublic(TAGS.products, TAGS.categories, TAGS.seo);
  revalidatePath("/agency");
  revalidatePath("/agency/products");
  revalidatePath(`/agency/products/${productId}`);
}

// ── Overview / description fields ───────────────────────────────────────────

export async function updateContentFields(input: {
  productId: unknown;
  overview: unknown;
  howItWorks: unknown;
  usage: unknown;
  whoItsFor: unknown;
  considerations: unknown;
}) {
  return withAgency(async () => {
    const productId = typeof input?.productId === "string" ? input.productId : "";
    if (!isUuid(productId)) return fail("That product doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't change product content.");

    const fields = {
      overview: clip(input.overview, 4000),
      how_it_works: clip(input.howItWorks, 4000),
      usage: clip(input.usage, 4000),
      who_its_for: clip(input.whoItsFor, 2000),
      considerations: clip(input.considerations, 2000),
      updated_by: session.userId,
    };

    // product_content has a unique(product_id) constraint, so this is a
    // straightforward "does a row exist yet" upsert, done as two statements
    // rather than .upsert() to keep the not-yet-existing case (a brand new
    // product the agency is touching for the first time) an explicit INSERT
    // with status defaulting to 'draft' from the column default.
    const { data: existing, error: existingErr } = await supabase
      .from("product_content")
      .select("id")
      .eq("product_id", productId)
      .maybeSingle();
    if (existingErr) return fail("Something went wrong saving your change. Please try again.");

    const result = existing
      ? await supabase.from("product_content").update(fields).eq("product_id", productId)
      : await supabase.from("product_content").insert({ product_id: productId, ...fields });
    if (result.error) return fail("Something went wrong saving your change. Please try again.");

    refresh(productId);
    return { ok: true, message: "Saved" };
  });
}

export async function setContentStatus(input: { productId: unknown; status: "draft" | "published" }) {
  return withAgency(async () => {
    const productId = typeof input?.productId === "string" ? input.productId : "";
    if (!isUuid(productId)) return fail("That product doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't publish content.");

    const { data: existing } = await supabase.from("product_content").select("id").eq("product_id", productId).maybeSingle();
    if (!existing) return fail("Add some content before publishing.");

    const { error } = await supabase
      .from("product_content")
      .update({ status: input.status, updated_by: session.userId })
      .eq("product_id", productId);
    if (error) return fail("Something went wrong. Please try again.");

    refresh(productId);
    return { ok: true, message: input.status === "published" ? "Content published" : "Content moved back to draft" };
  });
}

// ── Benefits / ingredients / FAQs: shared shape, one action set each ───────

type ListRow = { productId: unknown; id?: unknown; position?: unknown };

export async function addBenefit(input: { productId: unknown; title: unknown; description: unknown }) {
  return withAgency(async () => {
    const productId = typeof input?.productId === "string" ? input.productId : "";
    const title = clip(input.title, 200);
    if (!isUuid(productId) || !title) return fail("Enter a benefit title.");
    const { supabase } = await assertAgency();
    const { count } = await supabase.from("product_benefits").select("id", { count: "exact", head: true }).eq("product_id", productId);
    const { error } = await supabase
      .from("product_benefits")
      .insert({ product_id: productId, title, description: clip(input.description, 2000), position: count ?? 0 });
    if (error) return fail("Couldn't add that benefit.");
    refresh(productId);
    return { ok: true, message: "Benefit added" };
  });
}

export async function updateBenefit(input: { productId: unknown; id: unknown; title: unknown; description: unknown }) {
  return withAgency(async () => {
    const productId = typeof input?.productId === "string" ? input.productId : "";
    const id = typeof input?.id === "string" ? input.id : "";
    const title = clip(input.title, 200);
    if (!isUuid(productId) || !isUuid(id) || !title) return fail("Enter a benefit title.");
    const { supabase } = await assertAgency();
    const { error } = await supabase
      .from("product_benefits")
      .update({ title, description: clip(input.description, 2000) })
      .eq("id", id)
      .eq("product_id", productId);
    if (error) return fail("Couldn't save that benefit.");
    refresh(productId);
    return { ok: true, message: "Saved" };
  });
}

export async function deleteBenefit(input: ListRow) {
  return withAgency(async () => {
    const productId = typeof input?.productId === "string" ? input.productId : "";
    const id = typeof input?.id === "string" ? input.id : "";
    if (!isUuid(productId) || !isUuid(id)) return fail("That benefit doesn't exist.");
    const { supabase } = await assertAgency();
    const { error } = await supabase.from("product_benefits").delete().eq("id", id).eq("product_id", productId);
    if (error) return fail("Couldn't remove that benefit.");
    refresh(productId);
    return { ok: true, message: "Benefit removed" };
  });
}

export async function addIngredient(input: { productId: unknown; name: unknown; description: unknown }) {
  return withAgency(async () => {
    const productId = typeof input?.productId === "string" ? input.productId : "";
    const name = clip(input.name, 200);
    if (!isUuid(productId) || !name) return fail("Enter an ingredient name.");
    const { supabase } = await assertAgency();
    const { count } = await supabase.from("product_ingredients").select("id", { count: "exact", head: true }).eq("product_id", productId);
    const { error } = await supabase
      .from("product_ingredients")
      .insert({ product_id: productId, name, description: clip(input.description, 2000), position: count ?? 0 });
    if (error) return fail("Couldn't add that ingredient.");
    refresh(productId);
    return { ok: true, message: "Ingredient added" };
  });
}

export async function updateIngredient(input: { productId: unknown; id: unknown; name: unknown; description: unknown }) {
  return withAgency(async () => {
    const productId = typeof input?.productId === "string" ? input.productId : "";
    const id = typeof input?.id === "string" ? input.id : "";
    const name = clip(input.name, 200);
    if (!isUuid(productId) || !isUuid(id) || !name) return fail("Enter an ingredient name.");
    const { supabase } = await assertAgency();
    const { error } = await supabase
      .from("product_ingredients")
      .update({ name, description: clip(input.description, 2000) })
      .eq("id", id)
      .eq("product_id", productId);
    if (error) return fail("Couldn't save that ingredient.");
    refresh(productId);
    return { ok: true, message: "Saved" };
  });
}

export async function deleteIngredient(input: ListRow) {
  return withAgency(async () => {
    const productId = typeof input?.productId === "string" ? input.productId : "";
    const id = typeof input?.id === "string" ? input.id : "";
    if (!isUuid(productId) || !isUuid(id)) return fail("That ingredient doesn't exist.");
    const { supabase } = await assertAgency();
    const { error } = await supabase.from("product_ingredients").delete().eq("id", id).eq("product_id", productId);
    if (error) return fail("Couldn't remove that ingredient.");
    refresh(productId);
    return { ok: true, message: "Ingredient removed" };
  });
}

export async function addFaq(input: { productId: unknown; question: unknown; answer: unknown }) {
  return withAgency(async () => {
    const productId = typeof input?.productId === "string" ? input.productId : "";
    const question = clip(input.question, 300);
    const answer = clip(input.answer, 3000);
    if (!isUuid(productId) || !question || !answer) return fail("Enter both a question and an answer.");
    const { supabase } = await assertAgency();
    const { count } = await supabase.from("product_faqs").select("id", { count: "exact", head: true }).eq("product_id", productId);
    const { error } = await supabase.from("product_faqs").insert({ product_id: productId, question, answer, position: count ?? 0 });
    if (error) return fail("Couldn't add that FAQ.");
    refresh(productId);
    return { ok: true, message: "FAQ added" };
  });
}

export async function updateFaq(input: { productId: unknown; id: unknown; question: unknown; answer: unknown }) {
  return withAgency(async () => {
    const productId = typeof input?.productId === "string" ? input.productId : "";
    const id = typeof input?.id === "string" ? input.id : "";
    const question = clip(input.question, 300);
    const answer = clip(input.answer, 3000);
    if (!isUuid(productId) || !isUuid(id) || !question || !answer) return fail("Enter both a question and an answer.");
    const { supabase } = await assertAgency();
    const { error } = await supabase.from("product_faqs").update({ question, answer }).eq("id", id).eq("product_id", productId);
    if (error) return fail("Couldn't save that FAQ.");
    refresh(productId);
    return { ok: true, message: "Saved" };
  });
}

export async function deleteFaq(input: ListRow) {
  return withAgency(async () => {
    const productId = typeof input?.productId === "string" ? input.productId : "";
    const id = typeof input?.id === "string" ? input.id : "";
    if (!isUuid(productId) || !isUuid(id)) return fail("That FAQ doesn't exist.");
    const { supabase } = await assertAgency();
    const { error } = await supabase.from("product_faqs").delete().eq("id", id).eq("product_id", productId);
    if (error) return fail("Couldn't remove that FAQ.");
    refresh(productId);
    return { ok: true, message: "FAQ removed" };
  });
}

// ── Images ──────────────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function uploadProductImage(formData: FormData) {
  return withAgency(async () => {
    const productId = String(formData.get("productId") ?? "");
    const file = formData.get("file");
    if (!isUuid(productId)) return fail("That product doesn't exist.");
    if (!(file instanceof File) || file.size === 0) return fail("Choose an image file.");
    if (file.size > MAX_IMAGE_BYTES) return fail("Images must be 5 MB or smaller.");
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) return fail("Only JPEG, PNG, or WebP images are allowed.");

    const { supabase } = await assertAgency();
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("product-images").upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
    });
    if (uploadError) return fail("Couldn't upload that image. Please try again.");

    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
    const isFirst = (count ?? 0) === 0;

    const { error: insertError } = await supabase.from("product_images").insert({
      product_id: productId,
      storage_path: pub.publicUrl,
      alt_text: clip(formData.get("altText"), 200),
      position: count ?? 0,
      is_primary: isFirst,
    });
    if (insertError) {
      await supabase.storage.from("product-images").remove([path]);
      return fail("Couldn't save that image. Please try again.");
    }

    refresh(productId);
    return { ok: true, message: "Image uploaded" };
  });
}

export async function deleteProductImage(input: { productId: unknown; id: unknown; storagePath: unknown }) {
  return withAgency(async () => {
    const productId = typeof input?.productId === "string" ? input.productId : "";
    const id = typeof input?.id === "string" ? input.id : "";
    if (!isUuid(productId) || !isUuid(id)) return fail("That image doesn't exist.");
    const { supabase } = await assertAgency();

    const { error } = await supabase.from("product_images").delete().eq("id", id).eq("product_id", productId);
    if (error) return fail("Couldn't remove that image.");

    // Best-effort: the object is orphaned but inaccessible via the app once
    // its row is gone, so a storage failure here must not block the delete.
    if (typeof input.storagePath === "string") {
      const marker = "/object/public/product-images/";
      const idx = input.storagePath.indexOf(marker);
      if (idx !== -1) {
        const objectPath = input.storagePath.slice(idx + marker.length);
        await supabase.storage.from("product-images").remove([objectPath]).catch(() => {});
      }
    }

    refresh(productId);
    return { ok: true, message: "Image removed" };
  });
}

export async function setPrimaryImage(input: { productId: unknown; id: unknown }) {
  return withAgency(async () => {
    const productId = typeof input?.productId === "string" ? input.productId : "";
    const id = typeof input?.id === "string" ? input.id : "";
    if (!isUuid(productId) || !isUuid(id)) return fail("That image doesn't exist.");
    const { supabase } = await assertAgency();

    const { error: clearError } = await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
    if (clearError) return fail("Couldn't update the primary image.");
    const { error } = await supabase.from("product_images").update({ is_primary: true }).eq("id", id).eq("product_id", productId);
    if (error) return fail("Couldn't update the primary image.");

    refresh(productId);
    return { ok: true, message: "Primary image updated" };
  });
}

// ── SEO metadata ─────────────────────────────────────────────────────────────

export async function updateSeoMetadata(input: {
  productId: unknown;
  title: unknown;
  metaDescription: unknown;
  ogTitle: unknown;
  ogDescription: unknown;
  robotsIndex: unknown;
  robotsFollow: unknown;
}) {
  return withAgency(async () => {
    const productId = typeof input?.productId === "string" ? input.productId : "";
    if (!isUuid(productId)) return fail("That product doesn't exist.");
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
      .eq("entity_type", "product")
      .eq("entity_id", productId)
      .maybeSingle();
    if (existingErr) return fail("Something went wrong saving SEO metadata.");

    const result = existing
      ? await supabase.from("seo_metadata").update(fields).eq("entity_type", "product").eq("entity_id", productId)
      : await supabase.from("seo_metadata").insert({ entity_type: "product", entity_id: productId, ...fields });
    if (result.error) return fail("Something went wrong saving SEO metadata.");

    refresh(productId);
    return { ok: true, message: "SEO metadata saved" };
  });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/agency/login");
}
