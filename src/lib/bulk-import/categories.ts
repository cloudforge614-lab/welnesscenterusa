// Category handling for Bulk Import. Pure (no imports) so it runs unchanged in
// the server action and in plain-Node unit tests.
//
// The database is the source of truth for which categories exist; this file
// only decides whether a CSV cell names one of them. It NEVER creates a
// category — an unknown name is an error the Owner corrects in the CSV.

export type CategoryRef = { id: string; name: string; slug: string };

/** Most categories one product can be given in a single import row. */
export const MAX_CATEGORIES_PER_ROW = 5;

/**
 * Comparison key: case-, spacing-, punctuation-, apostrophe- and "&"/"and"-
 * insensitive, so a category's name matches however it is capitalised or spaced,
 * with or without its apostrophes, and its slug matches too. A genuinely
 * different word (a dropped or altered word) does not match.
 */
export function normalizeCategoryKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’‘`´]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Splits one CSV cell on ";" (the multi-category separator), trims, drops blanks and repeats. */
export function splitCategoryCell(cell: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of cell.split(";")) {
    const name = part.replace(/\s+/g, " ").trim();
    if (!name) continue;
    const key = normalizeCategoryKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export type ResolvedCategories = {
  /** Existing category ids, in the order given, no repeats. */
  ids: string[];
  /** Canonical names of the matched categories (as stored in the database). */
  names: string[];
  /** Cell values that matched no existing category. */
  notFound: string[];
};

export function resolveCategories(requested: string[], catalog: CategoryRef[]): ResolvedCategories {
  const byKey = new Map<string, CategoryRef>();
  for (const c of catalog) {
    for (const key of [normalizeCategoryKey(c.name), normalizeCategoryKey(c.slug)]) {
      if (key && !byKey.has(key)) byKey.set(key, c);
    }
  }
  const ids: string[] = [];
  const names: string[] = [];
  const notFound: string[] = [];
  for (const raw of requested) {
    const hit = byKey.get(normalizeCategoryKey(raw));
    if (!hit) notFound.push(raw);
    else if (!ids.includes(hit.id)) {
      ids.push(hit.id);
      names.push(hit.name);
    }
  }
  return { ids, names, notFound };
}
