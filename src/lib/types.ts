export type UserRole = "instructor" | "student";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface Course {
  id: string;
  code: string;
  title: string;
}

export type BloomLevel =
  | "Remember"
  | "Understand"
  | "Apply"
  | "Analyze"
  | "Evaluate"
  | "Create";

export interface ILO {
  id: string;
  courseId: string;
  code: string;
  statement: string;
  bloomLevel: BloomLevel;
}

export interface Class {
  id: string;
  name: string;
  course: string;
  section: string;
  code: string;
  createdAt: string;
  archived: boolean;
  studentCount: number;
}

export type SessionStatus = "active" | "archived" | "closed";

export interface Session {
  id: string;
  classId: string;
  courseId: string;
  topic: string;
  iloIds: string[];
  status: SessionStatus;
  createdAt: string;
  startsAt: string;
  endsAt: string;
}

export type Polarity = "pos" | "neu" | "neg";

export interface AspectExtraction {
  aspect: string;
  issue: string;
  polarity: Polarity;
}

export interface Feedback {
  id: string;
  sessionId: string;
  rawText: string;
  cleanedText: string;
  isPedagogical: boolean;
  aspects: AspectExtraction[];
  createdAt: string;
}

export type AnalysisMode = "online" | "offline";

export type Theory = "RBT" | "CLT" | "TTI";

export interface Recommendation {
  id: string;
  cue: string;
  theory: Theory;
  theoryDetail: string;
  triggerPattern: string;
}

export type Severity = "low" | "medium" | "high";

export interface GapItem {
  iloId: string;
  expected: string;
  actual: string;
  severity: Severity;
}

export interface DistEntry {
  label: string;
  value: number;
}

export interface AnalysisResult {
  sessionId: string;
  mode: AnalysisMode;
  totalFeedback: number;
  pedagogicalCount: number;
  aspectDist: DistEntry[];
  issueDist: DistEntry[];
  polarityDist: DistEntry[];
  gaps: GapItem[];
  recommendations: Recommendation[];
}
