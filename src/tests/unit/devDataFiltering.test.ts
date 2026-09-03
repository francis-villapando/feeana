import { describe, it, expect } from "vitest";
import { filterCurriculumForUser } from "../../lib/stores/filterCurriculum";
import type { AuthUser, Course, Topic, ILO, ActivityEntry } from "../../lib/types/types";

const devUser: AuthUser = {
  id: "dev-1",
  email: "dev@feeana.me",
  name: "Dev",
  role: "faculty",
  isDev: true,
};
const facultyUser: AuthUser = {
  id: "fac-1",
  email: "faculty@feeana.me",
  name: "Fac",
  role: "faculty",
  isDev: false,
};

const legacyCourse: Course = {
  id: "c-legacy",
  code: "LEGACY",
  title: "Legacy",
  archived: false,
  version: 1,
  createdById: null,
  createdByEmail: null,
};
const facultyCourse: Course = {
  id: "c-fac",
  code: "FAC101",
  title: "Faculty Course",
  archived: false,
  version: 1,
  createdById: "fac-1",
  createdByEmail: "faculty@feeana.me",
};
const devCourse: Course = {
  id: "c-dev",
  code: "DEV101",
  title: "Dev Course",
  archived: false,
  version: 1,
  createdById: "dev-1",
  createdByEmail: "dev@feeana.me",
};

const devTopic: Topic = {
  id: "t-dev",
  courseId: "c-dev",
  title: "Dev Topic",
  archived: false,
  createdAt: "",
  version: 1,
};
const facTopic: Topic = {
  id: "t-fac",
  courseId: "c-fac",
  title: "Fac Topic",
  archived: false,
  createdAt: "",
  version: 1,
};

const devIlo: ILO = {
  id: "i-dev",
  courseId: "c-dev",
  topicId: "t-dev",
  statement: "Dev ILO",
  bloomLevel: "Remember",
  archived: false,
  version: 1,
};
const facIlo: ILO = {
  id: "i-fac",
  courseId: "c-fac",
  topicId: "t-fac",
  statement: "Fac ILO",
  bloomLevel: "Apply",
  archived: false,
  version: 1,
};

const courses = [legacyCourse, facultyCourse, devCourse];
const topics = [devTopic, facTopic];
const ilos = [devIlo, facIlo];

function makeActivity(overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: "a1",
    entity: "course",
    entityId: "c-fac",
    action: "created",
    label: "test",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("filterCurriculumForUser", () => {
  it("returns all data for dev users", () => {
    const result = filterCurriculumForUser(devUser, courses, topics, ilos, []);
    expect(result.courses).toHaveLength(3);
    expect(result.topics).toHaveLength(2);
    expect(result.ilos).toHaveLength(2);
  });

  it("hides courses created by dev email from non-dev faculty", () => {
    const result = filterCurriculumForUser(facultyUser, courses, topics, ilos, []);
    expect(result.courses).toEqual([legacyCourse, facultyCourse]);
    expect(result.courses.find((c) => c.id === "c-dev")).toBeUndefined();
  });

  it("hides topics belonging to dev-created courses", () => {
    const result = filterCurriculumForUser(facultyUser, courses, topics, ilos, []);
    expect(result.topics).toEqual([facTopic]);
  });

  it("hides ILOs belonging to dev-created courses", () => {
    const result = filterCurriculumForUser(facultyUser, courses, topics, ilos, []);
    expect(result.ilos).toEqual([facIlo]);
  });

  it("keeps legacy courses with no creator visible to all faculty", () => {
    const result = filterCurriculumForUser(facultyUser, courses, topics, ilos, []);
    expect(result.courses.some((c) => c.id === "c-legacy")).toBe(true);
  });

  it("hides activity entries performed by dev user", () => {
    const devActivity = makeActivity({
      id: "a-dev",
      userEmail: "dev@feeana.me",
      userId: "dev-1",
    });
    const result = filterCurriculumForUser(facultyUser, courses, topics, ilos, [devActivity]);
    expect(result.activity).toHaveLength(0);
  });

  it("hides activity referencing dev-owned course entity", () => {
    const act = makeActivity({
      id: "a-course",
      entityId: "c-dev",
      entity: "course",
      userEmail: "other@feeana.me",
    });
    const result = filterCurriculumForUser(facultyUser, courses, topics, ilos, [act]);
    expect(result.activity).toHaveLength(0);
  });

  it("hides activity referencing dev-owned topic entity", () => {
    const act = makeActivity({
      id: "a-topic",
      entityId: "t-dev",
      entity: "topic",
      userEmail: "other@feeana.me",
    });
    const result = filterCurriculumForUser(facultyUser, courses, topics, ilos, [act]);
    expect(result.activity).toHaveLength(0);
  });

  it("hides activity referencing dev-owned ILO entity", () => {
    const act = makeActivity({
      id: "a-ilo",
      entityId: "i-dev",
      entity: "ILO",
      userEmail: "other@feeana.me",
    });
    const result = filterCurriculumForUser(facultyUser, courses, topics, ilos, [act]);
    expect(result.activity).toHaveLength(0);
  });

  it("keeps faculty activity on non-dev courses visible", () => {
    const act = makeActivity({
      id: "a-fac",
      entityId: "c-fac",
      entity: "course",
      userEmail: "faculty@feeana.me",
    });
    const result = filterCurriculumForUser(facultyUser, courses, topics, ilos, [act]);
    expect(result.activity).toHaveLength(1);
  });
});
