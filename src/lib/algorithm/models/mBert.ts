import { OnnxPidAbsaAdapter } from "./finetuned";

export class MBertFinetunedAdapter extends OnnxPidAbsaAdapter {
  constructor() {
    super({
      name: "mbert",
      modelDir: "mbert",
      onnxFile: "int8.onnx",
      cacheKey: "feeana-model-cache-mbert-v1",
    });
  }
}