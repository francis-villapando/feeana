import type { Class, Course, Topic } from "./types";

/** Find a course by its display code (e.g. "CS 101"). */
export function findCourseByCode(
  code: string,
  courses: Course[],
): Course | undefined {
  const norm = code.trim().toLowerCase();
  return courses.find((c) => c.code.trim().toLowerCase() === norm);
}

/** Active topics for the course referenced by `cls.course` (display code). */
export function topicsForClass(
  cls: Class | undefined,
  courses: Course[],
  topics: Topic[],
): Topic[] {
  if (!cls) return [];
  const course = findCourseByCode(cls.course, courses);
  if (!course) return [];
  return topics.filter((t) => t.courseId === course.id && !t.archived);
}
