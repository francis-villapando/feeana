"""Compare one DistilXLM-R checkpoint across PyTorch and ONNX runtimes."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import pandas as pd
import torch
from sklearn.metrics import accuracy_score, f1_score
from transformers import AutoTokenizer

from finetune import (
    DualHeadModel,
    FeedbackDataset,
    MODEL_NAME,
    NUM_ISSUES,
    NUM_POLARITIES,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--fp32-onnx", type=Path, required=True)
    parser.add_argument("--int8-onnx", type=Path, required=True)
    parser.add_argument("--data", type=Path, default=Path("data/test.csv"))
    parser.add_argument("--model-name", default=MODEL_NAME)
    parser.add_argument("--output", type=Path, default=None)
    return parser.parse_args()


def metric_row(name: str, issue_true: np.ndarray, issue_pred: np.ndarray,
               polarity_true: np.ndarray, polarity_pred: np.ndarray) -> dict:
    return {
        "runtime": name,
        "issue_accuracy": float(accuracy_score(issue_true, issue_pred)),
        "issue_macro_f1": float(f1_score(issue_true, issue_pred, average="macro", zero_division=0)),
        "polarity_macro_f1": float(f1_score(polarity_true, polarity_pred, average="macro", zero_division=0)),
    }


def encode_labels(frame: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    issue_labels = sorted(frame["issue"].unique())
    polarity_labels = sorted(frame["polarity"].unique())
    issue_to_id = {label: index for index, label in enumerate(issue_labels)}
    polarity_to_id = {label: index for index, label in enumerate(polarity_labels)}
    return (
        frame["issue"].map(issue_to_id).to_numpy(dtype=np.int64),
        frame["polarity"].map(polarity_to_id).to_numpy(dtype=np.int64),
    )


def load_rows(data_path: Path, tokenizer):
    frame = pd.read_csv(data_path)
    encoded = tokenizer(
        frame["cleaned_text"].tolist(),
        max_length=256,
        padding="max_length",
        truncation=True,
        return_tensors="np",
    )
    return frame, encoded


def run_onnx(path: Path, encoded: dict[str, np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    issue, polarity = session.run(
        ["issue_logits", "polarity_logits"],
        {
            "input_ids": encoded["input_ids"].astype(np.int64),
            "attention_mask": encoded["attention_mask"].astype(np.int64),
        },
    )
    return np.asarray(issue), np.asarray(polarity)


def main() -> None:
    args = parse_args()
    tokenizer = AutoTokenizer.from_pretrained(args.model_name)
    frame, encoded = load_rows(args.data, tokenizer)
    issue_true, polarity_true = encode_labels(frame)

    model = DualHeadModel(args.model_name, NUM_ISSUES, NUM_POLARITIES)
    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    with torch.no_grad():
        outputs = model(
            torch.from_numpy(encoded["input_ids"]).long(),
            torch.from_numpy(encoded["attention_mask"]).long(),
        )
    torch_issue = outputs["issue_logits"].numpy()
    torch_polarity = outputs["polarity_logits"].numpy()

    fp32_issue, fp32_polarity = run_onnx(args.fp32_onnx, encoded)
    int8_issue, int8_polarity = run_onnx(args.int8_onnx, encoded)

    rows = [
        metric_row("pytorch_fp32", issue_true, torch_issue.argmax(-1), polarity_true, torch_polarity.argmax(-1)),
        metric_row("onnx_fp32", issue_true, fp32_issue.argmax(-1), polarity_true, fp32_polarity.argmax(-1)),
        metric_row("onnx_int8", issue_true, int8_issue.argmax(-1), polarity_true, int8_polarity.argmax(-1)),
    ]
    report = {
        "data": str(args.data),
        "rows": len(frame),
        "checkpoint": str(args.checkpoint),
        "artifacts": {
            "fp32_onnx": {"path": str(args.fp32_onnx), "bytes": args.fp32_onnx.stat().st_size},
            "int8_onnx": {"path": str(args.int8_onnx), "bytes": args.int8_onnx.stat().st_size},
        },
        "max_abs_logit_delta": {
            "pytorch_vs_onnx_fp32_issue": float(np.max(np.abs(torch_issue - fp32_issue))),
            "pytorch_vs_onnx_fp32_polarity": float(np.max(np.abs(torch_polarity - fp32_polarity))),
            "onnx_fp32_vs_int8_issue": float(np.max(np.abs(fp32_issue - int8_issue))),
            "onnx_fp32_vs_int8_polarity": float(np.max(np.abs(fp32_polarity - int8_polarity))),
        },
        "argmax_agreement": {
            "pytorch_vs_onnx_fp32_issue": float(np.mean(torch_issue.argmax(-1) == fp32_issue.argmax(-1))),
            "pytorch_vs_onnx_fp32_polarity": float(np.mean(torch_polarity.argmax(-1) == fp32_polarity.argmax(-1))),
            "onnx_fp32_vs_int8_issue": float(np.mean(fp32_issue.argmax(-1) == int8_issue.argmax(-1))),
            "onnx_fp32_vs_int8_polarity": float(np.mean(fp32_polarity.argmax(-1) == int8_polarity.argmax(-1))),
        },
        "metrics": rows,
    }
    print(json.dumps(report, indent=2))
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
