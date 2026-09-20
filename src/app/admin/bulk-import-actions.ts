"use server";

import { assertOwner, NotOwnerError } from "@/lib/auth/owner";
import { refreshAdmin } from "@/lib/admin/refresh";
import { resolveCategories } from "@/lib/bulk-import/categories";
import { CSV_MAX_BYTES } from "@/lib/bulk-import/csv";
import { claimedTypeFromName, sniffImageType, type SniffedType } from "@/lib/bulk-import/images";
import {
  buildPreview,
  categoryErrors,
  emptyPreview,
  MAX_BULK_UPLOAD_BYTES,
  parseBulkRows,
  type ManifestImage,
  type Preview,
} from "@/lib/bulk-import/plan";
import { listCategories } from "@/lib/products/categories";
import { createOwnerProduct } from "@/lib/products/create-owner-product";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/products/image-constants";

// Owner-only, twice over: the page sits under the (owner) layout (which
// renders "Owner access only" for anyone else, and the proxy bounces signed-out
// visitors), AND every action below calls assertOwner() itself — a Server
// Action is a public POST endpoint whether or not the page was reachable.
// Authorization is then enforced a third time by the database: create_product()
// checks is_owner(), and RLS on products/affiliate_links/product_images/
// storage.objects only permits the owner (or, for images, agency roles) anyway.
// Nothing here uses a service-role key; every query runs as the signed-in Owner.

const MAX_MANIFEST_ENTRIES = 1000;

export type ValidateBulkResult = { ok: true; preview: Preview } | { ok: false; error: string };

function cleanManifest(raw: unknown): ManifestImage[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_MANIFEST_ENTRIES) return null;
  const out: ManifestImage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { name, size, sniffed, problem } = item as Record<string, unknown>;
    if (typeof name !== "string" || name.length === 0 || name.length > 260) return null;
    if (typeof size !== "number" || !Number.isFinite(size) || size < 0) return null;
    const sniffedOk: SniffedType | null =
      sniffed === "image/jpeg" || sniffed === "image/png" || sniffed === "image/webp" ? sniffed : null;
    out.push({
      name,
      size,
      sniffed: sniffedOk,
      problem: problem === "too-large" || problem === "unreadable" ? problem : undefined,
    });
  }
  return out;
}

/**
 * Validates the ENTIRE batch and returns a preview. Creates nothing.
 * The affiliate URLs are parsed here but never returned — the preview carries
 * only a status and the host, and only ever to the Owner.
 */
export async function validateBulkImport(input: { csvText: unknown; images: unknown }): Promise<ValidateBulkResult> {
  try {
    const { supabase } = await assertOwner();
    if (typeof input?.csvText !== "string") return { ok: false, error: "Choose a CSV file." };
    if (input.csvText.length > CSV_MAX_BYTES) return { ok: false, error: "The CSV file is too large." };
    const images = cleanManifest(input.images);
    if (!images) return { ok: false, error: "The image list was not understood. Re-select your files and try again." };

    const batch = parseBulkRows(input.csvText);
    if (batch.fatal) return { ok: true, preview: emptyPreview(batch.fatal) };

    // One query for the whole batch — not one per row.
    const bases = [...new Set(batch.rows.map((r) => r.base).filter(Boolean))];
    const existing = new Set<string>();
    if (bases.length > 0) {
      const { data, error } = await supabase.from("products").select("slug").is("deleted_at", null).in("slug", bases);
      if (error) {
        console.error("[bulk import] duplicate check failed", error.code);
        return { ok: false, error: "Couldn't check for existing products. Please try again." };
      }
      for (const row of data ?? []) existing.add(row.slug);
    }
    // The category catalogue is read only when the CSV actually has a category
    // column, and only to MATCH against — an unknown name is a row error, a
    // category is never created here.
    const catalog = batch.hasCategoryColumn ? await listCategories(supabase) : [];
    return { ok: true, preview: buildPreview(batch, images, existing, catalog) };
  } catch (error) {
    if (error instanceof NotOwnerError) return { ok: false, error: "Your session doesn't have owner access. Sign in again." };
    console.error("[bulk import] validate failed", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export type ImportRowResult =
  | { ok: true; line: number; name: string; slug: string; warning?: string }
  | { ok: false; line: number; name: string; error: string };

/**
 * Imports ONE row. The browser sends one image per request because the hosting
 * platform caps a request body at ~4.5 MB; the client drives the loop and the
 * progress bar. Because the request is client-initiated, nothing the preview
 * said is trusted: the CSV is re-parsed, the row re-validated, the duplicate
 * check re-run, and the image's real bytes re-sniffed — all BEFORE anything is
 * created, so a bad row can never leave a product behind.
 */
export async function importBulkRow(formData: FormData): Promise<ImportRowResult> {
  const lineRaw = Number(formData.get("line"));
  const line = Number.isInteger(lineRaw) ? lineRaw : -1;
  let name = "";
  try {
    const { supabase } = await assertOwner();

    const csvText = formData.get("csvText");
    const image = formData.get("image");
    if (typeof csvText !== "string" || csvText.length > CSV_MAX_BYTES) return { ok: false, line, name, error: "The CSV was not received." };
    if (!(image instanceof File)) return { ok: false, line, name, error: "No image was received for this row." };

    const batch = parseBulkRows(csvText);
    if (batch.fatal) return { ok: false, line, name, error: batch.fatal };
    const row = batch.rows.find((r) => r.line === line);
    if (!row) return { ok: false, line, name, error: "That row no longer exists in the CSV." };
    name = row.name;
    if (row.errors.length > 0) return { ok: false, line, name, error: row.errors[0] };

    // Re-resolved on the server from the database at import time (never from
    // anything the browser sent), so a category renamed or removed since the
    // preview is caught here, before anything is created.
    let categoryIds: string[] = [];
    if (row.categoryNames.length > 0) {
      const catalog = await listCategories(supabase);
      const problems = categoryErrors(row, catalog);
      if (problems.length > 0) return { ok: false, line, name, error: problems[0] };
      categoryIds = resolveCategories(row.categoryNames, catalog).ids;
    }

    if (row.base) {
      const { data, error } = await supabase.from("products").select("id").is("deleted_at", null).eq("slug", row.base).limit(1);
      if (error) {
        console.error("[bulk import] duplicate re-check failed", error.code);
        return { ok: false, line, name, error: "Couldn't check for an existing product. Nothing was created." };
      }
      if ((data ?? []).length > 0) {
        return { ok: false, line, name, error: "Skipped: a product with this name already exists (possible repeat import)." };
      }
    }

    // The bytes must be the file this row named — not just any image.
    if (image.name.toLowerCase() !== row.imageFilename.toLowerCase()) {
      return { ok: false, line, name, error: "The uploaded image doesn't match the filename in the CSV." };
    }
    if (image.size === 0) return { ok: false, line, name, error: "The image file is empty." };
    if (image.size > MAX_IMAGE_BYTES || image.size > MAX_BULK_UPLOAD_BYTES) {
      return { ok: false, line, name, error: "The image is larger than the allowed size." };
    }
    const bytes = new Uint8Array(await image.arrayBuffer());
    const sniffed = sniffImageType(bytes);
    if (!sniffed || !ALLOWED_IMAGE_TYPES.has(sniffed)) {
      return { ok: false, line, name, error: "Not a JPEG, PNG or WebP image (checked by file contents)." };
    }
    if (claimedTypeFromName(row.imageFilename) !== sniffed) {
      return { ok: false, line, name, error: "The file extension doesn't match the image's actual contents." };
    }

    // Reuse the one shared creation path. The File carries the SNIFFED type,
    // not the client-declared one, so the Storage bucket's MIME rule and the
    // stored content-type reflect what the bytes really are.
    const result = await createOwnerProduct(supabase, {
      name: row.name,
      affiliateUrl: row.affiliateUrl,
      image: new File([bytes as BlobPart], row.imageFilename, { type: sniffed }),
      categoryIds,
    });
    if (!result.ok) {
      if (result.stage === "category") return { ok: false, line, name, error: result.message };
      if (result.stage === "image") return { ok: false, line, name, error: `Image upload failed — the product was not kept. ${result.message}` };
      const msg = result.dbError.message;
      if (msg.includes("Only the owner") || result.dbError.code === "42501") return { ok: false, line, name, error: "Your account doesn't have owner access." };
      console.error("[bulk import] create failed", result.dbError.code);
      return { ok: false, line, name, error: "The database rejected this product. Nothing was created." };
    }

    // Per product, not once at the end: if the browser closes mid-import the
    // products that WERE created must already be live/consistent.
    refreshAdmin();
    return {
      ok: true,
      line,
      name: result.product.name,
      slug: result.product.slug,
      warning: result.activated ? undefined : "Created, but could not be activated automatically — activate it from its page.",
    };
  } catch (error) {
    if (error instanceof NotOwnerError) return { ok: false, line, name, error: "Your session doesn't have owner access. Sign in again." };
    console.error("[bulk import] row failed", error);
    return { ok: false, line, name, error: "Something went wrong on the server. This row was not imported." };
  }
}
