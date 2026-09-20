import Papa from "papaparse";

/**
 * Column names (case-insensitive) that may hold the feedback text in a
 * header row, in priority order. `cleaned_text` is last because benchmark
 * files usually carry both `text` and `cleaned_text` and the raw text is
 * preferred.
 */
const TEXT_COLUMNS = ["text", "content", "feedback", "comment", "response", "cleaned_text"];

export interface ParsedFeedbackFile {
  /** Unique, non-empty feedback texts ready for insertion. */
  items: string[];
  /** Total non-empty rows found in the file. */
  totalRows: number;
  /** Rows dropped because they were empty or duplicates. */
  ignoredRows: number;
}

/**
 * Parse CSV/TSV/pasted text into feedback items.
 *
 * - Header rows are matched against {@link TEXT_COLUMNS}; the first matching
 *   column is used. Without a matching header, every non-empty line is a row.
 * - Rows are trimmed; empty rows are dropped.
 * - Exact-duplicate texts are dropped, both within the file and against
 *   `existingTexts` (already-stored feedback for the session).
 */
export function parseFeedbackFile(
  content: string,
  existingTexts: ReadonlySet<string> = new Set(),
): ParsedFeedbackFile {
  const seen = new Set(existingTexts);
  const items: string[] = [];
  let totalRows = 0;
  let ignoredRows = 0;

  const parsed = Papa.parse<string[]>(content, {
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rows = parsed.data as unknown[][];
  if (rows.length === 0) return { items, totalRows, ignoredRows };

  const header = rows[0].map((cell) => String(cell).trim().toLowerCase());
  const matchedColumn = TEXT_COLUMNS.find((col) => header.includes(col));
  const textIndex = matchedColumn ? header.indexOf(matchedColumn) : -1;
  const hasHeader = textIndex !== -1;

  const dataRows = hasHeader ? rows.slice(1) : rows;

  for (const row of dataRows) {
    const raw = hasHeader ? String(row[textIndex] ?? "") : String(row[0] ?? "");
    const text = raw.trim();
    if (!text) {
      ignoredRows += 1;
      continue;
    }
    totalRows += 1;
    if (seen.has(text)) {
      ignoredRows += 1;
      continue;
    }
    seen.add(text);
    items.push(text);
  }

  return { items, totalRows, ignoredRows };
}
