"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// GA4, configured deliberately rather than dropped in with its defaults.
//
// WHY NOT @next/third-parties
// Its <GoogleAnalytics> component is the documented convenience wrapper, but
// the package is described in Next's own docs as "experimental ... under active
// development", and the component initialises gtag with default settings and
// offers no hook for the three things that actually matter here: turning off
// cookie storage, turning off advertising signals, and controlling what URL is
// reported. Writing the ~20 lines directly costs nothing, adds no dependency,
// and makes every privacy decision visible in this file.
//
// COOKIELESS, DELIBERATELY
// client_storage: "none" stops gtag writing the _ga cookie, so this site still
// sets no cookies for public visitors. That keeps the Step 7.3 privacy
// position intact and means there is no non-essential cookie to obtain consent
// for. The cost is real and worth stating: without a persisted client id, GA
// cannot recognise a returning visitor, so "users" and "sessions" are inflated
// and retention reports are meaningless. Page views, events, traffic sources,
// geography and device breakdowns all still work, and affiliate clicks already
// have a separate, accurate source of truth in Supabase. Turning cookies on
// would improve those metrics but requires a consent mechanism that does not
// exist — that is a product decision, not something to enable quietly.
//
// URLS ARE REDACTED
// gtag's automatic page_view reports the full location, including the query
// string. On this site that would send raw search terms to Google, and on a
// health and wellness site a search term can reveal something about a person's
// health. send_page_view is therefore disabled and each page_view is sent
// manually with the path only — never the query string, never a fragment.

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function Analytics({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  // The init script sends the first page_view itself, so the effect must not
  // duplicate it on mount — only on subsequent client-side navigations.
  const initialPath = useRef(pathname);

  useEffect(() => {
    if (pathname === initialPath.current) return;
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "page_view", {
      page_path: pathname,
      page_location: `${window.location.origin}${pathname}`,
      page_title: document.title,
    });
  }, [pathname]);

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied'
});
gtag('config', '${measurementId}', {
  client_storage: 'none',
  anonymize_ip: true,
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
  send_page_view: false
});
gtag('event', 'page_view', {
  page_path: location.pathname,
  page_location: location.origin + location.pathname,
  page_title: document.title
});
        `}
      </Script>
    </>
  );
}

/**
 * Reports that a search happened, and whether it found anything — never what
 * was searched for.
 *
 * "How often does search come up empty?" is genuinely actionable for content
 * planning, and it can be answered without recording a single query. The raw
 * term is deliberately not sent for the reason described above; if the owner
 * later decides search terms are worth collecting, that is a privacy decision
 * to take explicitly, and the privacy policy would have to change with it.
 */
export function SearchAnalytics({ hasResults }: { hasResults: boolean }) {
  useEffect(() => {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "search", { has_results: hasResults });
  }, [hasResults]);
  return null;
}
