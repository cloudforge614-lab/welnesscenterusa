import type { Database } from "@/lib/supabase/database.types";

type DeviceType = Database["public"]["Enums"]["device_type"];

// No client JS runs on /go/[slug] — the affiliate URL must never reach the
// browser, so there's no redirect page to run a client-side device check
// from. This is a best-effort heuristic from the User-Agent header only.
export function parseDeviceType(userAgent: string | null): DeviceType {
  if (!userAgent) return "unknown";
  const ua = userAgent;
  if (/iPad|Android(?!.*Mobile)|Tablet|Kindle|Silk/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) return "mobile";
  if (/Mozilla|Chrome|Safari|Firefox|Edg\//i.test(ua)) return "desktop";
  return "unknown";
}
