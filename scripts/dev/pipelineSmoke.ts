/**
 * Pipeline Smoke Test — Part B of Task 3.2.
 *
 * Runs the REAL algorithm pipeline (including Transformers.js zero-shot ML)
 * against the seeded 40-entry session WITHOUT writing any results to the DB.
 *
 * Usage:
 *   npx tsx scripts/dev/pipelineSmoke.ts
 */

import { createClient } from "@supabase/supabase-js";
import { runAlgorithmPipeline } from "../../src/lib/algorithm/pipeline";
import type { SessionContext, FeedbackInput } from "../../src/lib/algorithm/types";

const SESSION_ID = "3da770a1-ca05-422c-9b6b-c85f2f92dc4e";
const VALID_ISSUES = new Set([
  "relational coldness",
  "classroom tension",
  "evaluation unfairness",
  "perceived marginalization",
  "subject alienation",
  "peer distraction",
  "instructional cadence",
  "clarity deficit",
  "abstract logic gap",
  "procedural bottleneck",
  "conceptual misalignment",
  "design synthesis failure",
  "feedback latency",
  "notation struggle",
  "Uncategorized",
]);
const VALID_POLARITIES = new Set(["pos", "neu", "neg"]);
const VALID_CLTS = new Set(["Intrinsic", "Extraneous"]);

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Set them in your environment or use:\n" +
      "  npx tsx --env-file=.env scripts/dev/pipelineSmoke.ts",
    );
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  /* Fetch session + class + course */
  console.log("\n[fetch] Loading session data...");
  const { data: session } = await admin
    .from("sessions")
    .select("*, classes(faculty_id, name, course_id)")
    .eq("id", SESSION_ID)
    .single();

  if (!session) {
    console.error(`Session ${SESSION_ID} not found. Run seed.sql first.`);
    process.exit(1);
  }
  assert(true, `Session resolved (topic: "${session.topic}")`);

  const courseId = session.course_id || (session.classes as any)?.course_id;
  assert(!!courseId, "Course ID resolved");

  /* Fetch ILOs */
  const { data: ilos } = await admin
    .from("ilos")
    .select("*")
    .eq("course_id", courseId)
    .eq("archived", false);

  assert(!!ilos && ilos.length > 0, `ILOs fetched (${ilos!.length} found)`);

  const bloomLevelMap: Record<string, number> = {
    Remember: 1, Understand: 2, Apply: 3,
    Analyze: 4, Evaluate: 5, Create: 6,
  };

  const sessionIloIds = Array.isArray(session.ilo_ids) ? session.ilo_ids : [];
  const activeIlos = ilos!.filter((ilo) => sessionIloIds.includes(ilo.id));

  const rbtLevels = activeIlos.map((ilo) => bloomLevelMap[ilo.bloom_level] ?? 1);
  const targetIloRbt = rbtLevels.length > 0 ? Math.max(...rbtLevels) : 1;

  /* Fetch feedback */
  const { data: feedback } = await admin
    .from("feedback")
    .select("*")
    .eq("session_id", SESSION_ID);

  assert(!!feedback && feedback.length > 0, `Feedback entries fetched (${feedback!.length})`);

  const bloomLevels = activeIlos.map((ilo) => bloomLevelMap[ilo.bloom_level] ?? 1);
  const targetRbt = bloomLevels.length > 0 ? Math.max(...bloomLevels) : 1;

  const sessionContext: SessionContext = {
    course: session.classes?.name ?? "Unknown Course",
    topic: session.topic ?? "Unknown Topic",
    targetIloRbt: targetRbt,
    sessionId: SESSION_ID,
    iloStatement: activeIlos[0]?.statement ?? "Unknown Goal",
  };

  const feedbackStream: FeedbackInput[] = feedback.map((f) => ({
    id: f.id,
    rawText: f.content,
    createdAt: f.created_at,
  }));

  /* Run the real pipeline */
  console.log("\n[pipeline] Starting inference (this may take 30–120s first run)...\n");
  const start = performance.now();

  let output;
  try {
    output = await runAlgorithmPipeline(sessionContext, feedbackStream);
  } catch (err) {
    console.error("\n[pipeline] FAILED —", (err as Error).message);
    console.error(
      "If the error mentions 'onnxruntime-node', install it:\n" +
      "  npm install -D onnxruntime-node\n" +
      "Then re-run this script.",
    );
    process.exit(1);
  }

  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  console.log(`\n[pipeline] Completed in ${elapsed}s`);

  /* Assertions */
  console.log("\n--- Output Quality ---");
  const { diagnostics, recommendationList, warningList, stats } = output;

  assert(diagnostics.length === feedbackStream.length,
    `All ${feedbackStream.length} entries produced a diagnostic (got ${diagnostics.length})`);

  assert(recommendationList.length > 0,
    `At least 1 recommendation generated (got ${recommendationList.length})`);

  assert(stats.totalFeedback === feedbackStream.length,
    `stats.totalFeedback = ${feedbackStream.length}`);

  console.log("\n--- Diagnostic Schema ---");
  for (const d of diagnostics) {
    assert(typeof d.tti === "string" && d.tti.length > 0, `tti is a non-empty string (got "${d.tti}")`);
    assert(Number.isInteger(d.rbt) && d.rbt >= 1 && d.rbt <= 6, `rbt ∈ [1,6] (got ${d.rbt})`);
    assert(VALID_CLTS.has(d.clt), `clt ∈ {Intrinsic, Extraneous} (got "${d.clt}")`);
    assert(VALID_ISSUES.has(d.issue), `issue is a valid taxonomy tag (got "${d.issue}")`);
    assert(VALID_POLARITIES.has(d.polarity), `polarity ∈ {pos, neu, neg} (got "${d.polarity}")`);
    assert(typeof d.isGap === "boolean", `isGap is boolean (got ${typeof d.isGap})`);
    assert(!!d.feedbackId, "feedbackId is present");
  }

  console.log("\n--- Recommendation Schema ---");
  for (const r of recommendationList) {
    assert(typeof r.id === "string" && r.id.length > 0, "recommendation.id is non-empty");
    assert(typeof r.paragraph === "string" && r.paragraph.length > 0, "recommendation.paragraph is non-empty");
    assert(typeof r.priority === "number" && r.priority >= 0, `recommendation.priority >= 0 (got ${r.priority})`);
    assert(Array.isArray(r.theories), "recommendation.theories is an array");
    assert(typeof r.isGap === "boolean", "recommendation.isGap is boolean");
  }

  /* Summary */
  const total = passed + failed;
  console.log(`\n═══════════════════════════════════════`);
  console.log(`  Results: ${passed}/${total} passed`);
  if (failed > 0) {
    console.log(`  ⚠️  ${failed} assertion(s) failed`);
    process.exit(1);
  }
  console.log(`  Smoke test PASSED (${elapsed}s)`);
  console.log(`═══════════════════════════════════════\n`);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
