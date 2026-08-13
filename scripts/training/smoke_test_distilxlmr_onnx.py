"""
Smoke test validation script for exported DistilXLM-R ONNX model.

Runs inference on sample text inputs to verify output tensor shapes
and label mapping decoding logic.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_ONNX = SCRIPT_DIR / "exports" / "distilxlmr-pidabsa-int8.onnx"
DEFAULT_TOKENIZER_DIR = SCRIPT_DIR / "exports"
LABEL_MAPPINGS = SCRIPT_DIR / "exports" / "label_mappings.json"
FALLBACK_MODEL_NAME = "nreimers/mMiniLMv2-L12-H384-distilled-from-XLMR-Large"

MAX_LEN = 256
NUM_ISSUES = 15
NUM_POLARITIES = 3

SAMPLE_TEXTS = [
    "The professor never explains anything clearly and the slides are confusing.",
    "Great class, very engaging and the feedback was timely.",
    "I feel like my questions are ignored during lectures.",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke-test the exported PID-ABSA ONNX model.")
    parser.add_argument(
        "--onnx",
        type=Path,
        default=DEFAULT_ONNX,
        help="Path to target ONNX model file.",
    )
    parser.add_argument(
        "--tokenizer-dir",
        type=Path,
        default=DEFAULT_TOKENIZER_DIR,
        help="Directory containing tokenizer configuration.",
    )
    return parser.parse_args()


def load_label_mappings(mappings_path: Path) -> tuple[dict[int, str], dict[int, str]]:
    """Load issue and polarity label mappings if present."""
    id2issue: dict[int, str] = {}
    id2polarity: dict[int, str] = {}

    if mappings_path.exists():
        with open(mappings_path, encoding="utf-8") as f:
            lm = json.load(f)
        id2issue = {int(k): v for k, v in lm["issue"]["id2label"].items()}
        id2polarity = {int(k): v for k, v in lm["polarity"]["id2label"].items()}
    else:
        print(f"[WARN] Label mappings file not found at {mappings_path}; using raw indices.")

    return id2issue, id2polarity


def get_tokenizer(tokenizer_dir: Path) -> AutoTokenizer:
    """Load tokenizer from local directory or huggingface hub fallback."""
    if (tokenizer_dir / "tokenizer.json").exists():
        print(f"[INFO] Loading tokenizer from local directory: {tokenizer_dir}")
        return AutoTokenizer.from_pretrained(str(tokenizer_dir))
    
    print(f"[INFO] Local tokenizer not found; loading fallback: {FALLBACK_MODEL_NAME}")
    return AutoTokenizer.from_pretrained(FALLBACK_MODEL_NAME)


def main() -> None:
    args = parse_args()

    if not args.onnx.exists():
        print(f"[ERROR] Target ONNX file does not exist: {args.onnx}")
        sys.exit(1)

    id2issue, id2polarity = load_label_mappings(LABEL_MAPPINGS)
    tokenizer = get_tokenizer(args.tokenizer_dir)

    print(f"[INFO] Initializing ONNX session: {args.onnx}")
    session = ort.InferenceSession(str(args.onnx), providers=["CPUExecutionProvider"])

    dummy_ids = np.zeros((1, MAX_LEN), dtype=np.int64)
    dummy_mask = np.ones((1, MAX_LEN), dtype=np.int64)
    dummy_out = session.run(
        ["issue_logits", "polarity_logits"],
        {"input_ids": dummy_ids, "attention_mask": dummy_mask},
    )

    assert dummy_out[0].shape == (1, NUM_ISSUES), f"Invalid issue_logits shape: {dummy_out[0].shape}"
    assert dummy_out[1].shape == (1, NUM_POLARITIES), f"Invalid polarity_logits shape: {dummy_out[1].shape}"
    print("[INFO] Dummy input tensor verification passed.")

    print("\n--- Running Sample Inferences ---")
    for text in SAMPLE_TEXTS:
        enc = tokenizer(
            text,
            max_length=MAX_LEN,
            padding="max_length",
            truncation=True,
            return_tensors="np",
        )
        issue_logits, pol_logits = session.run(
            ["issue_logits", "polarity_logits"],
            {
                "input_ids": enc["input_ids"].astype(np.int64),
                "attention_mask": enc["attention_mask"].astype(np.int64),
            },
        )

        issue_idx = int(np.argmax(issue_logits, axis=-1)[0])
        pol_idx = int(np.argmax(pol_logits, axis=-1)[0])

        issue_exp = np.exp(issue_logits)
        issue_conf = float(np.max(issue_exp / np.sum(issue_exp, axis=-1, keepdims=True)))

        pol_exp = np.exp(pol_logits)
        pol_conf = float(np.max(pol_exp / np.sum(pol_exp, axis=-1, keepdims=True)))

        issue_label = id2issue.get(issue_idx, f"Index {issue_idx}")
        pol_label = id2polarity.get(pol_idx, f"Index {pol_idx}")

        print(f"Input   : {text}")
        print(f"Issue   : {issue_label} (confidence: {issue_conf:.4f})")
        print(f"Polarity: {pol_label} (confidence: {pol_conf:.4f})\n")

    print("[SUCCESS] Smoke test completed successfully.")


if __name__ == "__main__":
    main()
