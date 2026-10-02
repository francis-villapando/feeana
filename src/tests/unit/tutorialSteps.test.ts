// @vitest-environment jsdom

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as authModule from "../../lib/stores/auth";
import * as tutorialLifecycle from "../../lib/tutorial/tutorialLifecycle";
import { TutorialStoreProvider, useTutorialStore } from "../../lib/tutorial/tutorialStore";
import {
  TUTORIAL_STEPS,
  consumeLegacyTutorialCompletion,
  decideNavigationAdvance,
  isOnStepRoutePattern,
  resolveNavigationPath,
  shouldAutoStartTutorial,
  shouldBlockTutorial,
  type NavigationStepEntry,
  type TutorialDynamicIds,
  type TutorialPlacement,
  type TutorialStep,
  type TutorialStepTrigger,
} from "../../lib/tutorial/tutorialSteps";

vi.mock("../../lib/stores/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../lib/tutorial/tutorialLifecycle", () => ({
  ensureTutorialShown: vi.fn(),
  fetchTutorialShownAt: vi.fn(),
}));

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

describe("shouldAutoStartTutorial", () => {
  it("auto-starts only when the account has never shown the tour and the browser is clear", () => {
    expect(shouldAutoStartTutorial({ serverShownAt: null, completedInThisBrowser: false })).toBe(
      true,
    );
  });

  it("never auto-starts once the account flag exists", () => {
    expect(
      shouldAutoStartTutorial({
        serverShownAt: "2026-01-01T00:00:00.000Z",
        completedInThisBrowser: false,
      }),
    ).toBe(false);
  });

  it("bridges pre-migration browser completions even when the account flag is missing", () => {
    expect(shouldAutoStartTutorial({ serverShownAt: null, completedInThisBrowser: true })).toBe(
      false,
    );
  });

  it("bridges when both markers exist", () => {
    expect(
      shouldAutoStartTutorial({
        serverShownAt: "2026-01-01T00:00:00.000Z",
        completedInThisBrowser: true,
      }),
    ).toBe(false);
  });
});

describe("TutorialStoreProvider auto-start arbitration", () => {
  const user = { id: "faculty-123" } as const;

  function ConsumerFixture() {
    const store = useTutorialStore();
    return React.createElement(
      React.Fragment,
      null,
      React.createElement("button", { onClick: () => store.start() }, "start"),
      React.createElement("button", { onClick: () => store.restart() }, "restart"),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.mocked(authModule.useAuth).mockReturnValue({
      user,
    } as ReturnType<typeof authModule.useAuth>);
    vi.mocked(tutorialLifecycle.fetchTutorialShownAt).mockResolvedValue(null);
    vi.mocked(tutorialLifecycle.ensureTutorialShown).mockResolvedValue();
  });

  it("persists the server marker when the tour auto-starts", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    function Consumer() {
      const store = useTutorialStore();
      return React.createElement(
        "button",
        { onClick: () => store.start() },
        String(store.stepIndex),
      );
    }

    await act(async () => {
      root.render(React.createElement(TutorialStoreProvider, null, React.createElement(Consumer)));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(tutorialLifecycle.fetchTutorialShownAt).toHaveBeenCalledWith("faculty-123");
    expect(tutorialLifecycle.ensureTutorialShown).toHaveBeenCalledWith("faculty-123");
    expect(container.textContent).toBe("0");

    root.unmount();
    container.remove();
  });

  it("does not persist when the account already has a server marker", async () => {
    vi.mocked(tutorialLifecycle.fetchTutorialShownAt).mockResolvedValue("2026-01-01T00:00:00.000Z");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(TutorialStoreProvider, null, React.createElement(ConsumerFixture)),
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(tutorialLifecycle.ensureTutorialShown).not.toHaveBeenCalled();

    root.unmount();
    container.remove();
  });

  it("manual start and restart never write the auto-start marker", async () => {
    vi.mocked(tutorialLifecycle.fetchTutorialShownAt).mockResolvedValue("2026-01-01T00:00:00.000Z");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(TutorialStoreProvider, null, React.createElement(ConsumerFixture)),
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const buttons = Array.from(container.querySelectorAll("button"));
    await act(async () => {
      buttons[0].click();
      buttons[1].click();
    });

    expect(tutorialLifecycle.ensureTutorialShown).not.toHaveBeenCalled();

    root.unmount();
    container.remove();
  });
});

describe("consumeLegacyTutorialCompletion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubLocalStorage(store: Map<string, string>): void {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
  }

  it("reports and clears a pre-migration completion key", () => {
    const store = new Map([["feeana_tutorial_completed", "true"]]);
    stubLocalStorage(store);
    expect(consumeLegacyTutorialCompletion()).toBe(true);
    expect(store.has("feeana_tutorial_completed")).toBe(false);
  });

  it("returns false and keeps the browser untouched when no key exists", () => {
    const store = new Map<string, string>();
    stubLocalStorage(store);
    expect(consumeLegacyTutorialCompletion()).toBe(false);
    expect(store.size).toBe(0);
  });

  it("treats an unreadable localStorage as not completed", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(consumeLegacyTutorialCompletion()).toBe(false);
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
