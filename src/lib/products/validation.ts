export const PRODUCT_NAME_MAX = 120;
export const AFFILIATE_URL_MAX = 2048;

export type FieldResult = { ok: true; value: string } | { ok: false; error: string };

export function validateProductName(raw: unknown): FieldResult {
  const value = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!value) return { ok: false, error: "Enter a product name." };
  if (value.length > PRODUCT_NAME_MAX) {
    return { ok: false, error: `Keep the name under ${PRODUCT_NAME_MAX} characters.` };
  }
  // The slug is built from letters and digits; a name without any would produce a meaningless URL.
  if (!/[\p{L}\p{N}]/u.test(value)) return { ok: false, error: "The name needs at least one letter or number." };
  return { ok: true, value };
}

// Mirrors the database check (^https?://[^\s]+$) and adds a real URL parse,
// so bad input is caught before it reaches Supabase.
export function validateAffiliateUrl(raw: unknown): FieldResult {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { ok: false, error: "Enter the affiliate URL." };
  if (value.length > AFFILIATE_URL_MAX) return { ok: false, error: "That URL is too long." };
  if (/\s/.test(value)) return { ok: false, error: "The URL can't contain spaces." };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "Enter a full URL, starting with https://" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "The URL must start with https:// or http://" };
  }
  if (!url.hostname.includes(".")) return { ok: false, error: "That doesn't look like a valid web address." };
  return { ok: true, value };
}
