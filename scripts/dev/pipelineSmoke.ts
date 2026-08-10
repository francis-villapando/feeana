/**
 * Pipeline Smoke Test — Part B of Task 3.2.
 *
 * Runs the REAL algorithm pipeline (including Transformers.js zero-shot ML)
 * against the seeded session. Uses the service-role key to bypass RLS.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/dev/pipelineSmoke.ts
 *   npm run db:smoke
 */

import { createClient } from "@supabase/supabase-js";
import { runAnalysisPipeline } from "../../src/lib/algorithm/pipeline";

const SESSION_ID = "3da770a1-ca05-422c-9b6b-c85f2f92dc4e";

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
      "  npm run db:smoke\n" +
      "  npx tsx --env-file=.env scripts/dev/pipelineSmoke.ts",
    );
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  /* Run the real pipeline */
  console.log("\n[pipeline] Starting inference (this may take 30–120s first run)...\n");
  const start = performance.now();

  let output;
  try {
    output = await runAnalysisPipeline(SESSION_ID, admin);
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
  assert(output.sessionId === SESSION_ID, `sessionId matches (${output.sessionId})`);
  assert(typeof output.totalFeedback === "number" && output.totalFeedback > 0,
    `totalFeedback > 0 (got ${output.totalFeedback})`);

  console.log("\n--- Distributions ---");
  assert(output.aspectDist.length > 0, `aspectDist populated (${output.aspectDist.length} entries)`);
  assert(output.issueDist.length > 0, `issueDist populated (${output.issueDist.length} entries)`);
  assert(output.polarityDist.length === 3, `polarityDist has 3 entries (got ${output.polarityDist.length})`);
  assert(output.rbtDist.length > 0, `rbtDist populated (${output.rbtDist.length} entries)`);
  assert(output.cltDist.length > 0, `cltDist populated (${output.cltDist.length} entries)`);

  for (const d of output.aspectDist) {
    assert(typeof d.label === "string" && d.label.length > 0, `aspectDist label is non-empty`);
    assert(typeof d.value === "number" && d.value >= 0, `aspectDist value >= 0 (got ${d.value})`);
  }

  console.log("\n--- Recommendations ---");
  assert(output.recommendations.length > 0,
    `At least 1 recommendation generated (got ${output.recommendations.length})`);

  for (const r of output.recommendations) {
    assert(typeof r.id === "string" && r.id.length > 0, "recommendation.id is non-empty");
    assert(typeof r.paragraph === "string" && r.paragraph.length > 0, "recommendation.paragraph is non-empty");
    assert(typeof r.priority === "number" && r.priority >= 0, `recommendation.priority >= 0 (got ${r.priority})`);
    assert(Array.isArray(r.theories) && r.theories.length > 0, "recommendation.theories is non-empty");
  }

  console.log("\n--- Gaps ---");
  assert(Array.isArray(output.gaps), "gaps is an array");

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
