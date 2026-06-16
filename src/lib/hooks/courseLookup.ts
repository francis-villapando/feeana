import type { Class, Course, Topic } from "../types/types";

/** Find a course by its display code (e.g. "CS 101"). */
export function findCourseByCode(code: string, courses: Course[]): Course | undefined {
  const norm = code.trim().toLowerCase();
  return courses.find((crs) => crs.code.trim().toLowerCase() === norm);
}

/** Active topics for the course referenced by `cls.courseId`. */
export function topicsForClass(
  cls: Class | undefined,
  courses: Course[],
  topics: Topic[],
): Topic[] {
  if (!cls?.courseId) return [];
  return topics.filter((t) => t.courseId === cls.courseId && !t.archived);
}
