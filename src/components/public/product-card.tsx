import Link from "next/link";
import type { PublicProductSummary } from "@/lib/products/public-queries";
import { CategoryChip, PlaceholderImage } from "./ui";

// Plain <img>, not next/image: product images (when they exist) come from
// whatever https URL an agency enters (see src/lib/products/image.ts) —
// there's no fixed domain to allowlist in next.config.ts, and allow-listing
// "**" would turn the image optimizer into an open proxy for arbitrary
// URLs. No product in the current dataset has an image yet either way.

export function ProductCard({ product }: { product: PublicProductSummary }) {
  return (
    <li className="group relative overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition hover:-translate-y-0.5 hover:shadow-pop">
      <Link href={`/products/${product.slug}`} className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">
        <span className="sr-only">View {product.name}</span>
      </Link>

      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {product.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element -- see import comment: arbitrary external host, no next/image domain to allowlist
          <img
            src={product.imagePath}
            alt={product.imageAlt ?? product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <PlaceholderImage className="h-full w-full" />
        )}
      </div>

      <div className="p-5">
        {product.categories.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {product.categories.slice(0, 2).map((c) => (
              <CategoryChip key={c.id}>{c.name}</CategoryChip>
            ))}
          </div>
        )}
        <h3 className="font-display text-lg leading-snug text-ink group-hover:text-brand-700">{product.name}</h3>
        {product.excerpt && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">{product.excerpt}</p>}
        <span className="relative z-20 mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
          View product
          <svg viewBox="0 0 24 24" className="size-3.5 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </li>
  );
}

export function ProductGrid({ products }: { products: PublicProductSummary[] }) {
  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ul>
  );
}
