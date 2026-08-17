"""
ONNX export and INT8 quantization for the PID-ABSA dual-head model.

Model-agnostic: the base model is resolved from the FEEANA_MODEL_NAME
environment variable (with --model-name as an explicit override), so the
same script serves DistilXLM-R, mBERT, or any future base model.

Reads (resolved from the base model tag; folder-per-model with legacy fallbacks):
    scripts/training/checkpoints/{tag}/best_model.pt
    scripts/training/checkpoints/{tag}/label_mappings.json

Writes (tag derived from base model, e.g. "mbert" / "distilxlmr"):
    scripts/training/exports/{tag}/int8.onnx
    scripts/training/exports/{tag}/tokenizer.json
    scripts/training/exports/{tag}/config.json
    scripts/training/exports/{tag}/label_mappings.json
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from onnxruntime.quantization import QuantType, quantize_dynamic
import torch
import torch.nn as nn
from transformers import AutoModel, AutoTokenizer

from checkpoint_paths import (
    DEFAULT_MODEL_NAME,
    TAG_BY_MODEL_NAME,
    resolve_checkpoint_paths,
    resolve_tag,
)

MAX_LEN = 256
NUM_ISSUES = 15
NUM_POLARITIES = 3


def resolve_model_name(cli_value: str | None) -> str:
    """Resolve base model: --model-name flag > FEEANA_MODEL_NAME env > default."""
    return cli_value or os.environ.get("FEEANA_MODEL_NAME", DEFAULT_MODEL_NAME)


class DualHeadModel(nn.Module):
    """Dual-head architecture: shared encoder with issue and polarity heads."""

    def __init__(self, model_name: str, num_issues: int, num_polarities: int) -> None:
        super().__init__()
        # Use eager attention implementation to prevent SDPA float16 tracing artifacts in ONNX
        try:
            self.encoder = AutoModel.from_pretrained(model_name, attn_implementation="eager")
        except Exception:
            self.encoder = AutoModel.from_pretrained(model_name)

        hidden = self.encoder.config.hidden_size
        self.issue_head = nn.Linear(hidden, num_issues)
        self.polarity_head = nn.Linear(hidden, num_polarities)

        drop_p = getattr(self.encoder.config, "hidden_dropout_prob", 0.1)
        self.dropout = nn.Dropout(drop_p)

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        outputs = self.encoder(input_ids=input_ids, attention_mask=attention_mask)

        mask_expanded = (
            attention_mask.unsqueeze(-1)
            .expand(outputs.last_hidden_state.size())
            .float()
        )
        sum_embeddings = torch.sum(outputs.last_hidden_state * mask_expanded, dim=1)
        sum_mask = torch.clamp(mask_expanded.sum(dim=1), min=1e-9)
        pooled = sum_embeddings / sum_mask

        pooled = self.dropout(pooled)
        pooled = pooled.to(self.issue_head.weight.dtype)

        return self.issue_head(pooled), self.polarity_head(pooled)


def merge_lora_if_present(model: DualHeadModel) -> DualHeadModel:
    """Merge PEFT LoRA weights into base model if present."""
    try:
        from peft import PeftModel  # type: ignore

        if isinstance(model.encoder, PeftModel):
            print("[INFO] Merging LoRA adapter weights into base encoder...")
            model.encoder = model.encoder.merge_and_unload()
    except ImportError:
        print("[INFO] peft module not loaded; skipping adapter merge.")
    return model


def load_checkpoint(ckpt_path: Path, device: torch.device, model_name: str) -> DualHeadModel:
    """Load trained checkpoint into DualHeadModel."""
    print(f"[INFO] Loading base model architecture: {model_name}")
    model = DualHeadModel(model_name, NUM_ISSUES, NUM_POLARITIES)

    print(f"[INFO] Loading checkpoint: {ckpt_path}")
    try:
        ckpt = torch.load(ckpt_path, map_location=device)
    except Exception as err:
        print(f"\n[ERROR] Failed to read PyTorch checkpoint file: {ckpt_path}")
        print(f"        Details: {err}\n")
        sys.exit(1)

    state_dict = ckpt["model_state_dict"] if isinstance(ckpt, dict) and "model_state_dict" in ckpt else ckpt

    missing, unexpected = model.load_state_dict(state_dict, strict=False)
    if missing or unexpected:
        print("[INFO] Attempting PEFT-aware checkpoint load...")
        try:
            from peft import LoraConfig, TaskType, get_peft_model  # type: ignore

            lora_config = LoraConfig(
                task_type=TaskType.FEATURE_EXTRACTION,
                r=16,
                lora_alpha=32,
                lora_dropout=0.05,
                target_modules=["query", "key", "value", "output.dense"],
                bias="none",
            )
            model.encoder = get_peft_model(model.encoder, lora_config)
            model.load_state_dict(state_dict, strict=True)
        except Exception as err:
            print(f"[ERROR] Failed to apply state dict: {err}")
            sys.exit(1)

    model = merge_lora_if_present(model)
    model = model.float()
    model.eval()
    return model.to(device)


def export_fp32_onnx(model: DualHeadModel, out_path: Path, opset: int) -> None:
    """Export PyTorch model to FP32 ONNX format."""
    dummy_ids = torch.zeros(1, MAX_LEN, dtype=torch.long)
    dummy_mask = torch.ones(1, MAX_LEN, dtype=torch.long)

    print(f"[INFO] Exporting FP32 ONNX (opset {opset}) -> {out_path}")

    export_kwargs = {
        "model": model,
        "args": (dummy_ids, dummy_mask),
        "f": str(out_path),
        "opset_version": opset,
        "input_names": ["input_ids", "attention_mask"],
        "output_names": ["issue_logits", "polarity_logits"],
        "dynamic_axes": {
            "input_ids": {0: "batch_size", 1: "sequence_length"},
            "attention_mask": {0: "batch_size", 1: "sequence_length"},
            "issue_logits": {0: "batch_size"},
            "polarity_logits": {0: "batch_size"},
        },
        "do_constant_folding": True,
    }

    try:
        torch.onnx.export(**export_kwargs, dynamo=False)
    except TypeError:
        torch.onnx.export(**export_kwargs)

    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"[INFO] FP32 model size: {size_mb:.2f} MB")


def quantize_int8(fp32_path: Path, int8_path: Path) -> None:
    """Quantize FP32 ONNX model to INT8 using dynamic quantization."""
    print(f"[INFO] Quantizing model to INT8 -> {int8_path}")
    quantize_dynamic(
        model_input=str(fp32_path),
        model_output=str(int8_path),
        weight_type=QuantType.QInt8,
    )
    size_mb = int8_path.stat().st_size / (1024 * 1024)
    print(f"[INFO] INT8 model size: {size_mb:.2f} MB")


def smoke_test_onnx(onnx_path: Path) -> None:
    """Validate output tensor shapes of exported ONNX model."""
    print(f"[INFO] Validating exported ONNX model: {onnx_path}")
    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])

    dummy_ids = np.zeros((1, MAX_LEN), dtype=np.int64)
    dummy_mask = np.ones((1, MAX_LEN), dtype=np.int64)

    outputs = session.run(
        ["issue_logits", "polarity_logits"],
        {"input_ids": dummy_ids, "attention_mask": dummy_mask},
    )

    assert outputs[0].shape == (1, NUM_ISSUES), f"Invalid issue_logits shape: {outputs[0].shape}"
    assert outputs[1].shape == (1, NUM_POLARITIES), f"Invalid polarity_logits shape: {outputs[1].shape}"
    print("[INFO] Output shapes validated successfully.")


def stage_assets(tokenizer: AutoTokenizer, out_dir: Path, label_mappings_src: Path) -> None:
    """Stage tokenizer files and label mappings to output directory."""
    print(f"[INFO] Staging tokenizer and configuration -> {out_dir}")
    tokenizer.save_pretrained(str(out_dir))

    if label_mappings_src.exists():
        shutil.copy(label_mappings_src, out_dir / "label_mappings.json")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export fine-tuned dual-head model to ONNX.")
    parser.add_argument(
        "--model-name",
        type=str,
        default=None,
        help="Hugging Face base model identifier. Defaults to FEEANA_MODEL_NAME env or DistilXLM-R.",
    )
    parser.add_argument(
        "--tag",
        type=str,
        default=None,
        help="Short tag used in output filenames (e.g. 'mbert'). Auto-derived from model name.",
    )
    parser.add_argument(
        "--checkpoint",
        type=Path,
        default=None,
        help="Path to trained checkpoint (.pt). Defaults to checkpoints/{tag}/best_model.pt, else checkpoints/{tag}_best_model.pt, else best_model.pt.",
    )
    parser.add_argument(
        "--label-mappings",
        type=Path,
        default=None,
        help="Path to label_mappings.json. Defaults to checkpoints/{tag}/label_mappings.json, else checkpoints/{tag}_label_mappings.json, else label_mappings.json.",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path(__file__).parent / "exports",
        help="Output directory for exported assets.",
    )
    parser.add_argument(
        "--no-quantize",
        action="store_true",
        help="Skip INT8 quantization step.",
    )
    parser.add_argument(
        "--opset",
        type=int,
        default=17,
        help="ONNX opset version (default: 17).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    model_name = resolve_model_name(args.model_name)
    tag = resolve_tag(model_name, args.tag)
    ckpt_path, label_mappings_path = resolve_checkpoint_paths(
        tag, args.checkpoint, args.label_mappings
    )

    if not ckpt_path.exists():
        print(f"[ERROR] Checkpoint file not found: {ckpt_path}")
        sys.exit(1)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    tag_dir = args.out_dir / tag
    tag_dir.mkdir(parents=True, exist_ok=True)
    device = torch.device("cpu")

    model = load_checkpoint(ckpt_path, device, model_name)
    tokenizer = AutoTokenizer.from_pretrained(model_name)

    fp32_path = tag_dir / "int8-fp32.onnx"
    export_fp32_onnx(model, fp32_path, args.opset)

    final_onnx = fp32_path
    if not args.no_quantize:
        int8_path = tag_dir / "int8.onnx"
        quantize_int8(fp32_path, int8_path)
        final_onnx = int8_path
        if fp32_path.exists():
            fp32_path.unlink()

    smoke_test_onnx(final_onnx)
    stage_assets(tokenizer, tag_dir, label_mappings_path)

    print(f"[SUCCESS] Model export finished. Assets available in: {tag_dir.resolve()}")


if __name__ == "__main__":
    main()
