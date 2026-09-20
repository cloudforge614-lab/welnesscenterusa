"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { importBulkRow, validateBulkImport, type ImportRowResult } from "@/app/admin/bulk-import-actions";
import { CSV_MAX_BYTES } from "@/lib/bulk-import/csv";
import { claimedTypeFromName, classifyZipEntryName, sniffImageType } from "@/lib/bulk-import/images";
import type { ManifestImage, Preview } from "@/lib/bulk-import/plan";
import { openZip, ZipError, ZIP_MAX_ARCHIVE_BYTES } from "@/lib/bulk-import/zip";
import { MAX_IMAGE_BYTES } from "@/lib/products/image-constants";
import { Badge, buttonStyles, Card, cx, inputStyles, Spinner } from "./ui";

// Image bytes are read in THIS browser tab (a picked File or a ZIP entry) and
// sent to the server one image per request — the hosting platform caps a
// request body at ~4.5 MB, so a whole-ZIP upload could not work for a real
// catalogue. Nothing is written to disk anywhere and nothing is executed; ZIP
// entry names are only lookup keys. The server re-validates every row and
// re-sniffs every image's bytes, so nothing here is a security boundary — it
// only decides what to send.

type Source = { name: string; get: () => Promise<File> };

type Phase = "idle" | "scanning" | "previewed" | "importing" | "done";

async function readHead(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, 16).arrayBuffer());
}

async function scanImages(
  files: File[],
  onProgress: (label: string) => void,
): Promise<{ manifest: ManifestImage[]; sources: Source[]; notes: string[] }> {
  const manifest: ManifestImage[] = [];
  const sources: Source[] = [];
  const notes: string[] = [];
  let ignored = 0;

  for (const file of files) {
    const isZip = file.name.toLowerCase().endsWith(".zip");
    if (isZip) {
      if (file.size > ZIP_MAX_ARCHIVE_BYTES) throw new Error(`${file.name} is too large (limit ${ZIP_MAX_ARCHIVE_BYTES / 1024 / 1024} MB).`);
      let entries;
      try {
        entries = await openZip(file);
      } catch (err) {
        throw new Error(err instanceof ZipError ? `${file.name}: ${err.message}` : `${file.name} could not be read as a ZIP file.`);
      }
      let n = 0;
      for (const entry of entries) {
        const cls = classifyZipEntryName(entry.name);
        if (cls.kind === "skip") continue;
        if (cls.kind === "unsafe") {
          notes.push(`Skipped unsafe ZIP entry “${entry.name.slice(0, 80)}” (${cls.reason}).`);
          continue;
        }
        // Only supported image extensions are ever read; anything else in the
        // archive (scripts, executables, nested ZIPs…) is counted and ignored.
        if (!claimedTypeFromName(cls.basename)) {
          ignored++;
          continue;
        }
        n++;
        onProgress(`Scanning images (${n})…`);
        try {
          const data = await entry.read(MAX_IMAGE_BYTES);
          manifest.push({ name: cls.basename, size: data.length, sniffed: sniffImageType(data) });
          const type = sniffImageType(data);
          sources.push({
            name: cls.basename,
            // Re-read on demand at import time so the whole ZIP is never held in memory.
            get: async () => new File([(await entry.read(MAX_IMAGE_BYTES)) as BlobPart], cls.basename, { type: type ?? "" }),
          });
        } catch (err) {
          const tooLarge = err instanceof ZipError && err.code === "too-large";
          manifest.push({ name: cls.basename, size: entry.declaredSize, sniffed: null, problem: tooLarge ? "too-large" : "unreadable" });
          sources.push({ name: cls.basename, get: async () => { throw new Error("unreadable"); } });
        }
      }
    } else if (claimedTypeFromName(file.name)) {
      if (file.size > MAX_IMAGE_BYTES) {
        manifest.push({ name: file.name, size: file.size, sniffed: null, problem: "too-large" });
      } else {
        manifest.push({ name: file.name, size: file.size, sniffed: sniffImageType(await readHead(file)) });
      }
      sources.push({ name: file.name, get: async () => file });
    } else {
      ignored++;
    }
  }
  if (ignored > 0) notes.push(`${ignored} file${ignored === 1 ? "" : "s"} that aren't JPEG/PNG/WebP images were ignored.`);
  return { manifest, sources, notes };
}

export function BulkImport() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ImportRowResult[]>([]);
  const [cancelled, setCancelled] = useState(false);

  const csvTextRef = useRef("");
  const sourcesRef = useRef<Source[]>([]);
  const cancelRef = useRef(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const busy = phase === "scanning" || phase === "importing";

  function invalidate() {
    setPreview(null);
    setResults([]);
    setError(null);
    setNotes([]);
    setPhase("idle");
  }

  async function validate() {
    setError(null);
    if (!csvFile) return setError("Choose your CSV file first.");
    if (imageFiles.length === 0) return setError("Choose your ZIP file or image files first.");
    if (csvFile.size > CSV_MAX_BYTES) return setError("The CSV file is too large.");

    setPhase("scanning");
    setBusyLabel("Reading files…");
    setResults([]);
    try {
      csvTextRef.current = await csvFile.text();
      const { manifest, sources, notes: scanNotes } = await scanImages(imageFiles, setBusyLabel);
      sourcesRef.current = sources;
      setNotes(scanNotes);
      setBusyLabel("Validating…");
      const res = await validateBulkImport({ csvText: csvTextRef.current, images: manifest });
      if (!res.ok) {
        setError(res.error);
        setPhase("idle");
        return;
      }
      setPreview(res.preview);
      setPhase("previewed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while reading your files.");
      setPhase("idle");
    }
  }

  async function runImport() {
    if (!preview?.canImport) return;
    const rows = preview.rows.filter((r) => r.ok);
    cancelRef.current = false;
    setCancelled(false);
    setResults([]);
    setProgress({ done: 0, total: rows.length });
    setPhase("importing");

    const out: ImportRowResult[] = [];
    for (const row of rows) {
      if (cancelRef.current) break;
      let result: ImportRowResult;
      try {
        const source = sourcesRef.current.find((s) => s.name === row.image.matchedName);
        if (!source) throw new Error("The image for this row is no longer available.");
        const file = await source.get();
        const fd = new FormData();
        fd.set("csvText", csvTextRef.current);
        fd.set("line", String(row.line));
        fd.set("image", file);
        result = await importBulkRow(fd);
      } catch {
        // Network failure, or the platform rejected the request before it reached the app.
        result = { ok: false, line: row.line, name: row.name, error: "The upload failed (connection problem or the request was too large). This row was not imported." };
      }
      out.push(result);
      setResults([...out]);
      setProgress({ done: out.length, total: rows.length });
    }
    if (cancelRef.current) setCancelled(true);
    setPhase("done");
  }

  function reset() {
    setCsvFile(null);
    setImageFiles([]);
    if (csvInputRef.current) csvInputRef.current.value = "";
    if (imgInputRef.current) imgInputRef.current.value = "";
    sourcesRef.current = [];
    csvTextRef.current = "";
    invalidate();
  }

  const imported = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="bulk-csv" className="block text-sm font-medium text-ink">
              CSV file
            </label>
            <input
              id="bulk-csv"
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(e) => {
                setCsvFile(e.target.files?.[0] ?? null);
                invalidate();
              }}
              className={cx(inputStyles, "file:mr-3 file:rounded-md file:border-0 file:bg-sunken file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink")}
            />
            <p className="text-xs text-ink-subtle">Columns: product_name, affiliate_url, image_filename</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="bulk-images" className="block text-sm font-medium text-ink">
              ZIP / images
            </label>
            <input
              id="bulk-images"
              ref={imgInputRef}
              type="file"
              multiple
              accept=".zip,.jpg,.jpeg,.png,.webp,application/zip,image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(e) => {
                setImageFiles(Array.from(e.target.files ?? []));
                invalidate();
              }}
              className={cx(inputStyles, "file:mr-3 file:rounded-md file:border-0 file:bg-sunken file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink")}
            />
            <p className="text-xs text-ink-subtle">One ZIP, or several JPG / PNG / WebP files. Up to 5 MB each.</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" className={buttonStyles.primary} onClick={validate} disabled={busy || !csvFile || imageFiles.length === 0}>
            {phase === "scanning" && <Spinner />}
            {phase === "scanning" ? busyLabel : "Validate Import"}
          </button>
          {(csvFile || imageFiles.length > 0 || preview) && phase !== "importing" && (
            <button type="button" className={buttonStyles.secondary} onClick={reset}>
              Start over
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-rose-soft px-3.5 py-2.5 text-sm text-rose-ink">
            {error}
          </p>
        )}
      </Card>

      {preview?.fatal && (
        <p role="alert" className="rounded-lg bg-rose-soft px-3.5 py-2.5 text-sm text-rose-ink">
          {preview.fatal}
        </p>
      )}

      {preview && !preview.fatal && (
        <Card>
          <div className="border-b border-line p-5 sm:p-6">
            <h2 className="font-display text-xl text-ink">Import preview</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              <Stat label="Products found" value={preview.summary.found} />
              <Stat label="Images matched" value={preview.summary.imagesMatched} />
              <Stat label="Missing images" value={preview.summary.missingImages} bad />
              <Stat label="Invalid URLs" value={preview.summary.invalidUrls} bad />
              <Stat label="Duplicate products" value={preview.summary.duplicates} bad />
              {preview.hasCategoryColumn && <Stat label="Invalid categories" value={preview.summary.invalidCategories} bad />}
              <Stat label="Validation errors" value={preview.summary.errorRows} bad />
            </dl>
            {preview.summary.unusedImages > 0 && (
              <p className="mt-3 text-sm text-ink-muted">
                {preview.summary.unusedImages} uploaded image{preview.summary.unusedImages === 1 ? " isn't" : "s aren't"} referenced by the CSV and won&apos;t be imported.
              </p>
            )}
            {notes.map((n) => (
              <p key={n} className="mt-2 text-sm text-ink-muted">
                {n}
              </p>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-sunken/60 text-xs uppercase tracking-wide text-ink-subtle">
                <tr>
                  <th className="px-4 py-3 font-medium">Product Name</th>
                  <th className="px-4 py-3 font-medium">Image</th>
                  {preview.hasCategoryColumn && <th className="px-4 py-3 font-medium">Categories</th>}
                  <th className="px-4 py-3 font-medium">Affiliate URL</th>
                  <th className="px-4 py-3 font-medium">Validation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {preview.rows.map((row) => (
                  <tr key={row.line} className="align-top">
                    <td className="px-4 py-3">
                      <span className="font-medium text-ink">{row.name || "—"}</span>
                      <span className="ml-2 text-xs text-ink-subtle">line {row.line}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={row.image.status === "matched" ? "brand" : "rose"}>{row.image.label}</Badge>
                      <div className="mt-1 break-all text-xs text-ink-subtle">{row.imageFilename}</div>
                    </td>
                    {preview.hasCategoryColumn && (
                      <td className="px-4 py-3 text-ink-muted">{row.categories.length > 0 ? row.categories.join(", ") : "—"}</td>
                    )}
                    <td className="px-4 py-3">
                      <Badge tone={row.url.status === "valid" ? "brand" : "rose"}>{row.url.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {row.ok ? (
                        <Badge tone="brand">Ready</Badge>
                      ) : (
                        <ul className="space-y-1 text-rose-ink">
                          {row.errors.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line p-5 sm:p-6">
            {preview.canImport ? (
              <>
                <button type="button" className={buttonStyles.primary} onClick={runImport} disabled={phase !== "previewed"}>
                  {phase === "importing" && <Spinner />}
                  Import Products
                </button>
                <p className="text-sm text-ink-muted">
                  {preview.summary.found} product{preview.summary.found === 1 ? "" : "s"} will be created and go live on the homepage.
                </p>
              </>
            ) : (
              <p role="alert" className="text-sm text-rose-ink">
                Nothing can be imported yet. Fix the errors above in your CSV or images, then choose the files and validate again — no rows are imported until the whole batch is valid.
              </p>
            )}
          </div>
        </Card>
      )}

      {(phase === "importing" || phase === "done") && (
        <Card className="p-5 sm:p-6">
          <div
            role="progressbar"
            aria-label="Import progress"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            className="h-2.5 w-full overflow-hidden rounded-full bg-sunken"
          >
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            {phase === "importing" ? `Importing… ${progress.done} of ${progress.total}` : `Processed ${progress.done} of ${progress.total}`}
          </p>
          {phase === "importing" && (
            <button
              type="button"
              className={cx(buttonStyles.secondary, "mt-3")}
              onClick={() => {
                cancelRef.current = true;
              }}
            >
              Stop after this product
            </button>
          )}

          {phase === "done" && (
            <div className="mt-5 space-y-4" data-testid="import-result">
              {cancelled && (
                <p className="rounded-lg bg-amber-soft px-3.5 py-2.5 text-sm text-amber-ink">
                  Stopped early. Products already created stay live; re-running the same CSV will skip them as duplicates.
                </p>
              )}
              <p className="text-base font-medium text-ink">Successfully imported: {imported}</p>
              <p className="text-base font-medium text-ink">Failed: {failed.length}</p>
              {results.filter((r) => r.ok && r.warning).map((r) => (
                <p key={r.line} className="text-sm text-amber-ink">
                  Line {r.line} — {r.name}: {r.ok && r.warning}
                </p>
              ))}
              {failed.length > 0 && (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {failed.map((r) => (
                    <li key={r.line} className="px-4 py-3 text-sm">
                      <span className="font-medium text-ink">
                        Line {r.line}
                        {r.name ? ` — ${r.name}` : ""}
                      </span>
                      <span className="block text-rose-ink">{!r.ok && r.error}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-3">
                <Link href="/admin/products" className={buttonStyles.primary}>
                  View products
                </Link>
                <button type="button" className={buttonStyles.secondary} onClick={reset}>
                  Import another batch
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-sunken/40 px-3 py-2.5">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className={cx("mt-0.5 text-xl font-semibold", bad && value > 0 ? "text-rose-ink" : "text-ink")}>{value}</dd>
    </div>
  );
}
