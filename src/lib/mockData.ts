import type { Course, Feedback, ILO, Session } from "./types";

export const MOCK_COURSE: Course = {
  id: "course-cs101",
  code: "CS 101",
  title: "Introduction to Programming",
};

export const MOCK_ILOS: ILO[] = [
  {
    id: "ilo-1",
    courseId: "course-cs101",
    code: "ILO-1",
    statement:
      "Apply primitive data types and variable declarations to solve simple computational problems.",
    bloomLevel: "Apply",
  },
  {
    id: "ilo-2",
    courseId: "course-cs101",
    code: "ILO-2",
    statement:
      "Analyze type-conversion and scoping behavior in short Python programs.",
    bloomLevel: "Analyze",
  },
  {
    id: "ilo-3",
    courseId: "course-cs101",
    code: "ILO-3",
    statement:
      "Construct conditional and iterative control structures to model decision logic.",
    bloomLevel: "Create",
  },
  {
    id: "ilo-4",
    courseId: "course-cs101",
    code: "ILO-4",
    statement:
      "Evaluate the correctness of loops by tracing variable state across iterations.",
    bloomLevel: "Evaluate",
  },
];

export const MOCK_SESSIONS: Session[] = [
  {
    id: "session-vars",
    courseId: "course-cs101",
    topic: "Variables & Data Types",
    iloIds: ["ilo-1", "ilo-2"],
    status: "active",
    createdAt: "2025-04-08T09:00:00.000Z",
  },
  {
    id: "session-control",
    courseId: "course-cs101",
    topic: "Control Structures",
    iloIds: ["ilo-3", "ilo-4"],
    status: "archived",
    createdAt: "2025-03-25T09:00:00.000Z",
  },
];

export const MOCK_FEEDBACK: Feedback[] = [
  // ----- Variables & Data Types -----
  {
    id: "fb-1",
    sessionId: "session-vars",
    rawText:
      "Sir medyo mabilis yung discussion sa typecasting, di ko masyado nahabol yung int to float conversion.",
    cleanedText:
      "discussion on typecasting was too fast, hard to follow int to float conversion",
    isPedagogical: true,
    aspects: [
      { aspect: "Pacing", issue: "Too fast", polarity: "neg" },
      { aspect: "Content", issue: "Typecasting unclear", polarity: "neg" },
    ],
    createdAt: "2025-04-08T10:30:00.000Z",
  },
  {
    id: "fb-2",
    sessionId: "session-vars",
    rawText: "Yung examples sa variables nakakatulong, malinaw naman po.",
    cleanedText: "variable examples were helpful and clear",
    isPedagogical: true,
    aspects: [{ aspect: "Examples", issue: "Clear", polarity: "pos" }],
    createdAt: "2025-04-08T10:31:00.000Z",
  },
  {
    id: "fb-3",
    sessionId: "session-vars",
    rawText:
      "Confusing yung difference ng string at integer pag may input(), parang lagi syang string?",
    cleanedText:
      "difference between string and integer with input() is confusing",
    isPedagogical: true,
    aspects: [
      { aspect: "Content", issue: "Type confusion", polarity: "neg" },
      { aspect: "Examples", issue: "Need more I/O examples", polarity: "neu" },
    ],
    createdAt: "2025-04-08T10:32:00.000Z",
  },
  {
    id: "fb-4",
    sessionId: "session-vars",
    rawText: "Salamat po sir, mas gets ko na yung naming conventions.",
    cleanedText: "thanks, naming conventions are clearer now",
    isPedagogical: true,
    aspects: [{ aspect: "Content", issue: "Naming clear", polarity: "pos" }],
    createdAt: "2025-04-08T10:33:00.000Z",
  },
  {
    id: "fb-5",
    sessionId: "session-vars",
    rawText: "wala lang po, gutom na ako",
    cleanedText: "no comment, hungry",
    isPedagogical: false,
    aspects: [],
    createdAt: "2025-04-08T10:34:00.000Z",
  },
  {
    id: "fb-6",
    sessionId: "session-vars",
    rawText:
      "Need ng more practice exercises for casting, parang once lang kasi nagamit sa lab.",
    cleanedText: "needs more practice exercises for casting",
    isPedagogical: true,
    aspects: [
      { aspect: "Practice", issue: "Insufficient exercises", polarity: "neg" },
      { aspect: "Content", issue: "Typecasting unclear", polarity: "neg" },
    ],
    createdAt: "2025-04-08T10:35:00.000Z",
  },
  {
    id: "fb-7",
    sessionId: "session-vars",
    rawText: "Ok naman pace, kaya ko sumabay.",
    cleanedText: "pacing is fine, manageable",
    isPedagogical: true,
    aspects: [{ aspect: "Pacing", issue: "Manageable", polarity: "pos" }],
    createdAt: "2025-04-08T10:36:00.000Z",
  },
  {
    id: "fb-8",
    sessionId: "session-vars",
    rawText:
      "Yung slides po medyo maraming text, hirap basahin habang nagsasalita kayo.",
    cleanedText: "slides have too much text, hard to read while listening",
    isPedagogical: true,
    aspects: [
      { aspect: "Materials", issue: "Slide overload", polarity: "neg" },
      { aspect: "Pacing", issue: "Cognitive overload", polarity: "neg" },
    ],
    createdAt: "2025-04-08T10:37:00.000Z",
  },
  {
    id: "fb-9",
    sessionId: "session-vars",
    rawText:
      "Pwede po ba mag-share ng kahit sample errors? Gusto kong makita kung ano dapat hindi gawin.",
    cleanedText: "request sample errors to learn what not to do",
    isPedagogical: true,
    aspects: [
      { aspect: "Examples", issue: "Need error examples", polarity: "neu" },
    ],
    createdAt: "2025-04-08T10:38:00.000Z",
  },
  {
    id: "fb-10",
    sessionId: "session-vars",
    rawText: "Engaging po yung Q&A, nakakatulong para mag-clarify.",
    cleanedText: "Q&A was engaging and clarifying",
    isPedagogical: true,
    aspects: [{ aspect: "Engagement", issue: "Active Q&A", polarity: "pos" }],
    createdAt: "2025-04-08T10:39:00.000Z",
  },
  {
    id: "fb-11",
    sessionId: "session-vars",
    rawText: "asdfgh",
    cleanedText: "asdfgh",
    isPedagogical: false,
    aspects: [],
    createdAt: "2025-04-08T10:40:00.000Z",
  },
  {
    id: "fb-12",
    sessionId: "session-vars",
    rawText:
      "Gusto ko sana po mas slow yung casting part next time, isulat sa board step by step.",
    cleanedText: "slow down casting part, write it on board step by step",
    isPedagogical: true,
    aspects: [
      { aspect: "Pacing", issue: "Too fast", polarity: "neg" },
      { aspect: "Delivery", issue: "Need step-by-step", polarity: "neu" },
    ],
    createdAt: "2025-04-08T10:41:00.000Z",
  },

  // ----- Control Structures -----
  {
    id: "fb-13",
    sessionId: "session-control",
    rawText: "Sir gets ko na yung if-else, pero yung nested loops nakakalito.",
    cleanedText: "if-else clear, nested loops confusing",
    isPedagogical: true,
    aspects: [
      { aspect: "Content", issue: "Nested loops confusing", polarity: "neg" },
      { aspect: "Content", issue: "If-else clear", polarity: "pos" },
    ],
    createdAt: "2025-03-25T10:30:00.000Z",
  },
  {
    id: "fb-14",
    sessionId: "session-control",
    rawText: "Maganda yung dry-run sa board, helpful.",
    cleanedText: "dry-run on the board was helpful",
    isPedagogical: true,
    aspects: [{ aspect: "Delivery", issue: "Dry-run helpful", polarity: "pos" }],
    createdAt: "2025-03-25T10:31:00.000Z",
  },
  {
    id: "fb-15",
    sessionId: "session-control",
    rawText:
      "While loop vs for loop, di ko alam kelan dapat gamitin yung isa sa isa.",
    cleanedText: "unclear when to use while vs for loop",
    isPedagogical: true,
    aspects: [
      { aspect: "Content", issue: "Loop choice unclear", polarity: "neg" },
    ],
    createdAt: "2025-03-25T10:32:00.000Z",
  },
  {
    id: "fb-16",
    sessionId: "session-control",
    rawText: "Sobrang dami ng exercises, sakto lang sana.",
    cleanedText: "too many exercises, prefer fewer",
    isPedagogical: true,
    aspects: [
      { aspect: "Practice", issue: "Workload too heavy", polarity: "neg" },
    ],
    createdAt: "2025-03-25T10:33:00.000Z",
  },
  {
    id: "fb-17",
    sessionId: "session-control",
    rawText: "Maganda yung discussion, naintindihan ko yung break at continue.",
    cleanedText: "discussion was good, understood break and continue",
    isPedagogical: true,
    aspects: [
      { aspect: "Content", issue: "Break/continue clear", polarity: "pos" },
    ],
    createdAt: "2025-03-25T10:34:00.000Z",
  },
  {
    id: "fb-18",
    sessionId: "session-control",
    rawText: "next session po sana may live coding ulit.",
    cleanedText: "request live coding next session",
    isPedagogical: true,
    aspects: [
      { aspect: "Delivery", issue: "Want live coding", polarity: "neu" },
    ],
    createdAt: "2025-03-25T10:35:00.000Z",
  },
  {
    id: "fb-19",
    sessionId: "session-control",
    rawText: "Hirap po ako mag-trace ng iteration ng nested loops.",
    cleanedText: "difficulty tracing nested loop iterations",
    isPedagogical: true,
    aspects: [
      { aspect: "Content", issue: "Nested loops confusing", polarity: "neg" },
      { aspect: "Practice", issue: "Need trace exercises", polarity: "neu" },
    ],
    createdAt: "2025-03-25T10:36:00.000Z",
  },
  {
    id: "fb-20",
    sessionId: "session-control",
    rawText: "ok naman po lahat, salamat sir.",
    cleanedText: "all good, thanks",
    isPedagogical: true,
    aspects: [{ aspect: "Overall", issue: "Satisfied", polarity: "pos" }],
    createdAt: "2025-03-25T10:37:00.000Z",
  },
  {
    id: "fb-21",
    sessionId: "session-control",
    rawText: "lol",
    cleanedText: "lol",
    isPedagogical: false,
    aspects: [],
    createdAt: "2025-03-25T10:38:00.000Z",
  },
  {
    id: "fb-22",
    sessionId: "session-control",
    rawText:
      "Yung pacing sa loops ok, pero yung end na part rushed kasi kulang oras.",
    cleanedText: "loops pacing ok, end of session rushed due to time",
    isPedagogical: true,
    aspects: [
      { aspect: "Pacing", issue: "Rushed near end", polarity: "neg" },
    ],
    createdAt: "2025-03-25T10:39:00.000Z",
  },
  {
    id: "fb-23",
    sessionId: "session-control",
    rawText: "Engaging po, may interactive polls.",
    cleanedText: "engaging with interactive polls",
    isPedagogical: true,
    aspects: [
      { aspect: "Engagement", issue: "Interactive polls", polarity: "pos" },
    ],
    createdAt: "2025-03-25T10:40:00.000Z",
  },
  {
    id: "fb-24",
    sessionId: "session-control",
    rawText:
      "Pwede po bang mas marami pang real-world examples ng loops? Parang abstract pa rin sakin.",
    cleanedText: "request more real-world loop examples, still abstract",
    isPedagogical: true,
    aspects: [
      { aspect: "Examples", issue: "Need real-world examples", polarity: "neu" },
      { aspect: "Content", issue: "Abstract", polarity: "neg" },
    ],
    createdAt: "2025-03-25T10:41:00.000Z",
  },
];
