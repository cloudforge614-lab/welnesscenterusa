"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublic, TAGS } from "@/lib/cache/tags";
import { redirect } from "next/navigation";
import { assertOwner, NotOwnerError } from "@/lib/auth/owner";
import { isUuid } from "@/lib/products/queries";
import { validateAffiliateUrl, validateProductName } from "@/lib/products/validation";
import { uploadProductImageFile } from "@/lib/products/image-upload";
import { createClient } from "@/lib/supabase/server";

export type FieldErrors = Partial<Record<"name" | "affiliateUrl" | "image", string>>;

export type ActionResult<T = unknown> =
  | { ok: true; message: string; data?: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

type DbError = { code?: string; message: string };

function fail(error: string, fieldErrors?: FieldErrors): { ok: false; error: string; fieldErrors?: FieldErrors } {
  return { ok: false, error, fieldErrors };
}

function describeDbError(error: DbError): { ok: false; error: string; fieldErrors?: FieldErrors } {
  if (error.message.includes("Affiliate URL must be a valid")) {
    return fail("Check the affiliate URL.", { affiliateUrl: "Enter a full URL starting with https://" });
  }
  if (error.message.includes("Product name is required")) {
    return fail("Check the product name.", { name: "Enter a product name." });
  }
  if (error.message.includes("Only the owner") || error.code === "42501") {
    return fail("Your account doesn't have owner access.");
  }
  console.error("[admin action] database error", error);
  return fail("Something went wrong saving your change. Please try again.");
}

async function withOwner<T>(run: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof NotOwnerError) return fail("Your session doesn't have owner access. Sign in again.");
    console.error("[admin action] unexpected error", error);
    return fail("Something went wrong. Please try again.");
  }
}

function refreshAdmin() {
  // Public cache: The owner controls product status, soft delete, name/slug and the
  // affiliate link — all of which change public eligibility or output.
  // TAGS.redirects: a slug change writes a historical-redirect row via the
  // record_slug_change() trigger (0019), so the same action has to invalidate
  // the redirect lookup alongside the content it changed.
  revalidatePublic(TAGS.products, TAGS.categories, TAGS.redirects);
  revalidatePath("/admin", "layout");
}

// Takes FormData rather than a plain object because the required main image
// (a File) has to travel through here too — Server Actions can carry a File
// only inside FormData, never in a plain JSON-serializable argument.
export async function createProduct(formData: FormData) {
  return withOwner<{ id: string; name: string; slug: string }>(async () => {
    const name = validateProductName(formData.get("name"));
    const url = validateAffiliateUrl(formData.get("affiliateUrl"));
    const file = formData.get("image");
    const imageMissing = !(file instanceof File) || file.size === 0;

    if (!name.ok || !url.ok || imageMissing) {
      return fail("Please fix the highlighted fields.", {
        name: name.ok ? undefined : name.error,
        affiliateUrl: url.ok ? undefined : url.error,
        image: imageMissing ? "Choose a product image." : undefined,
      });
    }

    const { supabase } = await assertOwner();
    // create_product itself still inserts as 'new', unchanged — it's the one
    // RPC every product-creating caller shares, including every existing
    // Agency-content-review fixture across earlier phases, none of which
    // should auto-activate. "Immediately live on the homepage" is applied
    // here instead, as a second write scoped to exactly this flow, once the
    // required image has actually been attached.
    const { data, error } = await supabase.rpc("create_product", { p_name: name.value, p_affiliate_url: url.value });
    if (error) return describeDbError(error);

    // The image is required, so a product created without one is not a valid
    // outcome — roll back rather than leave a half-finished row behind.
    // Soft delete is the only removal path this schema supports (see
    // deleteProduct below): products has no DELETE policy, by design, since
    // click history and Agency content cascade from it.
    const uploadResult = await uploadProductImageFile(supabase, data.id, file, null);
    if (!uploadResult.ok) {
      await supabase.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", data.id);
      return fail(uploadResult.error, { image: uploadResult.error });
    }

    // Name + main image + affiliate URL is the whole of what this flow asks
    // for, so there is nothing left to wait on — go live now rather than
    // leaving it at 'new' for a separate manual Activate click.
    const { error: activateError } = await supabase.from("products").update({ status: "active" }).eq("id", data.id);
    if (activateError) {
      console.error("[admin action] failed to auto-activate new product", activateError);
      // Non-fatal: the product and its image both exist and are correct: the
      // owner can activate it with one click from its page. Surfacing this
      // as a hard failure here would be misleading — creation itself fully
      // succeeded.
    }

    refreshAdmin();
    return { ok: true, message: `“${data.name}” added`, data: { id: data.id, name: data.name, slug: data.slug } };
  });
}

export async function renameProduct(input: { id: unknown; name: unknown }) {
  return withOwner(async () => {
    const id = typeof input?.id === "string" ? input.id : "";
    if (!isUuid(id)) return fail("That product doesn't exist.");
    const name = validateProductName(input?.name);
    if (!name.ok) return fail(name.error, { name: name.error });

    const { supabase } = await assertOwner();
    const { data, error } = await supabase
      .from("products")
      .update({ name: name.value })
      .eq("id", id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) return describeDbError(error);
    // RLS filters instead of erroring, so "no row back" is how a blocked or missing update shows up.
    if (!data) return fail("That product doesn't exist or can't be edited.");

    refreshAdmin();
    return { ok: true, message: "Name updated" };
  });
}

export async function changeAffiliateUrl(input: { id: unknown; affiliateUrl: unknown }) {
  return withOwner(async () => {
    const id = typeof input?.id === "string" ? input.id : "";
    if (!isUuid(id)) return fail("That product doesn't exist.");
    const url = validateAffiliateUrl(input?.affiliateUrl);
    if (!url.ok) return fail(url.error, { affiliateUrl: url.error });

    const { supabase } = await assertOwner();
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, affiliate_links(destination_url, is_active)")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (productError) return describeDbError(productError);
    if (!product) return fail("That product doesn't exist.");

    const current = product.affiliate_links.find((link) => link.is_active)?.destination_url;
    if (current === url.value) return { ok: true, message: "That's already the current affiliate URL" };

    // Deactivates the old link (kept as history) and activates the new one in one transaction.
    const { error } = await supabase.rpc("update_product_affiliate_url", { p_product_id: id, p_new_url: url.value });
    if (error) return describeDbError(error);

    refreshAdmin();
    return { ok: true, message: "Affiliate URL updated" };
  });
}

const OWNER_STATUSES = ["active", "paused", "archived"] as const;
type OwnerStatus = (typeof OWNER_STATUSES)[number];

const STATUS_MESSAGES: Record<OwnerStatus, string> = {
  active: "Product activated",
  paused: "Product paused",
  archived: "Product archived",
};

export async function setProductStatus(input: { id: unknown; status: unknown }) {
  return withOwner(async () => {
    const id = typeof input?.id === "string" ? input.id : "";
    if (!isUuid(id)) return fail("That product doesn't exist.");
    const status = OWNER_STATUSES.find((s) => s === input?.status);
    if (!status) return fail("That status change isn't allowed.");

    const { supabase } = await assertOwner();
    const { data, error } = await supabase
      .from("products")
      .update({ status })
      .eq("id", id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) return describeDbError(error);
    if (!data) return fail("That product doesn't exist or can't be changed.");

    refreshAdmin();
    return { ok: true, message: STATUS_MESSAGES[status] };
  });
}

// Soft delete only. `products` deliberately has no DELETE policy: click history
// and agency content cascade from it, so rows are hidden, never destroyed.
export async function deleteProduct(input: { id: unknown }) {
  return withOwner(async () => {
    const id = typeof input?.id === "string" ? input.id : "";
    if (!isUuid(id)) return fail("That product doesn't exist.");

    const { supabase } = await assertOwner();
    const { data, error } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) return describeDbError(error);
    if (!data) return fail("That product doesn't exist or was already deleted.");

    refreshAdmin();
    return { ok: true, message: "Product deleted" };
  });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
