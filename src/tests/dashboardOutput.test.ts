import { describe, expect, it } from "vitest";
import { buildIloGapItems } from "../lib/algorithm/dashboardOutput";
import type { DiagnosticRecord } from "../lib/algorithm/types";

describe("gap cascade logic", () => {
  it("flags ILOs at the same level or above the diagnostic RBT level", () => {
    const diagnostics: DiagnosticRecord[] = [
      {
        feedbackId: "fb-1",
        issue: "procedural bottleneck",
        polarity: "neg",
        tti: "Concept Development",
        rbt: 3,
        clt: "Intrinsic",
        isGap: true,
      },
    ];

    const ilos = [
      { id: "ilo-1", statement: "Apply the procedure", bloomLevel: "Apply" as const },
      { id: "ilo-2", statement: "Analyze the result", bloomLevel: "Analyze" as const },
      { id: "ilo-3", statement: "Recall the steps", bloomLevel: "Remember" as const },
    ];

    const gaps = buildIloGapItems(diagnostics, ilos as any);

    expect(gaps.map((gap) => gap.iloId)).toEqual(["ilo-1", "ilo-2"]);
  });

  it("does not flag ILOs below the diagnostic RBT level", () => {
    const diagnostics: DiagnosticRecord[] = [
      {
        feedbackId: "fb-2",
        issue: "design synthesis failure",
        polarity: "neg",
        tti: "Concept Development",
        rbt: 6,
        clt: "Intrinsic",
        isGap: true,
      },
    ];

    const ilos = [
      { id: "ilo-1", statement: "Create a design", bloomLevel: "Create" as const },
      { id: "ilo-2", statement: "Evaluate a design", bloomLevel: "Evaluate" as const },
    ];

    const gaps = buildIloGapItems(diagnostics, ilos as any);

    expect(gaps.map((gap) => gap.iloId)).toEqual(["ilo-1"]);
  });
});
