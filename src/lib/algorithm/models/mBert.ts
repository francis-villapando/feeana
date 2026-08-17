import { pipeline, type PipelineType } from "@huggingface/transformers";
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

type ZeroShotClassifier = (
  text: string,
  labels: string[],
  options: { multi_label: boolean },
) => Promise<{ labels: string[]; scores: number[] }>;

export class MBertAdapter implements ModelAdapter {
  readonly name = "mbert";
  private classifier: ZeroShotClassifier | null = null;

  async load(): Promise<void> {
    this.classifier = (await pipeline(
      "zero-shot-classification" as PipelineType,
      "Xenova/bert-base-multilingual-cased",
    )) as unknown as ZeroShotClassifier;
  }

  async predict(text: string): Promise<Prediction> {
    const t0 = performance.now();
    const cleanText = Preprocess({ id: "", rawText: text });
    if (!this.classifier) {
      throw new Error("[mbert] Adapter not loaded — call load() first.");
    }
    const result = await this.classifier(cleanText, CANDIDATE_LABELS, {
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
    this.classifier = null;
  }
}
