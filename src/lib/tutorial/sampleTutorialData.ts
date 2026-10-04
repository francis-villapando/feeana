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

import { supabase } from "@/lib/db/supabase";
import { RULES_VERSION } from "@/lib/algorithm/rules";
import type { AnalysisResult, Session } from "@/lib/types/types";

/** Assumed class size for submission rate calculation during the tutorial. */
const TUTORIAL_ENROLLEE_COUNT = 50;

function computeSessionStatus(startsAt: string, endsAt: string): "upcoming" | "active" | "closed" {
  const now = new Date();
  if (now < new Date(startsAt)) return "upcoming";
  if (now > new Date(endsAt)) return "closed";
  return "active";
}

/** Generates `count` synthetic feedback strings for a tutorial trend session. */
function generateFeedbackTexts(pool: string[], count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(pool[i % pool.length]);
  return out;
}

// Feedback pools for the two generated sessions
const S2_FEEDBACK_POOL = [
  "clearer na yung explanation sa code examples ngayon",
  "mabilis pa rin ng konti pero mas nasusundan na namin",
  "helpful yung live walkthrough and practice problems",
  "salamat po sa patience sa pagsagot sa questions",
  "mas naiintindihan ko na yung main concepts",
  "ok na yung pacing, di na masyadong mabilis",
  "nag-improve yung examples, mas relatable na",
  "mas maganda yung structure ng lecture ngayon",
  "nagustuhan ko yung step-by-step approach",
  "sana mas marami pang practice exercises",
];

const S3_FEEDBACK_POOL = [
  "sobrang ganda ng discussion sa class, clear lahat ng slides",
  "crystal clear and engaging yung entire lecture",
  "very organized and easy to follow yung lesson",
  "ready na ako for the upcoming quiz, confident na sa topic",
  "best session so far, looking forward sa next topic",
  "napaka-structured ng lesson, madaling sundan",
  "ang galing ng examples, naintindihan ko agad",
  "very helpful yung Q&A portion, na-clarify lahat",
  "excited na ako sa next lesson, ang dami kong natutunan",
  "sobrang effective nung interactive exercises",
];

/**
 * Generates 2 subsequent tutorial sessions on consecutive future days with sample feedback
 * and diagnostics so longitudinal trend charts display multi-session trajectory.
 * Also sets student_count to 50 so submission rate metrics render realistically.
 */
export async function createTutorialTrendSessions({
  classId,
  baseSession,
  facultyId,
}: {
  classId: string;
  baseSession: Session;
  facultyId: string;
}): Promise<{ session2Id: string; session3Id: string }> {
  // Set student_count so submissionRateForSession produces meaningful percentages
  await supabase
    .from("classes")
    .update({ student_count: TUTORIAL_ENROLLEE_COUNT })
    .eq("id", classId);

  const endMs = new Date(baseSession.endsAt).getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const s2StartsAt = new Date(endMs + 1 * DAY_MS).toISOString();
  const s2EndsAt = new Date(endMs + 2 * DAY_MS).toISOString();

  const s3StartsAt = new Date(endMs + 3 * DAY_MS).toISOString();
  const s3EndsAt = new Date(endMs + 4 * DAY_MS).toISOString();

  const nowIso = new Date().toISOString();

  const { error: cleanupError } = await supabase.rpc("delete_tutorial_trend_sessions", {
    p_class_id: classId,
    p_base_session_id: baseSession.id,
  });
  if (cleanupError) throw new Error(cleanupError.message);

  const { data: sessions, error: sessionError } = await supabase
    .from("sessions")
    .insert([
      {
        class_id: classId,
        topic: `${baseSession.topic} (Session 2)`,
        topic_id: baseSession.topicId ?? null,
        course_id: baseSession.courseId ?? null,
        ilo_ids: baseSession.iloIds ?? [],
        status: computeSessionStatus(s2StartsAt, s2EndsAt),
        starts_at: s2StartsAt,
        ends_at: s2EndsAt,
        created_by: facultyId,
        last_analyzed_at: s2EndsAt,
      },
      {
        class_id: classId,
        topic: `${baseSession.topic} (Session 3)`,
        topic_id: baseSession.topicId ?? null,
        course_id: baseSession.courseId ?? null,
        ilo_ids: baseSession.iloIds ?? [],
        status: computeSessionStatus(s3StartsAt, s3EndsAt),
        starts_at: s3StartsAt,
        ends_at: s3EndsAt,
        created_by: facultyId,
        last_analyzed_at: s3EndsAt,
      },
    ])
    .select("id");

  if (sessionError || !sessions || sessions.length < 2) {
    throw new Error(sessionError?.message ?? "Failed to create sample trend sessions.");
  }

  const [s2, s3] = sessions;

  // Session 2: 30 feedbacks → 30/50 = 60% submission rate
  const s2FeedbackTexts = generateFeedbackTexts(S2_FEEDBACK_POOL, 30);
  // Session 3: 42 feedbacks → 42/50 = 84% submission rate
  const s3FeedbackTexts = generateFeedbackTexts(S3_FEEDBACK_POOL, 42);

  await supabase.from("feedback").insert([
    ...s2FeedbackTexts.map((text) => ({
      session_id: s2.id,
      content: text,
      meta: { cleanedText: text.toLowerCase() },
    })),
    ...s3FeedbackTexts.map((text) => ({
      session_id: s3.id,
      content: text,
      meta: { cleanedText: text.toLowerCase() },
    })),
  ]);

  const s2Result: AnalysisResult = {
    sessionId: s2.id,
    totalFeedback: s2FeedbackTexts.length,
    aspectDist: [
      { label: "Concept Development", value: 18 },
      { label: "Instructional Learning Formats", value: 7 },
      { label: "Quality of Feedback", value: 5 },
    ],
    issueDist: [
      { label: "clarity deficit", value: 12 },
      { label: "procedural bottleneck", value: 6 },
      { label: "notation struggle", value: 5 },
    ],
    polarityDist: [
      { label: "positive", value: 18 },
      { label: "neutral", value: 7 },
      { label: "negative", value: 5 },
    ],
    rbtDist: [
      { label: "Understand", value: 18 },
      { label: "Apply", value: 12 },
    ],
    cltDist: [
      { label: "Germane", value: 18 },
      { label: "Intrinsic", value: 12 },
    ],
    gaps: [],
    recommendations: [
      {
        id: `rec-${s2.id}-1`,
        paragraph:
          "Provide dual-coded representations and structured worked examples to address clarity deficit in Instructional Learning Formats.",
        terms: [],
        theories: [],
        priority: 0.25,
        tier: "secondary",
      },
    ],
    warnings: [],
  };

  const s3Result: AnalysisResult = {
    sessionId: s3.id,
    totalFeedback: s3FeedbackTexts.length,
    aspectDist: [
      { label: "Concept Development", value: 25 },
      { label: "Positive Climate", value: 17 },
    ],
    issueDist: [{ label: "abstract logic gap", value: 4 }],
    polarityDist: [
      { label: "positive", value: 34 },
      { label: "neutral", value: 6 },
      { label: "negative", value: 2 },
    ],
    rbtDist: [
      { label: "Apply", value: 25 },
      { label: "Analyze", value: 17 },
    ],
    cltDist: [
      { label: "Germane", value: 34 },
      { label: "Intrinsic", value: 8 },
    ],
    gaps: [],
    recommendations: [],
    warnings: [],
  };

  await supabase.from("feedback_diagnostics").insert([
    { session_id: s2.id, result: s2Result, rules_version: RULES_VERSION },
    { session_id: s3.id, result: s3Result, rules_version: RULES_VERSION },
  ]);

  return { session2Id: s2.id, session3Id: s3.id };
}
