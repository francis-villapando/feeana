import { describe, expect, it } from "vitest";
import { parseFeedbackFile } from "../../lib/utils/feedbackParser";

describe("parseFeedbackFile", () => {
  it("parses a CSV with a text column header", () => {
    const csv = "id,text,cleaned_text\n1,hello world,hello world\n2,second row,second row\n";
    const result = parseFeedbackFile(csv);
    expect(result.items).toEqual(["hello world", "second row"]);
    expect(result.totalRows).toBe(2);
    expect(result.ignoredRows).toBe(0);
  });

  it("prefers the text column over cleaned_text when both exist", () => {
    const csv = "cleaned_text,text\nlowercase version,Original Case\n";
    const result = parseFeedbackFile(csv);
    expect(result.items).toEqual(["Original Case"]);
  });

  it("detects alternative header names case-insensitively", () => {
    const csv = "Feedback\nfirst\nsecond\n";
    const result = parseFeedbackFile(csv);
    expect(result.items).toEqual(["first", "second"]);
  });

  it("falls back to single-column lines when no header matches", () => {
    const csv = "just a line\nanother line\n";
    const result = parseFeedbackFile(csv);
    expect(result.items).toEqual(["just a line", "another line"]);
  });

  it("parses TSV input", () => {
    const tsv = "text\tother\nrow one\tignored\nrow two\tignored\n";
    const result = parseFeedbackFile(tsv);
    expect(result.items).toEqual(["row one", "row two"]);
  });

  it("parses raw multiline pasted text", () => {
    const text = "first feedback\n\nsecond feedback\n   \nthird feedback";
    const result = parseFeedbackFile(text);
    expect(result.items).toEqual(["first feedback", "second feedback", "third feedback"]);
    expect(result.totalRows).toBe(3);
  });

  it("handles quoted multiline fields with commas", () => {
    const csv = 'text\n"line one, with comma"\n"line two\nstill line two"\n';
    const result = parseFeedbackFile(csv);
    expect(result.items).toEqual(["line one, with comma", "line two\nstill line two"]);
  });

  it("trims whitespace and drops empty rows", () => {
    const csv = "text\n  padded  \n   \n";
    const result = parseFeedbackFile(csv);
    expect(result.items).toEqual(["padded"]);
    expect(result.totalRows).toBe(1);
    expect(result.ignoredRows).toBe(1);
  });

  it("drops exact duplicates within the file", () => {
    const csv = "text\nduplicate\nduplicate\nunique\n";
    const result = parseFeedbackFile(csv);
    expect(result.items).toEqual(["duplicate", "unique"]);
    expect(result.totalRows).toBe(3);
    expect(result.ignoredRows).toBe(1);
  });

  it("drops rows matching existing session texts", () => {
    const csv = "text\nalready stored\nbrand new\n";
    const result = parseFeedbackFile(csv, new Set(["already stored"]));
    expect(result.items).toEqual(["brand new"]);
    expect(result.ignoredRows).toBe(1);
  });

  it("returns empty result for empty input", () => {
    const result = parseFeedbackFile("");
    expect(result.items).toEqual([]);
    expect(result.totalRows).toBe(0);
    expect(result.ignoredRows).toBe(0);
  });
});
