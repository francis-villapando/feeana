export type UserRole = "faculty" | "student";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isDev: boolean;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  archived: boolean;
  version: number;
  createdById?: string | null;
  createdByEmail?: string | null;
}

export type BloomLevel = "Remember" | "Understand" | "Apply" | "Analyze" | "Evaluate" | "Create";

export interface ILO {
  id: string;
  courseId: string;
  topicId: string;
  statement: string;
  bloomLevel: BloomLevel;
  archived: boolean;
  version: number;
}

export interface Topic {
  id: string;
  courseId: string;
  title: string;
  archived: boolean;
  createdAt: string;
  version: number;
}

export type EntityKind = "course" | "topic" | "ILO";
/** @deprecated "deleted" is no longer generated — retained only for historical DB rows. */
export type ActivityAction = "created" | "updated" | "archived" | "restored" | "deleted";

export interface ActivityEntry {
  id: string;
  entity: EntityKind;
  entityId: string;
  action: ActivityAction;
  label: string;
  newLabel?: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  enrolledAt: string;
}

export interface Class {
  id: string;
  courseCode: string;
  courseId: string;
  courseDisplay: string;
  section: string;
  enrollCode: string;
  createdAt: string;
  archived: boolean;
  studentCount: number;
  facultyName?: string;
}

export type SessionStatus = "active" | "archived" | "closed" | "upcoming";

export interface Session {
  id: string;
  classId: string;
  courseId: string;
  topic: string;
  topicId?: string;
  iloIds: string[];
  status: SessionStatus;
  createdAt: string;
  startsAt: string;
  endsAt: string;
  last_analyzed_at: string | null;
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
  aspects: AspectExtraction[];
  createdAt: string;
}

export interface SessionParticipation {
  id: string;
  sessionId: string;
  studentId: string;
  createdAt: string;
}

export type Theory = "RBT" | "CLT" | "TTI";

export type TermKind =
  "issue" | "RBT" | "CLT" | "TTI" | "ILO" | "prevalence" | "topic" | "recommendation";

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
  feedbackTexts?: string[];
}

export interface Warning {
  id: string;
  issue: string;
  count: number;
  terms: RecommendationTerm[];
  theories: Theory[];
  priority: number;
  isGap: boolean;
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
  feedbackTexts?: string[];
}

export interface AnalysisResult {
  sessionId: string;
  totalFeedback: number;
  aspectDist: DistEntry[];
  issueDist: DistEntry[];
  polarityDist: DistEntry[];
  rbtDist: DistEntry[];
  cltDist: DistEntry[];
  gaps: GapItem[];
  recommendations: Recommendation[];
  warnings: Warning[];
}
