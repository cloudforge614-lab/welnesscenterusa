import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { isUuid } from "./queries";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type CategoryOption = { id: string; name: string; slug: string };

/**
 * Every category, for pickers and for Bulk Import matching. The categories
 * table is publicly readable (taxonomy, no draft state), so this needs no
 * elevated access and reveals nothing private.
 */
export async function listCategories(supabase: Supabase): Promise<CategoryOption[]> {
  const { data, error } = await supabase.from("categories").select("id, name, slug").order("name", { ascending: true });
  if (error) throw new Error(`Failed to load categories: ${error.message}`);
  return data ?? [];
}

/** Keeps only well-formed, distinct UUIDs — the database's foreign key decides whether they exist. */
export function cleanCategoryIds(raw: unknown[]): string[] {
  return [...new Set(raw.filter((v): v is string => typeof v === "string" && isUuid(v)))];
}

/**
 * Makes `categoryIds` the product's exact category set (adds the missing ones,
 * removes the rest) through the existing product_categories many-to-many.
 * Runs as the signed-in Owner, so RLS (product_categories_manage/_delete) is the
 * boundary; nothing here touches affiliate data.
 */
export async function setProductCategories(
  supabase: Supabase,
  productId: string,
  categoryIds: string[],
): Promise<{ ok: true } | { ok: false; code?: string }> {
  const { data: current, error: readError } = await supabase.from("product_categories").select("category_id").eq("product_id", productId);
  if (readError) return { ok: false, code: readError.code };

  const have = new Set((current ?? []).map((r) => r.category_id));
  const want = new Set(categoryIds);
  const toAdd = categoryIds.filter((id) => !have.has(id));
  const toRemove = [...have].filter((id) => !want.has(id));

  if (toAdd.length > 0) {
    const { error } = await supabase.from("product_categories").insert(toAdd.map((category_id) => ({ product_id: productId, category_id })));
    if (error) return { ok: false, code: error.code };
  }
  if (toRemove.length > 0) {
    const { error } = await supabase.from("product_categories").delete().eq("product_id", productId).in("category_id", toRemove);
    if (error) return { ok: false, code: error.code };
  }
  return { ok: true };
}
