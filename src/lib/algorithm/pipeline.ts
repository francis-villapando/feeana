/**
 * Pipeline orchestrator: runs all 6 modules in sequence, persists results to Supabase.
 *
 * Modules 1-6 as defined in algorithm.pseudo:
 *   Module 1 — Data Collection (via dataCollection.ts)
 *   Module 2 — Preprocessing (via preprocess.ts, inside Web Worker)
 *   Module 3 — Information Extraction (via informationExtraction.ts, inside Web Worker)
 *   Module 4 — Pedagogical Diagnostic Mapping (via pedagogicalDiagnosticMapping.ts)
 *   Module 5 — Strategy Generation (via strategyGeneration.ts)
 *   Module 6 — Dashboard Output (via dashboardOutput.ts)
 *
 * Tables:
 *   analysis_results     → raw ML output per feedback { issue, polarity } — written once, immutable
 *   feedback_diagnostics → cached computed result per session (JSONB + rules_version)
 */

import type { AnalysisResult, DistEntry } from "../types/types";
import { supabase } from "../db/supabase";
import { getMLWorker } from "../ml/mlWorkerStore";
import { collectPipelineData } from "./dataCollection";
import {
  CalculateDistributions,
  GeneratePedagogicalCue,
  GenerateDiagnosticWarning,
} from "./strategyGeneration";
import { formatDashboardOutput } from "./dashboardOutput";
import { ISSUE_RULES, RBT_LEVELS, RULES_VERSION } from "./rules";
import type {
  SessionContext,
  FeedbackInput,
  DiagnosticRecord,
  BufferedDiagnostic,
  PipelineOutput,
} from "./types";

const PRIORITY_THRESHOLD = 0.3;

const BLOOM_LEVEL_MAP: Record<string, number> = {
  Remember: 1, Understand: 2, Apply: 3,
  Analyze: 4, Evaluate: 5, Create: 6,
};

// Read path

// Loads a previously computed result from the cache.
// Returns null if no result exists or the cache is stale (rules_version mismatch).

export async function fetchComputedResult(sessionId: string): Promise<AnalysisResult | null> {
  const { data, error } = await supabase
    .from("feedback_diagnostics")
    .select("result, rules_version")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching computed result:", error);
    throw new Error(error.message);
  }

  if (!data?.result) return null;
  if (data.rules_version !== RULES_VERSION) return null; // stale cache

  return data.result as AnalysisResult;
}

// Write path

async function fetchSessionData(sessionId: string) {
  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("*, classes(name, course, course_id)")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    throw new Error(sessionErr?.message || "Session not found.");
  }

  const courseId = session.course_id || (session.classes as any)?.course_id;
  if (!courseId) throw new Error("Course context not found for this session.");

  // Fire remaining 3 queries in parallel (ILOs, feedback, course)
  const [ilosResult, feedbackResult, courseResult] = await Promise.all([
    supabase.from("ilos").select("*").eq("course_id", courseId).eq("archived", false),
    supabase.from("feedback").select("*").eq("session_id", sessionId),
    supabase.from("courses").select("title").eq("id", courseId).maybeSingle(),
  ]);

  if (ilosResult.error) throw new Error(ilosResult.error.message);
  if (feedbackResult.error) throw new Error(feedbackResult.error.message);

  const courseName = courseResult.data?.title || (session.classes as any)?.course || "Unknown Course";

  return {
    session,
    courseName,
    ilosData: ilosResult.data ?? [],
    feedbackData: feedbackResult.data ?? [],
  };
}

/**
 * Runs the complete 6-module pipeline for a session and persists to Supabase.
 *
 * Flow:
 *   1. Fetch session metadata from Supabase (Module 1)
 *   2. Run preprocess + ML inference in Web Worker (Modules 2-3)
 *   3. SAVE raw ML output to analysis_results
 *   4. Map each diagnostic record in-memory (Module 4)
 *   5. Compute distributions, score, generate recs/warnings (Module 5)
 *   6. Format final output (Module 6)
 *   7. SAVE computed result to feedback_diagnostics
 *   8. UPDATE sessions.last_analyzed_at
 */
export async function runAnalysisPipeline(sessionId: string): Promise<AnalysisResult> {
  console.debug("[pipeline] Starting analysis pipeline for session", { sessionId });

  // Module 1: Fetch + assemble data
  performance.mark('pipeline:fetch-start');
  const { session, courseName, ilosData, feedbackData } = await fetchSessionData(sessionId);
  performance.mark('pipeline:fetch-end');
  performance.measure('Supabase read', {
    start: 'pipeline:fetch-start',
    end: 'pipeline:fetch-end',
    detail: { targetMs: 2500 },
  });

  const sessionIloIds = Array.isArray(session.ilo_ids) ? session.ilo_ids : [];
  const activeIlos = ilosData.filter((ilo: any) => sessionIloIds.includes(ilo.id));

  let targetIloRbt = 1;
  if (activeIlos.length > 0) {
    const rbtLevels = activeIlos.map((ilo: any) => BLOOM_LEVEL_MAP[ilo.bloom_level] ?? 1);
    targetIloRbt = Math.max(...rbtLevels);
  }

  const { sessionContext, feedbackStream } = collectPipelineData(
    courseName,
    session.topic || "Unknown Topic",
    targetIloRbt,
    sessionId,
    activeIlos[0]?.statement || "Unknown Goal",
    feedbackData ?? [],
  );

  // Modules 2-3-4: per-feedback loop in Web Worker (preprocess → extract → map)
  const { api } = getMLWorker();
  performance.mark('pipeline:model-load-start');
  await api.preloadModel();
  performance.mark('pipeline:model-load-end');
  performance.measure('Model init (warm)', {
    start: 'pipeline:model-load-start',
    end: 'pipeline:model-load-end',
    detail: { targetMs: 6000 },
  });

  performance.mark('pipeline:inference-start');
  const buffer: DiagnosticRecord[] = await api.runInference(feedbackStream, targetIloRbt);
  performance.mark('pipeline:inference-end');
  performance.measure('Pipeline total', {
    start: 'pipeline:inference-start',
    end: 'pipeline:inference-end',
    detail: { targetMs: 240000 },
  });

  // Save raw ML output to analysis_results
  performance.mark('pipeline:write-start');
  await supabase.from("analysis_results").delete().eq("session_id", sessionId);
  if (buffer.length > 0) {
    const { error: insertErr } = await supabase.from("analysis_results").insert(
      buffer.map((d) => ({
        session_id: sessionId,
        feedback_id: d.feedbackId,
        issue: d.issue,
        polarity: d.polarity,
      })),
    );
    if (insertErr) console.error("Error saving raw ML output:", insertErr);
  }

  // Module 5: Strategy Generation
  const totalFeedback = feedbackStream.length;
  const stats = CalculateDistributions(buffer, totalFeedback);

  const uniqueIssueMap = new Map<string, BufferedDiagnostic>();
  for (const diag of buffer) {
    const key = diag.issue.toLowerCase();
    const existing = uniqueIssueMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      uniqueIssueMap.set(key, { ...diag, count: 1 });
    }
  }

  const recommendationList: PipelineOutput["recommendationList"] = [];
  const warningList: PipelineOutput["warningList"] = [];

  for (const uniqueIssue of uniqueIssueMap.values()) {
    if (uniqueIssue.issue === "Uncategorized") continue;

    const w_c = uniqueIssue.isGap ? 1.5 : 1.0;
    const P = (uniqueIssue.count / totalFeedback) * w_c;

    if (P >= PRIORITY_THRESHOLD) {
      recommendationList.push(
        GeneratePedagogicalCue(sessionContext, uniqueIssue, totalFeedback),
      );
    } else {
      warningList.push(GenerateDiagnosticWarning(uniqueIssue));
    }
  }

  // Module 6: Dashboard Output
  const pipelineOutput = formatDashboardOutput(recommendationList, warningList, stats);

  // Build final AnalysisResult shape
  const aspectDist: DistEntry[] = Object.entries(stats.aspectCounts)
    .map(([label, value]) => ({ label, value } as DistEntry))
    .sort((a, b) => b.value - a.value);

  const issueDist: DistEntry[] = Object.entries(stats.issueCounts)
    .map(([key, value]) => ({ label: ISSUE_RULES[key.toLowerCase()] ?? key, value } as DistEntry))
    .sort((a, b) => b.value - a.value);

  const polarityDist: DistEntry[] = [
    { label: "Positive", value: stats.polarityCounts.pos || 0 },
    { label: "Neutral", value: stats.polarityCounts.neu || 0 },
    { label: "Negative", value: stats.polarityCounts.neg || 0 },
  ];

  const rbtDist: DistEntry[] = Object.entries(stats.rbtCounts)
    .map(([label, value]) => ({ label, value } as DistEntry))
    .sort((a, b) => (RBT_LEVELS as readonly string[]).indexOf(a.label) - (RBT_LEVELS as readonly string[]).indexOf(b.label));

  const cltDist: DistEntry[] = Object.entries(stats.cltCounts)
    .map(([label, value]) => ({ label, value } as DistEntry))
    .sort((a, b) => b.value - a.value);

  // Enrich distribution entries with contributing feedback texts
  const feedbackMap = new Map<string, string>();
  for (const fb of feedbackStream) feedbackMap.set(fb.id, fb.rawText);

  const aspectToTexts = new Map<string, string[]>();
  const issueToTexts = new Map<string, string[]>();
  const polarityToTexts: Record<string, string[]> = { pos: [], neu: [], neg: [] };
  const rbtToTexts = new Map<string, string[]>();
  const cltToTexts = new Map<string, string[]>();

  for (const diag of buffer) {
    const text = feedbackMap.get(diag.feedbackId ?? "");
    if (!text) continue;

    const aspectList = aspectToTexts.get(diag.tti) ?? [];
    aspectList.push(text);
    aspectToTexts.set(diag.tti, aspectList);

    const issueLabel = ISSUE_RULES[diag.issue.toLowerCase()] ?? diag.issue;
    const issueList = issueToTexts.get(issueLabel) ?? [];
    issueList.push(text);
    issueToTexts.set(issueLabel, issueList);

    if (diag.polarity in polarityToTexts) {
      polarityToTexts[diag.polarity].push(text);
    }

    const rbtName = diag.issue === "Uncategorized" ? "Uncategorized" : (RBT_LEVELS[diag.rbt] ?? String(diag.rbt));
    const rbtList = rbtToTexts.get(rbtName) ?? [];
    rbtList.push(text);
    rbtToTexts.set(rbtName, rbtList);

    const cltLabel = diag.issue === "Uncategorized" ? "Uncategorized" : diag.clt;
    const cltList = cltToTexts.get(cltLabel) ?? [];
    cltList.push(text);
    cltToTexts.set(cltLabel, cltList);
  }

  for (const entry of aspectDist) entry.feedbackTexts = aspectToTexts.get(entry.label);
  for (const entry of issueDist) entry.feedbackTexts = issueToTexts.get(entry.label);
  const polarityLabelKey: Record<string, string> = { Positive: "pos", Neutral: "neu", Negative: "neg" };
  for (const entry of polarityDist) entry.feedbackTexts = polarityToTexts[polarityLabelKey[entry.label]];
  for (const entry of rbtDist) entry.feedbackTexts = rbtToTexts.get(entry.label);
  for (const entry of cltDist) entry.feedbackTexts = cltToTexts.get(entry.label);

  // Gap items
  const gaps: any[] = [];
  for (const gapDiag of buffer.filter((d) => d.isGap)) {
    const ilo = activeIlos[0];
    if (ilo) {
      gaps.push({
        iloId: ilo.id,
        expected: ilo.statement,
        actual: `Issue: "${gapDiag.issue}" (CLT: ${gapDiag.clt}, RBT: Level ${gapDiag.rbt})`,
        severity: "medium" as const,
      });
    }
  }

  const finalResult: AnalysisResult = {
    sessionId,
    totalFeedback,
    aspectDist,
    issueDist,
    polarityDist,
    rbtDist,
    cltDist,
    gaps,
    recommendations: recommendationList.map((r) => ({
      id: r.id,
      paragraph: r.paragraph,
      terms: r.terms as any[],
      theories: r.theories as any[],
      priority: r.priority,
    })),
    warnings: warningList.map((w) => ({
      id: w.id,
      issue: w.issue,
      count: w.count,
    })),
  };

  // Save computed result to feedback_diagnostics
  await supabase.from("feedback_diagnostics").delete().eq("session_id", sessionId);
  const { error: cacheErr } = await supabase.from("feedback_diagnostics").insert({
    session_id: sessionId,
    result: finalResult,
    rules_version: RULES_VERSION,
  });
  if (cacheErr) console.error("Error saving computed result:", cacheErr);
  performance.mark('pipeline:write-end');
  performance.measure('Supabase write (diagnostics)', {
    start: 'pipeline:write-start',
    end: 'pipeline:write-end',
    detail: { targetMs: 5000 },
  });

  // Update sessions.last_analyzed_at
  const { error: updateErr } = await supabase
    .from("sessions")
    .update({ last_analyzed_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (updateErr) console.error("Error updating session timestamp:", updateErr);

  console.debug("[pipeline] Pipeline complete for session", { sessionId });
  return finalResult;
}
