import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MOCK_COURSES, MOCK_ILOS, MOCK_TOPICS } from "./mockData";
import type {
  ActivityAction,
  ActivityEntry,
  BloomLevel,
  Course,
  EntityKind,
  ILO,
  Topic,
} from "./types";

const COURSES_KEY = "feeana.courses";
const TOPICS_KEY = "feeana.topics";
const ILOS_KEY = "feeana.ilos";
const ACTIVITY_KEY = "feeana.activity";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

interface CourseStoreValue {
  courses: Course[];
  topics: Topic[];
  ilos: ILO[];
  activity: ActivityEntry[];
  // Course CRUD
  createCourse: (input: { code: string; title: string }) => Course;
  updateCourse: (id: string, input: { code: string; title: string }) => void;
  archiveCourse: (id: string) => void;
  restoreCourse: (id: string) => void;
  // Topic CRUD
  createTopic: (input: { courseId: string; title: string }) => Topic;
  updateTopic: (id: string, input: { courseId: string; title: string }) => void;
  archiveTopic: (id: string) => void;
  restoreTopic: (id: string) => void;
  // ILO CRUD
  createILO: (input: {
    courseId: string;
    code: string;
    statement: string;
    bloomLevel: BloomLevel;
  }) => ILO;
  updateILO: (
    id: string,
    input: {
      courseId: string;
      code: string;
      statement: string;
      bloomLevel: BloomLevel;
    },
  ) => void;
  archiveILO: (id: string) => void;
  restoreILO: (id: string) => void;
}

const CourseStoreContext = createContext<CourseStoreValue | null>(null);

export function CourseStoreProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<Course[]>(MOCK_COURSES);
  const [topics, setTopics] = useState<Topic[]>(MOCK_TOPICS);
  const [ilos, setIlos] = useState<ILO[]>(MOCK_ILOS);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    setCourses(readJSON(COURSES_KEY, MOCK_COURSES));
    setTopics(readJSON(TOPICS_KEY, MOCK_TOPICS));
    setIlos(readJSON(ILOS_KEY, MOCK_ILOS));
    setActivity(readJSON<ActivityEntry[]>(ACTIVITY_KEY, []));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
  }, [courses]);
  useEffect(() => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(TOPICS_KEY, JSON.stringify(topics));
  }, [topics]);
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(ILOS_KEY, JSON.stringify(ilos));
  }, [ilos]);
  useEffect(() => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity));
  }, [activity]);

  const log = useCallback(
    (entity: EntityKind, entityId: string, action: ActivityAction, label: string) => {
      setActivity((prev) =>
        [
          {
            id: uid("act"),
            entity,
            entityId,
            action,
            label,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 200),
      );
    },
    [],
  );

  // Courses
  const createCourse = useCallback(
    (input: { code: string; title: string }) => {
      const c: Course = {
        id: uid("course"),
        code: input.code.trim(),
        title: input.title.trim(),
        archived: false,
      };
      setCourses((prev) => [...prev, c]);
      log("course", c.id, "created", `${c.code} — ${c.title}`);
      return c;
    },
    [log],
  );
  const updateCourse = useCallback(
    (id: string, input: { code: string; title: string }) => {
      setCourses((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, code: input.code.trim(), title: input.title.trim() } : c,
        ),
      );
      log("course", id, "updated", `${input.code} — ${input.title}`);
    },
    [log],
  );
  const archiveCourse = useCallback(
    (id: string) => {
      const c = courses.find((x) => x.id === id);
      setCourses((prev) => prev.map((x) => (x.id === id ? { ...x, archived: true } : x)));
      if (c) log("course", id, "archived", `${c.code} — ${c.title}`);
    },
    [courses, log],
  );
  const restoreCourse = useCallback(
    (id: string) => {
      const c = courses.find((x) => x.id === id);
      setCourses((prev) => prev.map((x) => (x.id === id ? { ...x, archived: false } : x)));
      if (c) log("course", id, "restored", `${c.code} — ${c.title}`);
    },
    [courses, log],
  );

  // Topics
  const createTopic = useCallback(
    (input: { courseId: string; title: string }) => {
      const t: Topic = {
        id: uid("topic"),
        courseId: input.courseId,
        title: input.title.trim(),
        archived: false,
        createdAt: new Date().toISOString(),
      };
      setTopics((prev) => [...prev, t]);
      log("topic", t.id, "created", t.title);
      return t;
    },
    [log],
  );
  const updateTopic = useCallback(
    (id: string, input: { courseId: string; title: string }) => {
      setTopics((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, courseId: input.courseId, title: input.title.trim() } : t,
        ),
      );
      log("topic", id, "updated", input.title);
    },
    [log],
  );
  const archiveTopic = useCallback(
    (id: string) => {
      const t = topics.find((x) => x.id === id);
      setTopics((prev) => prev.map((x) => (x.id === id ? { ...x, archived: true } : x)));
      if (t) log("topic", id, "archived", t.title);
    },
    [topics, log],
  );
  const restoreTopic = useCallback(
    (id: string) => {
      const t = topics.find((x) => x.id === id);
      setTopics((prev) => prev.map((x) => (x.id === id ? { ...x, archived: false } : x)));
      if (t) log("topic", id, "restored", t.title);
    },
    [topics, log],
  );

  // ILOs
  const createILO = useCallback(
    (input: { courseId: string; code: string; statement: string; bloomLevel: BloomLevel }) => {
      const i: ILO = {
        id: uid("ilo"),
        courseId: input.courseId,
        code: input.code.trim(),
        statement: input.statement.trim(),
        bloomLevel: input.bloomLevel,
        archived: false,
      };
      setIlos((prev) => [...prev, i]);
      log("ILO", i.id, "created", `${i.code} — ${i.statement.slice(0, 40)}`);
      return i;
    },
    [log],
  );
  const updateILO = useCallback(
    (
      id: string,
      input: {
        courseId: string;
        code: string;
        statement: string;
        bloomLevel: BloomLevel;
      },
    ) => {
      setIlos((prev) =>
        prev.map((i) =>
          i.id === id
            ? {
                ...i,
                courseId: input.courseId,
                code: input.code.trim(),
                statement: input.statement.trim(),
                bloomLevel: input.bloomLevel,
              }
            : i,
        ),
      );
      log("ILO", id, "updated", `${input.code} — ${input.statement.slice(0, 40)}`);
    },
    [log],
  );
  const archiveILO = useCallback(
    (id: string) => {
      const i = ilos.find((x) => x.id === id);
      setIlos((prev) => prev.map((x) => (x.id === id ? { ...x, archived: true } : x)));
      if (i) log("ILO", id, "archived", i.code);
    },
    [ilos, log],
  );
  const restoreILO = useCallback(
    (id: string) => {
      const i = ilos.find((x) => x.id === id);
      setIlos((prev) => prev.map((x) => (x.id === id ? { ...x, archived: false } : x)));
      if (i) log("ILO", id, "restored", i.code);
    },
    [ilos, log],
  );

  const value = useMemo<CourseStoreValue>(
    () => ({
      courses,
      topics,
      ilos,
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
    }),
    [
      courses,
      topics,
      ilos,
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
    ],
  );

  return <CourseStoreContext.Provider value={value}>{children}</CourseStoreContext.Provider>;
}

export function useCourseStore() {
  const ctx = useContext(CourseStoreContext);
  if (!ctx) throw new Error("useCourseStore must be used within CourseStoreProvider");
  return ctx;
}
