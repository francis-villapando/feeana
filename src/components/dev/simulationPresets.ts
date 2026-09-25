import type { SimulationInput } from "./simulationEngine";

export interface Preset {
  label: string;
  description: string;
  input: SimulationInput;
  /**
   * The exact cleaned text that the dirtified `input.feedbackText` must restore
   * to after preprocessing. The model only ever sees this cleaned form, so the
   * invariant `CleanFeedback(feedbackText) === expectedClean` guarantees the
   * dirtification never changes the model's classification.
   */
  expectedClean: string;
}

export const PRESETS: Preset[] = [
  {
    label: "Intrinsic Gap (Recommendation)",
    description:
      "This Create-level recursion case targets original algorithm design (RBT 6). The model maps the feedback to an Intrinsic Abstract Logic Gap at RBT 4, so the prerequisite issue is a gap; 3 of 10 comments receive the 1.5× multiplier, producing priority 0.45 and a recommendation.",
    input: {
      topic: "Recursion & Divide-and-Conquer",
      iloStatement:
        "Design and develop recursive algorithms to solve complex computational problems using divide-and-conquer strategies.",
      targetRbt: 6,
      feedbackText:
        "😭 @sir_ramirez #Recursion medyoooo nawawala ako bc di ko magets kapag nagconnect na ng iba't ibang concepts https://feeana.me/student/home",
      totalFeedback: 10,
      issueOccurrences: 3,
    },
    expectedClean:
      "medyo nawawala ako because di ko magets kapag nagconnect na ng iba't ibang concepts",
  },
  {
    label: "Extraneous (Recommendation)",
    description:
      "This linked-list case simulates a lesson-pacing complaint rather than a linked-list knowledge gap. The model maps it to an Extraneous Instructional Cadence issue (RBT 2), so the RBT 3 target receives no intrinsic-gap multiplier; 4 of 10 comments produce priority 0.40 and a recommendation.",
    input: {
      topic: "Linked Lists",
      iloStatement:
        "Apply singly linked list operations to implement solutions for given programming problems.",
      targetRbt: 3,
      feedbackText:
        "@prof_santos #LessonPacing Hindi ko   masundan ung bilis ng lipat kc   parang laging biglaan ang paglipat   sa bagong topic. 😭 https://feeana.edu/survey",
      totalFeedback: 10,
      issueOccurrences: 4,
    },
    expectedClean:
      "Hindi ko masundan yung bilis ng lipat kasi parang laging biglaan ang paglipat sa bagong topic.",
  },
  {
    label: "Intrinsic Non-Gap (Recommendation)",
    description:
      "This algorithm-implementation case uses an Apply target (RBT 3), but feedback about constructing a personal algorithm is mapped to an Intrinsic Design Synthesis Failure (RBT 6). Because the issue exceeds the target, it remains a non-gap; 3 of 10 comments produce priority 0.30 and a recommendation.",
    input: {
      topic: "Algorithm Implementation",
      iloStatement: "Implement a working program from a given algorithm specification.",
      targetRbt: 3,
      feedbackText:
        "kaya kong sundan   ung step by step code habang nagdidiscuss pero pag tinatry ko nang   magbuild ng sarili kong algorithm para sa assignment, nasisira lng   lahat #CS102",
      totalFeedback: 10,
      issueOccurrences: 3,
    },
    expectedClean:
      "kaya kong sundan yung step by step code habang nagdidiscuss pero pag tinatry ko nang magbuild ng sarili kong algorithm para sa assignment, nasisira lang lahat",
  },
  {
    label: "Gap Multiplier Boost",
    description:
      "This sorting case targets choosing an appropriate algorithm (RBT 4). Students who understand the algorithm but struggle to implement it are mapped to an Intrinsic Procedural Bottleneck (RBT 3), which is a lower-level gap; 2 of 10 comments receive the 1.5× multiplier, producing priority 0.30 and a recommendation.",
    input: {
      topic: "Sorting Algorithms",
      iloStatement:
        "Analyze sorting algorithms to determine which approach is appropriate for a given data set and problem requirement.",
      targetRbt: 4,
      feedbackText:
        "gets ko naman   yung algorithm pero nacoconfuse ako kung paano   ko sisimulan yung implementation",
      totalFeedback: 10,
      issueOccurrences: 2,
    },
    expectedClean:
      "gets ko naman yung algorithm pero nacoconfuse ako kung paano ko sisimulan yung implementation",
  },
  {
    label: "Intrinsic (Warning)",
    description:
      "This proof-notation case targets applying formal notation (RBT 3). The model maps confusion over symbols to an Intrinsic Notation Struggle (RBT 1), so it remains a lower-level gap; 1 of 10 comments receives the 1.5× multiplier, producing priority 0.15, below the recommendation threshold, so the simulator shows a warning.",
    input: {
      topic: "Discrete Mathematics",
      iloStatement: "Apply standard logical notation when interpreting mathematical proofs.",
      targetRbt: 3,
      feedbackText:
        "nalito talagaaa ako nung   nag-start magsulat yung prof ng mga baligtad na A   at paatras na E sa board, parang nakatingin ako sa   ibang langauge 😭 #DiscreteMath",
      totalFeedback: 10,
      issueOccurrences: 1,
    },
    expectedClean:
      "nalito talaga ako nung nag-start magsulat yung professor ng mga baligtad na A at paatras na E sa board, parang nakatingin ako sa ibang langauge",
  },
  {
    label: "Extraneous (Warning)",
    description:
      "This binary-tree case targets applying traversal algorithms (RBT 3), but the feedback is about peers distracting the class. The model maps it to an Extraneous Peer Distraction issue (RBT 1), so it is a non-gap and receives no multiplier; 1 of 10 comments produces priority 0.10, below the recommendation threshold, so the simulator shows a warning.",
    input: {
      topic: "Binary Trees",
      iloStatement:
        "Apply in-order and pre-order traversal algorithms to obtain the required node sequences of binary trees.",
      targetRbt: 3,
      feedbackText:
        "ang hirap ifollow   nung lecture kapag panay ang daldalan nung group sa likod   tungkol sa mga weekend plans nila @classmate_jo",
      totalFeedback: 10,
      issueOccurrences: 1,
    },
    expectedClean:
      "ang hirap ifollow nung lecture kapag panay ang daldalan nung group sa likod tungkol sa mga weekend plans nila",
  },
  {
    label: "Uncategorized Feedback",
    description:
      "A neutral comment about creating a microservices diagram does not express a recognized academic or instructional problem. The simulator classifies it as Uncategorized (RBT 0, CLT Uncategorized), excludes it from priority scoring, and generates no recommendation or warning.",
    input: {
      topic: "Graph Theory",
      iloStatement:
        "Analyze graph operations and constraints to select an adjacency-list or adjacency-matrix representation for a graph.",
      targetRbt: 4,
      feedbackText:
        "may ginawa kaming   diagram about sa microservices architecture   kanina #GraphTheory",
      totalFeedback: 10,
      issueOccurrences: 1,
    },
    expectedClean: "may ginawa kaming diagram about sa microservices architecture kanina",
  },
  {
    label: "Low-Confidence Fallback (Uncategorized)",
    description:
      "An ambiguous instructor-competence comment produces a top raw candidate below the 31% confidence cutoff. The confidence gate routes the item to Uncategorized before gap scoring, so it is excluded and produces no recommendation or warning.",
    input: {
      topic: "Programming Fundamentals",
      iloStatement: "Apply core programming constructs to implement simple programs.",
      targetRbt: 3,
      feedbackText:
        "😭 @prof_santos #CS102 Makes mistakes frequentlyyyy and is not equipped to teach at this level. https://feeana.edu/survey",
      totalFeedback: 10,
      issueOccurrences: 1,
    },
    expectedClean: "Makes mistakes frequently and is not equipped to teach at this level.",
  },
];
