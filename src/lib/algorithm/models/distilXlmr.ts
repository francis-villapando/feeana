import { OnnxPidAbsaAdapter } from "./finetuned";
import { MODEL_SIZES_BYTES } from "./sizes";
import { MODEL_CACHE_KEYS } from "./modelCache";

export type { LoadProgress } from "./finetuned";

export class DistilXlmrAdapter extends OnnxPidAbsaAdapter {
  constructor() {
    super({
      name: "distilxlmr",
      modelDir: "distilxlmr",
      hfRepo: "francis-villapando/feeana-distilxlmr",
      onnxFile: "int8.onnx",
      cacheKey: MODEL_CACHE_KEYS.distilxlmr,
      knownModelSize: MODEL_SIZES_BYTES.distilxlmr,
    });
  }
}
