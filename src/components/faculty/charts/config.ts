import {
  ASPECT_COLOR_ORDER,
  CLT_COLOR_ORDER,
  ISSUE_COLOR_ORDER,
  RBT_COLOR_ORDER,
} from "@/lib/constants/chartColors";

export type BarView = "aspect" | "issue" | "rbt" | "clt";
export type TrendView = "engagement" | "polarity" | "issues";

export interface BarViewConfig {
  label: string;
  description: string;
  dataKey: "aspectDist" | "issueDist" | "rbtDist" | "cltDist";
  /** Canonical labels always rendered, zero-filled per session when absent. */
  alwaysShow: string[];
  colorOrder: [label: string, color: string][];
}

export const BAR_VIEW_CONFIG: Record<BarView, BarViewConfig> = {
  aspect: {
    label: "Aspect",
    description: "Student concern areas per session.",
    dataKey: "aspectDist",
    alwaysShow: [],
    colorOrder: ASPECT_COLOR_ORDER,
  },
  issue: {
    label: "Issue",
    description: "Specific PID-ABSA issues extracted per session.",
    dataKey: "issueDist",
    alwaysShow: [],
    colorOrder: ISSUE_COLOR_ORDER,
  },
  rbt: {
    label: "RBT",
    description: "Bloom's cognitive-process level distribution per session.",
    dataKey: "rbtDist",
    alwaysShow: ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"],
    colorOrder: RBT_COLOR_ORDER,
  },
  clt: {
    label: "CLT",
    description: "Intrinsic vs extraneous cognitive load per session.",
    dataKey: "cltDist",
    alwaysShow: ["Intrinsic", "Extraneous"],
    colorOrder: CLT_COLOR_ORDER,
  },
};

export interface LineViewConfig {
  label: string;
  description: string;
}

export const LINE_VIEW_CONFIG: Record<TrendView, LineViewConfig> = {
  engagement: {
    label: "Engagement",
    description: "Submission rate and ILO achievement per analyzed session.",
  },
  polarity: {
    label: "Polarity",
    description: "Average student polarity per analyzed session.",
  },
  issues: {
    label: "Issues",
    description: "Recommendation and warning counts per analyzed session.",
  },
};
