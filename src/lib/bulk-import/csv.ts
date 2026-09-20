// Minimal RFC 4180 CSV parser for the Owner bulk import. No imports, no
// server-only: it is pure so it can be exercised directly in tests.
//
// Handles: UTF-8 BOM, CRLF/LF/CR line endings, quoted fields, commas and
// newlines inside quotes, "" as an escaped quote, and blank lines (dropped).
// It never evaluates or interprets any cell — everything is a plain string.

export const CSV_MAX_BYTES = 1024 * 1024; // 1 MiB is far beyond any sane product list
export const CSV_MAX_ROWS = 200; // data rows; each import row is one sequential request

export type ParsedCsv = {
  header: string[];
  /** Data rows only. `line` is the 1-based physical line the row STARTED on, for error messages. */
  rows: { line: number; cells: string[] }[];
  error?: string;
};

export function parseCsv(input: string): ParsedCsv {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  if (text.includes("\u0000")) return { header: [], rows: [], error: "The file contains binary data, not CSV text." };

  const records: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let cellWasQuoted = false;
  let line = 1;
  let recordLine = 1;
  let i = 0;

  const endCell = () => {
    cells.push(cellWasQuoted ? cell : cell.trim());
    cell = "";
    cellWasQuoted = false;
  };
  const endRecord = () => {
    endCell();
    // Blank line: a single empty unquoted cell.
    const blank = cells.length === 1 && cells[0] === "";
    if (!blank) records.push({ line: recordLine, cells: cells.map((c) => c.trim()) });
    cells = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      if (ch === "\n") line++;
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"' && cell.trim() === "") {
      // A quote only opens a quoted field at the start of a field.
      inQuotes = true;
      cellWasQuoted = true;
      cell = "";
      i++;
      continue;
    }
    if (ch === ",") {
      endCell();
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRecord();
      line++;
      recordLine = line;
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  if (inQuotes) return { header: [], rows: [], error: "A quoted value is never closed (missing closing quote)." };
  if (cell !== "" || cells.length > 0 || cellWasQuoted) endRecord();

  if (records.length === 0) return { header: [], rows: [], error: "The CSV is empty." };
  const [head, ...rows] = records;
  return { header: head.cells.map((h) => h.toLowerCase()), rows };
}
