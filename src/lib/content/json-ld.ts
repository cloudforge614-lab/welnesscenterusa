// JSON.stringify() alone does not escape "</script" sequences. A value that
// contains that literal text (e.g. a FAQ answer or review body authored by
// an agency user) would prematurely close the <script type="application/
// ld+json"> tag it's embedded in and let anything after it be parsed as
// live HTML/script — a real injection vector, not a theoretical one, since
// this data is agency-authored free text. Escaping "<" as < is the
// standard fix (recommended by both the JSON-LD and React communities) and
// is a no-op for valid JSON-LD, which never needs a literal "<" character.
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
