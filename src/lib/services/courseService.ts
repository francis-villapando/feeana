import { supabase } from "@/lib/supabase";
import type {
  ActivityEntry,
  BloomLevel,
  Course,
  EntityKind,
  ActivityAction,
  ILO,
  Topic,
} from "@/lib/types";

export class DuplicateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

async function isConflictingRecordArchived(
  table: "courses" | "topics" | "ilos",
  filters: Record<string, unknown>,
): Promise<boolean> {
  const { data } = await supabase
    .from(table)
    .select("archived")
    .match(filters)
    .maybeSingle();
  return data?.archived === true;
}

function fromDbCourse(row: Record<string, unknown>): Course {
  return {
    id: row.id as string,
    code: row.code as string,
    title: row.title as string,
    archived: row.archived as boolean,
    version: (row.version as number) ?? 1,
  };
}

function fromDbTopic(row: Record<string, unknown>): Topic {
  return {
    id: row.id as string,
    courseId: row.course_id as string,
    title: row.title as string,
    archived: row.archived as boolean,
    createdAt: row.created_at as string,
    version: (row.version as number) ?? 1,
  };
}

function fromDbIlo(row: Record<string, unknown>): ILO {
  return {
    id: row.id as string,
    courseId: row.course_id as string,
    topicId: row.topic_id as string,
    statement: row.statement as string,
    bloomLevel: row.bloom_level as BloomLevel,
    archived: row.archived as boolean,
    version: (row.version as number) ?? 1,
  };
}

function fromDbActivity(row: Record<string, unknown>): ActivityEntry {
  const profile = row.profiles as Record<string, unknown> | null;
  return {
    id: row.id as string,
    entity: row.entity as EntityKind,
    entityId: row.entity_id as string,
    action: row.action as ActivityAction,
    label: row.label as string,
    newLabel: row.new_label as string | undefined,
    timestamp: row.timestamp as string,
    userId: row.user_id as string,
    userName: (profile?.full_name as string) ?? undefined,
  };
}

export async function getCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromDbCourse);
}

export async function createCourse(input: { code: string; title: string }): Promise<Course> {
  const { data, error } = await supabase
    .from("courses")
    .insert({ code: input.code.trim(), title: input.title.trim() })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      const archived = await isConflictingRecordArchived("courses", { code: input.code.trim() });
      throw new DuplicateError(`A course with this code already exists.${archived ? " (archived)" : ""}`);
    }
    throw new Error(error.message);
  }
  await logActivity("course", data.id, "created", `${data.code} — ${data.title}`);
  return fromDbCourse(data);
}

export async function updateCourse(
  id: string,
  input: { code: string; title: string; version: number },
): Promise<void> {
  const { data: old, error: fetchError } = await supabase
    .from("courses")
    .select("code, title")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  const { data, error } = await supabase
    .from("courses")
    .update({ code: input.code.trim(), title: input.title.trim(), version: input.version + 1 })
    .eq("id", id)
    .eq("version", input.version)
    .select();
  if (error) {
    if (error.code === "23505") {
      const archived = await isConflictingRecordArchived("courses", { code: input.code.trim() });
      throw new DuplicateError(`A course with this code already exists.${archived ? " (archived)" : ""}`);
    }
    throw new Error(error.message);
  }
  await logActivity(
    "course",
    id,
    "updated",
    `${old.code} — ${old.title}`,
    `${input.code.trim()} — ${input.title.trim()}`,
  );
}

export async function archiveCourse(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("courses")
    .update({ archived: true })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await logActivity(
    "course",
    id,
    "archived",
    `${(data as Record<string, unknown>).code} — ${(data as Record<string, unknown>).title}`,
  );
}

export async function restoreCourse(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("courses")
    .update({ archived: false })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await logActivity(
    "course",
    id,
    "restored",
    `${(data as Record<string, unknown>).code} — ${(data as Record<string, unknown>).title}`,
  );
}

export async function getTopics(courseId?: string): Promise<Topic[]> {
  let q = supabase.from("topics").select("*").order("created_at", { ascending: false });
  if (courseId) q = q.eq("course_id", courseId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromDbTopic);
}

export async function createTopic(input: { courseId: string; title: string }): Promise<Topic> {
  const { data, error } = await supabase
    .from("topics")
    .insert({ course_id: input.courseId, title: input.title.trim() })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      const archived = await isConflictingRecordArchived("topics", {
        course_id: input.courseId,
        title: input.title.trim(),
      });
      throw new DuplicateError(`A topic with this title already exists in this course.${archived ? " (archived)" : ""}`);
    }
    throw new Error(error.message);
  }
  await logActivity("topic", data.id, "created", data.title);
  return fromDbTopic(data);
}

export async function updateTopic(
  id: string,
  input: { title: string; version: number },
): Promise<void> {
  const { data: old, error: fetchError } = await supabase
    .from("topics")
    .select("title, course_id")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  const { data, error } = await supabase
    .from("topics")
    .update({ title: input.title.trim(), version: input.version + 1 })
    .eq("id", id)
    .eq("version", input.version)
    .select();
  if (error) {
    if (error.code === "23505") {
      const archived = await isConflictingRecordArchived("topics", {
        course_id: old.course_id,
        title: input.title.trim(),
      });
      throw new DuplicateError(`A topic with this title already exists in this course.${archived ? " (archived)" : ""}`);
    }
    throw new Error(error.message);
  }
  if (!data || data.length === 0) throw new ConflictError("Could not save — this was edited by another faculty member. Please open again and retry.");
  await logActivity("topic", id, "updated", old.title, input.title.trim());
}

export async function archiveTopic(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("topics")
    .update({ archived: true })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await logActivity("topic", id, "archived", (data as Record<string, unknown>).title as string);
}

export async function restoreTopic(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("topics")
    .update({ archived: false })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await logActivity("topic", id, "restored", (data as Record<string, unknown>).title as string);
}

export async function getILOs(courseId?: string): Promise<ILO[]> {
  let q = supabase.from("ilos").select("*");
  if (courseId) q = q.eq("course_id", courseId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromDbIlo);
}

export async function createILO(input: {
  courseId: string;
  topicId: string;
  statement: string;
  bloomLevel: BloomLevel;
}): Promise<ILO> {
  const { data, error } = await supabase
    .from("ilos")
    .insert({
      course_id: input.courseId,
      topic_id: input.topicId,
      statement: input.statement.trim(),
      bloom_level: input.bloomLevel,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      const archived = await isConflictingRecordArchived("ilos", {
        topic_id: input.topicId,
        statement: input.statement.trim(),
      });
      throw new DuplicateError(`An ILO with this statement already exists in this topic.${archived ? " (archived)" : ""}`);
    }
    throw new Error(error.message);
  }
  await logActivity("ILO", data.id, "created", `${data.statement.slice(0, 40)}`);
  return fromDbIlo(data);
}

export async function updateILO(
  id: string,
  input: { statement: string; bloomLevel: BloomLevel; version: number },
): Promise<void> {
  const { data: old, error: fetchError } = await supabase
    .from("ilos")
    .select("statement, topic_id")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  const { data, error } = await supabase
    .from("ilos")
    .update({
      statement: input.statement.trim(),
      bloom_level: input.bloomLevel,
      version: input.version + 1,
    })
    .eq("id", id)
    .eq("version", input.version)
    .select();
  if (error) {
    if (error.code === "23505") {
      const archived = await isConflictingRecordArchived("ilos", {
        topic_id: old.topic_id,
        statement: input.statement.trim(),
      });
      throw new DuplicateError(`An ILO with this statement already exists in this topic.${archived ? " (archived)" : ""}`);
    }
    throw new Error(error.message);
  }
  if (!data || data.length === 0) throw new ConflictError("Could not save — this was edited by another faculty member. Please open again and retry.");
  await logActivity(
    "ILO",
    id,
    "updated",
    `${old.statement.slice(0, 40)}`,
    `${input.statement.trim().slice(0, 40)}`,
  );
}

export async function archiveILO(id: string): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from("ilos")
    .select("statement")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  const { error } = await supabase
    .from("ilos")
    .update({ archived: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity("ILO", id, "archived", `${data.statement.slice(0, 40)}`);
}

export async function restoreILO(id: string): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from("ilos")
    .select("statement")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  const { error } = await supabase
    .from("ilos")
    .update({ archived: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity("ILO", id, "restored", `${data.statement.slice(0, 40)}`);
}

export async function deleteCourse(id: string): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from("courses")
    .select("code, title")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity("course", id, "deleted", `${data.code} — ${data.title}`);
}

export async function deleteTopic(id: string): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from("topics")
    .select("title")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  const { error } = await supabase.from("topics").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity("topic", id, "deleted", data.title);
}

export async function deleteILO(id: string): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from("ilos")
    .select("statement")
    .eq("id", id)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  const { error } = await supabase.from("ilos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity("ILO", id, "deleted", `${data.statement.slice(0, 40)}`);
}

async function logActivity(
  entity: EntityKind,
  entityId: string,
  action: ActivityAction,
  label: string,
  newLabel?: string,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  try {
    await supabase
      .from("activity_log")
      .insert({
        entity,
        entity_id: entityId,
        action,
        label,
        new_label: newLabel,
        user_id: user.id,
      });
  } catch {
    // Silently fail activity logging
  }
}

export async function getActivity(days = 30): Promise<ActivityEntry[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("activity_log")
    .select("*, profiles!inner(full_name)")
    .gte("timestamp", since)
    .order("timestamp", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromDbActivity);
}
