import type { ModelAdapter, ModelKind } from "./types";
import { DistilXlmrAdapter } from "./distilXlmr";
import { MBertFinetunedAdapter } from "./mBert";
import { SvmAdapter } from "./svm";
import { MDebertaAdapter } from "./mDeberta";

export function createModel(kind: ModelKind): ModelAdapter {
  switch (kind) {
    case "distilxlmr":
      return new DistilXlmrAdapter();
    case "mbert":
      return new MBertFinetunedAdapter();
    case "svm":
      return new SvmAdapter();
    case "mdeberta":
      return new MDebertaAdapter();
  }
}
