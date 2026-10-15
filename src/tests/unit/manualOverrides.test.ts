import { describe, expect, it } from "vitest";
import { applyManualOverrides } from "../../lib/algorithm/pipeline";
import { resolveIssueLabel } from "../../lib/algorithm/rules";

const targetIloRbt = 3;

type RawRow = { feedback_id: string; issue: string; polarity: string };

describe("applyManualOverrides", () => {
  it("forces negative polarity when a manual override assigns a named issue", () => {
    const rows: RawRow[] = [{ feedback_id: "f1", issue: "Uncategorized", polarity: "pos" }];

    const [diag] = applyManualOverrides(rows, { f1: "Lesson Pace" }, targetIloRbt);

    expect(resolveIssueLabel(diag.issue)).toBe("Lesson Pace");
    expect(diag.polarity).toBe("neg");
    expect(diag.tti).toBe("Productivity");
  });

  it("keeps the model polarity for uncategorized feedback with no override", () => {
    const rows: RawRow[] = [{ feedback_id: "f1", issue: "Uncategorized", polarity: "neu" }];

    const [diag] = applyManualOverrides(rows, {}, targetIloRbt);

    expect(diag.issue).toBe("Uncategorized");
    expect(diag.polarity).toBe("neu");
  });

  it("forces negative polarity for a named issue that arrived positive", () => {
    const rows: RawRow[] = [{ feedback_id: "f1", issue: "clarity deficit", polarity: "pos" }];

    const [diag] = applyManualOverrides(rows, {}, targetIloRbt);

    expect(diag.polarity).toBe("neg");
  });

  it("preserves polarity for an unmapped issue", () => {
    const rows: RawRow[] = [
      { feedback_id: "f1", issue: "completely unknown issue", polarity: "neu" },
    ];

    const [diag] = applyManualOverrides(rows, {}, targetIloRbt);

    expect(diag.polarity).toBe("neu");
  });
});
