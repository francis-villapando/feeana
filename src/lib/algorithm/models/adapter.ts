import type { ModelAdapter, ModelKind } from "./types";
import { MDebertaAdapter } from "./mDeberta";
import { MBertAdapter } from "./mBert";
import { SvmAdapter } from "./svm";

export function createModel(kind: ModelKind): ModelAdapter {
  switch (kind) {
    case "mdeberta":
      return new MDebertaAdapter();
    case "mbert":
      return new MBertAdapter();
    case "svm":
      return new SvmAdapter();
  }
}
