import { describe, it, expect } from "vitest";
import { fromDbClass } from "../../lib/services/classService";

const baseRow = {
  id: "class-1",
  course_id: "course-1",
  section: "1A",
  enroll_code: "ABC12345",
  created_at: "2026-01-01T00:00:00.000Z",
  archived: false,
  student_count: 0,
};

describe("fromDbClass", () => {
  it("prioritizes joined courses record over stale snapshot columns", () => {
    const cls = fromDbClass({
      ...baseRow,
      name: "TEST101",
      course: "TEST101 — Initial Test Course",
      courses: { id: "course-1", code: "TEST201", title: "Updated Test Course" },
    });

    expect(cls.courseCode).toBe("TEST201");
    expect(cls.courseDisplay).toBe("TEST201 — Updated Test Course");
    expect(cls.courseId).toBe("course-1");
  });

  it("falls back to snapshot columns when courses join is absent", () => {
    const cls = fromDbClass({
      ...baseRow,
      name: "TEST101",
      course: "TEST101 — Initial Test Course",
    });

    expect(cls.courseCode).toBe("TEST101");
    expect(cls.courseDisplay).toBe("TEST101 — Initial Test Course");
  });

  it("falls back to empty strings when both courses and snapshots are missing", () => {
    const cls = fromDbClass({ ...baseRow });

    expect(cls.courseCode).toBe("");
    expect(cls.courseDisplay).toBe("");
  });
});
