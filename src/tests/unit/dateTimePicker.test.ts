import { describe, expect, it } from "vitest";
import { endOfDay, startOfDay } from "date-fns";
import {
  dayMatcher,
  defaultTimeFrom,
  endConflictsWithStart,
  isAtOrBefore,
  roundUpToStep,
  toDate,
} from "../../lib/datetime";

describe("toDate", () => {
  it("parses ISO strings", () => {
    expect(toDate("2026-09-18T10:00:00.000Z")?.toISOString()).toBe("2026-09-18T10:00:00.000Z");
  });

  it("passes Date instances through", () => {
    const d = new Date("2026-09-18T10:00:00.000Z");
    expect(toDate(d)).toBe(d);
  });

  it("returns undefined for null/undefined/empty", () => {
    expect(toDate(undefined)).toBeUndefined();
    expect(toDate(null)).toBeUndefined();
    expect(toDate("")).toBeUndefined();
  });

  it("returns undefined for invalid input", () => {
    expect(toDate("not-a-date")).toBeUndefined();
  });
});

describe("isAtOrBefore", () => {
  it("is true when equal", () => {
    const a = new Date("2026-09-18T10:00:00.000Z");
    expect(isAtOrBefore(a, new Date(a))).toBe(true);
  });

  it("is true when a is before b", () => {
    expect(
      isAtOrBefore(new Date("2026-09-18T10:00:00.000Z"), new Date("2026-09-18T11:00:00.000Z")),
    ).toBe(true);
  });

  it("is false when a is after b", () => {
    expect(
      isAtOrBefore(new Date("2026-09-18T11:00:00.000Z"), new Date("2026-09-18T10:00:00.000Z")),
    ).toBe(false);
  });
});

describe("roundUpToStep", () => {
  it("rounds up to the next 15-minute boundary", () => {
    expect(roundUpToStep(new Date("2026-09-18T10:07:00.000Z"), 15).toISOString()).toBe(
      "2026-09-18T10:15:00.000Z",
    );
    expect(roundUpToStep(new Date("2026-09-18T10:42:00.000Z"), 15).toISOString()).toBe(
      "2026-09-18T10:45:00.000Z",
    );
  });

  it("keeps times already on a boundary", () => {
    expect(roundUpToStep(new Date("2026-09-18T10:00:00.000Z"), 15).toISOString()).toBe(
      "2026-09-18T10:00:00.000Z",
    );
    expect(roundUpToStep(new Date("2026-09-18T10:45:00.000Z"), 15).toISOString()).toBe(
      "2026-09-18T10:45:00.000Z",
    );
  });

  it("rounds up to the next 5-minute boundary", () => {
    expect(roundUpToStep(new Date("2026-09-18T10:07:00.000Z"), 5).toISOString()).toBe(
      "2026-09-18T10:10:00.000Z",
    );
    expect(roundUpToStep(new Date("2026-09-18T10:42:00.000Z"), 5).toISOString()).toBe(
      "2026-09-18T10:45:00.000Z",
    );
  });
});

describe("defaultTimeFrom", () => {
  it("returns the next strictly-after boundary", () => {
    expect(defaultTimeFrom(new Date("2026-09-18T10:00:00.000Z"), 15).toISOString()).toBe(
      "2026-09-18T10:15:00.000Z",
    );
    expect(defaultTimeFrom(new Date("2026-09-18T10:07:00.000Z"), 15).toISOString()).toBe(
      "2026-09-18T10:15:00.000Z",
    );
    expect(defaultTimeFrom(new Date("2026-09-18T10:42:00.000Z"), 15).toISOString()).toBe(
      "2026-09-18T10:45:00.000Z",
    );
  });

  it("steps past a boundary that equals the min", () => {
    expect(defaultTimeFrom(new Date("2026-09-18T10:45:00.000Z"), 15).toISOString()).toBe(
      "2026-09-18T11:00:00.000Z",
    );
  });
});

describe("endConflictsWithStart", () => {
  it("is false when end is after start", () => {
    expect(endConflictsWithStart("2026-09-18T10:00:00.000Z", "2026-09-18T11:00:00.000Z")).toBe(
      false,
    );
  });

  it("is true when end equals start", () => {
    expect(endConflictsWithStart("2026-09-18T10:00:00.000Z", "2026-09-18T10:00:00.000Z")).toBe(
      true,
    );
  });

  it("is true when end precedes start", () => {
    expect(endConflictsWithStart("2026-09-18T10:00:00.000Z", "2026-09-18T09:00:00.000Z")).toBe(
      true,
    );
  });

  it("is false when either value is missing", () => {
    expect(endConflictsWithStart("", "2026-09-18T10:00:00.000Z")).toBe(false);
    expect(endConflictsWithStart("2026-09-18T10:00:00.000Z", "")).toBe(false);
  });
});

describe("dayMatcher", () => {
  it("returns undefined when no bounds are given", () => {
    expect(dayMatcher()).toBeUndefined();
  });

  it("disables days before the min day", () => {
    const min = new Date("2026-09-18T10:00:00.000Z");
    expect(dayMatcher(min)).toEqual({ before: startOfDay(min) });
  });

  it("disables days after the max day", () => {
    const max = new Date("2026-09-20T10:00:00.000Z");
    expect(dayMatcher(undefined, max)).toEqual({ after: endOfDay(max) });
  });

  it("combines min and max bounds", () => {
    const min = new Date("2026-09-18T10:00:00.000Z");
    const max = new Date("2026-09-20T10:00:00.000Z");
    expect(dayMatcher(min, max)).toEqual({ before: startOfDay(min), after: endOfDay(max) });
  });
});
