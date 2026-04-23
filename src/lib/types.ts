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
  archived: boolean;
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
  archived: boolean;
}

export interface Topic {
  id: string;
  courseId: string;
  title: string;
  archived: boolean;
  createdAt: string;
}

export type EntityKind = "course" | "topic" | "ILO";
export type ActivityAction = "created" | "updated" | "archived" | "restored";

export interface ActivityEntry {
  id: string;
  entity: EntityKind;
  entityId: string;
  action: ActivityAction;
  label: string;
  timestamp: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
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

export type Theory = "RBT" | "CLT" | "TTI";

export type TermKind = "issue" | "aspect" | "RBT" | "CLT" | "TTI" | "ILO";

export interface RecommendationTerm {
  text: string;
  kind: TermKind;
  detail: string;
  iloId?: string;
}

export interface Recommendation {
  id: string;
  paragraph: string;
  terms: RecommendationTerm[];
  theories: Theory[];
  priority: number;
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
  totalFeedback: number;
  pedagogicalCount: number;
  aspectDist: DistEntry[];
  issueDist: DistEntry[];
  polarityDist: DistEntry[];
  gaps: GapItem[];
  recommendations: Recommendation[];
}
