import { OnnxPidAbsaAdapter } from "./finetuned";
import { MODEL_SIZES_BYTES } from "./sizes";

export class MBertFinetunedAdapter extends OnnxPidAbsaAdapter {
  constructor() {
    super({
      name: "mbert",
      modelDir: "mbert",
      hfRepo: "francis-villapando/feeana-mbert",
      onnxFile: "int8.onnx",
      cacheKey: "feeana-model-cache-mbert-v1",
      knownModelSize: MODEL_SIZES_BYTES.mbert,
    });
  }
}
