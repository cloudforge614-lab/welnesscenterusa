import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

// Disallow is prefix-matched, so "/admin" also covers /admin/login,
// /admin/products, and every other segment beneath it.
//
// What is deliberately NOT here:
//   • /search — it is noindex'd by its own metadata, which a crawler can only
//     read if it is allowed to fetch the page. Disallowing it in robots.txt
//     would hide that directive and leave the URL eligible to appear as a
//     bare, untitled result. Crawlable-but-noindex is the correct pairing.
//   • every other public route — the whole point of the site is that they are
//     indexed, and a broad disallow here is the easiest way to silently
//     de-index the entire catalogue.
const DISALLOW = [
  // Owner console.
  "/admin",
  // Agency workspace, including /agency/login. Previously missing: the route
  // group is behind auth and every page in it is unreachable to a crawler,
  // but its URLs are linkable and there is no reason to spend crawl budget on
  // a login wall or to have those paths surface in search at all.
  "/agency",
  // Affiliate redirect endpoints. Not content: each one is a 302 that records
  // a click, so crawling them would both pollute the click data and hand
  // crawlers the merchant destinations.
  "/go/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: DISALLOW,
    },
    // Environment-configured, never a hard-coded hostname — siteUrl is the
    // same value canonical and OG URLs are built from, so the sitemap
    // declaration cannot drift from them.
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
