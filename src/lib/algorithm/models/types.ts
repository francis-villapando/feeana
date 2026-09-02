import type { Polarity, FeedbackEncoding } from "../types";
import type { MachineTokenizer } from "../preprocess";

export interface Prediction {
  issue: string;
  polarity: Polarity;
  confidence: number;
  latencyMs: number;
}

export interface ModelLoadProgress {
  status: "loading" | "progress" | "done";
  progress: number;
  phase?: string;
  source?: "cache" | "network";
  bytes?: { loaded: number; total: number };
}

export interface ModelLoadOptions {
  /** Skip the JIT warmup inference so load() measures only asset retrieval and session creation. */
  skipWarmup?: boolean;
}

export interface ModelAdapter {
  readonly name: string;
  load(options?: ModelLoadOptions): Promise<void>;
  predict(text: string): Promise<Prediction>;
  dispose(): Promise<void>;
  setProgressHook?(hook: (info: ModelLoadProgress) => void): void;
  setColdMode?(enabled: boolean): void;
}

export interface EncodedModelAdapter extends ModelAdapter {
  readonly tokenizer: MachineTokenizer | null;
  predictEncoded(encoding: FeedbackEncoding): Promise<Prediction>;
}

export type ModelKind = "distilxlmr" | "mdeberta" | "mbert" | "svm";
