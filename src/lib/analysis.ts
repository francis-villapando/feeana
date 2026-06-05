/**
 * Analysis pipeline.
 * Persists results and individual feedback diagnostics to Supabase.
 */
import type { AnalysisResult } from "./types";
import { supabase } from "./supabase";
import { getMLWorker } from "./mlWorkerStore";
import { ISSUE_RULES } from "./algorithm/rules";



/** Threshold for issue significance — issues at or above this count yield a recommendation. */
export const ISSUE_THRESHOLD = 1;

/** Retrieves existing analysis result from Supabase */
export async function fetchAnalysisResult(sessionId: string): Promise<AnalysisResult | null> {
  const { data, error } = await supabase
    .from("analysis_results")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching analysis result:", error);
    throw new Error(error.message);
  }

  if (!data || !data.result) return null;

  return data.result as AnalysisResult;
}

/** Executes the algorithm pipeline and saves results to Supabase */
export async function runAnalysis(sessionId: string): Promise<AnalysisResult> {
  console.debug("[analysis] Triggering analysis for session", { sessionId });

  // 1. Fetch class session data along with its class and course details
  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("*, classes(name, course, course_id)")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    console.error("Error fetching session details:", sessionErr);
    throw new Error(sessionErr?.message || "Session not found.");
  }

  const courseId = session.course_id || (session.classes as any)?.course_id;
  if (!courseId) {
    throw new Error("Course context not found for this session.");
  }

  // 2. Fetch the target ILOs for this course to calculate the session's active RBT target level
  const { data: ilosData, error: ilosErr } = await supabase
    .from("ilos")
    .select("*")
    .eq("course_id", courseId)
    .eq("archived", false);

  if (ilosErr) {
    console.error("Error fetching course ILOs:", ilosErr);
    throw new Error(ilosErr.message);
  }

  // Calculate session's target RBT level from its active ILOs
  const sessionIloIds = Array.isArray(session.ilo_ids) ? session.ilo_ids : [];
  const activeIlos = (ilosData ?? []).filter(ilo => sessionIloIds.includes(ilo.id));

  const bloomLevelMap: Record<string, number> = {
    "Remember": 1,
    "Understand": 2,
    "Apply": 3,
    "Analyze": 4,
    "Evaluate": 5,
    "Create": 6
  };

  let targetIloRbt = 1; // Default fallback level
  if (activeIlos.length > 0) {
    const rbtLevels = activeIlos.map(ilo => bloomLevelMap[ilo.bloom_level] ?? 1);
    targetIloRbt = Math.max(...rbtLevels);
  }

  // 3. Fetch the actual raw student comments (feedback stream)
  const { data: feedbackData, error: feedbackErr } = await supabase
    .from("feedback")
    .select("*")
    .eq("session_id", sessionId);

  if (feedbackErr) {
    console.error("Error fetching session feedback comments:", feedbackErr);
    throw new Error(feedbackErr.message);
  }

  const feedbackStream = (feedbackData ?? []).map(f => ({
    id: f.id,
    rawText: f.content,
    createdAt: f.created_at
  }));

  // Fetch course name
  const { data: courseData } = await supabase
    .from("courses")
    .select("title")
    .eq("id", courseId)
    .maybeSingle();
  const courseName = courseData?.title || (session.classes as any)?.course || "Unknown Course";

  // 4. Formulate the SessionContext and run the modular pipeline orchestrator
  const sessionContext = {
    course: courseName,
    topic: session.topic || "Unknown Topic",
    targetIloRbt: targetIloRbt,
    sessionId: sessionId,
    iloStatement: activeIlos[0]?.statement || "Unknown Goal"
  };

  const { api } = getMLWorker();
  // Preload the model with download progress before running inference
  await api.preloadModel();
  const pipelineOutput = await api.run(sessionContext, feedbackStream);
  const buffer = pipelineOutput.diagnostics ?? [];

  // 5. Calculate distribution metrics to construct the final UI AnalysisResult payload
  const aspectDist = Object.entries(pipelineOutput.stats.aspectCounts).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const issueDist = Object.entries(pipelineOutput.stats.issueCounts).map(([key, value]) => ({ label: ISSUE_RULES[key.toLowerCase()] ?? key, value })).sort((a, b) => b.value - a.value);
  
  const polarityDist = [
    { label: "Positive", value: pipelineOutput.stats.polarityCounts.pos || 0 },
    { label: "Neutral", value: pipelineOutput.stats.polarityCounts.neu || 0 },
    { label: "Negative", value: pipelineOutput.stats.polarityCounts.neg || 0 },
  ];

  // Enrich distribution entries with contributing feedback texts
  const feedbackMap = new Map<string, string>();
  for (const fb of feedbackStream) {
    feedbackMap.set(fb.id, fb.rawText);
  }

  const aspectToTexts = new Map<string, string[]>();
  const issueToTexts = new Map<string, string[]>();
  const polarityToTexts: Record<string, string[]> = { pos: [], neu: [], neg: [] };
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
  }
  for (const entry of aspectDist) {
    entry.feedbackTexts = aspectToTexts.get(entry.label);
  }
  for (const entry of issueDist) {
    entry.feedbackTexts = issueToTexts.get(entry.label);
  }
  const polarityLabelKey: Record<string, string> = { Positive: "pos", Neutral: "neu", Negative: "neg" };
  for (const entry of polarityDist) {
    entry.feedbackTexts = polarityToTexts[polarityLabelKey[entry.label]];
  }

  // Construct Gap items corresponding to live active session ILO statements
  const gaps: any[] = [];
  const gapDiagnostics = buffer.filter(d => d.isGap);
  for (const gapDiag of gapDiagnostics) {
    const ilo = activeIlos[0]; // Associate gap with primary session ILO for now
    if (ilo) {
      gaps.push({
        iloId: ilo.id,
        expected: ilo.statement,
        actual: `Issue: "${gapDiag.issue}" (CLT: ${gapDiag.clt}, RBT: Level ${gapDiag.rbt})`,
        severity: "medium"
      });
    }
  }

  // Map recommendations
  const recommendations = pipelineOutput.recommendationList.map(rec => ({
    id: rec.id,
    paragraph: rec.paragraph,
    terms: rec.terms as any[],
    theories: rec.theories as any[],
    priority: rec.priority
  }));

  const finalResult: AnalysisResult = {
    sessionId,
    totalFeedback: pipelineOutput.stats.totalFeedback,
    aspectDist,
    issueDist,
    polarityDist,
    gaps,
    recommendations
  };

  // 6. DB Integration: Save aggregate result to analysis_results
  // Delete first to avoid conflicts in case unique constraint is not present
  await supabase
    .from("analysis_results")
    .delete()
    .eq("session_id", sessionId);

  const { error: insertErr } = await supabase
    .from("analysis_results")
    .insert({
      session_id: sessionId,
      result: finalResult,
      is_mock: false,
      model_version: "DistilXLM-R (Tracer Stub)"
    });

  if (insertErr) {
    console.error("Error saving aggregate analysis results:", insertErr);
    throw new Error(insertErr.message);
  }

  // 7. DB Integration: Save individual diagnostic records to feedback_diagnostics
  await supabase
    .from("feedback_diagnostics")
    .delete()
    .eq("session_id", sessionId);

  if (buffer.length > 0) {
    const diagnosticsInsert = buffer.map(diag => ({
      feedback_id: diag.feedbackId,
      session_id: sessionId,
      tti: diag.tti,
      rbt: diag.rbt,
      clt: diag.clt,
      issue: diag.issue,
      polarity: diag.polarity,
      is_gap: diag.isGap
    }));

    const { error: diagnosticsErr } = await supabase
      .from("feedback_diagnostics")
      .insert(diagnosticsInsert);

    if (diagnosticsErr) {
      console.error("Error saving feedback diagnostics:", diagnosticsErr);
      // Non-blocking error for tracer, but log it
    }
  }

  // 8. Update session's last_analyzed_at
  const { error: sessionUpdateErr } = await supabase
    .from("sessions")
    .update({ last_analyzed_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (sessionUpdateErr) {
    console.error("Error updating session last_analyzed_at:", sessionUpdateErr);
  }

  console.debug("[analysis] Successfully saved analysis results and diagnostics.", { sessionId });
  return finalResult;
}
