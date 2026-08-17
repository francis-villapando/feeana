# public/models/finetuned/

This directory holds the browser-ready artefacts for the fine-tuned
PID-ABSA models (folder-per-model). Files here are served by Vercel as static assets and loaded at runtime by `onnxruntime-web` in the browser.

## Layout

Each subfolder holds one exported model with canonical filenames:

| Subfolder     | Model                    | Loaded by               |
| ------------- | ------------------------ | ----------------------- |
| `distilxlmr/` | DistilXLM-R (production) | `DistilXlmrAdapter`     |
| `mbert/`      | mBERT (dev benchmark)    | `MBertFinetunedAdapter` |

## Expected contents (after export)

| File                      | Tracked via  | Purpose                      |
| ------------------------- | ------------ | ---------------------------- |
| `int8.onnx`               | **Git LFS**  | Quantized dual-head model    |
| `tokenizer.json`          | Git (normal) | Tokenizer vocabulary + rules |
| `tokenizer_config.json`   | Git (normal) | Tokenizer metadata           |
| `special_tokens_map.json` | Git (normal) | Special token definitions    |
| `config.json`             | Git (normal) | Encoder architecture config  |
| `label_mappings.json`     | Git (normal) | id→label maps for both heads |

## How to populate this directory

After running `scripts/training/export_model_onnx.py` on Colab/Kaggle, the assets land in `scripts/training/exports/{tag}/`. Copy the matching folder into this directory:

```bash
# On your local machine, copy the exports into this directory:
cp scripts/training/exports/distilxlmr/* public/models/finetuned/distilxlmr/
cp scripts/training/exports/mbert/*     public/models/finetuned/mbert/

# If the .onnx file exceeds 100 MB (likely), ensure Git LFS is set up:
git lfs install                          # one-time per machine
# .gitattributes already has the track rule — no need to re-run git lfs track

git add public/models/finetuned/
git commit -m "feat: add fine-tuned ONNX for browser inference"
git push
```

## Size expectations

| Format        | Estimated size                                        |
| ------------- | ----------------------------------------------------- |
| FP32 baseline | ~184 MB (mMiniLMv2 is much smaller than full XLM-R)   |
| INT8 PTQ      | ~50–90 MB (embeddings excluded from quant by default) |

> FP32 intermediates (`*-fp32.onnx`) are `.gitignore`d — only the INT8 version is committed.
