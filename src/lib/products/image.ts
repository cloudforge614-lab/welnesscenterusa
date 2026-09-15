// No Supabase Storage bucket exists yet for product_images (Phase 1 never
// created one, and Phase 3 is explicitly not adding one — that belongs to
// the future agency CMS/upload workflow). `storage_path` is a bare text
// column today, so the only safe interpretation is: if it's already a full
// URL, use it; otherwise there's nothing we can resolve it against, so show
// the fallback UI instead of guessing a bucket name.
export function resolveImageUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  return /^https?:\/\//i.test(storagePath) ? storagePath : null;
}
