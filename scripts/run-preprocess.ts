import fs from "node:fs";
import path from "node:path";
import { Preprocess } from "../src/lib/algorithm/preprocess";

function parseCSV(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField);
        currentField = "";
      } else if (char === "\r") {
        if (nextChar === "\n") {
          i++;
        }
        currentRow.push(currentField);
        currentField = "";
        if (currentRow.length > 1 || currentRow[0] !== "") {
          rows.push(currentRow);
        }
        currentRow = [];
      } else if (char === "\n") {
        currentRow.push(currentField);
        currentField = "";
        if (currentRow.length > 1 || currentRow[0] !== "") {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = rows[0];
  const recordRows: Record<string, string>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === headers.length) {
      const record: Record<string, string> = {};
      for (let c = 0; c < headers.length; c++) {
        record[headers[c]] = row[c];
      }
      recordRows.push(record);
    }
  }

  return { headers, rows: recordRows };
}

function escapeCSVField(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function runPreprocessDataset(): void {
  const inputCsvPath = path.join(
    process.cwd(),
    "scripts",
    "training",
    "data",
    "feeana dataset - dataset.csv",
  );
  const outputCsvPath = path.join(
    process.cwd(),
    "scripts",
    "training",
    "data",
    "feeana dataset - dataset.cleaned.csv",
  );

  console.log(`[run-preprocess] Reading dataset from: ${inputCsvPath}`);
  const csvContent = fs.readFileSync(inputCsvPath, "utf-8");

  const { headers, rows } = parseCSV(csvContent);
  const textColumnName = headers.find(
    (h) => h.trim().toLowerCase() === "text" || h.trim().toLowerCase().includes("feedback"),
  );

  if (!textColumnName) {
    throw new Error("Could not find feedback text column in CSV headers.");
  }

  console.log(`[run-preprocess] Found text column '${textColumnName}'. Processing ${rows.length} rows...`);

  const outputLines: string[] = [];
  outputLines.push(headers.map(escapeCSVField).join(","));

  let processedCount = 0;
  for (const row of rows) {
    const rawText = row[textColumnName] || "";
    const feedbackId = row.id || String(processedCount + 1);

    const cleanedText = Preprocess({ id: feedbackId, rawText });
    row[textColumnName] = cleanedText;

    const rowLine = headers.map((h) => escapeCSVField(row[h] || "")).join(",");
    outputLines.push(rowLine);
    processedCount++;
  }

  fs.writeFileSync(outputCsvPath, outputLines.join("\n"), "utf-8");
  console.log(`[run-preprocess] Successfully wrote ${processedCount} cleaned rows to: ${outputCsvPath}`);
}

if (process.argv[1] && process.argv[1].includes("run-preprocess")) {
  runPreprocessDataset();
}
