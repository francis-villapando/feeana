// Deploy bridge for pre-migration browser completions; remove once old keys have drained.
const TUTORIAL_COMPLETED_KEY = "feeana_tutorial_completed";

// Step IDs

export type TutorialStepId =
  | "step-welcome"
  | "step-nav-dashboard"
  | "step-kpi-cards"
  | "step-add-course-btn"
  | "step-course-form"
  | "step-expand-course"
  | "step-add-topic-btn"
  | "step-topic-form"
  | "step-add-ilo-btn"
  | "step-ilo-form"
  | "step-activity-feed"
  | "step-create-class-btn"
  | "step-create-class-form"
  | "step-open-class-card"
  | "step-class-overview"
  | "step-class-details"
  | "step-session-creator"
  | "step-open-session-card"
  | "step-analysis-import-btn"
  | "step-analysis-sample"
  | "step-analysis-trigger"
  | "step-analysis-confirm"
  | "step-ml-progress"
  | "step-results-kpi"
  | "step-results-aspect"
  | "step-results-aspect-category"
  | "step-results-aspect-all-feedback"
  | "step-results-issue"
  | "step-results-polarity"
  | "step-results-cognitive"
  | "step-results-uncategorized"
  | "step-results-ilo-gaps"
  | "step-results-recommendations"
  | "step-back-to-class"
  | "step-class-trends-populated"
  | "step-conclusion";

export type TutorialPlacement = "top" | "bottom" | "left" | "right" | "center";

// Trigger contracts

export type TutorialStepTrigger =
  | { type: "acknowledgement"; buttonLabel?: string }
  | {
      type: "dom-action";
      event: "click" | "submit";
      targetAnchor: string;
      requiresInteraction?: boolean;
      bridged?: boolean;
    }
  | {
      type: "navigation";
      targetPath: string | ((ids: TutorialDynamicIds) => string);
    }
  | { type: "worker-complete"; progressAnchor: string };

export interface TutorialDynamicIds {
  courseId: string | null;
  topicId: string | null;
  iloId: string | null;
  classId: string | null;
  sessionId: string | null;
  courseCodePlaceholder: string;
}

// Step definition

export interface TutorialStep {
  id: TutorialStepId;
  title: string;
  body: string;
  anchor: string | null;
  placement: TutorialPlacement;
  routePattern: string;
  trigger: TutorialStepTrigger;
  interactive?: readonly string[];
}

// Step definitions

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  // Step 1 — Welcome
  {
    id: "step-welcome",
    title: "Welcome to Feeana",
    body: "Let's walk through managing your curriculum, launching feedback sessions, and analyzing student responses. Everything you create during the tour is sample data and is cleaned up when it ends.",
    anchor: null,
    placement: "center",
    routePattern: "/home",
    trigger: { type: "acknowledgement", buttonLabel: "Start Tour" },
  },
  // Step 2 — Navigate to Dashboard
  {
    id: "step-nav-dashboard",
    title: "Navigate to Dashboard",
    body: "Navigate to your faculty dashboard to view workspace metrics and manage courses.",
    anchor: "home-nav-dashboard",
    placement: "bottom",
    routePattern: "/home",
    trigger: { type: "navigation", targetPath: "/dashboard" },
    interactive: ["home-nav-dashboard"],
  },
  // Step 3 — KPI Cards
  {
    id: "step-kpi-cards",
    title: "Workspace KPIs",
    body: "These KPI cards summarize active classes, active sessions, overall submission rate, and overall ILO achievement across your workspace.",
    anchor: "dashboard-kpi-row",
    placement: "bottom",
    routePattern: "/dashboard",
    trigger: { type: "acknowledgement", buttonLabel: "Continue" },
  },
  // Step 4a — Open Course Creator
  {
    id: "step-add-course-btn",
    title: "Create a Course",
    body: "Let's define your curriculum hierarchy starting with a course. Open the course creator.",
    anchor: "hub-add-course-btn",
    placement: "bottom",
    routePattern: "/dashboard",
    trigger: { type: "dom-action", event: "click", targetAnchor: "hub-add-course-btn" },
  },
  // Step 4b — Course Form Submit
  {
    id: "step-course-form",
    title: "Fill in Course Details",
    body: "Enter a course code and descriptive title of your choice, then save.",
    anchor: "entity-dialog-content",
    placement: "right",
    routePattern: "/dashboard",
    trigger: {
      type: "dom-action",
      event: "submit",
      targetAnchor: "entity-dialog-content",
      requiresInteraction: true,
    },
  },
  // Step 4c — Expand the tutorial course accordion
  {
    id: "step-expand-course",
    title: "Open Your Course",
    body: "Click on your newly created course to view its topics and intended learning outcomes.",
    anchor: "hub-course-trigger",
    placement: "bottom",
    routePattern: "/dashboard",
    trigger: { type: "dom-action", event: "click", targetAnchor: "hub-course-trigger" },
  },
  // Step 4d — Add Topic button
  {
    id: "step-add-topic-btn",
    title: "Add a Topic",
    body: "Courses contain specific topics. Add a topic to your newly created course.",
    anchor: "hub-add-topic-btn",
    placement: "right",
    routePattern: "/dashboard",
    trigger: { type: "dom-action", event: "click", targetAnchor: "hub-add-topic-btn" },
  },
  // Step 4e — Topic Form Submit
  {
    id: "step-topic-form",
    title: "Fill in Topic Details",
    body: "Enter a topic title for an upcoming lecture or module of your choice, then save.",
    anchor: "entity-dialog-content",
    placement: "right",
    routePattern: "/dashboard",
    trigger: {
      type: "dom-action",
      event: "submit",
      targetAnchor: "entity-dialog-content",
      requiresInteraction: true,
    },
  },
  // Step 4f — Add ILO button
  {
    id: "step-add-ilo-btn",
    title: "Add an ILO",
    body: "Intended Learning Outcomes (ILOs) define student competency goals. Add an ILO to your topic.",
    anchor: "hub-add-ilo-btn",
    placement: "right",
    routePattern: "/dashboard",
    trigger: { type: "dom-action", event: "click", targetAnchor: "hub-add-ilo-btn" },
  },
  // Step 4g — ILO Form Submit
  {
    id: "step-ilo-form",
    title: "Fill in ILO Details",
    body: "Enter a target outcome statement and select its Bloom's Taxonomy level from the dropdown.",
    anchor: "entity-dialog-content",
    placement: "right",
    routePattern: "/dashboard",
    trigger: {
      type: "dom-action",
      event: "submit",
      targetAnchor: "entity-dialog-content",
      requiresInteraction: true,
    },
  },
  // Step 5 — Activity Feed
  {
    id: "step-activity-feed",
    title: "Activity Feed",
    body: "The Activity Feed logs curriculum updates (courses, topics, and ILOs) chronologically across your faculty workspace.",
    anchor: "dashboard-activity-feed",
    placement: "left",
    routePattern: "/dashboard",
    trigger: { type: "acknowledgement", buttonLabel: "Continue" },
  },
  // Step 6a — Open Create Class dialog
  {
    id: "step-create-class-btn",
    title: "Create a Class",
    body: "Now create a class offering for this course. Open the class creation dialog.",
    anchor: "sidebar-create-class-btn",
    placement: "right",
    routePattern: "/dashboard",
    trigger: { type: "dom-action", event: "click", targetAnchor: "sidebar-create-class-btn" },
  },
  // Step 6b — Class form submit
  {
    id: "step-create-class-form",
    title: "Fill in Class Details",
    body: "Select the course you just created, then enter any section label of your choice.",
    anchor: "create-class-dialog-content",
    placement: "right",
    routePattern: "/dashboard",
    trigger: {
      type: "dom-action",
      event: "submit",
      targetAnchor: "create-class-dialog-content",
      requiresInteraction: true,
    },
  },
  // Step 7a — Open class card
  {
    id: "step-open-class-card",
    title: "Open Your Class",
    body: "In the sidebar, find your newly created class and open it to view its details and trend tracking.",
    anchor: "sidebar-class-link",
    placement: "right",
    routePattern: "/dashboard",
    trigger: {
      type: "navigation",
      targetPath: (ids) => (ids.classId ? `/${ids.classId}` : "/home"),
    },
    interactive: ["sidebar-class-link"],
  },
  // Step 7b — Class overview
  {
    id: "step-class-overview",
    title: "Class Overview",
    body: "Here you can track class KPIs and monitor longitudinal sentiment and category trends across sessions.",
    anchor: "class-overview-section",
    placement: "bottom",
    routePattern: "/:classId",
    trigger: { type: "acknowledgement", buttonLabel: "Continue" },
  },
  // Step 7c — Class Details
  {
    id: "step-class-details",
    title: "Class Details",
    body: "This card holds the class essentials: course code and section, enrolled students, the enrollment code your students use to sign in, and a way to archive the class.",
    anchor: "class-details-card",
    placement: "left",
    routePattern: "/:classId",
    trigger: { type: "acknowledgement", buttonLabel: "Continue" },
  },
  // Step 8 — Session Creator
  {
    id: "step-session-creator",
    title: "Schedule a Session",
    body: "Schedule a feedback window for your students by selecting a topic and setting dates.",
    anchor: "class-session-creator",
    placement: "left",
    routePattern: "/:classId",
    trigger: {
      type: "dom-action",
      event: "submit",
      targetAnchor: "class-session-creator",
      requiresInteraction: true,
    },
  },
  // Step 9 — Open Session card
  {
    id: "step-open-session-card",
    title: "Open the Session",
    body: "Open the session to import submissions and run the analysis pipeline.",
    anchor: "class-session-card",
    placement: "right",
    routePattern: "/:classId",
    trigger: {
      type: "navigation",
      targetPath: (ids) =>
        ids.classId && ids.sessionId ? `/${ids.classId}/analysis/${ids.sessionId}` : "/home",
    },
    interactive: ["class-session-card"],
  },
  // Step 10a — Import button
  {
    id: "step-analysis-import-btn",
    title: "Import Feedback",
    body: "In regular use, students submit anonymous feedback during the active window. For this tour, let's load a sample batch.",
    anchor: "analysis-import-btn",
    placement: "bottom",
    routePattern: "/:classId/analysis/:sessionId",
    trigger: {
      type: "dom-action",
      event: "click",
      targetAnchor: "analysis-import-btn",
      bridged: true,
    },
  },
  // Step 10b — Load sample preset
  {
    id: "step-analysis-sample",
    title: "Load Sample Feedback",
    body: "Click Load sample feedback, then click Import feedback to save the batch to this session.",
    anchor: "analysis-sample-btn",
    placement: "bottom",
    routePattern: "/:classId/analysis/:sessionId",
    trigger: {
      type: "dom-action",
      event: "click",
      targetAnchor: "analysis-sample-btn",
      bridged: true,
    },
    interactive: ["analysis-import-confirm"],
  },
  // Step 11 — Trigger analysis
  {
    id: "step-analysis-trigger",
    title: "Trigger Analysis",
    body: "Run Feeana's client-side PID-ABSA pipeline to classify aspects, issues, sentiment, and cognitive levels.",
    anchor: "analysis-trigger-btn",
    placement: "bottom",
    routePattern: "/:classId/analysis/:sessionId",
    trigger: {
      type: "dom-action",
      event: "click",
      targetAnchor: "analysis-trigger-btn",
      bridged: true,
    },
  },
  // Step 11b — Confirm & run
  {
    id: "step-analysis-confirm",
    title: "Start Analysis",
    body: "Click Start analysis to confirm and run the PID-ABSA pipeline on the imported feedback. DistilXLM-R and SVM execute locally in your browser.",
    anchor: "analysis-confirm-btn",
    placement: "top",
    routePattern: "/:classId/analysis/:sessionId",
    trigger: {
      type: "dom-action",
      event: "click",
      targetAnchor: "analysis-confirm-btn",
      bridged: true,
    },
  },
  // Step 12 — ML Progress
  {
    id: "step-ml-progress",
    title: "Analysis Running",
    body: "DistilXLM-R and SVM models run in a Web Worker on your device — feedback is never sent anywhere for analysis.",
    anchor: "analysis-ml-progress",
    placement: "bottom",
    routePattern: "/:classId/analysis/:sessionId",
    trigger: { type: "worker-complete", progressAnchor: "analysis-ml-progress" },
  },
  // Step 13a — KPI Summary
  {
    id: "step-results-kpi",
    title: "Session KPI Summary",
    body: "The KPI summary indicates overall student submission rate and session ILO achievement percentage.",
    anchor: "analysis-kpi-summary",
    placement: "bottom",
    routePattern: "/:classId/analysis/:sessionId",
    trigger: { type: "acknowledgement", buttonLabel: "Continue" },
  },
  // Step 13b — Aspect Chart
  {
    id: "step-results-aspect",
    title: "Aspect Distribution",
    body: "The Aspect Distribution shows which classroom dimensions students commented on (e.g., Teacher Sensitivity, Concept Development, Quality of Feedback).",
    anchor: "analysis-aspect-chart",
    placement: "right",
    routePattern: "/:classId/analysis/:sessionId",
    trigger: { type: "acknowledgement", buttonLabel: "Continue" },
  },
  // Step 13c — Feedback list from the Aspect chart
  {
    id: "step-results-aspect-category",
    title: "Explore the Feedback List",
    body: "Click any category segment on the Aspect chart to open the list of feedback that makes it up. This tour opens the list from the Aspect chart only; in real use, the same list is available from every chart.",
    anchor: "analysis-aspect-chart",
    placement: "right",
    routePattern: "/:classId/analysis/:sessionId",
    trigger: {
      type: "dom-action",
      event: "click",
      targetAnchor: "analysis-aspect-chart",
      bridged: true,
    },
  },
  // Step 13d — All feedback in the modal
  {
    id: "step-results-aspect-all-feedback",
    title: "Session Feedback",
    body: "Toggle 'All Feedback' at the top of the modal to see every response in the session, then close the modal to continue.",
    anchor: "analysis-feedback-dialog",
    placement: "top",
    routePattern: "/:classId/analysis/:sessionId",
    trigger: {
      type: "dom-action",
      event: "click",
      targetAnchor: "analysis-feedback-dialog",
      bridged: true,
    },
  },
  // Step 13e — Issue Chart
  {
    id: "step-results-issue",
    title: "Issue Distribution",
    body: "The Issue Distribution categorizes specific challenges encountered by students during the session.",
    anchor: "analysis-issue-chart",
    placement: "left",
    routePattern: "/:classId/analysis/:sessionId",
    trigger: { type: "acknowledgement", buttonLabel: "Continue" },
  },
  // Step 13d — Polarity Chart
  {
    id: "step-results-polarity",
    title: "Polarity Breakdown",
    body: "Polarity breaks down sentiment into positive, negative, or neutral sentiment across responses.",
    anchor: "analysis-polarity-chart",
    placement: "right",
    routePattern: "/:classId/analysis/:sessionId",
    trigger: { type: "acknowledgement", buttonLabel: "Continue" },
  },
  // Step 13e — Cognitive Charts
  {
    id: "step-results-cognitive",
    title: "RBT & CLT Distributions",
    body: "Revised Bloom's Taxonomy (RBT) and Cognitive Load Theory (CLT) distributions reveal student cognitive engagement and mental effort.",
    anchor: "analysis-cognitive-charts",
    placement: "right",
    routePattern: "/:classId/analysis/:sessionId",
    trigger: { type: "acknowledgement", buttonLabel: "Continue" },
  },
  // Step 13f — Uncategorized
  {
    id: "step-results-uncategorized",
    title: "Uncategorized Submissions",
    body: "Submissions falling below classification confidence thresholds are surfaced here for manual faculty review.",
    anchor: "analysis-uncategorized-notice",
    placement: "top",
    routePattern: "/:classId/analysis/:sessionId",
    trigger: { type: "acknowledgement", buttonLabel: "Continue" },
  },
  // Step 13g — ILO Gaps
  {
    id: "step-results-ilo-gaps",
    title: "ILO Gap Analysis",
    body: "The ILO Gap analysis benchmarks actual student understanding against the session's intended learning outcome level.",
    anchor: "analysis-ilo-gaps",
    placement: "top",
    routePattern: "/:classId/analysis/:sessionId",
    trigger: { type: "acknowledgement", buttonLabel: "Continue" },
  },
  // Step 13h — Recommendations
  {
    id: "step-results-recommendations",
    title: "Recommendations & Warnings",
    body: "Feeana generates primary teaching interventions and secondary pedagogical cues from rule-based pedagogical mappings, paired with anomaly warnings.",
    anchor: "analysis-recommendations",
    placement: "top",
    routePattern: "/:classId/analysis/:sessionId",
    trigger: { type: "acknowledgement", buttonLabel: "Continue" },
  },
  // Step 14a — Back to Class
  {
    id: "step-back-to-class",
    title: "Back to Class",
    body: "Navigate back to the class page to see how analyzed session results update class-level analytics.",
    anchor: "analysis-back-to-class-btn",
    placement: "bottom",
    routePattern: "/:classId/analysis/:sessionId",
    trigger: {
      type: "navigation",
      targetPath: (ids) => (ids.classId ? `/${ids.classId}` : "/home"),
    },
    interactive: ["analysis-back-to-class-btn"],
  },
  // Step 14b — Class Trends (populated)
  {
    id: "step-class-trends-populated",
    title: "Class Trends Populated",
    body: "With the session analyzed, the Metric Trend line and Category Trend distribution now display aggregated results from your analyzed session.",
    anchor: "class-trends",
    placement: "bottom",
    routePattern: "/:classId",
    trigger: { type: "acknowledgement", buttonLabel: "Continue" },
  },
  // Step 15 — Conclusion
  {
    id: "step-conclusion",
    title: "Tour Complete!",
    body: "You've completed the full Feeana feedback loop! Tutorial sandbox data will now be permanently deleted.",
    anchor: null,
    placement: "center",
    routePattern: "/:classId",
    trigger: { type: "acknowledgement", buttonLabel: "Finish Tour" },
  },
];

// Route helpers

export function resolveNavigationPath(
  trigger: Extract<TutorialStepTrigger, { type: "navigation" }>,
  ids: TutorialDynamicIds,
): string | null {
  const raw =
    typeof trigger.targetPath === "function" ? trigger.targetPath(ids) : trigger.targetPath;
  if (raw === "/home" && (trigger.targetPath as string) !== "/home") {
    if (typeof trigger.targetPath === "function") return null;
  }
  return raw;
}

export interface NavigationStepEntry {
  stepId: TutorialStepId;
  pathname: string;
}

/**
 * Decides whether a `navigation` step may advance.
 */
export function decideNavigationAdvance(args: {
  step: TutorialStep;
  pathname: string;
  expectedPath: string | null;
  entry: NavigationStepEntry | null;
}): { advance: boolean; entry: NavigationStepEntry } {
  const { step, pathname, expectedPath, entry } = args;
  const current: NavigationStepEntry = { stepId: step.id, pathname };

  if (entry?.stepId !== step.id) return { advance: false, entry: current };
  if (!expectedPath || entry.pathname === pathname) return { advance: false, entry };

  return { advance: normalizePathname(pathname) === normalizePathname(expectedPath), entry };
}

export function isOnStepRoutePattern(pathname: string, pattern: string): boolean {
  const normalizedPath = normalizePathname(pathname);
  const normalizedPattern = normalizePathname(pattern);

  const pathParts = normalizedPath.split("/").filter(Boolean);
  const patternParts = normalizedPattern.split("/").filter(Boolean);

  if (pathParts.length !== patternParts.length) return false;

  for (let i = 0; i < patternParts.length; i++) {
    const patPart = patternParts[i];
    const pathPart = pathParts[i];
    if (patPart.startsWith(":") || patPart.startsWith("$")) continue;
    if (patPart !== pathPart) return false;
  }
  return true;
}

function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

export function shouldBlockTutorial(hasHole: boolean, placement: TutorialPlacement): boolean {
  return hasHole && placement !== "center";
}

// Auto-start gating

/**
 * Deploy bridge: reports and clears a pre-migration browser completion so the
 * account flag can backfill and other devices never re-show the tour.
 */
export function consumeLegacyTutorialCompletion(): boolean {
  try {
    const completed = localStorage.getItem(TUTORIAL_COMPLETED_KEY) === "true";
    if (completed) localStorage.removeItem(TUTORIAL_COMPLETED_KEY);
    return completed;
  } catch {
    return false;
  }
}

export interface TutorialAutoStartInput {
  /** profiles.tutorial_shown_at for the signed-in faculty; null = never auto-opened. */
  serverShownAt: string | null;
  completedInThisBrowser: boolean;
}

/**
 * The tour auto-opens exactly once per faculty account: only a signin that
 * finds no persisted marker may start it. Every later signin — and any run
 * started from the app menu — is manual-only.
 */
export function shouldAutoStartTutorial(input: TutorialAutoStartInput): boolean {
  return input.serverShownAt === null && !input.completedInThisBrowser;
}

/**
 * Generates a non-colliding placeholder hint for the course code field.
 * Format: TUT-<4 random alphanumeric characters>.
 */
export function generateCourseCodePlaceholder(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `TUT-${suffix}`;
}
