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
import type { Class, Session, Student } from "./types";
import * as classService from "./services/classService";

interface ClassStoreValue {
  classes: Class[];
  sessions: Session[];
  joinedClassIds: string[];
  studentsByClass: Record<string, Student[]>;
  activeClasses: Class[];
  archivedClasses: Class[];
  isLoading: boolean;
  error: string | null;
  getClass: (id: string) => Class | undefined;
  sessionsForClass: (classId: string) => Session[];
  studentsForClass: (classId: string) => Student[];
  removeStudent: (classId: string, studentId: string) => void;
  createClass: (input: { courseId: string; courseCode: string; courseTitle: string; section: string }) => Promise<Class>;
  archiveClass: (id: string) => Promise<void>;
  restoreClass: (id: string) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  createSession: (input: {
    classId: string;
    topic: string;
    topicId?: string;
    courseId?: string;
    startsAt: string;
    endsAt: string;
  }) => Promise<Session>;
  joinClassByCode: (code: string) => Promise<Class | null>;
  activeSessions: Session[];
  refreshClasses: () => Promise<void>;
  refreshEnrolledClasses: () => Promise<void>;
  refreshSessions: (classId: string) => Promise<void>;
  refreshStudents: (classId: string) => Promise<void>;
}

const ClassStoreContext = createContext<ClassStoreValue | null>(null);

export function ClassStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [joinedClassIds, setJoinedClassIds] = useState<string[]>([]);
  const [studentsByClass, setStudentsByClass] = useState<Record<string, Student[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshClasses = useCallback(async () => {
    if (!user) return;
    try {
      const data = await classService.getClasses(user.id);
      setClasses(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load classes");
    }
  }, [user]);

  const refreshEnrolledClasses = useCallback(async () => {
    if (!user) return;
    try {
      const data = await classService.getEnrolledClasses(user.id);
      setClasses(data);
      setJoinedClassIds(data.filter((c) => !c.archived).map((c) => c.id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load enrolled classes");
    }
  }, [user]);

  const refreshSessions = useCallback(
    async (classId?: string) => {
      try {
        if (classId) {
          const data = await classService.getSessions(classId);
          setSessions((prev) => {
            const others = prev.filter((s) => s.classId !== classId);
            return [...others, ...data];
          });
        } else {
          const allClasses = classes.length > 0 ? classes : [];
          const results = await Promise.all(allClasses.map((c) => classService.getSessions(c.id)));
          setSessions(results.flat());
        }
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load sessions");
      }
    },
    [classes],
  );

  const refreshStudents = useCallback(async (classId: string) => {
    try {
      const data = await classService.getStudents(classId);
      setStudentsByClass((prev) => ({ ...prev, [classId]: data }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load students");
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    classService
      .getClasses(user.id)
      .then(async (clsData) => {
        setClasses(clsData);
        setJoinedClassIds(clsData.filter((c) => !c.archived).map((c) => c.id));
        try {
          const sessionResults = await Promise.all(
            clsData.map((c) => classService.getSessions(c.id)),
          );
          setSessions(sessionResults.flat());
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to load sessions");
        }
        setError(null);
        setIsLoading(false);
      })
      .catch(() => {
        classService
          .getEnrolledClasses(user.id)
          .then(async (enrolledData) => {
            setClasses(enrolledData);
            setJoinedClassIds(enrolledData.filter((c) => !c.archived).map((c) => c.id));
            try {
              const sessionResults = await Promise.all(
                enrolledData.map((c) => classService.getSessions(c.id)),
              );
              setSessions(sessionResults.flat());
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to load sessions");
            }
            setError(null);
            setIsLoading(false);
          })
          .catch((e) => {
            setError(e instanceof Error ? e.message : "Failed to load classes");
            setIsLoading(false);
          });
      });
  }, [user]);

  const createClass = useCallback(
    async (input: { courseId: string; courseCode: string; courseTitle: string; section: string }) => {
      if (!user) throw new Error("Not authenticated");
      const cls = await classService.createClass(user.id, input);
      setClasses((prev) => [cls, ...prev]);
      if (!cls.archived) setJoinedClassIds((prev) => [cls.id, ...prev]);
      return cls;
    },
    [user],
  );

  const archiveClass = useCallback(async (id: string) => {
    await classService.archiveClass(id);
    setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, archived: true } : c)));
  }, []);

  const restoreClass = useCallback(async (id: string) => {
    await classService.restoreClass(id);
    setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, archived: false } : c)));
  }, []);

  const deleteClass = useCallback(async (id: string) => {
    await classService.deleteClass(id);
    setClasses((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const createSession = useCallback(
    async (input: {
      classId: string;
      topic: string;
      topicId?: string;
      courseId?: string;
      startsAt: string;
      endsAt: string;
    }) => {
      const s = await classService.createSession({
        classId: input.classId,
        topic: input.topic,
        topicId: input.topicId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        courseId: input.courseId,
        iloIds: [],
      });
      setSessions((prev) => [s, ...prev]);
      return s;
    },
    [],
  );

  const joinClassByCode = useCallback(
    async (code: string) => {
      if (!user) return null;
      const cls = await classService.joinClassByCode(code, user.id);
      if (cls) {
        setJoinedClassIds((prev) => (prev.includes(cls.id) ? prev : [...prev, cls.id]));
        setClasses((prev) => (prev.find((c) => c.id === cls.id) ? prev : [...prev, cls]));
        const newSessions = await classService.getSessions(cls.id);
        setSessions((prev) => {
          const existing = prev.filter((s) => s.classId === cls.id);
          return [...prev, ...newSessions.filter((s) => !existing.some((e) => e.id === s.id))];
        });
      }
      return cls;
    },
    [user],
  );

  const removeStudent = useCallback(async (classId: string, studentId: string) => {
    await classService.removeStudent(classId, studentId);
    setStudentsByClass((prev) => ({
      ...prev,
      [classId]: (prev[classId] ?? []).filter((s) => s.id !== studentId),
    }));
    setClasses((prev) =>
      prev.map((c) =>
        c.id === classId ? { ...c, studentCount: Math.max(0, c.studentCount - 1) } : c,
      ),
    );
  }, []);

  const value = useMemo<ClassStoreValue>(() => {
    const activeClasses = classes.filter((c) => !c.archived);
    const archivedClasses = classes.filter((c) => c.archived);
    const activeSessions = sessions.filter((s) => s.status === "active");
    return {
      classes,
      sessions,
      joinedClassIds,
      studentsByClass,
      activeClasses,
      archivedClasses,
      activeSessions,
      isLoading,
      error,
      getClass: (id) => classes.find((c) => c.id === id),
      sessionsForClass: (classId) => sessions.filter((s) => s.classId === classId),
      studentsForClass: (classId) => studentsByClass[classId] ?? [],
      removeStudent,
      createClass,
      archiveClass,
      restoreClass,
      deleteClass,
      createSession,
      joinClassByCode,
      refreshClasses,
      refreshEnrolledClasses,
      refreshSessions,
      refreshStudents,
    };
  }, [
    classes,
    sessions,
    joinedClassIds,
    studentsByClass,
    createClass,
    archiveClass,
    restoreClass,
    deleteClass,
    createSession,
    joinClassByCode,
    removeStudent,
    isLoading,
    error,
    refreshClasses,
    refreshEnrolledClasses,
    refreshSessions,
    refreshStudents,
  ]);

  return <ClassStoreContext.Provider value={value}>{children}</ClassStoreContext.Provider>;
}

export function useClassStore() {
  const ctx = useContext(ClassStoreContext);
  if (!ctx) throw new Error("useClassStore must be used within ClassStoreProvider");
  return ctx;
}
