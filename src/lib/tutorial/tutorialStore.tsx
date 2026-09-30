import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  TUTORIAL_STEPS,
  clearTutorialCompleted,
  generateCourseCodePlaceholder,
  hasCompletedTutorial,
  markTutorialCompleted,
  type TutorialStep,
  type TutorialStepId,
} from "@/lib/tutorial/tutorialSteps";

interface TutorialStoreValue {
  stepIndex: number | null;
  step: TutorialStep | null;
  isActive: boolean;
  isFinished: boolean;

  // Dynamic entity IDs (populated as user creates entities)
  activeCourseId: string | null;
  setActiveCourseId: (id: string | null) => void;
  activeTopicId: string | null;
  setActiveTopicId: (id: string | null) => void;
  activeIloId: string | null;
  setActiveIloId: (id: string | null) => void;
  activeClassId: string | null;
  setActiveClassId: (id: string | null) => void;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;

  spotlightAnchor: string | null;
  setSpotlightAnchor: (anchor: string | null) => void;

  courseCodePlaceholder: string;

  start: () => void;
  advanceIfStep: (expectedStepId: TutorialStepId) => void;
  next: () => void;
  back: () => void;
  finish: () => void;
  skip: () => void;
  restart: () => void;
}

const TutorialStoreContext = createContext<TutorialStoreValue | null>(null);

export function TutorialStoreProvider({ children }: { children: ReactNode }) {
  const [stepIndex, setStepIndex] = useState<number | null>(null);

  // Dynamic entity IDs
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [activeIloId, setActiveIloId] = useState<string | null>(null);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [courseCodePlaceholder, setCourseCodePlaceholder] = useState<string>("");
  const [spotlightAnchor, setSpotlightAnchor] = useState<string | null>(null);

  useEffect(() => {
    setStepIndex(hasCompletedTutorial() ? null : 0);
    setCourseCodePlaceholder(generateCourseCodePlaceholder());
  }, []);

  useEffect(() => {
    setSpotlightAnchor(null);
  }, [stepIndex]);

  const start = useCallback(() => {
    setStepIndex(0);
    setCourseCodePlaceholder(generateCourseCodePlaceholder());
  }, []);

  const next = useCallback(() => {
    setStepIndex((prev) => {
      if (prev === null) return prev;
      const candidate = prev + 1;
      return candidate >= TUTORIAL_STEPS.length ? null : candidate;
    });
  }, []);

  const advanceIfStep = useCallback((expectedStepId: TutorialStepId) => {
    setStepIndex((prev) => {
      if (prev === null) return prev;
      const currentStep = TUTORIAL_STEPS[prev];
      if (currentStep?.id !== expectedStepId) return prev;
      const candidate = prev + 1;
      return candidate >= TUTORIAL_STEPS.length ? null : candidate;
    });
  }, []);

  const back = useCallback(() => {
    setStepIndex((prev) => (prev === null || prev === 0 ? prev : prev - 1));
  }, []);

  const finish = useCallback(() => {
    markTutorialCompleted();
    setStepIndex(null);
  }, []);

  const skip = useCallback(() => {
    markTutorialCompleted();
    setStepIndex(null);
  }, []);

  const restart = useCallback(() => {
    clearTutorialCompleted();
    setActiveCourseId(null);
    setActiveTopicId(null);
    setActiveIloId(null);
    setActiveClassId(null);
    setActiveSessionId(null);
    setCourseCodePlaceholder(generateCourseCodePlaceholder());
    setStepIndex(0);
  }, []);

  const value = useMemo<TutorialStoreValue>(
    () => ({
      stepIndex,
      step: stepIndex === null ? null : (TUTORIAL_STEPS[stepIndex] ?? null),
      isActive: stepIndex !== null,
      isFinished: stepIndex === TUTORIAL_STEPS.length - 1,
      activeCourseId,
      setActiveCourseId,
      activeTopicId,
      setActiveTopicId,
      activeIloId,
      setActiveIloId,
      activeClassId,
      setActiveClassId,
      activeSessionId,
      setActiveSessionId,
      spotlightAnchor,
      setSpotlightAnchor,
      courseCodePlaceholder,
      start,
      advanceIfStep,
      next,
      back,
      finish,
      skip,
      restart,
    }),
    [
      stepIndex,
      activeCourseId,
      activeTopicId,
      activeIloId,
      activeClassId,
      activeSessionId,
      courseCodePlaceholder,
      spotlightAnchor,
      start,
      advanceIfStep,
      next,
      back,
      finish,
      skip,
      restart,
    ],
  );

  return <TutorialStoreContext.Provider value={value}>{children}</TutorialStoreContext.Provider>;
}

export function useTutorialStore(): TutorialStoreValue {
  const ctx = useContext(TutorialStoreContext);
  if (!ctx) throw new Error("useTutorialStore must be used within a TutorialStoreProvider");
  return ctx;
}
