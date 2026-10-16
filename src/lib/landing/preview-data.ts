import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getAgencyProduct } from "@/lib/products/agency-queries";
import { buildLanding, type BuiltLanding } from "./build";

// Loads a product's CURRENT (possibly draft) landing content for the
// authenticated preview. Uses the signed-in user's session client, so RLS
// decides what is visible: agency roles and the owner can read drafts,
// nobody else can. Never cached, never public.
//
// The preview never needs the affiliate destination: CTAs render inert in
// preview mode, so hasAffiliateLink is fixed to true purely so the layout
// matches the live page.
export async function loadLandingPreview(productId: string): Promise<(BuiltLanding & { slug: string; name: string }) | null> {
  const product = await getAgencyProduct(productId);
  if (!product || !product.content) return null;

  const supabase = await createClient();
  const { data: cats } = await supabase
    .from("product_categories")
    .select("categories(id, name, slug)")
    .eq("product_id", productId);
  const categories = (cats ?? [])
    .map((r) => (Array.isArray(r.categories) ? r.categories[0] : r.categories))
    .filter((c): c is { id: string; name: string; slug: string } => Boolean(c));

  const c = product.content;
  const images = [...product.images]
    .sort((a, b) => (a.isPrimary !== b.isPrimary ? (a.isPrimary ? -1 : 1) : a.position - b.position))
    .map((i) => ({ url: i.url, alt: i.altText }));

  const built = buildLanding(
    {
      id: product.id,
      name: product.name,
      slug: product.slug,
      categories,
      images,
      overview: c.overview,
      howItWorks: c.howItWorks,
      usage: c.usage,
      whoItsFor: c.whoItsFor,
      considerations: c.considerations,
      benefits: product.benefits,
      ingredients: product.ingredients,
      faqs: product.faqs,
      announcement: c.announcement,
      heroHeadline: c.heroHeadline,
      heroSubtitle: c.heroSubtitle,
      brand: c.brand,
      manufacturer: c.manufacturer,
      sections: c.sections,
      theme: c.theme,
      sources: c.sources,
      lastReviewedAt: c.lastReviewedAt,
    },
    { mode: "preview", hasAffiliateLink: true },
  );
  return { ...built, slug: product.slug, name: product.name };
}
