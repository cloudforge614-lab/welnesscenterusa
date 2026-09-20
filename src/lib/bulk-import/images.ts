// Image filename normalization and content sniffing for the Owner bulk import.
// Pure (no imports) so it can be used by the browser, the server actions, and
// tests alike. The MIME/size RULES themselves are NOT redefined here — they
// live in src/lib/products/image-constants.ts and are applied by the callers;
// this file only answers "what is this file really?" and "is this filename safe?".

export type SniffedType = "image/jpeg" | "image/png" | "image/webp";

/**
 * Identifies an image by its leading bytes, never by its name or the
 * client-declared MIME type. Returns null for anything that is not one of the
 * three supported formats — SVG, GIF, HTML, PDF, ZIP, executables and
 * everything else are all "null".
 */
export function sniffImageType(bytes: Uint8Array): SniffedType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // WEBP
  ) {
    return "image/webp";
  }
  return null;
}

const EXT_TO_TYPE: Record<string, SniffedType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot <= 0 ? "" : filename.slice(dot + 1).toLowerCase();
}

/** The type a filename CLAIMS to be (from its extension), or null if unsupported. */
export function claimedTypeFromName(filename: string): SniffedType | null {
  return EXT_TO_TYPE[extensionOf(filename)] ?? null;
}

export type FilenameCheck = { ok: true; name: string } | { ok: false; error: string };

/**
 * Validates a filename taken from the CSV. This must be a bare filename: any
 * directory component, traversal sequence, drive letter, control character or
 * hidden-file dot is rejected outright rather than "cleaned up" — a value like
 * ../../x.jpg is a mistake or an attack, and silently rewriting it to x.jpg
 * could match the wrong file.
 */
export function checkCsvImageFilename(raw: string): FilenameCheck {
  const name = raw.trim();
  if (!name) return { ok: false, error: "Enter the image filename." };
  if (name.length > 200) return { ok: false, error: "That image filename is too long." };
  if (/[\u0000-\u001f\u007f]/.test(name)) return { ok: false, error: "The image filename contains control characters." };
  if (/[\\/]/.test(name) || name.includes("..") || /^[a-zA-Z]:/.test(name) || name.startsWith("~")) {
    return { ok: false, error: "Use just the filename (paths such as ../ or folders are not allowed)." };
  }
  if (name.startsWith(".")) return { ok: false, error: "The image filename can't start with a dot." };
  if (!claimedTypeFromName(name)) return { ok: false, error: "Unsupported image type — use .jpg, .jpeg, .png or .webp." };
  return { ok: true, name };
}

/**
 * Reduces a ZIP entry path to a matchable basename, or explains why the entry
 * is unusable. NOTHING is ever written to disk from an entry name — names are
 * only used as lookup keys — but unsafe names are still surfaced and excluded
 * rather than quietly accepted.
 */
export type EntryName =
  | { kind: "file"; basename: string }
  | { kind: "skip" } // directory, macOS resource fork, OS junk: silently ignored
  | { kind: "unsafe"; reason: string };

export function classifyZipEntryName(rawName: string): EntryName {
  if (rawName.endsWith("/") || rawName.endsWith("\\")) return { kind: "skip" };
  if (/[\u0000-\u001f\u007f]/.test(rawName)) return { kind: "unsafe", reason: "control characters in name" };
  const path = rawName.replace(/\\/g, "/");
  if (path.startsWith("/") || /^[a-zA-Z]:/.test(path)) return { kind: "unsafe", reason: "absolute path" };
  const parts = path.split("/");
  if (parts.some((p) => p === "..")) return { kind: "unsafe", reason: "path traversal (..)" };
  if (parts[0] === "__MACOSX") return { kind: "skip" };
  const basename = parts[parts.length - 1];
  if (!basename) return { kind: "skip" };
  if (basename.startsWith("._") || basename === ".DS_Store" || basename.toLowerCase() === "thumbs.db") return { kind: "skip" };
  return { kind: "file", basename };
}
