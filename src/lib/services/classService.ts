import { supabase } from "@/lib/db/supabase";
import type { Class, Session, Student } from "@/lib/types/types";

const SAFE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return out;
}

function fromDbClass(row: Record<string, unknown>): Class {
  const faculty = row.profiles
    ? (row.profiles as Record<string, unknown>)
    : row.faculty
      ? (row.faculty as Record<string, unknown>)
      : null;
  const enrollments = Array.isArray(row.enrollments)
    ? (row.enrollments as Record<string, unknown>[]) : [];
  const activeEnrollmentCount = enrollments.filter(
    (item) => item.removed_at === null || item.removed_at === undefined,
  ).length;

  return {
    id: row.id as string,
    courseCode: (row.name as string) ?? "",
    courseId: (row.course_id as string) ?? "",
    courseDisplay: row.course as string,
    section: row.section as string,
    enrollCode: row.enroll_code as string,
    createdAt: row.created_at as string,
    archived: row.archived as boolean,
    studentCount:
      enrollments.length > 0 ? activeEnrollmentCount : ((row.student_count as number) ?? 0),
    facultyName: (faculty?.full_name as string) ?? (row.faculty_name as string) ?? undefined,
  };
}

function fromDbSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    classId: row.class_id as string,
    courseId: (row.course_id as string) ?? "",
    topic: (row.topic as string) ?? "",
    topicId: row.topic_id as string | undefined,
    iloIds: (row.ilo_ids as string[]) ?? [],
    status: (row.status as "active" | "archived" | "closed") ?? "active",
    createdAt: row.created_at as string,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    last_analyzed_at: (row.last_analyzed_at as string) ?? null,
  };
}

function toDbSession(s: Session) {
  return {
    id: s.id,
    class_id: s.classId,
    course_id: s.courseId,
    topic: s.topic,
    topic_id: s.topicId,
    ilo_ids: s.iloIds,
    status: s.status,
    starts_at: s.startsAt,
    ends_at: s.endsAt,
    last_analyzed_at: s.last_analyzed_at,
  };
}

export async function getClasses(facultyId: string): Promise<Class[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("faculty_id", facultyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => fromDbClass(row));
}

export async function createClass(
  facultyId: string,
  input: {
    courseId: string;
    courseCode: string;
    courseTitle: string;
    section: string;
  },
): Promise<Class> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const enrollCode = generateCode(8);

  const { data, error } = await supabase
    .from("classes")
    .insert({
      faculty_id: facultyId,
      course_id: input.courseId,
      course: `${input.courseCode} — ${input.courseTitle}`,
      name: input.courseCode,
      section: input.section.trim(),
      enroll_code: enrollCode,
      archived: false,
      student_count: 0,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return fromDbClass(data);
}

export async function archiveClass(id: string): Promise<void> {
  const { error } = await supabase.from("classes").update({ archived: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function restoreClass(id: string): Promise<void> {
  const { error } = await supabase.from("classes").update({ archived: false }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteClass(id: string): Promise<void> {
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getSessions(classId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromDbSession);
}

export async function createSession(input: {
  classId: string;
  topic: string;
  topicId?: string;
  courseId?: string;
  startsAt: string;
  endsAt: string;
  iloIds?: string[];
}): Promise<Session> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      class_id: input.classId,
      topic: input.topic.trim(),
      topic_id: input.topicId ?? null,
      course_id: input.courseId ?? null,
      ilo_ids: input.iloIds ?? [],
      status: "active",
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      created_by: user?.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return fromDbSession(data);
}

export async function getStudents(classId: string): Promise<Student[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      created_at,
      profiles!student_id (
        id,
        full_name,
        email
      )
    `,
    )
    .eq("class_id", classId)
    .is("removed_at", null);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => {
    const profile = row.profiles as Record<string, unknown>;
    return {
      id: (profile?.id as string) ?? (row.id as string),
      name: (profile?.full_name as string) ?? "Unknown",
      email: (profile?.email as string) ?? "",
      enrolledAt: row.created_at as string,
    };
  });
}

export async function enrollClassByCode(code: string, studentId: string): Promise<Class | null> {
  const { data: cls, error: clsError } = await supabase
    .from("classes")
    .select("*")
    .eq("enroll_code", code.trim().toUpperCase())
    .eq("archived", false);
  if (clsError) throw new Error(clsError.message);
  if (!cls || cls.length === 0) return null;
  const classData = cls[0];

  const { data: activeEnrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("class_id", classData.id)
    .eq("student_id", studentId)
    .is("removed_at", null)
    .maybeSingle();

  if (activeEnrollment) {
    throw new Error("already_enrolled");
  }

  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("class_id", classData.id)
    .eq("student_id", studentId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("enrollments")
      .update({ removed_at: null })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("enrollments")
      .insert({ class_id: classData.id, student_id: studentId });
    if (error && error.code !== "23505") throw new Error(error.message);
  }

  return fromDbClass(classData);
}

export async function dismissStudent(classId: string, studentId: string): Promise<void> {
  const { error } = await supabase
    .from("enrollments")
    .update({ removed_at: new Date().toISOString() })
    .eq("class_id", classId)
    .eq("student_id", studentId)
    .is("removed_at", null);
  if (error) throw new Error(error.message);
}

export async function unenrollSelf(classId: string, studentId: string): Promise<void> {
  const { error } = await supabase
    .from("enrollments")
    .update({ removed_at: new Date().toISOString() })
    .eq("class_id", classId)
    .eq("student_id", studentId)
    .is("removed_at", null);
  if (error) throw new Error(error.message);
}

export async function getClassById(id: string): Promise<Class | null> {
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("id", id)
    .single();
  if (error?.code === "PGRST116") return null;
  if (error) throw new Error(error.message);
  if (!data) return null;
  return fromDbClass(data);
}

export async function getSessionById(id: string): Promise<Session | null> {
  const { data, error } = await supabase.from("sessions").select("*").eq("id", id).single();
  if (error?.code === "PGRST116") return null;
  if (error) throw new Error(error.message);
  return data ? fromDbSession(data) : null;
}

export async function getActiveSessionsCount(facultyId: string): Promise<number> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id", { count: "exact" })
    .eq("status", "active")
    .eq("classes!inner.faculty_id", facultyId);
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function getEnrolledClasses(studentId: string): Promise<Class[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select(
      `
      class_id,
      classes!inner (
        id,
        name,
        course_id,
        course,
        section,
        enroll_code,
        created_at,
        archived,
        student_count,
        profiles!faculty_id (full_name)
      )
    `
    )
    .eq("student_id", studentId)
    .is("removed_at", null)
    .order("classes(name)");

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row: Record<string, unknown>) => {
      const cls = row.classes as Record<string, unknown>;
      return fromDbClass(cls || {});
    })
    .filter((cls) => cls.id);
}
