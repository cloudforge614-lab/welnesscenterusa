import "server-only";

import { siteUrl } from "@/lib/env";

// IndexNow (Bing, Yandex and other participating engines; Google does not use
// it). Notifies engines that a URL changed so they can recrawl it sooner. It
// is a hint, never a ranking or indexing guarantee.
//
// INERT UNLESS CONFIGURED: nothing is sent unless INDEXNOW_KEY is set to a
// valid key AND the site URL is a real https origin (never localhost or a
// preview). The key is verified by engines fetching /indexnow-key.txt, which
// serves the same value. Server-only: the key is not a secret in the IndexNow
// protocol (it is published at keyLocation), but it is environment-configured
// so no key is baked into the repository.

const KEY = process.env.INDEXNOW_KEY ?? "";
const VALID_KEY = /^[A-Za-z0-9-]{8,128}$/;

export function indexNowKey(): string | null {
  return VALID_KEY.test(KEY) ? KEY : null;
}

export function indexNowEnabled(): boolean {
  if (!indexNowKey()) return false;
  try {
    const u = new URL(siteUrl);
    return u.protocol === "https:" && u.hostname !== "localhost" && !u.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

/** Fire-and-forget. Never throws; failures are logged and ignored. */
export async function submitIndexNow(paths: string[]): Promise<void> {
  const key = indexNowKey();
  if (!key || !indexNowEnabled() || paths.length === 0) return;
  const host = new URL(siteUrl).host;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${siteUrl}/indexnow-key.txt`,
        urlList: paths.slice(0, 100).map((p) => `${siteUrl}${p}`),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok && res.status !== 202) console.warn(`[indexnow] submission returned ${res.status}`);
  } catch (error) {
    console.warn("[indexnow] submission failed", error instanceof Error ? error.message : error);
  }
}
