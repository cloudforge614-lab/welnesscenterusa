import Link from "next/link";
import type { PublicProductSummary } from "@/lib/products/public-queries";
import { ProductImage } from "./product-image";
import { CategoryChip, PlaceholderImage } from "./ui";

const CARD_IMAGE_SIZES = "(min-width: 1280px) 280px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw";

export function ProductCard({ product, priorityImage = false }: { product: PublicProductSummary; priorityImage?: boolean }) {
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition hover:-translate-y-0.5 hover:shadow-pop">
      <Link href={`/products/${product.slug}`} className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100">
        <span className="sr-only">View {product.name}</span>
      </Link>

      {/* object-contain on a white frame: the whole photo is always visible —
          packaging is never cropped or stretched, whatever its proportions. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-line bg-white">
        {product.imagePath ? (
          <ProductImage
            src={product.imagePath}
            alt={product.imageAlt ?? product.name}
            sizes={CARD_IMAGE_SIZES}
            priority={priorityImage}
            className="p-2 transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <PlaceholderImage className="h-full w-full" />
        )}
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {product.categories.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {product.categories.slice(0, 2).map((c) => (
              <CategoryChip key={c.id}>{c.name}</CategoryChip>
            ))}
          </div>
        )}
        <h3 className="font-display text-lg leading-snug text-ink [overflow-wrap:anywhere] group-hover:text-brand-700">{product.name}</h3>
        {product.excerpt && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">{product.excerpt}</p>}

        {/* mt-auto pins the actions to the bottom of the card, so buttons line
            up across a row of cards whatever the title/excerpt length. */}
        <div className="relative z-20 mt-auto pt-4">
          <span className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-700">
            View product
            <svg viewBox="0 0 24 24" className="size-3.5 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>

          {product.hasAffiliateLink && (
            <>
              {/* Plain <a>, never next/link: /go/[slug] is a server Route
                  Handler that performs an off-site 302 and records a click.
                  Link's viewport/hover prefetch would fire that request — and
                  record a click — before anyone clicked. The href is the
                  internal /go path only; the destination URL is resolved
                  server-side and never reaches this HTML. */}
              <a
                href={`/go/${product.slug}?cta=homepage-card`}
                rel="sponsored nofollow noopener"
                aria-label={`Visit official site for ${product.name} (affiliate link, leaves Wellness Center USA)`}
                className="mt-1 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
              >
                Visit Official Site
                <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <p className="mt-1.5 text-center text-xs text-ink-subtle">Affiliate link · opens the official merchant site</p>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

export function ProductGrid({ products }: { products: PublicProductSummary[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ul>
  );
}
