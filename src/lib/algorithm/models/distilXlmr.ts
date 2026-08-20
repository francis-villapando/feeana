import { OnnxPidAbsaAdapter } from "./finetuned";
import { MODEL_SIZES_BYTES } from "./sizes";

export type { LoadProgress } from "./finetuned";

export class DistilXlmrAdapter extends OnnxPidAbsaAdapter {
  constructor() {
    super({
      name: "distilxlmr",
      modelDir: "distilxlmr",
      onnxFile: "int8.onnx",
      cacheKey: "feeana-model-cache-v1",
      knownModelSize: MODEL_SIZES_BYTES.distilxlmr,
    });
  }
}
