import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { setProductCategories } from "./categories";
import { uploadProductImageFile } from "./image-upload";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type CreateOwnerProductResult =
  | { ok: true; product: { id: string; name: string; slug: string }; activated: boolean }
  | { ok: false; stage: "create"; dbError: { code?: string; message: string } }
  | { ok: false; stage: "image"; message: string }
  | { ok: false; stage: "category"; message: string };

/**
 * The single implementation of "Owner creates a live product from a name, an
 * affiliate URL and a required main image". Used by the Add Product dialog
 * (createProduct in src/app/admin/actions.ts) and by Bulk Import, so there is
 * exactly one place that decides how a product, its affiliate link, its image
 * and its activation are created.
 *
 *  1. create_product() RPC — owner-only (is_owner() is not true guard, 0021),
 *     generates the collision-safe slug via next_unique_slug(), inserts the
 *     product as 'new' and its affiliate_links row in one database transaction.
 *  2. uploadProductImageFile() — same validation, same products/<id>/<uuid>.ext
 *     path scoping, and same primary-image rule as the Agency image manager.
 *  3. Categories (optional) - the existing product_categories many-to-many.
 *  4. Activation — the Owner-minimal-creation behaviour: a second explicit
 *     write, only after the image exists.
 *
 * If the image fails, the product is soft-deleted (products has no DELETE
 * policy, by design) so no half-finished product is left visible anywhere.
 *
 * Callers are responsible for authorization (assertOwner) and for cache
 * invalidation (revalidatePublic); this function does neither, so it can never
 * be reached without going through one of those.
 */
export async function createOwnerProduct(
  supabase: Supabase,
  input: { name: string; affiliateUrl: string; image: File; categoryIds?: string[] },
): Promise<CreateOwnerProductResult> {
  const { data, error } = await supabase.rpc("create_product", {
    p_name: input.name,
    p_affiliate_url: input.affiliateUrl,
  });
  if (error) return { ok: false, stage: "create", dbError: error };

  const upload = await uploadProductImageFile(supabase, data.id, input.image, null);
  if (!upload.ok) {
    await supabase.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: false, stage: "image", message: upload.error };
  }

  // Categories are assigned BEFORE activation, so a product never goes live
  // half-finished. A failure rolls the product back exactly like an image failure.
  if (input.categoryIds && input.categoryIds.length > 0) {
    const assigned = await setProductCategories(supabase, data.id, input.categoryIds);
    if (!assigned.ok) {
      await supabase.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", data.id);
      return { ok: false, stage: "category", message: "Couldn't assign the categories — the product was not kept." };
    }
  }

  const { error: activateError } = await supabase.from("products").update({ status: "active" }).eq("id", data.id);
  if (activateError) {
    // Non-fatal: product, link and image are all correct; the Owner can
    // activate it with one click. Reported so bulk import can surface it.
    console.error("[create-owner-product] failed to auto-activate", activateError.code);
  }
  return { ok: true, product: { id: data.id, name: data.name, slug: data.slug }, activated: !activateError };
}
