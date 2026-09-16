import "server-only";

import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

// Agency-authored long-form content (reviews/comparisons/articles/guides) is
// stored as Markdown source and rendered to HTML only here, at render time,
// server-side. Never render agency content with dangerouslySetInnerHTML
// anywhere else — always go through renderMarkdown() first.
//
// Allowlist is intentionally narrow: enough for real editorial formatting
// (headings, emphasis, lists, links, quotes, inline/block code), nothing
// that can execute script or load off-site resources. No <img> — images go
// through the dedicated, RLS-checked upload flow, never inline markdown.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "a", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "code", "pre"],
  allowedAttributes: {
    // rel/target are added by transformTags below, not by agency input — but
    // sanitize-html still strips any attribute not in this allowlist after
    // the transform runs, so they must be listed here too.
    a: ["href", "title", "rel", "target"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    // Outbound links only ever need to be safe, not tracked or opened in the
    // current tab away from the article — matches how the rest of the site
    // treats any non-internal link.
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
  },
};

export function renderMarkdown(source: string | null | undefined): string {
  if (!source) return "";
  const rawHtml = marked.parse(source, { async: false, gfm: true, breaks: true });
  return sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
}

// Plain-text excerpt for list pages / meta descriptions — strips Markdown
// syntax rather than rendering then stripping tags, so it can't ever contain
// even sanitized HTML.
export function markdownExcerpt(source: string | null | undefined, max = 180): string | null {
  if (!source) return null;
  const plain = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return null;
  return plain.length <= max ? plain : `${plain.slice(0, max).trimEnd()}…`;
}
