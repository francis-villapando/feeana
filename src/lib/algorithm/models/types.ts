import type { Polarity } from "../types";

export interface Prediction {
  issue: string;
  polarity: Polarity;
  confidence: number;
  latencyMs: number;
}

export interface ModelAdapter {
  readonly name: string;
  load(): Promise<void>;
  predict(text: string): Promise<Prediction>;
  dispose(): Promise<void>;
}

export type ModelKind = "mdeberta" | "mbert" | "svm";
