import Image from "next/image";
import logo from "@/assets/brand/logo.png";

// The official Wellness Center USA logo (src/assets/brand/logo.png — the
// supplied artwork, trimmed of transparent padding and downscaled, never
// redrawn). It is a static import, so next/image knows the intrinsic size:
// only the HEIGHT is set per placement and the width follows automatically
// (w-auto), which keeps the original proportions at every breakpoint. The
// optimizer serves AVIF/WebP at 1x/2x/3x for the small display size, so it
// stays sharp on high-DPI phones without shipping the 960px source.
//
// `sizes` is the widest the logo is ever rendered (height × the 1.66 aspect
// ratio), which is what makes the srcset small.
export function BrandLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src={logo}
      alt="Wellness Center USA"
      sizes="128px"
      priority={priority}
      className={className ?? "h-12 w-auto"}
    />
  );
}
