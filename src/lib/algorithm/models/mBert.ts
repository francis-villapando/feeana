import { OnnxPidAbsaAdapter } from "./finetuned";
import { MODEL_SIZES_BYTES } from "./sizes";
import { MODEL_CACHE_KEYS } from "./modelCache";

export class MBertFinetunedAdapter extends OnnxPidAbsaAdapter {
  constructor() {
    super({
      name: "mbert",
      modelDir: "mbert",
      hfRepo: "francis-villapando/feeana-mbert",
      onnxFile: "int8.onnx",
      cacheKey: MODEL_CACHE_KEYS.mbert,
      knownModelSize: MODEL_SIZES_BYTES.mbert,
    });
  }
}
