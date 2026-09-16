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
    console.error("[agency articles action] unexpected error", error);
    return fail("Something went wrong. Please try again.");
  }
}

function clip(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return v ? v.slice(0, max) : null;
}

function refresh(articleId?: string) {
  revalidatePath("/agency/articles");
  if (articleId) revalidatePath(`/agency/articles/${articleId}`);
}

// Reuses the same product/category picker helpers Reviews and Guides use —
// deliberately not duplicated per content type.
export async function searchProductsForArticle(query: string) {
  return withAgency<{ id: string; name: string; status: string }[]>(async () => {
    await assertAgency();
    const results = await searchProductsForPicker(query);
    return { ok: true, message: "", data: results };
  });
}

export async function listCategoriesForArticle() {
  return withAgency<{ id: string; name: string }[]>(async () => {
    await assertAgency();
    const results = await listCategoriesForPicker();
    return { ok: true, message: "", data: results };
  });
}

export async function createArticle(input: { title: unknown; categoryId: unknown }) {
  return withAgency<{ id: string }>(async () => {
    const title = clip(input.title, 200);
    if (!title) return fail("Enter an article title.");
    const categoryId = typeof input.categoryId === "string" && isUuid(input.categoryId) ? input.categoryId : null;
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't create articles.");

    const { data, error } = await supabase
      .from("articles")
      // slug: "" — articles_before_insert_slug fills a real slug from the
      // title; the generated Insert type doesn't know about that trigger.
      .insert({ title, slug: "", category_id: categoryId, author_id: session.userId })
      .select("id")
      .single();
    if (error) return fail("Couldn't create that article. Please try again.");

    refresh();
    return { ok: true, message: "Article created", data: { id: data.id } };
  });
}

export async function updateArticleContent(input: { articleId: unknown; content: unknown; categoryId: unknown }) {
  return withAgency(async () => {
    const articleId = typeof input?.articleId === "string" ? input.articleId : "";
    if (!isUuid(articleId)) return fail("That article doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't edit article content.");

    const categoryId = typeof input.categoryId === "string" && isUuid(input.categoryId) ? input.categoryId : null;
    const { error } = await supabase.from("articles").update({ content: clip(input.content, 20000), category_id: categoryId }).eq("id", articleId);
    if (error) return fail("Something went wrong saving your change. Please try again.");

    refresh(articleId);
    return { ok: true, message: "Saved" };
  });
}

export async function setArticleStatus(input: { articleId: unknown; status: "draft" | "published" }) {
  return withAgency(async () => {
    const articleId = typeof input?.articleId === "string" ? input.articleId : "";
    if (!isUuid(articleId)) return fail("That article doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't publish articles.");

    const { error } = await supabase
      .from("articles")
      .update(input.status === "published" ? { status: input.status, published_at: new Date().toISOString() } : { status: input.status })
      .eq("id", articleId);
    if (error) return fail("Something went wrong. Please try again.");

    refresh(articleId);
    return { ok: true, message: input.status === "published" ? "Article published" : "Article moved back to draft" };
  });
}

export async function updateArticleSeo(input: {
  articleId: unknown;
  title: unknown;
  metaDescription: unknown;
  ogTitle: unknown;
  ogDescription: unknown;
  robotsIndex: unknown;
  robotsFollow: unknown;
}) {
  return withAgency(async () => {
    const articleId = typeof input?.articleId === "string" ? input.articleId : "";
    if (!isUuid(articleId)) return fail("That article doesn't exist.");
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
      .eq("entity_type", "article")
      .eq("entity_id", articleId)
      .maybeSingle();
    if (existingErr) return fail("Something went wrong saving SEO metadata.");

    const result = existing
      ? await supabase.from("seo_metadata").update(fields).eq("entity_type", "article").eq("entity_id", articleId)
      : await supabase.from("seo_metadata").insert({ entity_type: "article", entity_id: articleId, ...fields });
    if (result.error) return fail("Something went wrong saving SEO metadata.");

    refresh(articleId);
    return { ok: true, message: "SEO metadata saved" };
  });
}

export async function addArticleRelatedProduct(input: { articleId: unknown; productId: unknown }) {
  return withAgency(async () => {
    const articleId = typeof input?.articleId === "string" ? input.articleId : "";
    const productId = typeof input?.productId === "string" ? input.productId : "";
    if (!isUuid(articleId) || !isUuid(productId)) return fail("That product doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't manage related products.");

    const { error } = await supabase.from("article_related_products").insert({ article_id: articleId, product_id: productId });
    if (error) return fail("Couldn't add that related product.");

    refresh(articleId);
    return { ok: true, message: "Related product added" };
  });
}

export async function removeArticleRelatedProduct(input: { articleId: unknown; productId: unknown }) {
  return withAgency(async () => {
    const articleId = typeof input?.articleId === "string" ? input.articleId : "";
    const productId = typeof input?.productId === "string" ? input.productId : "";
    if (!isUuid(articleId) || !isUuid(productId)) return fail("That product doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't manage related products.");

    const { error } = await supabase.from("article_related_products").delete().eq("article_id", articleId).eq("product_id", productId);
    if (error) return fail("Couldn't remove that related product.");

    refresh(articleId);
    return { ok: true, message: "Related product removed" };
  });
}

// ── Featured image ──────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function uploadArticleImage(formData: FormData) {
  return withAgency(async () => {
    const articleId = String(formData.get("articleId") ?? "");
    const file = formData.get("file");
    if (!isUuid(articleId)) return fail("That article doesn't exist.");
    if (!(file instanceof File) || file.size === 0) return fail("Choose an image file.");
    if (file.size > MAX_IMAGE_BYTES) return fail("Images must be 5 MB or smaller.");
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) return fail("Only JPEG, PNG, or WebP images are allowed.");

    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't upload images.");

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    // articles/{articleId}/... — the "articles" prefix was already part of
    // the path-scoping policy (0015/0016_storage_path_scoping.sql) applied
    // at the Guides step; reused as-is, no new Storage policy needed.
    const path = `articles/${articleId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (uploadError) return fail("Couldn't upload that image. Please try again.");

    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    const { error: updateError } = await supabase.from("articles").update({ featured_image_path: pub.publicUrl }).eq("id", articleId);
    if (updateError) {
      await supabase.storage.from("product-images").remove([path]);
      return fail("Couldn't save that image. Please try again.");
    }

    refresh(articleId);
    return { ok: true, message: "Image uploaded" };
  });
}

export async function deleteArticleImage(input: { articleId: unknown; storagePath: unknown }) {
  return withAgency(async () => {
    const articleId = typeof input?.articleId === "string" ? input.articleId : "";
    if (!isUuid(articleId)) return fail("That article doesn't exist.");
    const { session, supabase } = await assertAgency();
    if (session.role === "seo_editor") return fail("SEO editors can't remove images.");

    const { error } = await supabase.from("articles").update({ featured_image_path: null }).eq("id", articleId);
    if (error) return fail("Couldn't remove that image.");

    if (typeof input.storagePath === "string") {
      const marker = "/object/public/product-images/";
      const idx = input.storagePath.indexOf(marker);
      if (idx !== -1) {
        const objectPath = input.storagePath.slice(idx + marker.length);
        await supabase.storage.from("product-images").remove([objectPath]).catch(() => {});
      }
    }

    refresh(articleId);
    return { ok: true, message: "Image removed" };
  });
}
