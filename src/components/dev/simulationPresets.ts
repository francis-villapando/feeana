import type { SimulationInput } from "./simulationEngine";

export interface Preset {
  label: string;
  description: string;
  input: SimulationInput;
}

export const PRESETS: Preset[] = [
  {
    label: "Intrinsic Gap (Recommendation)",
    description:
      "Major learning bottleneck where students struggle with essential lesson concepts (Abstract Logic), receiving a 1.5x importance multiplier to trigger an actionable teaching recommendation.",
    input: {
      topic: "Recursion & Divide-and-Conquer",
      iloStatement: "Design and analyze recursive algorithms for complex problems.",
      targetRbt: 5,
      feedbackText:
        "madali naman magsulat ng basic loop pero yung pagdecompose ng malaking problem papunta sa recursive base cases and subproblems talagang di kayang i-wrap ng utak ko",
      totalFeedback: 10,
      issueOccurrences: 3,
    },
  },
  {
    label: "Extraneous (Recommendation)",
    description:
      "Classroom delivery friction (Lesson Pacing is too fast) affecting 40% of the class, generating an actionable teaching adjustment without being a concept gap.",
    input: {
      topic: "Linked Lists",
      iloStatement: "Implement and manipulate singly linked list operations.",
      targetRbt: 3,
      feedbackText:
        "Hindi ko masundan yung bilis ng lipat kasi parang laging biglaan ang paglipat sa bagong topic.",
      totalFeedback: 10,
      issueOccurrences: 4,
    },
  },
  {
    label: "Intrinsic Non-Gap (Recommendation)",
    description:
      "Advanced concept struggle (Design Synthesis) exceeding the session's intended learning goals, receiving standard priority without gap status.",
    input: {
      topic: "Algorithm Implementation",
      iloStatement: "Implement a working program from a given algorithm specification.",
      targetRbt: 3,
      feedbackText:
        "kaya kong sundan yung step by step code habang nagdidiscuss pero pag tinatry ko nang magbuild ng sarili kong algorithm para sa assignment, nasisira lang lahat",
      totalFeedback: 10,
      issueOccurrences: 3,
    },
  },
  {
    label: "Gap Multiplier Boost",
    description:
      "Moderate concept difficulty (20% of class) elevated into an actionable recommendation because failing a target learning goal gives it a 1.5x priority boost.",
    input: {
      topic: "Sorting Algorithms",
      iloStatement: "Apply sorting algorithms to order data sets.",
      targetRbt: 4,
      feedbackText:
        "gets ko naman yung algorithm pero nacoconfuse ako kung paano ko sisimulan yung implementation",
      totalFeedback: 10,
      issueOccurrences: 2,
    },
  },
  {
    label: "Intrinsic (Warning)",
    description:
      "Isolated concept confusion (Notation Struggle) affecting only 10% of students, flagged as a low-priority warning for instructor monitoring.",
    input: {
      topic: "Discrete Mathematics",
      iloStatement: "Interpret logical notation used in mathematical proofs.",
      targetRbt: 3,
      feedbackText:
        "nalito talaga ako nung nag-start magsulat yung professor ng mga baligtad na A at paatras na E sa board, parang nakatingin ako sa ibang langauge",
      totalFeedback: 10,
      issueOccurrences: 1,
    },
  },
  {
    label: "Extraneous (Warning)",
    description:
      "Minor classroom environment distraction (Chatty Peers) affecting 10% of students, kept below the action threshold as a monitoring warning.",
    input: {
      topic: "Binary Trees",
      iloStatement: "Traverse binary trees using in-order and pre-order strategies.",
      targetRbt: 3,
      feedbackText:
        "ang hirap ifollow nung lecture kapag panay ang daldalan nung group sa likod tungkol sa mga weekend plans nila",
      totalFeedback: 10,
      issueOccurrences: 1,
    },
  },
  {
    label: "Uncategorized Feedback",
    description:
      "Neutral class-activity feedback with no academic or teaching issue, safely recognized as Uncategorized with no interventions generated.",
    input: {
      topic: "Graph Theory",
      iloStatement: "Represent graphs using adjacency lists and matrices.",
      targetRbt: 4,
      feedbackText: "may ginawa kaming diagram about sa microservices architecture kanina",
      totalFeedback: 10,
      issueOccurrences: 1,
    },
  },
];
