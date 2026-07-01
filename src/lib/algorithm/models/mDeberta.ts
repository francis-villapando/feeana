import { getClassifier } from "../informationExtraction";
import { Preprocess } from "../preprocess";
import type { ModelAdapter, Prediction } from "./types";

const CANDIDATE_LABELS = [
  "relational coldness",
  "classroom tension",
  "evaluation unfairness",
  "perceived marginalization",
  "subject alienation",
  "peer distraction",
  "instructional cadence",
  "clarity deficit",
  "abstract logic gap",
  "procedural bottleneck",
  "conceptual misalignment",
  "design synthesis failure",
  "feedback latency",
  "notation struggle",
];

export class MDebertaAdapter implements ModelAdapter {
  readonly name = "mdeberta";

  async load(): Promise<void> {
    await getClassifier();
  }

  async predict(text: string): Promise<Prediction> {
    const t0 = performance.now();
    const cleanText = Preprocess({ id: "", rawText: text });
    const classifier = await getClassifier();
    const result = await classifier(cleanText, CANDIDATE_LABELS, {
      multi_label: false,
    });
    return {
      issue: result.labels[0],
      polarity: "neg",
      confidence: result.scores[0],
      latencyMs: performance.now() - t0,
    };
  }

  async dispose(): Promise<void> {
    /* The singleton classifier is managed by informationExtraction.ts.
       ModelBenchmarkRunner handles isolation by terminating the Web Worker. */
  }
}
