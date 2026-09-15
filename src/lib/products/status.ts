import type { Database } from "@/lib/supabase/database.types";

export type ProductStatus = Database["public"]["Enums"]["product_status"];
export type ContentStatus = Database["public"]["Enums"]["content_status"];

export type Tone = "brand" | "amber" | "sky" | "rose" | "stone";

export const STATUS_META: Record<ProductStatus, { label: string; tone: Tone; hint: string }> = {
  new: { label: "New", tone: "sky", hint: "Added, not yet activated" },
  active: { label: "Active", tone: "brand", hint: "Activated by you" },
  paused: { label: "Paused", tone: "amber", hint: "Hidden from the public site" },
  archived: { label: "Archived", tone: "stone", hint: "Retired, hidden from the public site" },
};

export function contentMeta(content: ContentStatus | null): { label: string; tone: Tone } {
  if (content === "published") return { label: "Published", tone: "brand" };
  if (content === "draft") return { label: "Agency drafting", tone: "sky" };
  return { label: "Awaiting agency", tone: "amber" };
}

// Mirrors the two-gate rule enforced by RLS (products_public_select).
export function isLive(status: ProductStatus, content: ContentStatus | null) {
  return status === "active" && content === "published";
}

export const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "awaiting", label: "Awaiting agency" },
  { value: "archived", label: "Archived" },
] as const;

export type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

export function parseStatusFilter(value: unknown): StatusFilter {
  return STATUS_FILTERS.some((f) => f.value === value) ? (value as StatusFilter) : "all";
}
