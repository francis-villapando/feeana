import { isDevEmail } from "./devEmail";
import type { AuthUser, Course, Topic, ILO, ActivityEntry } from "../types/types";

/**
 * Isolates dev-authored curriculum and activity from non-dev faculty.
 *
 * Dev users see everything. Non-dev faculty see courses created by themselves,
 * other non-dev faculty, and legacy courses (created_by NULL); dev-created
 * courses, their topics/ILOs, and any activity referencing them are hidden.
 */
export function filterCurriculumForUser(
  user: AuthUser | null,
  courses: Course[],
  topics: Topic[],
  ilos: ILO[],
  activity: ActivityEntry[],
): {
  courses: Course[];
  topics: Topic[];
  ilos: ILO[];
  activity: ActivityEntry[];
} {
  if (user?.isDev) return { courses, topics, ilos, activity };

  const devCourseIds = new Set(
    courses.filter((c) => isDevEmail(c.createdByEmail)).map((c) => c.id),
  );

  const filteredCourses = courses.filter((c) => !devCourseIds.has(c.id));
  const filteredTopics = topics.filter((t) => !devCourseIds.has(t.courseId));
  const filteredIlos = ilos.filter((i) => !devCourseIds.has(i.courseId));

  const devTopicIds = new Set(topics.filter((t) => devCourseIds.has(t.courseId)).map((t) => t.id));
  const devIloIds = new Set(ilos.filter((i) => devCourseIds.has(i.courseId)).map((i) => i.id));

  const filteredActivity = activity.filter((entry) => {
    if (isDevEmail(entry.userEmail)) return false;
    if (entry.entity === "course" && devCourseIds.has(entry.entityId)) return false;
    if (entry.entity === "topic" && devTopicIds.has(entry.entityId)) return false;
    if (entry.entity === "ILO" && devIloIds.has(entry.entityId)) return false;
    return true;
  });

  return {
    courses: filteredCourses,
    topics: filteredTopics,
    ilos: filteredIlos,
    activity: filteredActivity,
  };
}
