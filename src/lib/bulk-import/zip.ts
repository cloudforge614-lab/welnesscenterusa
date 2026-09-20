// Minimal, read-only ZIP reader for the Owner bulk import. No imports: uses
// only web-platform globals (Blob, TextDecoder, DecompressionStream), which
// exist in every modern browser and in Node 18+, so the same code runs in the
// Owner's browser and in tests.
//
// WHY THIS EXISTS INSTEAD OF A LIBRARY
// The project rule is "no new dependency unless clearly justified". A ZIP
// *reader* for stored/deflate entries is ~150 lines, and owning it means the
// hostile-input handling below is explicit and auditable rather than inherited.
//
// SAFETY MODEL
//  • Nothing is ever written to disk or executed. Entry names are used only as
//    lookup keys; there is no extraction directory, so "zip slip" (an entry
//    named ../../x escaping a target directory) has nothing to escape.
//  • Only the central directory is trusted for structure, and every offset and
//    length is bounds-checked against the real blob size.
//  • Encrypted, ZIP64, multi-disk and unknown-compression entries are refused.
//  • Decompression is STREAMED with a hard byte cap, so a "zip bomb" (tiny
//    archive, gigantic inflated output) or a header that lies about its
//    uncompressed size is cut off at the cap, not buffered.
//  • CRC32 and the declared size are verified after inflating.

export const ZIP_MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;
export const ZIP_MAX_ENTRIES = 1000;
const CENTRAL_DIR_MAX_BYTES = 4 * 1024 * 1024;

export type ZipEntry = {
  /** Raw name as stored in the archive (may contain directories). */
  name: string;
  /** Size the archive CLAIMS the entry inflates to. Not trusted; verified on read. */
  declaredSize: number;
  /** Reads and verifies the entry. Throws ZipError if it exceeds maxBytes or is corrupt. */
  read: (maxBytes: number) => Promise<Uint8Array>;
};

export class ZipError extends Error {
  constructor(message: string, readonly code: "not-zip" | "unsupported" | "corrupt" | "too-large") {
    super(message);
    this.name = "ZipError";
  }
}

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function bytesOf(blob: Blob, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer());
}

async function inflateRawCapped(compressed: Uint8Array, maxBytes: number): Promise<Uint8Array> {
  const stream = new Blob([compressed as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ZipError("Entry is larger than allowed once decompressed.", "too-large");
      }
      chunks.push(value);
    }
  } catch (err) {
    if (err instanceof ZipError) throw err;
    throw new ZipError("Entry could not be decompressed (corrupt data).", "corrupt");
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export async function openZip(blob: Blob): Promise<ZipEntry[]> {
  if (blob.size > ZIP_MAX_ARCHIVE_BYTES) throw new ZipError("The ZIP file is too large.", "too-large");
  if (blob.size < 22) throw new ZipError("This is not a ZIP file.", "not-zip");

  // End of central directory record: last 22 bytes + optional comment (<= 65535).
  const tailStart = Math.max(0, blob.size - (22 + 65535));
  const tail = await bytesOf(blob, tailStart, blob.size);
  const tv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError("This is not a ZIP file.", "not-zip");

  const diskNo = tv.getUint16(eocd + 4, true);
  const cdDisk = tv.getUint16(eocd + 6, true);
  const entriesOnDisk = tv.getUint16(eocd + 8, true);
  const totalEntries = tv.getUint16(eocd + 10, true);
  const cdSize = tv.getUint32(eocd + 12, true);
  const cdOffset = tv.getUint32(eocd + 16, true);

  if (diskNo !== 0 || cdDisk !== 0 || entriesOnDisk !== totalEntries) {
    throw new ZipError("Multi-part ZIP archives are not supported.", "unsupported");
  }
  if (totalEntries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new ZipError("ZIP64 archives are not supported.", "unsupported");
  }
  if (totalEntries > ZIP_MAX_ENTRIES) throw new ZipError(`The ZIP has too many files (limit ${ZIP_MAX_ENTRIES}).`, "too-large");
  if (cdSize > CENTRAL_DIR_MAX_BYTES || cdOffset + cdSize > blob.size) {
    throw new ZipError("The ZIP directory is corrupt.", "corrupt");
  }

  const cd = await bytesOf(blob, cdOffset, cdOffset + cdSize);
  const dv = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const decoder = new TextDecoder("utf-8");
  const entries: ZipEntry[] = [];
  let p = 0;

  for (let n = 0; n < totalEntries; n++) {
    if (p + 46 > cd.length || dv.getUint32(p, true) !== 0x02014b50) throw new ZipError("The ZIP directory is corrupt.", "corrupt");
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    const compSize = dv.getUint32(p + 20, true);
    const uncompSize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    if (p + 46 + nameLen + extraLen + commentLen > cd.length) throw new ZipError("The ZIP directory is corrupt.", "corrupt");
    const name = decoder.decode(cd.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    const isDirectory = name.endsWith("/");
    const supported = method === 0 || method === 8;
    const encrypted = (flags & 0x1) !== 0;
    const zip64 = compSize === 0xffffffff || uncompSize === 0xffffffff || localOffset === 0xffffffff;

    entries.push({
      name,
      declaredSize: uncompSize,
      read: async (maxBytes: number) => {
        if (isDirectory) throw new ZipError("Entry is a directory.", "corrupt");
        if (encrypted) throw new ZipError("Encrypted ZIP entries are not supported.", "unsupported");
        if (zip64) throw new ZipError("ZIP64 entries are not supported.", "unsupported");
        if (!supported) throw new ZipError("Unsupported ZIP compression method.", "unsupported");
        if (uncompSize > maxBytes) throw new ZipError("Entry is larger than allowed.", "too-large");
        // Compressed data can be a little larger than the original for incompressible input.
        if (compSize > maxBytes + 1024 * 1024) throw new ZipError("Entry is larger than allowed.", "too-large");
        if (localOffset + 30 > blob.size) throw new ZipError("The ZIP entry is corrupt.", "corrupt");

        const local = await bytesOf(blob, localOffset, localOffset + 30);
        const lv = new DataView(local.buffer, local.byteOffset, local.byteLength);
        if (lv.getUint32(0, true) !== 0x04034b50) throw new ZipError("The ZIP entry is corrupt.", "corrupt");
        const dataStart = localOffset + 30 + lv.getUint16(26, true) + lv.getUint16(28, true);
        if (dataStart + compSize > blob.size) throw new ZipError("The ZIP entry is corrupt.", "corrupt");

        const compressed = await bytesOf(blob, dataStart, dataStart + compSize);
        const data = method === 0 ? compressed : await inflateRawCapped(compressed, maxBytes);
        if (data.length > maxBytes) throw new ZipError("Entry is larger than allowed.", "too-large");
        // A header that lies about size or checksum is treated as corruption.
        if (data.length !== uncompSize) throw new ZipError("The ZIP entry size does not match its header.", "corrupt");
        if (crc32(data) !== crc) throw new ZipError("The ZIP entry failed its checksum.", "corrupt");
        return data;
      },
    });
  }
  return entries;
}
