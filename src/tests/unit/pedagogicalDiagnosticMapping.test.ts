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
});
