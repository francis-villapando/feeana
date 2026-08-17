import type { ModelAdapter, ModelKind } from "./types";
import { DistilXlmrAdapter } from "./distilXlmr";
import { MDebertaAdapter } from "./mDeberta";
import { MBertAdapter } from "./mBert";
import { SvmAdapter } from "./svm";

export function createModel(kind: ModelKind): ModelAdapter {
  switch (kind) {
    case "distilxlmr":
      return new DistilXlmrAdapter();
    case "mdeberta":
      return new MDebertaAdapter();
    case "mbert":
      return new MBertAdapter();
    case "svm":
      return new SvmAdapter();
  }
}
