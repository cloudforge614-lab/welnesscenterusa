import { indexNowEnabled, indexNowKey } from "@/lib/seo/indexnow";

// IndexNow key verification file (keyLocation). 404 unless IndexNow is
// configured, so an unconfigured deployment exposes nothing.
export const dynamic = "force-dynamic";

export function GET() {
  const key = indexNowKey();
  if (!key || !indexNowEnabled()) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
