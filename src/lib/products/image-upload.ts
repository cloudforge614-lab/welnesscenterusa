import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { ALLOWED_IMAGE_TYPES, extensionFor, MAX_IMAGE_BYTES } from "./image-constants";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ImageUploadResult = { ok: true; path: string } | { ok: false; error: string };

/**
 * Validates and stores a product image, then records it in product_images.
 *
 * Shared by both the Owner's minimal-creation flow (src/app/admin/actions.ts)
 * and the Agency CMS's image manager (src/app/agency/actions.ts) — same
 * validation, same Storage path shape (products/<id>/<uuid>.<ext>), same
 * "first image for this product becomes primary" rule. Reusing one function
 * rather than keeping two independent copies is what the task means by
 * "store the image using the existing product image architecture": there is
 * exactly one code path that writes a product_images row, regardless of
 * which role's form triggered it.
 *
 * Auth is NOT checked here — the caller (assertOwner()/assertAgency()) has
 * already established the caller may write to this product before this
 * function is reached. Storage's own RLS policies (product_images_bucket_write,
 * 0014/0016) and the bucket's file_size_limit/allowed_mime_types (0020) are
 * the real, final boundary regardless of what the caller believes it checked
 * — this function's own validation is a fast, friendly first pass, not the
 * security control.
 */
export async function uploadProductImageFile(
  supabase: Supabase,
  productId: string,
  file: unknown,
  altText: string | null,
): Promise<ImageUploadResult> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image file." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Images must be 5 MB or smaller." };
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return { ok: false, error: "Only JPEG, PNG, or WebP images are allowed." };

  const ext = extensionFor(file.type);
  const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("product-images").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (uploadError) return { ok: false, error: "Couldn't upload that image. Please try again." };

  const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
  const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  const isFirst = (count ?? 0) === 0;

  const { error: insertError } = await supabase.from("product_images").insert({
    product_id: productId,
    storage_path: pub.publicUrl,
    alt_text: altText,
    position: count ?? 0,
    is_primary: isFirst,
  });
  if (insertError) {
    // Best-effort cleanup: an orphaned Storage object with no product_images
    // row is invisible everywhere (no public query ever lists raw Storage
    // contents), just wasted space — worth removing, not worth failing loudly
    // over if the removal itself fails.
    await supabase.storage.from("product-images").remove([path]);
    return { ok: false, error: "Couldn't save that image. Please try again." };
  }

  return { ok: true, path };
}
