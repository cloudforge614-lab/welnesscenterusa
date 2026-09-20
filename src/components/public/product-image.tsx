import Image from "next/image";
import { cx } from "@/lib/format";

// Renders a product photo without cropping or stretching it (object-contain
// inside a fixed-aspect frame) and without shipping the multi-megabyte
// original to every visitor.
//
// Uploads to the product-images bucket (the Owner dialog, Bulk Import, the
// Agency image manager) are served through the Next.js image optimizer: it
// resizes to the size the card actually needs and re-encodes to AVIF/WebP.
// next.config.ts only allowlists THAT bucket's public path on the project's
// own Supabase host, so the optimizer is not an open proxy.
//
// Anything else — a legacy image whose storage_path is an arbitrary external
// https URL — has no allowlisted host and keeps the plain <img> it always had.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const OPTIMIZABLE_PREFIX = supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/product-images/` : null;

export function ProductImage({
  src,
  alt,
  sizes,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const classes = cx("h-full w-full object-contain", className);
  if (OPTIMIZABLE_PREFIX && src.startsWith(OPTIMIZABLE_PREFIX)) {
    return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={classes} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary external host: no next/image domain to allowlist
    <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" className={classes} />
  );
}
