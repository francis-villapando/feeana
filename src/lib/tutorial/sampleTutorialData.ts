import Papa from "papaparse";

/**
 * Guided-tour feedback preset: 12 Taglish/code-switched rows sourced from the
 * benchmark corpus (`scripts/training/data/test.csv`) and verified against the
 * real DistilXLM-R INT8 model. Designed so the tour produces a rich analysis
 * result: four `notation struggle` rows make it the dominant issue (4/12 = 33%,
 * above the 30% priority threshold, so a primary recommendation is generated),
 * two positive out-of-scope rows route to Uncategorized so the uncategorized
 * notice renders, and the remaining six rows each map to a different issue so
 * the aspect, issue, RBT, and CLT distributions are all populated.
 */
const SAMPLE_TEXTS = [
  // notation struggle ×4 — dominant issue above the 30% recommendation threshold
  "as in literal na papatunayan sayo gamit ang summations at iba pa na ang nested for-loop ay O(n^2)",
  "nalito talaga ako nung nag-start magsulat yung professor ng mga baligtad na A at paatras na E sa board, parang nakatingin ako sa ibang langauge",
  "nalilito talaga ako palagi sa mga arrow at asterisk symbols kapag sinusundan yung memory addresses, as in literal na mukhang gibberish pag nakasulat",
  "ang tagal kong inintindi yung summation tsaka big O notation formulas sa slides, na-intimidate ako kasi nakakatakot tingnan",
  // clarity deficit
  "hirap niya sundan kasi madalas siyang nago-off topic habang naglelecture",
  // abstract logic gap
  "medyo mahirap yung dynamic programming tsaka sa ilan sa mga graph algorithms, pero overall, ang ganda at sobrang interesting naman ng lahat ng algorithms",
  // procedural bottleneck
  "mukhang simple lang yung mobile development concepts sa screen, pero sobrang tricky mag-set up ng configuration tsaka mag-build ng gumaganang app mula sa umpisa",
  // classroom tension
  "nakakawala ng composure pag random magtawag",
  // relational coldness
  "pangit kabonding ni Ms. Usyk haha yabang and unhelpful",
  // feedback latency
  "di niya agad naibabalik yung mga homework, mga lab, tapos iba pang activity",
  // uncategorized ×2 — positive out-of-scope feedback below classification scope
  "salamat po, sobrang helpful ng example nya sa inheritance kanina",
  "grabe, ang linaw ng breakdown nya sa recursion, na-appreciate ko talaga",
];

export const SAMPLE_TUTORIAL_ROW_COUNT = SAMPLE_TEXTS.length;

/**
 * Pre-quoted single-column CSV so it drops straight into the same parse path as a
 * user upload. Papa handles the escaping that the embedded commas require, and
 * every field is quoted explicitly so the `text` header is never ambiguous.
 */
export const SAMPLE_TUTORIAL_CSV = Papa.unparse(
  { fields: ["text"], data: SAMPLE_TEXTS.map((text) => [text]) },
  { quotes: true },
);
