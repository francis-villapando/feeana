import { OnnxPidAbsaAdapter } from "./finetuned";

export type { LoadProgress } from "./finetuned";

export class DistilXlmrAdapter extends OnnxPidAbsaAdapter {
  constructor() {
    super({
      name: "distilxlmr",
      modelDir: "distilxlmr",
      onnxFile: "int8.onnx",
      cacheKey: "feeana-model-cache-v1",
      knownModelSize: 118_052_968,
    });
  }
}