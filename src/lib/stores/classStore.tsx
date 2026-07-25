import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./auth";
import type { Class, Session, Student } from "../types/types";
import * as classService from "../services/classService";
import * as feedbackService from "../services/feedbackService";

interface ClassStoreValue {
  classes: Class[];
  sessions: Session[];
  enrolledClassIds: string[];
  studentsByClass: Record<string, Student[]>;
  activeClasses: Class[];
  archivedClasses: Class[];
  isLoading: boolean;
  error: string | null;
  getClass: (id: string) => Class | undefined;
  sessionsForClass: (classId: string) => Session[];
  studentsForClass: (classId: string) => Student[];
  dismissStudent: (classId: string, studentId: string) => void;
  createClass: (input: { courseId: string; courseCode: string; courseTitle: string; section: string }) => Promise<Class>;
  archiveClass: (id: string) => Promise<void>;
  restoreClass: (id: string) => Promise<void>;
  createSession: (input: {
    classId: string;
    topic: string;
    topicId?: string;
    courseId?: string;
    startsAt: string;
    endsAt: string;
  }) => Promise<Session>;
  updateSession: (id: string, fields: { topic?: string; startsAt?: string; endsAt?: string }) => Promise<Session>;
  archiveSession: (id: string) => Promise<void>;
  restoreSession: (id: string) => Promise<Session>;
  enrollClassByCode: (code: string) => Promise<Class | null>;
  activeSessions: Session[];
  submittedSessionIds: Set<string>;
  refreshClasses: () => Promise<void>;
  refreshEnrolledClasses: () => Promise<void>;
  refreshSessions: (classId: string) => Promise<void>;
  refreshStudents: (classId: string) => Promise<void>;
  studentCountForClass: (classId: string) => number;
  addSubmittedSession: (sessionId: string) => void;
  closeSessionLocally: (id: string) => void;
  unenrollStudent: (classId: string) => Promise<void>;
}

const ClassStoreContext = createContext<ClassStoreValue | null>(null);

export function ClassStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [classes, setClasses] = useState<Class[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [enrolledClassIds, setEnrolledClassIds] = useState<string[]>([]);
  const [studentsByClass, setStudentsByClass] = useState<Record<string, Student[]>>({});
  const [submittedSessionIds, setSubmittedSessionIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedUserId = useRef<string | null>(null);

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
      setEnrolledClassIds(data.filter((cls) => !cls.archived).map((cls) => cls.id));
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
          const results = await Promise.all(allClasses.map((cls) => classService.getSessions(cls.id)));
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

  const studentCountForClass = useCallback(
    (classId: string) => {
      const students = studentsByClass[classId];
      if (students && students.length > 0) return students.length;
      return classes.find((cls) => cls.id === classId)?.studentCount ?? 0;
    },
    [classes, studentsByClass],
  );

  const refreshSubmissions = useCallback(async (studentId: string) => {
    try {
      const ids = await feedbackService.getStudentSubmissions(studentId);
      setSubmittedSessionIds(new Set(ids));
    } catch {
      console.error("Failed to load submitted sessions");
    }
  }, []);

  const addSubmittedSession = useCallback((sessionId: string) => {
    setSubmittedSessionIds((prev) => {
      const next = new Set(prev);
      next.add(sessionId);
      return next;
    });
  }, []);

  const closeSessionLocally = useCallback((id: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, status: "closed" } : s)));
  }, []);

  useEffect(() => {
    if (!user) return;
    if (loadedUserId.current === user.id) return;
    loadedUserId.current = user.id;
    setIsLoading(true);

    const loadData = async () => {
      try {
        let clsData: Class[] = [];
        if (user.role === "faculty") {
          clsData = await classService.getClasses(user.id);
        } else {
          clsData = await classService.getEnrolledClasses(user.id);
        }

        setClasses(clsData);
        setEnrolledClassIds(clsData.filter((cls) => !cls.archived).map((cls) => cls.id));

        if (clsData.length > 0) {
          const sessionResults = await Promise.all(
            clsData.map((cls) => classService.getSessions(cls.id)),
          );
          setSessions(sessionResults.flat());

          const studentResults = await Promise.all(
            clsData.map((cls) => classService.getStudents(cls.id)),
          );
          setStudentsByClass(
            clsData.reduce((acc, cls, index) => {
              acc[cls.id] = studentResults[index];
              return acc;
            }, {} as Record<string, Student[]>),
          );
        } else {
          setSessions([]);
        }

        if (user.role === "student") {
          await refreshSubmissions(user.id);
        }

        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load class data");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, refreshSubmissions]);

  const createClass = useCallback(
    async (input: { courseId: string; courseCode: string; courseTitle: string; section: string }) => {
      if (!user) throw new Error("Not authenticated");
      const cls = await classService.createClass(user.id, input);
      setClasses((prev) => [cls, ...prev]);
      if (!cls.archived) setEnrolledClassIds((prev) => [cls.id, ...prev]);
      return cls;
    },
    [user],
  );

  const archiveClass = useCallback(async (id: string) => {
    await classService.archiveClass(id);
    setClasses((prev) => prev.map((cls) => (cls.id === id ? { ...cls, archived: true } : cls)));
  }, []);

  const restoreClass = useCallback(async (id: string) => {
    await classService.restoreClass(id);
    setClasses((prev) => prev.map((cls) => (cls.id === id ? { ...cls, archived: false } : cls)));
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

  const updateSession = useCallback(
    async (id: string, fields: { topic?: string; startsAt?: string; endsAt?: string }) => {
      const s = await classService.updateSession(id, fields);
      setSessions((prev) => prev.map((session) => (session.id === id ? s : session)));
      return s;
    },
    [],
  );

  const archiveSession = useCallback(async (id: string) => {
    await classService.archiveSession(id);
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, status: "archived" } : s)));
  }, []);

  const restoreSession = useCallback(async (id: string) => {
    const s = await classService.restoreSession(id);
    setSessions((prev) => prev.map((session) => (session.id === id ? s : session)));
    return s;
  }, []);

  const enrollClassByCode = useCallback(
    async (code: string) => {
      if (!user) return null;
      const cls = await classService.enrollClassByCode(code, user.id);
      if (cls) {
        setEnrolledClassIds((prev) => (prev.includes(cls.id) ? prev : [...prev, cls.id]));
        setClasses((prev) => (prev.find((enrolledClass) => enrolledClass.id === cls.id) ? prev : [...prev, cls]));
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

  const dismissStudent = useCallback(async (classId: string, studentId: string) => {
    await classService.dismissStudent(classId, studentId);
    setStudentsByClass((prev) => ({
      ...prev,
      [classId]: (prev[classId] ?? []).filter((s) => s.id !== studentId),
    }));
    setClasses((prev) =>
      prev.map((cls) =>
        cls.id === classId ? { ...cls, studentCount: Math.max(0, cls.studentCount - 1) } : cls,
      ),
    );
  }, []);
  const unenrollStudent = useCallback(async (classId: string) => {
    if (!user) return;
    await classService.unenrollSelf(classId, user.id);
    setEnrolledClassIds((prev) => prev.filter((id) => id !== classId));
    setClasses((prev) => prev.filter((cls) => cls.id !== classId));
  }, [user]);


  const value = useMemo<ClassStoreValue>(() => {
    const activeClasses = classes.filter((cls) => !cls.archived).sort((a, b) => {
      const cmp = a.courseCode.localeCompare(b.courseCode);
      if (cmp !== 0) return cmp;
      return a.section.localeCompare(b.section);
    });
    const archivedClasses = classes.filter((cls) => cls.archived);
    const activeSessions = sessions.filter((s) => s.status === "active");
    return {
      classes,
      sessions,
      enrolledClassIds,
      studentsByClass,
      activeClasses,
      archivedClasses,
      activeSessions,
      submittedSessionIds,
      isLoading,
      error,
      getClass: (id) => classes.find((cls) => cls.id === id),
      sessionsForClass: (classId) => sessions.filter((s) => s.classId === classId),
      studentsForClass: (classId) => studentsByClass[classId] ?? [],
      dismissStudent,
      unenrollStudent,
      createClass,
      archiveClass,
      restoreClass,
      createSession,
      updateSession,
      archiveSession,
      restoreSession,
      enrollClassByCode,
      refreshClasses,
      refreshEnrolledClasses,
      refreshSessions,
      refreshStudents,
      studentCountForClass,
      addSubmittedSession,
      closeSessionLocally,
    };
  }, [
    classes,
    sessions,
    enrolledClassIds,
    studentsByClass,
    submittedSessionIds,
    createClass,
    archiveClass,
    restoreClass,
    createSession,
    updateSession,
    archiveSession,
    restoreSession,
    enrollClassByCode,
    dismissStudent,
    isLoading,
    error,
    refreshClasses,
    refreshEnrolledClasses,
    refreshSessions,
    refreshStudents,
    addSubmittedSession,
    closeSessionLocally,
  ]);

  return <ClassStoreContext.Provider value={value}>{children}</ClassStoreContext.Provider>;
}

export function useClassStore() {
  const ctx = useContext(ClassStoreContext);
  if (!ctx) throw new Error("useClassStore must be used within ClassStoreProvider");
  return ctx;
}



