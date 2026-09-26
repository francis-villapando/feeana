/**
 * Fails the build when a source comment points at a line in another file that no
 * longer holds what the comment claims.
 *
 * Scope is deliberately narrow: only *line-anchored* references
 * (`<file>.ts L12`, `<file>.pseudo L26-28`) are validated. Bare filename mentions
 * in prose are ignored — a filename without a line number cannot silently rot,
 * and detecting "is this mention a comment or an import" would trade a cheap gate
 * for a fragile one. Line numbers are the thing that rots; that is what this checks.
 *
 * The EXPECTED manifest is the load-bearing part. A bare "the line exists" check
 * would pass on a wrong-but-in-range number, which is how simulationEngine.ts came
 * to cite the Total_F/stats/blank lines of algorithm.pseudo as "Unified Priority
 * Scoring" and the unique-issue map insert in pipeline.ts as the Uncategorized
 * skip. The manifest pins each target line to the symbol it is supposed to name.
 *
 * Direction matters: every reference found by the scan must have a manifest entry
 * (UNPINNED). The reverse is deliberately not enforced — algorithm.pseudo's own
 * forward references are validated through the implementation lines they point at,
 * and no back-reference to them exists, so an unused manifest key is legitimate.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const SCAN_ROOTS = ["src", "scripts"];
const SCAN_EXT = new Set([".ts", ".tsx", ".pseudo"]);
const SKIP_DIRS = new Set(["node_modules", "tests", "__tests__", "dist", "checkpoints"]);

/** `<file>.ts L12` or `<file>.pseudo L26-28`, anywhere on a line. */
const REF_RE = /(?<file>[\w./-]+\.(?:ts|tsx|pseudo)) L(?<start>\d+)(?:-(?<end>\d+))?/g;

interface Expectation {
  /** All must match the referenced start line. */
  start: RegExp[];
  /** Optional: must match the referenced end line (only for ranges). */
  end?: RegExp[];
}

/**
 * Every line-anchored reference in the repo, keyed `<repo-relative-path>:<line>`.
 * Paths are POSIX-normalised so manifest keys are stable across platforms.
 */
const EXPECTED: Record<string, Expectation> = {
  // ── algorithm.pseudo: the spec, 42 lines. Must never gain or lose a line — seven
  //    back-references below depend on those exact numbers. Only the `//` comments are
  //    anchored; the statement text is the spec's own business and may be edited freely,
  //    so the manifest pins the module comment that carries the forward reference.
  "src/lib/algorithm/algorithm.pseudo:1": { start: [/^Begin/], end: [/^End/] },
  "src/lib/algorithm/algorithm.pseudo:9": {
    start: [/Module 2: Preprocessing \(preprocess\.ts L191\)/],
  },
  "src/lib/algorithm/algorithm.pseudo:10": {
    start: [/Module 3: Information Extraction \(informationExtraction\.ts L48\)/],
  },
  "src/lib/algorithm/algorithm.pseudo:12": {
    start: [/Module 4: Pedagogical Diagnostic Mapping \(pedagogicalDiagnosticMapping\.ts L22\)/],
    end: [/clt = map_clt\(issue\)/],
  },
  "src/lib/algorithm/algorithm.pseudo:26": {
    start: [/Unified Priority Scoring/],
    end: [/P = \(unique_issue\.count \/ Total_F\) \* w_c/],
  },

  // ── pipeline.ts: the production orchestrator.
  "src/lib/algorithm/pipeline.ts:226": {
    start: [/const candidateIssues = Array\.from\(uniqueIssueMap\.values\(\)\)\.filter\(/],
    end: [/^\s{2}\);$/],
  },
  "src/lib/algorithm/pipeline.ts:274": {
    start: [/} else if \(subThresholdCandidates\.length > 0\) \{/],
    end: [/^\s{2}\}$/],
  },
  "src/lib/algorithm/dashboardOutput.ts:75": { start: [/export function buildAnalysisResult\(/] },

  // ── Module entry points.
  "src/lib/algorithm/dataCollection.ts:12": { start: [/export function collectPipelineData\(/] },
  "src/lib/algorithm/worker.ts:49": { start: [/async runInference\(/] },
  "src/lib/algorithm/preprocess.ts:191": { start: [/export function Preprocess\(/] },
  "src/lib/algorithm/informationExtraction.ts:48": {
    start: [/export async function ExtractPID\(/],
  },
  "src/lib/algorithm/pedagogicalDiagnosticMapping.ts:22": {
    start: [/export function buildDiagnosticRecord\(/],
  },
  "src/lib/algorithm/strategyGeneration.ts:21": {
    start: [/export function CalculateDistributions\(/],
  },
};

interface Ref {
  from: string;
  fromLine: number;
  to: string;
  start: number;
  end: number;
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (SCAN_EXT.has(full.slice(full.lastIndexOf(".")))) yield full;
  }
}

/** Resolves a reference's filename: next to the referrer, then the algorithm dir, then root. */
function resolveTarget(referrer: string, file: string): string | null {
  const bare = file.replace(/^(\.\/|\.\.\/)+/, "");
  const candidates = [
    resolve(dirname(referrer), bare),
    resolve(ROOT, "src", "lib", "algorithm", bare),
    resolve(ROOT, bare),
  ];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return relative(ROOT, candidate).replace(/\\/g, "/");
    } catch {
      /* keep trying */
    }
  }
  return null;
}

const lineCache = new Map<string, string[]>();
function linesOf(path: string): string[] {
  let cached = lineCache.get(path);
  if (!cached) {
    cached = readFileSync(resolve(ROOT, path), "utf8").split(/\r?\n/);
    lineCache.set(path, cached);
  }
  return cached;
}

const refs: Ref[] = [];
const unresolved: string[] = [];

for (const scanRoot of SCAN_ROOTS) {
  for (const file of walk(resolve(ROOT, scanRoot))) {
    const relPath = relative(ROOT, file).replace(/\\/g, "/");
    if (relPath.endsWith("routeTree.gen.ts")) continue; // generated
    // This script quotes reference examples verbatim in its header; skip its own prose.
    if (relPath.endsWith("checkPseudoRefs.ts")) continue;
    const lines = linesOf(relPath);
    lines.forEach((text, index) => {
      for (const match of text.matchAll(REF_RE)) {
        const {
          file: raw,
          start,
          end,
        } = match.groups as {
          file: string;
          start: string;
          end?: string;
        };
        const to = resolveTarget(file, raw);
        const where = `${relPath}:${index + 1}`;
        if (!to) {
          unresolved.push(`${where} -> ${raw}`);
          continue;
        }
        refs.push({
          from: relPath,
          fromLine: index + 1,
          to,
          start: Number(start),
          end: end ? Number(end) : Number(start),
        });
      }
    });
  }
}

const problems: string[] = [];
for (const note of unresolved) {
  problems.push(`UNRESOLVED  ${note} — target file does not exist`);
}

for (const ref of refs) {
  const targetLines = linesOf(ref.to);
  const target = `${ref.to}:${ref.start}`;

  if (ref.start < 1 || ref.end > targetLines.length) {
    problems.push(
      `OUT OF RANGE  ${ref.from}:${ref.fromLine} -> ${ref.to} L${ref.start}${
        ref.end === ref.start ? "" : `-${ref.end}`
      } (file has ${targetLines.length} lines)`,
    );
    continue;
  }

  const expectation = EXPECTED[target];
  if (!expectation) {
    problems.push(
      `UNPINNED     ${ref.from}:${ref.fromLine} -> ${ref.to} L${ref.start} — add an EXPECTED entry so this anchor cannot drift`,
    );
    continue;
  }

  const startText = targetLines[ref.start - 1] ?? "";
  for (const pattern of expectation.start) {
    if (!pattern.test(startText)) {
      problems.push(
        `STALE        ${ref.from}:${ref.fromLine} -> ${ref.to} L${ref.start} does not match ${pattern}\n              found: ${startText.trim()}`,
      );
    }
  }

  if (expectation.end) {
    const endText = targetLines[ref.end - 1] ?? "";
    for (const pattern of expectation.end) {
      if (!pattern.test(endText)) {
        problems.push(
          `STALE RANGE  ${ref.from}:${ref.fromLine} -> ${ref.to} L${ref.end} does not match ${pattern}\n              found: ${endText.trim()}`,
        );
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`checkPseudoRefs: ${problems.length} problem(s) in ${refs.length} references\n`);
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    "\nFix by updating the referring comment to the current line, or updating the\n" +
      "EXPECTED manifest in scripts/dev/checkPseudoRefs.ts if the code moved.\n" +
      "Note: algorithm.pseudo must stay exactly 42 lines — insert or delete nothing there.",
  );
  process.exit(1);
}

console.log(`checkPseudoRefs: OK — ${refs.length} line-anchored references verified.`);
