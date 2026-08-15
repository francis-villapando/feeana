import { pipeline, type PipelineType } from "@huggingface/transformers";
import { Preprocess } from "../preprocess";
import type { ModelAdapter, Prediction } from "./types";

// @deprecated — benchmark-only comparison model. Not used in production;
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

export class MDebertaAdapter implements ModelAdapter {
  readonly name = "mdeberta";
  private classifier: any = null;

  async load(): Promise<void> {
    this.classifier = await pipeline(
      "zero-shot-classification" as PipelineType,
      "Xenova/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7",
    );
  }

  async predict(text: string): Promise<Prediction> {
    const t0 = performance.now();
    const cleanText = Preprocess({ id: "", rawText: text });
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