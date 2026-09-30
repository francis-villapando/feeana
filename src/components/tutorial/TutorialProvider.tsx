import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { friendlyError } from "@/lib/hooks/utils";
import { useAuth } from "@/lib/stores/auth";
import { useClassStore } from "@/lib/stores/classStore";
import {
  decideNavigationAdvance,
  isOnStepRoutePattern,
  resolveNavigationPath,
  type NavigationStepEntry,
  type TutorialDynamicIds,
} from "@/lib/tutorial/tutorialSteps";
import { TutorialStoreProvider, useTutorialStore } from "@/lib/tutorial/tutorialStore";
import { TutorialOverlay } from "./TutorialOverlay";
import { deleteTutorialSandbox } from "@/lib/tutorial/tutorialLifecycle";
import { useCourseStore } from "@/lib/stores/courseStore";

interface TutorialActions {
  /** Resets the tour back to step 0, sweeping prior sandbox data. */
  restart: () => void;
}

const TutorialActionsContext = createContext<TutorialActions | null>(null);

export function useTutorialActions(): TutorialActions | null {
  return useContext(TutorialActionsContext);
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  return (
    <TutorialStoreProvider>
      <TutorialOrchestrator>{children}</TutorialOrchestrator>
    </TutorialStoreProvider>
  );
}

function TutorialOrchestrator({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { refreshClasses, setActiveTutorialClassIds } = useClassStore();
  const { refreshAll: refreshCourses, setActiveTutorialCourseIds } = useCourseStore();
  const {
    isActive,
    step,
    activeCourseId,
    activeTopicId,
    activeIloId,
    activeClassId,
    activeSessionId,
    courseCodePlaceholder,
    setActiveCourseId,
    setActiveTopicId,
    setActiveIloId,
    setActiveClassId,
    setActiveSessionId,
    advanceIfStep,
    finish,
    restart: rewindSteps,
  } = useTutorialStore();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const sweptRef = useRef(false);
  const cleanupRef = useRef(false);
  const enteredRef = useRef(false);
  const navEntryRef = useRef<NavigationStepEntry | null>(null);

  // Route the run to its entry page
  useEffect(() => {
    if (!isActive) {
      enteredRef.current = false;
      return;
    }
    if (enteredRef.current) return;
    enteredRef.current = true;
    if (!isOnStepRoutePattern(pathname, "/home")) void navigate({ to: "/home" });
  }, [isActive, pathname, navigate]);

  // Sweep abandoned prior runs on first activation
  useEffect(() => {
    if (authLoading || !user || user.role !== "faculty") return;
    if (!isActive || sweptRef.current) return;
    sweptRef.current = true;
    void (async () => {
      try {
        await deleteTutorialSandbox(user.id);
        await Promise.all([refreshClasses(), refreshCourses()]);
      } catch (err) {
        toast.error(friendlyError(err, "Couldn't clean up prior tutorial data."));
      }
    })();
  }, [authLoading, user, isActive, refreshClasses, refreshCourses]);

  // Delete sandbox when tour ends
  useEffect(() => {
    if (isActive) {
      cleanupRef.current = false;
      return;
    }
    if (cleanupRef.current || !user) return;
    if (!sweptRef.current) return;
    cleanupRef.current = true;
    void (async () => {
      try {
        await deleteTutorialSandbox(user.id);
        setActiveTutorialClassIds([]);
        setActiveTutorialCourseIds([]);
        setActiveCourseId(null);
        setActiveTopicId(null);
        setActiveIloId(null);
        setActiveClassId(null);
        setActiveSessionId(null);
        await Promise.all([refreshClasses(), refreshCourses()]);
      } catch (err) {
        toast.error(friendlyError(err, "Couldn't delete the tutorial sandbox data."));
      }
    })();
  }, [
    isActive,
    user,
    refreshClasses,
    refreshCourses,
    setActiveTutorialClassIds,
    setActiveTutorialCourseIds,
    setActiveCourseId,
    setActiveTopicId,
    setActiveIloId,
    setActiveClassId,
    setActiveSessionId,
  ]);

  // Navigation step detection
  useEffect(() => {
    if (!isActive || !step) {
      navEntryRef.current = null;
      return;
    }
    const trigger = step.trigger;
    if (trigger.type !== "navigation") {
      navEntryRef.current = null;
      return;
    }

    const ids: TutorialDynamicIds = {
      courseId: activeCourseId,
      topicId: activeTopicId,
      iloId: activeIloId,
      classId: activeClassId,
      sessionId: activeSessionId,
      courseCodePlaceholder,
    };
    const decision = decideNavigationAdvance({
      step,
      pathname,
      expectedPath: resolveNavigationPath(trigger, ids),
      entry: navEntryRef.current,
    });
    navEntryRef.current = decision.entry;
    if (decision.advance) advanceIfStep(step.id);
  }, [
    isActive,
    step,
    pathname,
    activeCourseId,
    activeTopicId,
    activeIloId,
    activeClassId,
    activeSessionId,
    courseCodePlaceholder,
    advanceIfStep,
  ]);

  // DOM action step detection (click)
  useEffect(() => {
    if (!isActive || !step) return;
    if (step.trigger.type !== "dom-action" || step.trigger.event !== "click") return;
    if (step.trigger.bridged) return;

    const anchor = step.trigger.targetAnchor;
    const handleClick = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest(`[data-tutorial="${anchor}"]`)) {
        advanceIfStep(step.id);
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [isActive, step, advanceIfStep]);

  // Sync tutorial class & course visibility
  useEffect(() => {
    if (activeClassId) {
      setActiveTutorialClassIds([activeClassId]);
    } else {
      setActiveTutorialClassIds([]);
    }
  }, [activeClassId, setActiveTutorialClassIds]);

  useEffect(() => {
    if (activeCourseId) {
      setActiveTutorialCourseIds([activeCourseId]);
    } else {
      setActiveTutorialCourseIds([]);
    }
  }, [activeCourseId, setActiveTutorialCourseIds]);

  const restart = useCallback(() => {
    sweptRef.current = false;
    cleanupRef.current = false;
    rewindSteps();
    if (!isOnStepRoutePattern(pathname, "/home")) {
      enteredRef.current = true;
      void navigate({ to: "/home" });
    }
  }, [rewindSteps, pathname, navigate]);

  return (
    <TutorialActionsContext.Provider value={{ restart }}>
      {children}
      {isActive && <TutorialOverlay />}
    </TutorialActionsContext.Provider>
  );
}
