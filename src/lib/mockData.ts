import type { Class, Course, Feedback, ILO, Session } from "./types";

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

export const MOCK_CLASSES: Class[] = [
  {
    id: "class-cs101-a",
    name: "Intro to Programming",
    course: "CS 101",
    section: "A",
    code: "7K2P9X",
    createdAt: "2025-02-01T08:00:00.000Z",
    archived: false,
    studentCount: 28,
  },
  {
    id: "class-cs101-b",
    name: "Intro to Programming",
    course: "CS 101",
    section: "B",
    code: "M4QH8R",
    createdAt: "2025-02-01T08:00:00.000Z",
    archived: false,
    studentCount: 24,
  },
  {
    id: "class-cs100-archived",
    name: "Computing Foundations",
    course: "CS 100",
    section: "A",
    code: "Z3NV6Y",
    createdAt: "2024-08-12T08:00:00.000Z",
    archived: true,
    studentCount: 31,
  },
];

export const MOCK_SESSIONS: Session[] = [
  {
    id: "session-vars",
    classId: "class-cs101-a",
    courseId: "course-cs101",
    topic: "Variables & Data Types",
    iloIds: ["ilo-1", "ilo-2"],
    status: "active",
    createdAt: "2025-04-08T09:00:00.000Z",
    startsAt: "2025-04-08T09:00:00.000Z",
    endsAt: "2025-04-15T23:59:00.000Z",
  },
  {
    id: "session-control",
    classId: "class-cs101-a",
    courseId: "course-cs101",
    topic: "Control Structures",
    iloIds: ["ilo-3", "ilo-4"],
    status: "closed",
    createdAt: "2025-03-25T09:00:00.000Z",
    startsAt: "2025-03-25T09:00:00.000Z",
    endsAt: "2025-04-01T23:59:00.000Z",
  },
  {
    id: "session-funcs-b",
    classId: "class-cs101-b",
    courseId: "course-cs101",
    topic: "Functions & Scope",
    iloIds: ["ilo-1", "ilo-3"],
    status: "active",
    createdAt: "2025-04-10T09:00:00.000Z",
    startsAt: "2025-04-10T09:00:00.000Z",
    endsAt: "2025-04-18T23:59:00.000Z",
  },
  {
    id: "session-lists-b",
    classId: "class-cs101-b",
    courseId: "course-cs101",
    topic: "Lists & Iteration",
    iloIds: ["ilo-3", "ilo-4"],
    status: "closed",
    createdAt: "2025-03-20T09:00:00.000Z",
    startsAt: "2025-03-20T09:00:00.000Z",
    endsAt: "2025-03-27T23:59:00.000Z",
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
    id: "fb-funcs-1",
    sessionId: "session-funcs-b",
    rawText: "Naintindihan ko na yung scope, mas malinaw na.",
    cleanedText: "scope is clearer now",
    isPedagogical: true,
    aspects: [{ aspect: "Content", issue: "Scope clear", polarity: "pos" }],
    createdAt: "2025-04-10T10:30:00.000Z",
  },
  {
    id: "fb-lists-1",
    sessionId: "session-lists-b",
    rawText: "Mas marami sana exercises sa list comprehension.",
    cleanedText: "needs more list comprehension exercises",
    isPedagogical: true,
    aspects: [
      { aspect: "Practice", issue: "Insufficient exercises", polarity: "neg" },
    ],
    createdAt: "2025-03-20T10:30:00.000Z",
  },
];
