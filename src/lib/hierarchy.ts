import type { Course, ILO, Topic } from "./types";

export function getIloPath(
  iloId: string,
  courses: Course[],
  topics: Topic[],
  ilos: ILO[],
): string {
  const ilo = ilos.find((i) => i.id === iloId);
  if (!ilo) return "";

  const topic = topics.find((t) => t.id === ilo.topicId);
  const course = courses.find((c) => c.id === ilo.courseId);

  if (course && topic) {
    return `${course.code} > ${topic.title}`;
  }
  if (course) return course.code;
  return "";
}

export function getTopicPath(
  topicId: string,
  courses: Course[],
  topics: Topic[],
): string {
  const topic = topics.find((t) => t.id === topicId);
  if (!topic) return "";

  const course = courses.find((c) => c.id === topic.courseId);
  if (course) return course.code;
  return "";
}
