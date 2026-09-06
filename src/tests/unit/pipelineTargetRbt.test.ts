import { describe, it, expect } from "vitest";
import { getIloLevel, buildIloGapItems } from "../../lib/algorithm/dashboardOutput";
import { collectPipelineData } from "../../lib/algorithm/dataCollection";
import { GeneratePedagogicalCue } from "../../lib/algorithm/strategyGeneration";
import type {
  BufferedDiagnostic,
  DiagnosticRecord,
  SessionContext,
} from "../../lib/algorithm/types";

const multiLevelIlos = [
  { id: "ilo-1", statement: "Recall basic definitions", bloomLevel: "Remember" as const },
  { id: "ilo-2", statement: "Explain core concepts", bloomLevel: "Understand" as const },
  { id: "ilo-3", statement: "Apply techniques to solve problems", bloomLevel: "Apply" as const },
];

const singleIlo = [
  { id: "ilo-a", statement: "Implement a sorting algorithm", bloomLevel: "Apply" as const },
];

describe("maxSessionRbt computation", () => {
  it("computes targetIloRbt as the max Bloom level across all active ILOs", () => {
    const { sessionContext } = collectPipelineData(
      "Course",
      "Topic",
      Math.max(...multiLevelIlos.map(getIloLevel)),
      "session-1",
      multiLevelIlos.map((ilo, i) => `ILO ${i + 1}: ${ilo.statement}`).join("; "),
      [],
    );
    expect(sessionContext.targetIloRbt).toBe(3);
  });

  it("defaults to 1 when no ILOs are active", () => {
    const { sessionContext } = collectPipelineData(
      "Course",
      "Topic",
      1,
      "session-2",
      "Unknown Goal",
      [],
    );
    expect(sessionContext.targetIloRbt).toBe(1);
  });
});

describe("iloStatement formatting", () => {
  it("joins multiple ILO statements with 'ILO n:' prefix", () => {
    const iloStatement = multiLevelIlos
      .map((ilo, i) => `ILO ${i + 1}: ${ilo.statement}`)
      .join("; ");
    expect(iloStatement).toBe(
      "ILO 1: Recall basic definitions; ILO 2: Explain core concepts; ILO 3: Apply techniques to solve problems",
    );
  });

  it("uses the raw statement for a single ILO (no prefix)", () => {
    const iloStatement =
      singleIlo.length === 1
        ? singleIlo[0].statement
        : singleIlo.map((ilo, i) => `ILO ${i + 1}: ${ilo.statement}`).join("; ");
    expect(iloStatement).toBe("Implement a sorting algorithm");
  });
});

function makeGapDiagnostic(rbtLevel: number, feedbackId: string): DiagnosticRecord {
  return {
    feedbackId,
    issue: "test issue",
    polarity: "neg",
    tti: "Concept Development",
    rbt: rbtLevel,
    clt: "Intrinsic",
    isGap: true,
  };
}

describe("hierarchical RBT cascade", () => {
  it("RBT 1 issue flags ILOs at levels 1, 2, and 3", () => {
    const diagnostics = [makeGapDiagnostic(1, "fb-1")];
    const gaps = buildIloGapItems(diagnostics, multiLevelIlos);
    expect(gaps.map((g) => g.iloId)).toEqual(["ilo-1", "ilo-2", "ilo-3"]);
  });

  it("RBT 2 issue flags ILOs at levels 2 and 3 only", () => {
    const diagnostics = [makeGapDiagnostic(2, "fb-2")];
    const gaps = buildIloGapItems(diagnostics, multiLevelIlos);
    expect(gaps.map((g) => g.iloId)).toEqual(["ilo-2", "ilo-3"]);
  });

  it("RBT 3 issue flags ILO 3 only", () => {
    const diagnostics = [makeGapDiagnostic(3, "fb-3")];
    const gaps = buildIloGapItems(diagnostics, multiLevelIlos);
    expect(gaps.map((g) => g.iloId)).toEqual(["ilo-3"]);
  });

  it("RBT 4 issue flags no ILOs (out of scope)", () => {
    const diagnostics = [makeGapDiagnostic(4, "fb-4")];
    const gaps = buildIloGapItems(diagnostics, multiLevelIlos);
    expect(gaps).toEqual([]);
  });

  it("non-gap diagnostics produce no gap items regardless of RBT level", () => {
    const nonGap: DiagnosticRecord = {
      feedbackId: "fb-5",
      issue: "clarity deficit",
      polarity: "neg",
      tti: "Instructional Learning Formats",
      rbt: 2,
      clt: "Extraneous",
      isGap: false,
    };
    const gaps = buildIloGapItems([nonGap], multiLevelIlos);
    expect(gaps).toEqual([]);
  });
});

function makeBufferedIssue(rbtLevel: number): BufferedDiagnostic {
  return {
    tti: "Concept Development",
    rbt: rbtLevel,
    clt: "Intrinsic",
    issue: "test issue",
    polarity: "neg",
    isGap: true,
    count: 3,
  };
}

function makeSessionContext(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    course: "Course",
    topic: "Topic",
    targetIloRbt: 3,
    sessionId: "session-1",
    iloStatement:
      "ILO 1: Recall basic definitions; ILO 2: Explain core concepts; ILO 3: Apply techniques to solve problems",
    ilos: multiLevelIlos.map((ilo, index) => ({
      index,
      statement: ilo.statement,
      level: getIloLevel(ilo),
    })),
    ...overrides,
  };
}

describe("scoped ILO goal statement in pedagogical cues", () => {
  it("lists all ILOs for an RBT 1 gap", () => {
    const cue = GeneratePedagogicalCue(makeSessionContext(), makeBufferedIssue(1), 10);
    expect(cue.paragraph).toContain(
      "the goal: ILO 1: Recall basic definitions; ILO 2: Explain core concepts; ILO 3: Apply techniques to solve problems.",
    );
    const iloTerm = cue.terms.find((t) => t.kind === "ILO");
    expect(iloTerm?.text).toBe(
      "ILO 1: Recall basic definitions; ILO 2: Explain core concepts; ILO 3: Apply techniques to solve problems",
    );
  });

  it("lists only ILOs at or above the issue RBT for an RBT 2 gap", () => {
    const cue = GeneratePedagogicalCue(makeSessionContext(), makeBufferedIssue(2), 10);
    expect(cue.paragraph).toContain(
      "the goal: ILO 2: Explain core concepts; ILO 3: Apply techniques to solve problems.",
    );
    const iloTerm = cue.terms.find((t) => t.kind === "ILO");
    expect(iloTerm?.text).toBe(
      "ILO 2: Explain core concepts; ILO 3: Apply techniques to solve problems",
    );
  });

  it("lists only the top ILO for an RBT 3 gap", () => {
    const cue = GeneratePedagogicalCue(makeSessionContext(), makeBufferedIssue(3), 10);
    expect(cue.paragraph).toContain("the goal: ILO 3: Apply techniques to solve problems.");
    const iloTerm = cue.terms.find((t) => t.kind === "ILO");
    expect(iloTerm?.text).toBe("ILO 3: Apply techniques to solve problems");
  });

  it("falls back to iloStatement when no ILO scope is provided", () => {
    const cue = GeneratePedagogicalCue(
      makeSessionContext({ ilos: undefined }),
      makeBufferedIssue(2),
      10,
    );
    expect(cue.paragraph).toContain(
      "the goal: ILO 1: Recall basic definitions; ILO 2: Explain core concepts; ILO 3: Apply techniques to solve problems.",
    );
  });

  it("uses the bare statement for a single-ILO session", () => {
    const cue = GeneratePedagogicalCue(
      makeSessionContext({
        iloStatement: "Implement a sorting algorithm",
        ilos: [{ index: 0, statement: "Implement a sorting algorithm", level: 3 }],
      }),
      makeBufferedIssue(3),
      10,
    );
    expect(cue.paragraph).toContain("the goal: Implement a sorting algorithm.");
  });
});
