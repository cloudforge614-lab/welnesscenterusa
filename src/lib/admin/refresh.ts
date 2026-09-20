import "server-only";

import { revalidatePath } from "next/cache";
import { revalidatePublic, TAGS } from "@/lib/cache/tags";

/**
 * Cache invalidation for Owner product mutations. Shared by the admin actions
 * and Bulk Import so both invalidate exactly the same things.
 *
 * Public cache: the owner controls product status, soft delete, name/slug and
 * the affiliate link — all of which change public eligibility or output.
 * TAGS.redirects: a slug change writes a historical-redirect row via the
 * record_slug_change() trigger (0019), so it is invalidated alongside.
 *
 * updateTag (inside revalidatePublic) is only legal from a Server Action;
 * every caller is one.
 */
export function refreshAdmin() {
  revalidatePublic(TAGS.products, TAGS.categories, TAGS.redirects);
  revalidatePath("/admin", "layout");
}
