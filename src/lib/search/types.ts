// Unified site-wide search — shared shape and the one place the per-type
// result cap lives, so changing it later never means touching five files.

export const SEARCH_RESULT_LIMIT = 6;

export type SearchResultType = "product" | "review" | "guide" | "article" | "comparison";

// Deliberately flat and minimal: every field here already exists on one of
// the five content types' own public summary types (or maps trivially, e.g.
// product.name -> title). There is no affiliate field to accidentally
// include — none of the five source queries this type is built from ever
// selects affiliate_links/affiliate_clicks in the first place.
export type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  slug: string;
  url: string;
  excerpt: string | null;
  publishedAt: string | null;
  imagePath: string | null;
};

export const SEARCH_TYPE_LABEL: Record<SearchResultType, string> = {
  product: "Product",
  review: "Review",
  guide: "Guide",
  article: "Article",
  comparison: "Comparison",
};
