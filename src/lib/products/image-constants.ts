// Shared, client-safe product image constraints (Owner minimal-creation
// workflow). Deliberately NOT "server-only": both the client-side Add
// Product form (for instant validation before a submit round-trip) and the
// server-side upload helper import these same values, so the two can never
// drift apart. The real enforcement is server-side (src/lib/products/
// image-upload.ts) and, beneath that, the product-images Storage bucket's
// own file_size_limit/allowed_mime_types (migration 0020) — this file only
// lets the client fail fast with the same rule the server will apply anyway.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const ALLOWED_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

export function extensionFor(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}
