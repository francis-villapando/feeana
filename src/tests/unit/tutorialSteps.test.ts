import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TUTORIAL_STEPS,
  decideNavigationAdvance,
  isOnStepRoutePattern,
  resolveNavigationPath,
  shouldBlockTutorial,
  type NavigationStepEntry,
  type TutorialDynamicIds,
  type TutorialPlacement,
  type TutorialStep,
  type TutorialStepTrigger,
} from "../../lib/tutorial/tutorialSteps";

const CLASS_ID = "class-abc";
const SESSION_ID = "session-xyz";

const NAV_TRIGGER: Extract<TutorialStepTrigger, { type: "navigation" }> = {
  type: "navigation",
  targetPath: "/dashboard",
};

const NAV_STEP: TutorialStep = {
  id: "step-nav-dashboard",
  title: "Dashboard",
  body: "",
  anchor: "home-nav-dashboard",
  placement: "bottom",
  routePattern: "/home",
  trigger: NAV_TRIGGER,
};

const DYNAMIC_NAV_TRIGGER: Extract<TutorialStepTrigger, { type: "navigation" }> = {
  type: "navigation",
  targetPath: (ids) => (ids.classId ? `/${ids.classId}` : "/home"),
};

/** Every `data-tutorial` attribute value and `dataTutorial:` prop value in the app, read straight from source. */
function collectDeclaredAnchors(): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith(".tsx") && !entry.name.endsWith(".ts")) continue;
      const src = readFileSync(path, "utf8");
      // Scan within 240 chars of each data-tutorial/dataTutorial occurrence to
      // capture multi-line ternary expressions like:
      //   data-tutorial={condition ? "hub-add-topic-btn" : undefined}
      const keyRe = /(?:data-tutorial|dataTutorial)/g;
      for (const km of src.matchAll(keyRe)) {
        const window = src.slice(km.index!, km.index! + 240);
        for (const vm of window.matchAll(/"([a-z][a-z0-9-]+)"/g)) {
          if (vm[1] !== "data-tutorial" && vm[1] !== "dataTutorial") found.add(vm[1]);
        }
      }
    }
  };
  walk(join(process.cwd(), "src"));
  return found;
}

describe("TUTORIAL_STEPS", () => {
  it("has the thirty-six planned steps in order", () => {
    expect(TUTORIAL_STEPS.map((s) => s.id)).toEqual([
      "step-welcome",
      "step-nav-dashboard",
      "step-kpi-cards",
      "step-add-course-btn",
      "step-course-form",
      "step-expand-course",
      "step-add-topic-btn",
      "step-topic-form",
      "step-add-ilo-btn",
      "step-ilo-form",
      "step-activity-feed",
      "step-create-class-btn",
      "step-create-class-form",
      "step-open-class-card",
      "step-class-overview",
      "step-class-details",
      "step-session-creator",
      "step-open-session-card",
      "step-analysis-import-btn",
      "step-analysis-sample",
      "step-analysis-trigger",
      "step-analysis-confirm",
      "step-ml-progress",
      "step-results-kpi",
      "step-results-aspect",
      "step-results-aspect-category",
      "step-results-aspect-all-feedback",
      "step-results-issue",
      "step-results-polarity",
      "step-results-cognitive",
      "step-results-uncategorized",
      "step-results-ilo-gaps",
      "step-results-recommendations",
      "step-back-to-class",
      "step-class-trends-populated",
      "step-conclusion",
    ]);
  });

  it("uses unique ids and prefixes every id with step-", () => {
    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("step-"))).toBe(true);
  });

  it("centres only the opening and closing cards, so neither can ever block", () => {
    const centered = TUTORIAL_STEPS.filter((s) => s.placement === "center");
    expect(centered.map((s) => s.id)).toEqual(["step-welcome", "step-conclusion"]);
    expect(centered.every((s) => s.anchor === null)).toBe(true);
  });

  it("declares a routePattern for every step", () => {
    for (const step of TUTORIAL_STEPS) {
      expect(typeof step.routePattern).toBe("string");
      expect(step.routePattern.length).toBeGreaterThan(0);
    }
  });

  it("every non-centered step has a non-null anchor", () => {
    const nonCentered = TUTORIAL_STEPS.filter((s) => s.placement !== "center");
    expect(nonCentered.every((s) => s.anchor !== null)).toBe(true);
  });

  it("worker-complete trigger only on ml-progress step", () => {
    const workerSteps = TUTORIAL_STEPS.filter((s) => s.trigger.type === "worker-complete");
    expect(workerSteps.map((s) => s.id)).toEqual(["step-ml-progress"]);
  });

  it("marks exactly the click steps a route state effect already advances", () => {
    // The click bridge in TutorialProvider skips these. The analysis steps advance
    // on modal open/close, so advancing on the anchor click would leave the user
    // mid-flow — on step-ml-progress, which has no forward button to click.
    const bridged = TUTORIAL_STEPS.filter(
      (s) => s.trigger.type === "dom-action" && s.trigger.bridged === true,
    );
    expect(bridged.map((s) => s.id)).toEqual([
      "step-analysis-import-btn",
      "step-analysis-sample",
      "step-analysis-trigger",
      "step-analysis-confirm",
      "step-results-aspect-category",
      "step-results-aspect-all-feedback",
    ]);
    expect(
      bridged.every((s) => s.trigger.type === "dom-action" && s.trigger.event === "click"),
    ).toBe(true);
  });

  it("leaves the click-to-open steps unbridged so the click bridge owns them", () => {
    const unbridged = TUTORIAL_STEPS.filter(
      (s) => s.trigger.type === "dom-action" && s.trigger.event === "click" && !s.trigger.bridged,
    );
    expect(unbridged.map((s) => s.id)).toEqual([
      "step-add-course-btn",
      "step-expand-course",
      "step-add-topic-btn",
      "step-add-ilo-btn",
      "step-create-class-btn",
    ]);
  });
});

describe("anchor coverage", () => {
  // With page blocking on, an anchor that does not resolve would strand the user on
  // a page the overlay holds shut, so a renamed or removed selector must fail CI.
  const declared = collectDeclaredAnchors();

  it("found the source scan non-trivially", () => {
    expect(declared.has("sidebar-class-link")).toBe(true);
  });

  it.each(
    TUTORIAL_STEPS.filter((s) => s.anchor).flatMap((s) =>
      [s.anchor as string, ...(s.interactive ?? [])].map((selector) => [s.id, selector] as const),
    ),
  )("%s declares %s in the app source", (_stepId, selector) => {
    expect(declared.has(selector)).toBe(true);
  });

  it("spotlights the loader card rather than centring the progress step", () => {
    const progress = TUTORIAL_STEPS.find((s) => s.id === "step-ml-progress");
    expect(progress?.anchor).toBe("analysis-ml-progress");
    expect(progress?.placement).not.toBe("center");
  });

  it("keeps the import footer confirm reachable alongside the preset button", () => {
    const sample = TUTORIAL_STEPS.find((s) => s.id === "step-analysis-sample");
    expect(sample?.anchor).toBe("analysis-sample-btn");
    expect(sample?.interactive).toContain("analysis-import-confirm");
  });
});

describe("isOnStepRoutePattern", () => {
  it("matches exact static paths", () => {
    expect(isOnStepRoutePattern("/home", "/home")).toBe(true);
    expect(isOnStepRoutePattern("/dashboard", "/dashboard")).toBe(true);
  });

  it("matches paths with named segments", () => {
    expect(isOnStepRoutePattern(`/${CLASS_ID}`, "/:classId")).toBe(true);
    expect(
      isOnStepRoutePattern(`/${CLASS_ID}/analysis/${SESSION_ID}`, "/:classId/analysis/:sessionId"),
    ).toBe(true);
  });

  it("rejects different segment counts", () => {
    // A path with more segments than the pattern has
    expect(isOnStepRoutePattern(`/${CLASS_ID}/analysis/${SESSION_ID}`, "/:classId")).toBe(false);
    // A path with fewer segments than the pattern has
    expect(isOnStepRoutePattern(`/${CLASS_ID}`, "/:classId/analysis/:sessionId")).toBe(false);
    // Empty path against non-empty pattern
    expect(isOnStepRoutePattern("/", "/:classId")).toBe(false);
  });

  it("rejects mismatched static segments", () => {
    expect(
      isOnStepRoutePattern(`/${CLASS_ID}/other/${SESSION_ID}`, "/:classId/analysis/:sessionId"),
    ).toBe(false);
  });

  it("tolerates trailing slashes", () => {
    expect(isOnStepRoutePattern("/home/", "/home")).toBe(true);
    expect(isOnStepRoutePattern(`/${CLASS_ID}/`, "/:classId")).toBe(true);
  });
});

describe("resolveNavigationPath", () => {
  const FULL_IDS: TutorialDynamicIds = {
    courseId: null,
    topicId: null,
    iloId: null,
    classId: CLASS_ID,
    sessionId: SESSION_ID,
    courseCodePlaceholder: "",
  };

  it("returns a static targetPath unchanged", () => {
    expect(resolveNavigationPath(NAV_TRIGGER, FULL_IDS)).toBe("/dashboard");
  });

  it("substitutes dynamic ids when they exist", () => {
    expect(resolveNavigationPath(DYNAMIC_NAV_TRIGGER, FULL_IDS)).toBe(`/${CLASS_ID}`);
  });

  it("returns null while a dynamic id the step needs is missing", () => {
    // The resolver falls back to "/home" when the id is absent; that is a
    // placeholder, not a destination, so it must not be treated as one.
    expect(resolveNavigationPath(DYNAMIC_NAV_TRIGGER, { ...FULL_IDS, classId: null })).toBeNull();
  });

  it("keeps a genuine /home target rather than reading it as unresolved", () => {
    const toHome = { type: "navigation", targetPath: "/home" } as const;
    expect(resolveNavigationPath(toHome, FULL_IDS)).toBe("/home");
  });
});

describe("decideNavigationAdvance", () => {
  const entry = (pathname: string): NavigationStepEntry => ({
    stepId: NAV_STEP.id,
    pathname,
  });

  it("does not advance on the step's first observation, even already on the target", () => {
    // The reported bug: the tour started on /dashboard, step 2 activated, and the
    // step skipped itself straight to step 3.
    const result = decideNavigationAdvance({
      step: NAV_STEP,
      pathname: "/dashboard",
      expectedPath: "/dashboard",
      entry: null,
    });
    expect(result.advance).toBe(false);
    expect(result.entry).toEqual(entry("/dashboard"));
  });

  it("advances once the pathname changes onto the target", () => {
    const result = decideNavigationAdvance({
      step: NAV_STEP,
      pathname: "/dashboard",
      expectedPath: "/dashboard",
      entry: entry("/home"),
    });
    expect(result.advance).toBe(true);
  });

  it("does not advance while the pathname is unchanged", () => {
    const result = decideNavigationAdvance({
      step: NAV_STEP,
      pathname: "/home",
      expectedPath: "/dashboard",
      entry: entry("/home"),
    });
    expect(result.advance).toBe(false);
  });

  it("does not advance when the pathname changes somewhere else", () => {
    const result = decideNavigationAdvance({
      step: NAV_STEP,
      pathname: `/archived`,
      expectedPath: "/dashboard",
      entry: entry("/home"),
    });
    expect(result.advance).toBe(false);
  });

  it("re-records the entry when a different step becomes active", () => {
    const other = { ...NAV_STEP, id: "step-back-to-class" } as TutorialStep;
    const result = decideNavigationAdvance({
      step: other,
      pathname: "/dashboard",
      expectedPath: "/dashboard",
      entry: entry("/home"),
    });
    expect(result.advance).toBe(false);
    expect(result.entry).toEqual({ stepId: "step-back-to-class", pathname: "/dashboard" });
  });

  it("never advances while the expected path is unresolved", () => {
    const result = decideNavigationAdvance({
      step: NAV_STEP,
      pathname: "/dashboard",
      expectedPath: null,
      entry: entry("/home"),
    });
    expect(result.advance).toBe(false);
  });

  it("tolerates trailing slashes on the target", () => {
    const result = decideNavigationAdvance({
      step: NAV_STEP,
      pathname: "/dashboard/",
      expectedPath: "/dashboard",
      entry: entry("/home"),
    });
    expect(result.advance).toBe(true);
  });
});

describe("shouldBlockTutorial", () => {
  const placements: TutorialPlacement[] = ["top", "bottom", "left", "right"];

  it("blocks whenever a hole resolved on an anchored step", () => {
    for (const placement of placements) {
      expect(shouldBlockTutorial(true, placement)).toBe(true);
    }
  });

  it("never blocks a centered card", () => {
    expect(shouldBlockTutorial(true, "center")).toBe(false);
    expect(shouldBlockTutorial(false, "center")).toBe(false);
  });

  it("never blocks when the anchor failed to resolve, so a missing anchor cannot trap the user", () => {
    for (const placement of [...placements, "center" as const]) {
      expect(shouldBlockTutorial(false, placement)).toBe(false);
    }
  });
});
