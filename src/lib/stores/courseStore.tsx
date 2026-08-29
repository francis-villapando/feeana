import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./auth";
import { friendlyError } from "../hooks/utils";
import type {
  ActivityAction,
  ActivityEntry,
  AuthUser,
  BloomLevel,
  Course,
  EntityKind,
  ILO,
  Topic,
} from "../types/types";
import * as courseService from "../services/courseService";

// Course codes created by scripts/seed/seedDashboard.ts. These are dev-only demo
// data and must stay hidden from non-dev faculty in the shared course hub.
const DEV_SEED_COURSE_CODES = ["TEST-COURSE-CODE"];

function filterForUser(
  user: AuthUser | null,
  courses: Course[],
  topics: Topic[],
  ilos: ILO[],
): { courses: Course[]; topics: Topic[]; ilos: ILO[] } {
  if (user?.isDev) return { courses, topics, ilos };
  const hiddenCourseIds = new Set(
    courses.filter((c) => DEV_SEED_COURSE_CODES.includes(c.code)).map((c) => c.id),
  );
  return {
    courses: courses.filter((c) => !hiddenCourseIds.has(c.id)),
    topics: topics.filter((t) => !hiddenCourseIds.has(t.courseId)),
    ilos: ilos.filter((i) => !hiddenCourseIds.has(i.courseId)),
  };
}

interface CourseStoreValue {
  courses: Course[];
  topics: Topic[];
  ilos: ILO[];
  activity: ActivityEntry[];
  isLoading: boolean;
  error: string | null;
  currentUserId: string | null;
  createCourse: (input: { code: string; title: string }) => Promise<Course>;
  updateCourse: (
    id: string,
    input: { code: string; title: string; version: number },
  ) => Promise<void>;
  archiveCourse: (id: string) => Promise<void>;
  restoreCourse: (id: string) => Promise<void>;
  createTopic: (input: { courseId: string; title: string }) => Promise<Topic>;
  updateTopic: (id: string, input: { title: string; version: number }) => Promise<void>;
  archiveTopic: (id: string) => Promise<void>;
  restoreTopic: (id: string) => Promise<void>;
  createILO: (input: {
    courseId: string;
    topicId: string;
    statement: string;
    bloomLevel: BloomLevel;
  }) => Promise<ILO>;
  updateILO: (
    id: string,
    input: {
      statement: string;
      bloomLevel: BloomLevel;
      version: number;
    },
  ) => Promise<void>;
  archiveILO: (id: string) => Promise<void>;
  restoreILO: (id: string) => Promise<void>;
  refreshActivity: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const CourseStoreContext = createContext<CourseStoreValue | null>(null);

export function CourseStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [ilos, setIlos] = useState<ILO[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Hide dev-only seeded courses (and their topics/ILOs) from non-dev faculty.
  const visible = useMemo(
    () => filterForUser(user, courses, topics, ilos),
    [user, courses, topics, ilos],
  );

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      courseService.getCourses(),
      courseService.getTopics(),
      courseService.getILOs(),
      courseService.getActivity(),
    ])
      .then(([crs, t, i, a]) => {
        setCourses(crs);
        setTopics(t);
        setIlos(i);
        setActivity(a);
        setError(null);
      })
      .catch((e) => setError(friendlyError(e, "Failed to load data")))
      .finally(() => setIsLoading(false));
  }, []);

  const refreshActivity = useCallback(async () => {
    try {
      const data = await courseService.getActivity();
      setActivity(data);
    } catch (e) {
      // silent fail for activity refresh
    }
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [crs, t, i, a] = await Promise.all([
        courseService.getCourses(),
        courseService.getTopics(),
        courseService.getILOs(),
        courseService.getActivity(),
      ]);
      setCourses(crs);
      setTopics(t);
      setIlos(i);
      setActivity(a);
    } catch {
      // silent
    }
  }, []);

  const createCourse = useCallback(async (input: { code: string; title: string }) => {
    const crs = await courseService.createCourse(input);
    setCourses((prev) => [crs, ...prev]);
    await refreshActivity();
    return crs;
  }, []);

  const updateCourse = useCallback(
    async (id: string, input: { code: string; title: string; version: number }) => {
      await courseService.updateCourse(id, input);
      setCourses((prev) =>
        prev.map((crs) =>
          crs.id === id
            ? {
                ...crs,
                code: input.code.trim(),
                title: input.title.trim(),
                version: input.version + 1,
              }
            : crs,
        ),
      );
      await refreshActivity();
    },
    [],
  );

  const archiveCourse = useCallback(async (id: string) => {
    await courseService.archiveCourse(id);
    setCourses((prev) => prev.map((x) => (x.id === id ? { ...x, archived: true } : x)));
    await refreshActivity();
  }, []);

  const restoreCourse = useCallback(async (id: string) => {
    await courseService.restoreCourse(id);
    setCourses((prev) => prev.map((x) => (x.id === id ? { ...x, archived: false } : x)));
    await refreshActivity();
  }, []);

  const createTopic = useCallback(async (input: { courseId: string; title: string }) => {
    const t = await courseService.createTopic(input);
    setTopics((prev) => [t, ...prev]);
    await refreshActivity();
    return t;
  }, []);

  const updateTopic = useCallback(async (id: string, input: { title: string; version: number }) => {
    await courseService.updateTopic(id, input);
    setTopics((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, title: input.title.trim(), version: input.version + 1 } : t,
      ),
    );
    await refreshActivity();
  }, []);

  const archiveTopic = useCallback(async (id: string) => {
    await courseService.archiveTopic(id);
    setTopics((prev) => prev.map((x) => (x.id === id ? { ...x, archived: true } : x)));
    await refreshActivity();
  }, []);

  const restoreTopic = useCallback(async (id: string) => {
    await courseService.restoreTopic(id);
    setTopics((prev) => prev.map((x) => (x.id === id ? { ...x, archived: false } : x)));
    await refreshActivity();
  }, []);

  const createILO = useCallback(
    async (input: {
      courseId: string;
      topicId: string;
      statement: string;
      bloomLevel: BloomLevel;
    }) => {
      const i = await courseService.createILO(input);
      setIlos((prev) => [...prev, i]);
      await refreshActivity();
      return i;
    },
    [],
  );

  const updateILO = useCallback(
    async (
      id: string,
      input: {
        statement: string;
        bloomLevel: BloomLevel;
        version: number;
      },
    ) => {
      await courseService.updateILO(id, input);
      setIlos((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                statement: input.statement.trim(),
                bloomLevel: input.bloomLevel,
                version: input.version + 1,
              }
            : i,
        ),
      );
      await refreshActivity();
    },
    [],
  );

  const archiveILO = useCallback(async (id: string) => {
    await courseService.archiveILO(id);
    setIlos((prev) => prev.map((x) => (x.id === id ? { ...x, archived: true } : x)));
    await refreshActivity();
  }, []);

  const restoreILO = useCallback(async (id: string) => {
    await courseService.restoreILO(id);
    setIlos((prev) => prev.map((x) => (x.id === id ? { ...x, archived: false } : x)));
    await refreshActivity();
  }, []);

  const value = useMemo<CourseStoreValue>(
    () => ({
      courses: visible.courses,
      topics: visible.topics,
      ilos: visible.ilos,
      activity,
      isLoading,
      error,
      currentUserId: user?.id ?? null,
      createCourse,
      updateCourse,
      archiveCourse,
      restoreCourse,
      createTopic,
      updateTopic,
      archiveTopic,
      restoreTopic,
      createILO,
      updateILO,
      archiveILO,
      restoreILO,
      refreshActivity,
      refreshAll,
    }),
    [
      visible,
      activity,
      createCourse,
      updateCourse,
      archiveCourse,
      restoreCourse,
      createTopic,
      updateTopic,
      archiveTopic,
      restoreTopic,
      createILO,
      updateILO,
      archiveILO,
      restoreILO,
      isLoading,
      error,
      refreshActivity,
      refreshAll,
      user,
    ],
  );

  return <CourseStoreContext.Provider value={value}>{children}</CourseStoreContext.Provider>;
}

export function useCourseStore() {
  const ctx = useContext(CourseStoreContext);
  if (!ctx) throw new Error("useCourseStore must be used within CourseStoreProvider");
  return ctx;
}
