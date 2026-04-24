import type {
  Class,
  Course,
  Feedback,
  ILO,
  Session,
  Student,
  Topic,
} from "./types";

export const MOCK_COURSE: Course = {
  id: "course-cs101",
  code: "CSEG2",
  title: "Game Programming 1",
  archived: false,
};

export const MOCK_COURSES: Course[] = [
  MOCK_COURSE,
  {
    id: "course-cs100",
    code: "CS 100",
    title: "Computing Foundations",
    archived: false,
  },
];

export const MOCK_TOPICS: Topic[] = [
  {
    id: "topic-1",
    courseId: "course-cs101",
    title: "Variables & Data Types",
    archived: false,
    createdAt: "2025-02-05T08:00:00.000Z",
  },
  {
    id: "topic-2",
    courseId: "course-cs101",
    title: "Control Structures",
    archived: false,
    createdAt: "2025-02-12T08:00:00.000Z",
  },
  {
    id: "topic-3",
    courseId: "course-cs101",
    title: "Functions & Scope",
    archived: false,
    createdAt: "2025-02-19T08:00:00.000Z",
  },
];

export const MOCK_ILOS: ILO[] = [
  {
    id: "ilo-1",
    courseId: "course-cs101",
    code: "ILO-1",
    statement:
      "Apply primitive data types and variable declarations to solve simple computational problems.",
    bloomLevel: "Apply",
    archived: false,
  },
  {
    id: "ilo-2",
    courseId: "course-cs101",
    code: "ILO-2",
    statement:
      "Analyze type-conversion and scoping behavior in short Python programs.",
    bloomLevel: "Analyze",
    archived: false,
  },
  {
    id: "ilo-3",
    courseId: "course-cs101",
    code: "ILO-3",
    statement:
      "Construct conditional and iterative control structures to model decision logic.",
    bloomLevel: "Create",
    archived: false,
  },
  {
    id: "ilo-4",
    courseId: "course-cs101",
    code: "ILO-4",
    statement:
      "Evaluate the correctness of loops by tracing variable state across iterations.",
    bloomLevel: "Evaluate",
    archived: false,
  },
];

export const MOCK_CLASSES: Class[] = [
  {
    id: "class-cs101-a",
    name: "Computer Programming 1",
    course: "CSEG2",
    section: "3CS-C",
    code: "7K2P9X",
    createdAt: "2025-02-01T08:00:00.000Z",
    archived: false,
    studentCount: 28,
  },
  {
    id: "class-cs101-b",
    name: "Computer Programming 1",
    course: "CSEG2",
    section: "3CS-D",
    code: "M4QH8R",
    createdAt: "2025-02-01T08:00:00.000Z",
    archived: false,
    studentCount: 24,
  },
  {
    id: "class-cs100-archived",
    name: "Computer Programming 1",
    course: "CSEG2",
    section: "3CS-A",
    code: "Z3NV6Y",
    createdAt: "2024-08-12T08:00:00.000Z",
    archived: true,
    studentCount: 31,
  },
];

function makeStudents(prefix: string, count: number): Student[] {
  const names = [
    "Aira Santos",
    "Miguel Cruz",
    "Joana Reyes",
    "Liam Tan",
    "Patricia Lim",
    "Noah Garcia",
    "Sofia Ramos",
    "Ethan Dela Cruz",
    "Maya Villanueva",
    "Carlos Mendoza",
    "Bea Aquino",
    "Ramon Bautista",
    "Trisha Domingo",
    "Andre Velasco",
    "Kim Ocampo",
    "Joaquin Pascual",
    "Lara Mercado",
    "Diego Navarro",
    "Faith Jimenez",
    "Sam Robles",
    "Cassey Bernal",
    "Vince Castillo",
    "Nina Salvador",
    "Paolo Manalo",
    "Bianca Reyes",
    "Tomas Estrada",
    "Yza Pineda",
    "Rico Buenaventura",
    "Hannah Cortes",
    "Marco Padilla",
    "Eli Roxas",
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-stu-${i + 1}`,
    name: names[i % names.length],
    email: `${names[i % names.length].toLowerCase().replace(/[^a-z]/g, ".")}@uni.edu`,
    joinedAt: new Date(2025, 1, 5 + (i % 20)).toISOString(),
  }));
}

export const MOCK_STUDENTS_BY_CLASS: Record<string, Student[]> = {
  "class-cs101-a": makeStudents("a", 28),
  "class-cs101-b": makeStudents("b", 24),
  "class-cs100-archived": makeStudents("c", 31),
};

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
