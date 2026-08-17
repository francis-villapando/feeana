import { describe, it, expect } from "vitest";
import { unchangedFields, noChangesMessage } from "../../lib/hooks/utils";

describe("unchangedFields", () => {
  it("returns labels when new value equals old value", () => {
    const unchanged = unchangedFields([
      { label: "title", oldValue: "Recursion", newValue: "Recursion" },
      { label: "code", oldValue: "CSEG2", newValue: "CSEG3" },
    ]);
    expect(unchanged).toEqual(["title"]);
  });

  it("returns empty array when all fields changed", () => {
    const unchanged = unchangedFields([
      { label: "title", oldValue: "Recursion", newValue: "Sorting" },
    ]);
    expect(unchanged).toEqual([]);
  });

  it("treats whitespace differences as equal", () => {
    const unchanged = unchangedFields([
      { label: "title", oldValue: "Recursion", newValue: "  Recursion  " },
    ]);
    expect(unchanged).toEqual(["title"]);
  });

  it("compares case-insensitively", () => {
    const unchanged = unchangedFields([{ label: "code", oldValue: "CSEG2", newValue: "cseg2" }]);
    expect(unchanged).toEqual(["code"]);
  });

  it("handles Date values", () => {
    const old = new Date("2026-08-16T10:00:00.000Z");
    const same = new Date("2026-08-16T10:00:00.000Z");
    const different = new Date("2026-08-17T10:00:00.000Z");
    expect(unchangedFields([{ label: "start", oldValue: old, newValue: same }])).toEqual(["start"]);
    expect(unchangedFields([{ label: "start", oldValue: old, newValue: different }])).toEqual([]);
  });

  it("treats null/undefined as empty values", () => {
    expect(unchangedFields([{ label: "topic", oldValue: undefined, newValue: "" }])).toEqual([
      "topic",
    ]);
    expect(unchangedFields([{ label: "topic", oldValue: null, newValue: "Sorting" }])).toEqual([]);
  });
});

describe("noChangesMessage", () => {
  it("formats a single field", () => {
    expect(noChangesMessage(["title"])).toBe("No changes were made — update the title.");
  });

  it("formats two fields", () => {
    expect(noChangesMessage(["code", "title"])).toBe(
      "No changes were made — update the code or title.",
    );
  });

  it("formats three or more fields with Oxford comma", () => {
    expect(noChangesMessage(["topic", "start time", "end time"])).toBe(
      "No changes were made — update the topic, start time, or end time.",
    );
  });
});
