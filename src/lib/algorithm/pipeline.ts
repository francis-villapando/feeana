/**
 * Pipeline orchestrator: runs all 6 modules in sequence, persists results to Supabase.
 *
 * Modules 1-6 as defined in algorithm.pseudo L1-42:
 *   Module 1 — Data Collection (via dataCollection.ts L12)
 *   Module 2 — Preprocessing (via preprocess.ts L191, inside Web Worker)
 *   Module 3 — Information Extraction (via informationExtraction.ts L48, inside Web Worker)
 *   Module 4 — Pedagogical Diagnostic Mapping (via pedagogicalDiagnosticMapping.ts L22)
 *   Module 5 — Strategy Generation (via strategyGeneration.ts L21)
 *   Module 6 — Dashboard Output (via dashboardOutput.ts L75)
 *
 * Tables:
 *   analysis_results     → raw ML output per feedback { issue, polarity } — written once, immutable
 *   feedback_diagnostics → cached computed result per session (JSONB + rules_version)
 */

import type { AnalysisResult } from "../types/types";
import { supabase as defaultSupabase } from "../db/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMLWorkerAsync } from "../ml/mlWorkerStore";
import { collectPipelineData } from "./dataCollection";
import { CalculateDistributions, GeneratePedagogicalCue } from "./strategyGeneration";
import { getIloLevel, buildIloGapItems, buildAnalysisResult } from "./dashboardOutput";
import { RULES_VERSION } from "./rules";
import type { DiagnosticRecord, BufferedDiagnostic, RecommendationItem } from "./types";

const PRIORITY_THRESHOLD = 0.3;

// Throws an AbortError if the pipeline has been cancelled. Call at every
// safe interruption point so cancellation never corrupts a write transaction.
function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Analysis was cancelled.", "AbortError");
  }
}

// Read path

// Loads a previously computed result from the cache.
// Returns null if no result exists or the cache is stale (rules_version mismatch).

export async function fetchComputedResult(
  sessionId: string,
  client?: SupabaseClient,
): Promise<AnalysisResult | null> {
  const db = client ?? defaultSupabase;
  const { data, error } = await db
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

async function fetchSessionData(sessionId: string, db: SupabaseClient) {
  const { data: session, error: sessionErr } = await db
    .from("sessions")
    .select("*, classes(name, course, course_id)")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    throw new Error(sessionErr?.message || "Session not found.");
  }

  const courseId =
    session.course_id || (session.classes as { course_id?: string } | null)?.course_id;
  if (!courseId) throw new Error("Course context not found for this session.");

  // Fire remaining 3 queries in parallel (ILOs, feedback, course)
  const [ilosResult, feedbackResult, courseResult] = await Promise.all([
    db.from("ilos").select("*").eq("course_id", courseId).eq("archived", false),
    db.from("feedback").select("*").eq("session_id", sessionId),
    db.from("courses").select("title").eq("id", courseId).maybeSingle(),
  ]);

  if (ilosResult.error) throw new Error(ilosResult.error.message);
  if (feedbackResult.error) throw new Error(feedbackResult.error.message);

  const courseName =
    courseResult.data?.title ||
    (session.classes as { course?: string } | null)?.course ||
    "Unknown Course";

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
export async function runAnalysisPipeline(
  sessionId: string,
  client?: SupabaseClient,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const db = client ?? defaultSupabase;
  console.debug("[pipeline] Starting analysis pipeline for session", { sessionId });

  // Module 1: Fetch + assemble data
  performance.mark("pipeline:fetch-start");
  const { session, courseName, ilosData, feedbackData } = await fetchSessionData(sessionId, db);
  performance.mark("pipeline:fetch-end");
  performance.measure("Supabase read", {
    start: "pipeline:fetch-start",
    end: "pipeline:fetch-end",
    detail: { targetMs: 2500 },
  });
  assertNotAborted(signal);

  const sessionIloIds = Array.isArray(session.ilo_ids) ? session.ilo_ids : [];
  const activeIlos = ilosData.filter((ilo) => sessionIloIds.includes(ilo.id));

  const maxSessionRbt = activeIlos.length > 0 ? Math.max(...activeIlos.map(getIloLevel)) : 1;
  const iloStatement =
    activeIlos.length > 1
      ? activeIlos.map((ilo, i) => `ILO ${i + 1}: ${ilo.statement}`).join("; ")
      : activeIlos[0]?.statement || "Unknown Goal";
  const ilosScope = activeIlos.map((ilo, index) => ({
    index,
    statement: ilo.statement,
    level: getIloLevel(ilo),
  }));

  const { sessionContext, feedbackStream } = collectPipelineData(
    courseName,
    session.topic || "Unknown Topic",
    maxSessionRbt,
    sessionId,
    iloStatement,
    feedbackData ?? [],
    ilosScope,
  );

  // Guard against empty feedback stream
  if (feedbackStream.length === 0) {
    throw new Error("No student feedback to analyze in this session.");
  }

  // Modules 2-3-4: per-feedback loop in Web Worker (preprocess → extract → map)
  const { api } = await getMLWorkerAsync();
  performance.mark("pipeline:model-load-start");
  assertNotAborted(signal);
  await api.preloadModel();
  performance.mark("pipeline:model-load-end");
  assertNotAborted(signal);
  performance.measure("Model init (warm)", {
    start: "pipeline:model-load-start",
    end: "pipeline:model-load-end",
    detail: { targetMs: 6000 },
  });

  performance.mark("pipeline:inference-start");
  const buffer: DiagnosticRecord[] = await api.runInference(
    feedbackStream,
    sessionContext.targetIloRbt,
  );
  performance.mark("pipeline:inference-end");
  assertNotAborted(signal);
  performance.measure("Pipeline total", {
    start: "pipeline:inference-start",
    end: "pipeline:inference-end",
    detail: { targetMs: 240000 },
  });

  // Save raw ML output to analysis_results
  performance.mark("pipeline:write-start");
  // Atomic cancel-aware write checkpoint
  assertNotAborted(signal);
  await db.from("analysis_results").delete().eq("session_id", sessionId);
  if (buffer.length > 0) {
    const { error: insertErr } = await db.from("analysis_results").insert(
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

  const recommendationList: RecommendationItem[] = [];
  const warningList: RecommendationItem[] = [];

  const candidateIssues = Array.from(uniqueIssueMap.values()).filter(
    (item) => item.issue !== "Uncategorized" && item.count > 0,
  );

  const primaryCandidates: { item: BufferedDiagnostic; score: number; weight: number }[] = [];
  const subThresholdCandidates: { item: BufferedDiagnostic; score: number; weight: number }[] = [];

  for (const uniqueIssue of candidateIssues) {
    const weightedCoefficient = uniqueIssue.isGap ? 1.5 : 1.0;
    const priorityScore = (uniqueIssue.count / totalFeedback) * weightedCoefficient;

    if (priorityScore >= PRIORITY_THRESHOLD) {
      primaryCandidates.push({
        item: uniqueIssue,
        score: priorityScore,
        weight: weightedCoefficient,
      });
    } else {
      subThresholdCandidates.push({
        item: uniqueIssue,
        score: priorityScore,
        weight: weightedCoefficient,
      });
    }
  }

  if (primaryCandidates.length > 0) {
    for (const cand of primaryCandidates) {
      const cue = GeneratePedagogicalCue(
        sessionContext,
        cand.item,
        totalFeedback,
        cand.weight,
        "primary",
      );
      recommendationList.push(cue);
    }
    // Sub-threshold issues become warnings
    for (const cand of subThresholdCandidates) {
      const cue = GeneratePedagogicalCue(
        sessionContext,
        cand.item,
        totalFeedback,
        cand.weight,
        "primary",
      );
      warningList.push(cue);
    }
  } else if (subThresholdCandidates.length > 0) {
    // Promote the sub-threshold issue(s) with the highest boost-adjusted score; ties all go to secondary.
    const maxScore = Math.max(...subThresholdCandidates.map((c) => c.score));
    for (const cand of subThresholdCandidates) {
      if (Math.abs(cand.score - maxScore) < 1e-9) {
        const cue = GeneratePedagogicalCue(
          sessionContext,
          cand.item,
          totalFeedback,
          cand.weight,
          "secondary",
        );
        recommendationList.push(cue);
      } else {
        const cue = GeneratePedagogicalCue(
          sessionContext,
          cand.item,
          totalFeedback,
          cand.weight,
          "primary",
        );
        warningList.push(cue);
      }
    }
  }

  // Module 6: Dashboard Output
  const finalResult = buildAnalysisResult({
    sessionId,
    totalFeedback,
    stats,
    buffer,
    ilos: activeIlos,
    recommendationList,
    warningList,
    feedback: feedbackStream.map((fb) => ({ id: fb.id, text: fb.rawText })),
  });

  // Save computed result to feedback_diagnostics
  assertNotAborted(signal);
  await db.from("feedback_diagnostics").delete().eq("session_id", sessionId);
  const { error: cacheErr } = await db.from("feedback_diagnostics").insert({
    session_id: sessionId,
    result: finalResult,
    rules_version: RULES_VERSION,
  });
  if (cacheErr) console.error("Error saving computed result:", cacheErr);
  performance.mark("pipeline:write-end");
  performance.measure("Supabase write (diagnostics)", {
    start: "pipeline:write-start",
    end: "pipeline:write-end",
    detail: { targetMs: 5000 },
  });

  // Update sessions.last_analyzed_at
  assertNotAborted(signal);
  const { error: updateErr } = await db
    .from("sessions")
    .update({ last_analyzed_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (updateErr) {
    throw new Error(`Failed to persist last_analyzed_at: ${updateErr.message}`);
  }

  console.debug("[pipeline] Pipeline complete for session", { sessionId });
  return finalResult;
}
