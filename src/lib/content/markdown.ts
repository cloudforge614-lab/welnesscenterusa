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
// that can execute script or load off-site resources. <img> is allowed ONLY
// for files this site itself serves from /blog-images/ (checked below), so
// markdown can never pull in an off-site image or tracking pixel.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "a", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "code", "pre", "img", "table", "thead", "tbody", "tr", "th", "td"],
  allowedAttributes: {
    // rel/target are added by transformTags below, not by agency input — but
    // sanitize-html still strips any attribute not in this allowlist after
    // the transform runs, so they must be listed here too.
    a: ["href", "title", "rel", "target"],
    img: ["src", "alt", "loading", "decoding"],
  },
  exclusiveFilter: (frame) => frame.tag === "img" && !/^\/blog-images\/[A-Za-z0-9._-]+$/.test(frame.attribs.src ?? ""),
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    // Outbound links only ever need to be safe, not tracked or opened in the
    // current tab away from the article — matches how the rest of the site
    // treats any non-internal link.
    // Internal links (same-site paths) stay in the tab and keep their SEO value.
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      if (/^\/(?!\/)/.test(href)) return { tagName, attribs: { href, ...(attribs.title ? { title: attribs.title } : {}) } };
      return { tagName, attribs: { ...attribs, rel: "noopener noreferrer nofollow", target: "_blank" } };
    },
    img: sanitizeHtml.simpleTransform("img", { loading: "lazy", decoding: "async" }),
  },
};

export function renderMarkdown(source: string | null | undefined): string {
  if (!source) return "";
  const rawHtml = marked.parse(source, { async: false, gfm: true, breaks: true });
  return addHeadingIds(sanitizeHtml(rawHtml, SANITIZE_OPTIONS));
}

function slugifyHeading(text: string): string {
  return text.toLowerCase().replace(/&amp;/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// Adds id="…" to h2/h3 so a table of contents can link to them. Runs on the
// already-sanitized HTML and only ever emits [a-z0-9-], so it cannot add
// anything the sanitizer would have removed.
function addHeadingIds(html: string): string {
  const seen = new Set<string>();
  return html.replace(/<h([23])>([\s\S]*?)<\/h[23]>/g, (_m, level: string, inner: string) => {
    let id = slugifyHeading(inner.replace(/<[^>]+>/g, "")) || `section-${seen.size + 1}`;
    while (seen.has(id)) id += "-2";
    seen.add(id);
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
}

/** The h2 headings of rendered article HTML, for a table of contents. */
export function extractH2Headings(html: string): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  for (const m of html.matchAll(/<h2 id="([a-z0-9-]+)">([\s\S]*?)<\/h2>/g)) {
    out.push({ id: m[1], text: m[2].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim() });
  }
  return out;
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
