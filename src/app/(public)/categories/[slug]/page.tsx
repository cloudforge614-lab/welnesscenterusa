import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pagination } from "@/components/public/pagination";
import { ProductGrid } from "@/components/public/product-card";
import { EmptyState } from "@/components/public/ui";
import { siteUrl } from "@/lib/env";
import { safeJsonLd } from "@/lib/content/json-ld";
import { ContentLinkSection } from "@/components/public/content-link-section";
import {
  getCategoryProducts,
  getCategorySeoMetadata,
  getPublicCategory,
  PUBLIC_PAGE_SIZE,
} from "@/lib/products/public-queries";
import { getGuidesByCategory } from "@/lib/guides/public-queries";
import { getArticlesByCategory } from "@/lib/articles/public-queries";

function parsePage(value: string | string[] | undefined): number {
  const n = Number.parseInt(Array.isArray(value) ? value[0] : (value ?? "1"), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function generateMetadata(props: PageProps<"/categories/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const category = await getPublicCategory(slug);
  if (!category) return { title: "Category not found" };

  const seo = await getCategorySeoMetadata(category.id);
  const canonical = `${siteUrl}/categories/${category.slug}`;
  const title = seo?.title || category.name;
  const description = seo?.metaDescription || category.description || `Browse ${category.name} products at Wellness Center USA.`;
  const indexable = (seo?.robotsIndex ?? true) && (seo?.robotsFollow ?? true);

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: indexable, follow: seo?.robotsFollow ?? true },
    openGraph: {
      title: seo?.ogTitle || title,
      description: seo?.ogDescription || description,
      url: canonical,
      type: "website",
    },
  };
}

export default async function CategoryPage(props: PageProps<"/categories/[slug]">) {
  const { slug } = await props.params;
  const { page: pageParam } = await props.searchParams;
  const page = parsePage(pageParam);

  const category = await getPublicCategory(slug);
  if (!category) notFound();

  // Parallel: pagination (products) and the two new sections all only need
  // category.id, already known — no reason to fetch them one after another.
  const [{ items, totalCount, pageCount }, categoryGuides, categoryArticles] = await Promise.all([
    getCategoryProducts(category.id, page),
    getGuidesByCategory(category.id),
    getArticlesByCategory(category.id),
  ]);
  const canonical = `${siteUrl}/categories/${category.slug}`;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Categories", item: `${siteUrl}/categories` },
      { "@type": "ListItem", position: 2, name: category.name, item: canonical },
    ],
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbLd) }} />

      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/categories" className="hover:text-ink">
              Categories
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-ink" aria-current="page">
            {category.name}
          </li>
        </ol>
      </nav>

      <div className="mt-4 max-w-2xl">
        <h1 className="font-display text-4xl text-ink">{category.name}</h1>
        {category.description && <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">{category.description}</p>}
      </div>

      <div className="mt-10">
        {items.length > 0 ? (
          <ProductGrid products={items} />
        ) : (
          <EmptyState
            title="No products in this category yet"
            description="Check back soon, or browse the full product directory."
            action={
              <Link
                href="/products"
                className="inline-flex items-center justify-center rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium text-ink shadow-card transition hover:bg-sunken"
              >
                Browse all products
              </Link>
            }
          />
        )}
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        totalCount={totalCount}
        pageSize={PUBLIC_PAGE_SIZE}
        basePath={`/categories/${category.slug}`}
      />

      {categoryGuides.length > 0 && (
        <ContentLinkSection id="category-guides-heading" title="Guides in this category" items={categoryGuides} hrefFor={(g) => `/guides/${g.slug}`} labelFor={(g) => g.title} />
      )}
      {categoryArticles.length > 0 && (
        <ContentLinkSection id="category-articles-heading" title="Articles in this category" items={categoryArticles} hrefFor={(a) => `/blog/${a.slug}`} labelFor={(a) => a.title} />
      )}
    </div>
  );
}
