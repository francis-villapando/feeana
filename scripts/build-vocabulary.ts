import fs from "node:fs";
import path from "node:path";

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

export function buildSeedVocabulary(): string[] {
  const csvPath = path.join(
    process.cwd(),
    "scripts",
    "training",
    "data",
    "feeana dataset - dataset.csv",
  );
  const csvContent = fs.readFileSync(csvPath, "utf-8");

  const { headers, rows } = parseCSV(csvContent);
  const textColumnName = headers.find(
    (h) => h.trim().toLowerCase() === "text" || h.trim().toLowerCase().includes("feedback"),
  );

  if (!textColumnName) {
    throw new Error("Could not find column containing raw feedback text in CSV headers.");
  }

  console.log(`[build-vocabulary] CSV raw feedback column: '${textColumnName}'`);
  console.log(`[build-vocabulary] Total rows processed: ${rows.length}`);

  const doubleLetterWords = new Set<string>();
  const doubleLetterRegex = /([a-z])\1/;

  for (const row of rows) {
    const text = row[textColumnName] || "";
    const tokens = text.toLowerCase().match(/[a-z]+/g) || [];
    for (const token of tokens) {
      if (doubleLetterRegex.test(token)) {
        doubleLetterWords.add(token);
      }
    }
  }

  const sortedWords = Array.from(doubleLetterWords).sort();
  console.log(
    `[build-vocabulary] Extracted ${sortedWords.length} unique double-letter words from corpus.`,
  );

  return sortedWords;
}

export function updatePreprocessTs(words: string[]): void {
  const preprocessPath = path.join(
    process.cwd(),
    "src",
    "lib",
    "algorithm",
    "preprocess.ts",
  );

  let content = fs.readFileSync(preprocessPath, "utf-8");

  const formattedWords = words.map((w) => `  "${w}",`).join("\n");
  const newVocabBlock = `// Double-letter vocabulary consulted by normalizeVowels to decide whether a
// repeated run collapses to one copy or keeps two.
// Vocabulary derived directly from valid double-letter words in the target dataset corpus.
const seedVocabulary = new Set([\n${formattedWords}\n]);`;

  // Pattern matching old seedVocabulary block including its preceding comment
  const regex =
    /\/\/\s*Double-letter vocabulary consulted by normalizeVowels[\s\S]*?const seedVocabulary = new Set\(\[\s*[\s\S]*?\s*\]\);/;

  if (!regex.test(content)) {
    throw new Error("Could not find existing seedVocabulary Set block in preprocess.ts");
  }

  content = content.replace(regex, newVocabBlock);
  fs.writeFileSync(preprocessPath, content, "utf-8");
  console.log(`[build-vocabulary] Updated seedVocabulary in preprocess.ts with ${words.length} words.`);
}

if (process.argv[1] && process.argv[1].includes("build-vocabulary")) {
  const words = buildSeedVocabulary();
  updatePreprocessTs(words);
}
