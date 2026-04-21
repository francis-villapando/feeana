import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MOCK_CLASSES, MOCK_SESSIONS } from "./mockData";
import type { Class, Session } from "./types";

const CLASSES_KEY = "feeana.classes";
const SESSIONS_KEY = "feeana.sessions";
const JOINED_KEY = "feeana.joined";

const SAFE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return out;
}

interface ClassStoreValue {
  classes: Class[];
  sessions: Session[];
  joinedClassIds: string[];
  activeClasses: Class[];
  archivedClasses: Class[];
  getClass: (id: string) => Class | undefined;
  sessionsForClass: (classId: string) => Session[];
  createClass: (input: { name: string; course: string; section: string }) => Class;
  archiveClass: (id: string) => void;
  restoreClass: (id: string) => void;
  createSession: (input: {
    classId: string;
    topic: string;
    startsAt: string;
    endsAt: string;
  }) => Session;
  joinClassByCode: (code: string) => Class | null;
  activeSessions: Session[];
}

const ClassStoreContext = createContext<ClassStoreValue | null>(null);

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

export function ClassStoreProvider({ children }: { children: ReactNode }) {
  const [classes, setClasses] = useState<Class[]>(MOCK_CLASSES);
  const [sessions, setSessions] = useState<Session[]>(MOCK_SESSIONS);
  const [joinedClassIds, setJoinedClassIds] = useState<string[]>([
    "class-cs101-a",
    "class-cs101-b",
  ]);

  // hydrate from localStorage
  useEffect(() => {
    setClasses(readJSON(CLASSES_KEY, MOCK_CLASSES));
    setSessions(readJSON(SESSIONS_KEY, MOCK_SESSIONS));
    setJoinedClassIds(readJSON(JOINED_KEY, ["class-cs101-a", "class-cs101-b"]));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CLASSES_KEY, JSON.stringify(classes));
    }
  }, [classes]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    }
  }, [sessions]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(JOINED_KEY, JSON.stringify(joinedClassIds));
    }
  }, [joinedClassIds]);

  const createClass = useCallback(
    (input: { name: string; course: string; section: string }) => {
      const cls: Class = {
        id: `class-${Date.now()}`,
        name: input.name.trim(),
        course: input.course.trim(),
        section: input.section.trim(),
        code: generateCode(6),
        createdAt: new Date().toISOString(),
        archived: false,
        studentCount: 0,
      };
      setClasses((prev) => [...prev, cls]);
      return cls;
    },
    [],
  );

  const archiveClass = useCallback((id: string) => {
    setClasses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, archived: true } : c)),
    );
  }, []);

  const restoreClass = useCallback((id: string) => {
    setClasses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, archived: false } : c)),
    );
  }, []);

  const createSession = useCallback(
    (input: {
      classId: string;
      topic: string;
      startsAt: string;
      endsAt: string;
    }) => {
      const s: Session = {
        id: `session-${Date.now()}`,
        classId: input.classId,
        courseId: "course-cs101",
        topic: input.topic.trim(),
        iloIds: ["ilo-1"], // internal default; not surfaced in UI
        status: "active",
        createdAt: new Date().toISOString(),
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      };
      setSessions((prev) => [...prev, s]);
      return s;
    },
    [],
  );

  const joinClassByCode = useCallback(
    (code: string) => {
      const normalized = code.trim().toUpperCase();
      const cls = classes.find((c) => c.code === normalized && !c.archived);
      if (!cls) return null;
      setJoinedClassIds((prev) =>
        prev.includes(cls.id) ? prev : [...prev, cls.id],
      );
      return cls;
    },
    [classes],
  );

  const value = useMemo<ClassStoreValue>(() => {
    const activeClasses = classes.filter((c) => !c.archived);
    const archivedClasses = classes.filter((c) => c.archived);
    const activeSessions = sessions.filter((s) => s.status === "active");
    return {
      classes,
      sessions,
      joinedClassIds,
      activeClasses,
      archivedClasses,
      activeSessions,
      getClass: (id) => classes.find((c) => c.id === id),
      sessionsForClass: (classId) =>
        sessions.filter((s) => s.classId === classId),
      createClass,
      archiveClass,
      restoreClass,
      createSession,
      joinClassByCode,
    };
  }, [
    classes,
    sessions,
    joinedClassIds,
    createClass,
    archiveClass,
    restoreClass,
    createSession,
    joinClassByCode,
  ]);

  return (
    <ClassStoreContext.Provider value={value}>
      {children}
    </ClassStoreContext.Provider>
  );
}

export function useClassStore() {
  const ctx = useContext(ClassStoreContext);
  if (!ctx) throw new Error("useClassStore must be used within ClassStoreProvider");
  return ctx;
}
