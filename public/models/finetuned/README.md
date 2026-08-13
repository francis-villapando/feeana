# public/models/finetuned/

This directory holds the browser-ready artefacts for the fine-tuned
DistilXLM-R PID-ABSA model. Files here are served by Vercel as static assets
and loaded at runtime by `onnxruntime-web` in the browser.

## Expected contents (after export)

| File | Tracked via | Purpose |
|------|-------------|---------|
| `distilxlmr-pidabsa-int8.onnx` | **Git LFS** | Quantized dual-head model |
| `tokenizer.json` | Git (normal) | Tokenizer vocabulary + rules |
| `tokenizer_config.json` | Git (normal) | Tokenizer metadata |
| `special_tokens_map.json` | Git (normal) | Special token definitions |
| `config.json` | Git (normal) | Encoder architecture config |
| `label_mappings.json` | Git (normal) | id→label maps for both heads |

## How to populate this directory

After running `scripts/training/export_distilxlmr_onnx.py` on Colab/Kaggle:

```bash
# On your local machine, copy the exports into this directory:
cp scripts/training/exports/* public/models/finetuned/

# If the .onnx file exceeds 100 MB (likely), ensure Git LFS is set up:
git lfs install                          # one-time per machine
# .gitattributes already has the track rule — no need to re-run git lfs track

git add public/models/finetuned/
git commit -m "feat: add fine-tuned DistilXLM-R ONNX for browser inference"
git push
```

## Size expectations

| Format | Estimated size |
|--------|---------------|
| FP32 baseline | ~184 MB (mMiniLMv2 is much smaller than full XLM-R) |
| INT8 PTQ | ~50–90 MB (embeddings excluded from quant by default) |

> FP32 intermediates (`*-fp32.onnx`) are `.gitignore`d — only the INT8 version is committed.
