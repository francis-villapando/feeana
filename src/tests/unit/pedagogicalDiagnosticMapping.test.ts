import { describe, expect, it } from "vitest";
import { buildDiagnosticRecord } from "../../lib/algorithm/pedagogicalDiagnosticMapping";

describe("buildDiagnosticRecord", () => {
  it("maps a diagnostic issue and marks it as a gap when the target RBT is met and the CLT is intrinsic", () => {
    const record = buildDiagnosticRecord("procedural bottleneck", "neg", 3, "fb-1");

    expect(record).toMatchObject({
      feedbackId: "fb-1",
      issue: "procedural bottleneck",
      polarity: "neg",
      tti: "Concept Development",
      rbt: 3,
      clt: "Intrinsic",
      isGap: true,
    });
  });

  it("does not mark the issue as a gap when the CLT is extraneous", () => {
    const record = buildDiagnosticRecord("peer distraction", "neg", 1, "fb-2");

    expect(record).toMatchObject({
      issue: "peer distraction",
      clt: "Extraneous",
      isGap: false,
    });
  });

  it("handles uncategorized feedback with Extraneous CLT and isGap false", () => {
    const record = buildDiagnosticRecord("uncategorized", "neu", 3, "fb-3");

    expect(record).toMatchObject({
      issue: "uncategorized",
      clt: "Extraneous",
      isGap: false,
    });
  });

  it("safely falls back unmapped issues to Extraneous CLT without triggering gap", () => {
    const record = buildDiagnosticRecord("completely unknown issue", "neu", 3, "fb-4");

    expect(record).toMatchObject({
      clt: "Extraneous",
      isGap: false,
    });
  });

  it("does not mark an intrinsic issue as a gap if RBT exceeds target ILO RBT", () => {
    const record = buildDiagnosticRecord("design synthesis failure", "neg", 3, "fb-5");

    expect(record).toMatchObject({
      issue: "design synthesis failure",
      rbt: 6,
      clt: "Intrinsic",
      isGap: false,
    });
  });
});
