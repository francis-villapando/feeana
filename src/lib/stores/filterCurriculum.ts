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
  activeTutorialCourseIds: string[] = [],
): {
  courses: Course[];
  topics: Topic[];
  ilos: ILO[];
  activity: ActivityEntry[];
} {
  const activeTutSet = new Set(activeTutorialCourseIds);
  const tutorialCourseIds = new Set(
    courses.filter((c) => c.isTutorial && !activeTutSet.has(c.id)).map((c) => c.id),
  );
  const tutorialTopicIds = new Set(
    topics.filter((t) => tutorialCourseIds.has(t.courseId)).map((t) => t.id),
  );
  const tutorialIloIds = new Set(
    ilos.filter((i) => tutorialCourseIds.has(i.courseId)).map((i) => i.id),
  );

  const nonTutorialCourses = courses.filter((c) => !c.isTutorial || activeTutSet.has(c.id));
  const nonTutorialTopics = topics.filter((t) => !tutorialCourseIds.has(t.courseId));
  const nonTutorialIlos = ilos.filter((i) => !tutorialCourseIds.has(i.courseId));
  const tutorialEntityIds = new Set([...tutorialCourseIds, ...tutorialTopicIds, ...tutorialIloIds]);
  const nonTutorialActivity = activity.filter((entry) => !tutorialEntityIds.has(entry.entityId));

  if (user?.isDev) {
    return {
      courses: nonTutorialCourses,
      topics: nonTutorialTopics,
      ilos: nonTutorialIlos,
      activity: nonTutorialActivity,
    };
  }

  const devCourseIds = new Set(
    nonTutorialCourses.filter((c) => isDevEmail(c.createdByEmail)).map((c) => c.id),
  );

  const filteredCourses = nonTutorialCourses.filter((c) => !devCourseIds.has(c.id));
  const filteredTopics = nonTutorialTopics.filter((t) => !devCourseIds.has(t.courseId));
  const filteredIlos = nonTutorialIlos.filter((i) => !devCourseIds.has(i.courseId));

  const devTopicIds = new Set(
    nonTutorialTopics.filter((t) => devCourseIds.has(t.courseId)).map((t) => t.id),
  );
  const devIloIds = new Set(
    nonTutorialIlos.filter((i) => devCourseIds.has(i.courseId)).map((i) => i.id),
  );

  const filteredActivity = nonTutorialActivity.filter((entry) => {
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
