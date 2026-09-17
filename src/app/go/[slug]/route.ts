import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseDeviceType } from "@/lib/products/device";
import { classifyClick } from "@/lib/products/click-integrity";

// The tracked affiliate redirect. Uses the existing Phase 1 RPCs exclusively
// — get_active_affiliate_link()/record_affiliate_click() are SECURITY
// DEFINER and already re-verify the full two-gate eligibility rule
// server-side (products.status = 'active' AND deleted_at IS NULL AND
// product_content.status = 'published' AND an active affiliate_links row
// exists). This route does not, and must not, query `affiliate_links`
// directly — the anon role has no SELECT grant on that table at all.
//
// The affiliate URL is read here, on the server, and handed to
// NextResponse.redirect() as a Location header. It is never included in
// any JSON body, any rendered HTML, or anything else this handler returns.

export const dynamic = "force-dynamic"; // eligibility must be re-checked on every request, never cached

function notFoundResponse() {
  const html =
    "<!doctype html><html><head><meta charset=\"utf-8\">" +
    "<title>Offer not found</title></head>" +
    '<body style="font-family:system-ui,-apple-system,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1.5rem;color:#1c2420">' +
    "<h1>This offer isn't available</h1>" +
    '<p>The link you followed may be outdated. <a href="/products">Browse our products</a> instead.</p>' +
    "</body></html>";
  return new NextResponse(html, {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

// Splits the Referer header into an external referrer (a different origin —
// e.g. an ad network linking straight to /go/[slug]) versus our own landing
// page (same-origin — the normal case: visitor was on /products/[slug] and
// clicked "View official offer"). This is the only place either value can
// come from; nothing is fabricated or carried over from an earlier request.
function splitReferer(refererHeader: string | null, ownOrigin: string) {
  if (!refererHeader) return { referrer: null, landingPage: null };
  try {
    const url = new URL(refererHeader);
    if (url.origin === ownOrigin) {
      return { referrer: null, landingPage: `${url.pathname}${url.search}` };
    }
    return { referrer: refererHeader, landingPage: null };
  } catch {
    return { referrer: null, landingPage: null };
  }
}

export async function GET(request: NextRequest, props: RouteContext<"/go/[slug]">) {
  const { slug } = await props.params;
  if (!slug || typeof slug !== "string") return notFoundResponse();

  const supabase = await createClient();

  const { data: linkRows, error: linkError } = await supabase.rpc("get_active_affiliate_link", { p_slug: slug });
  if (linkError) {
    console.error("[go] get_active_affiliate_link failed", { slug, error: linkError.message });
    return notFoundResponse();
  }
  const destination = linkRows?.[0]?.destination_url;
  if (!destination) return notFoundResponse();

  // Click integrity (Phase 7.7). Deliberately evaluated AFTER eligibility has
  // already been confirmed and the destination resolved, so it can only ever
  // decide whether this click is *counted* — never whether the visitor gets
  // through. An eligible product always redirects, including for traffic
  // judged automated, so a misjudgement costs an uncounted click rather than a
  // broken link, and there is no behavioural difference for an abuser to probe.
  const decision = classifyClick(slug, request, request.method);

  if (decision.record) {
    const { referrer, landingPage } = splitReferer(request.headers.get("referer"), request.nextUrl.origin);
    const { searchParams } = request.nextUrl;

    try {
      await supabase.rpc("record_affiliate_click", {
        p_slug: slug,
        p_referrer: referrer ?? undefined,
        p_landing_page: landingPage ?? undefined,
        p_cta_location: searchParams.get("cta") ?? undefined,
        p_utm_source: searchParams.get("utm_source") ?? undefined,
        p_utm_medium: searchParams.get("utm_medium") ?? undefined,
        p_utm_campaign: searchParams.get("utm_campaign") ?? undefined,
        p_utm_term: searchParams.get("utm_term") ?? undefined,
        p_utm_content: searchParams.get("utm_content") ?? undefined,
        p_device_type: parseDeviceType(request.headers.get("user-agent")),
      });
    } catch (err) {
      // Tracking is best-effort: a click-logging failure (e.g. the product
      // became ineligible in the instant between the two RPC calls) must
      // never block a visitor who was just handed a valid destination.
      console.error("[go] record_affiliate_click failed", { slug, error: err });
    }
  }
  // No else branch on purpose: a filtered request is not an error and is not
  // logged. Logging every automated hit would turn ordinary crawler traffic
  // into monitoring noise, which Step 7.4 exists to keep clean.

  const response = NextResponse.redirect(destination, { status: 302 });
  response.headers.set("Cache-Control", "no-store");
  // Keeps the merchant from seeing our internal /go/[slug]?cta=...&utm_...
  // path in their server logs — only our origin is sent as referrer.
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}
