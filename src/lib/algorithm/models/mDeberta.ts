import { pipeline, type PipelineType } from "@huggingface/transformers";
import { CleanFeedback } from "../preprocess";
import type { ModelAdapter, ModelLoadOptions, Prediction } from "./types";

// @deprecated — tracer bullet-only model. Not used in production;
// the DistilXlmrAdapter is the production model.
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

export class MDebertaAdapter implements ModelAdapter {
  readonly name = "mdeberta";
  private classifier: ZeroShotClassifier | null = null;

  async load(_options?: ModelLoadOptions): Promise<void> {
    this.classifier = (await pipeline(
      "zero-shot-classification" as PipelineType,
      "Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7",
    )) as unknown as ZeroShotClassifier;
  }

  async predict(text: string): Promise<Prediction> {
    const t0 = performance.now();
    const cleanText = CleanFeedback(text);
    if (!this.classifier) {
      throw new Error("[mdeberta] Adapter not loaded — call load() first.");
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
