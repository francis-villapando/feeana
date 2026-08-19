"""
Offline SOP 5.1 evaluation of all deployed PID-ABSA models on the held-out test set.

Runs the three browser-deployed ONNX artifacts through onnxruntime on CPU:
  - DistilXLM-R / mBERT: dual-head transformers consuming tokenizer
    input_ids/attention_mask (int64 [N, 256]) and emitting issue_logits /
    polarity_logits, decoded via softmax argmax against label_mappings.json.
  - SVM baseline: a single dual-head ONNX consuming string_input and emitting
    issue_label/polarity_label (int64 index) + issue_probabilities/
    polarity_probabilities from one run, decoded via label_mappings.json.

All three consume the same parity-cleaned text (cleaned_text from test.csv),
matching the training-time input contract. For each model and each head
(15-way issue, 3-way polarity) this script computes per-label and macro
precision / recall / F1 (zero_division=0) plus the full confusion matrix.

Outputs (fixed filenames, appended to reports/):
  - model_comparison.csv              : one row per (model, task, label)
                                       plus a macro row per model/task
  - <model>_cm_<task>.csv             : square label x label counts

Library versions are printed at runtime by main().

Usage:
  python compare_models.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import pandas as pd
from sklearn.metrics import (
    confusion_matrix,
    precision_recall_fscore_support,
)
from transformers import AutoTokenizer

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = Path(__file__).resolve().parents[2]
REPORTS_DIR = SCRIPT_DIR / "reports"
PUBLIC_MODELS_DIR = ROOT / "public" / "models"

TEST_CSV = ROOT / "public" / "model-data" / "test.csv"

SEED = 0
MAX_LEN = 256
BATCH_SIZE = 32

TASKS = ["issue", "polarity"]
OUTPUT_BASE = "model_comparison.csv"


def public_model(relative: str) -> Path:
    """Resolves a path relative to public/models/."""
    return PUBLIC_MODELS_DIR / relative


MODELS = {
    "distilxlmr": {
        "kind": "transformer",
        "onnx": public_model("finetuned/distilxlmr/int8.onnx"),
        "tokenizer_dir": public_model("finetuned/distilxlmr"),
        "label_mappings": public_model("finetuned/distilxlmr/label_mappings.json"),
    },
    "mbert": {
        "kind": "transformer",
        "onnx": public_model("finetuned/mbert/int8.onnx"),
        "tokenizer_dir": public_model("finetuned/mbert"),
        "label_mappings": public_model("finetuned/mbert/label_mappings.json"),
    },
    "svm": {
        "kind": "svm",
        "onnx": public_model("trained/svm/svm.onnx"),
        "label_mappings": public_model("trained/svm/label_mappings.json"),
    },
}


def load_label_mappings(path: Path) -> dict:
    """Loads label_mappings.json and returns {task: [labels in index order]}."""
    with open(path, encoding="utf-8") as handle:
        raw = json.load(handle)
    return {
        task: [
            raw[task]["id2label"][str(idx)]
            for idx in range(raw[task]["num_labels"])
        ]
        for task in TASKS
    }


def decode_indices(indices: np.ndarray, labels: list[str]) -> list[str]:
    """Maps model-returned class indices to their label strings."""
    return [labels[int(idx)] for idx in indices]


def run_transformer_inference(
    model_cfg: dict,
    texts: list[str],
    tokenizer: AutoTokenizer,
    session: ort.InferenceSession,
    labels_by_task: dict,
) -> dict[str, list[str]]:
    """Batch tokenizes cleaned_text and decodes both heads' argmax labels."""
    predictions: dict[str, list[str]] = {task: [] for task in TASKS}
    for start in range(0, len(texts), BATCH_SIZE):
        batch = texts[start : start + BATCH_SIZE]
        encoded = tokenizer(
            batch,
            max_length=MAX_LEN,
            padding="max_length",
            truncation=True,
            return_tensors="np",
        )
        issue_logits, polarity_logits = session.run(
            ["issue_logits", "polarity_logits"],
            {
                "input_ids": encoded["input_ids"].astype(np.int64),
                "attention_mask": encoded["attention_mask"].astype(np.int64),
            },
        )
        predictions["issue"].extend(
            decode_indices(issue_logits.argmax(axis=-1), labels_by_task["issue"])
        )
        predictions["polarity"].extend(
            decode_indices(polarity_logits.argmax(axis=-1), labels_by_task["polarity"])
        )
    return predictions


def run_svm_inference(
    model_cfg: dict,
    texts: list[str],
    session: ort.InferenceSession,
    labels_by_task: dict,
) -> dict[str, list[str]]:
    """Runs the dual-head SVM ONNX once and decodes both heads' label indices."""
    feeds = {"string_input": np.array([[text] for text in texts], dtype=object)}
    issue_label, _, polarity_label, _ = session.run(
        [
            "issue_label",
            "issue_probabilities",
            "polarity_label",
            "polarity_probabilities",
        ],
        feeds,
    )
    return {
        "issue": decode_indices(issue_label, labels_by_task["issue"]),
        "polarity": decode_indices(polarity_label, labels_by_task["polarity"]),
    }


def compute_metrics(y_true: list[str], y_pred: list[str], labels: list[str]) -> pd.DataFrame:
    """Returns a DataFrame of per-label + macro precision/recall/F1 rows."""
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=labels, average=None, zero_division=0
    )
    macro_precision, macro_recall, macro_f1, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=labels, average="macro", zero_division=0
    )

    rows = [
        {
            "label": label,
            "precision": round(float(p), 4),
            "recall": round(float(r), 4),
            "f1": round(float(f), 4),
        }
        for label, p, r, f in zip(labels, precision, recall, f1)
    ]
    rows.append({
        "label": "macro",
        "precision": round(float(macro_precision), 4),
        "recall": round(float(macro_recall), 4),
        "f1": round(float(macro_f1), 4),
    })
    return pd.DataFrame(rows, columns=["label", "precision", "recall", "f1"])


def save_confusion_matrix(
    y_true: list[str],
    y_pred: list[str],
    labels: list[str],
    out_path: Path,
) -> pd.DataFrame:
    """Writes a label x label confusion matrix CSV and returns the matrix."""
    matrix = confusion_matrix(y_true, y_pred, labels=labels)
    df = pd.DataFrame(matrix, index=labels, columns=labels)
    df.to_csv(out_path)
    print(f"[EXPORT] Confusion matrix -> {out_path}")
    return df


def main() -> None:
    np.random.seed(SEED)

    print("[INFO] Library versions:")
    for module in ("onnxruntime", "numpy", "pandas", "sklearn", "transformers"):
        print(f"  {module} {__import__(module).__version__}")

    test_df = pd.read_csv(TEST_CSV)
    texts = test_df["cleaned_text"].tolist()
    y_true = {task: test_df[task].tolist() for task in TASKS}
    print(f"[INFO] Test rows: {len(test_df)}")

    comparison_frames: list[pd.DataFrame] = []
    for model_name, model_cfg in MODELS.items():
        print(f"\n[INFO] Evaluating model: {model_name} ({model_cfg['kind']})")
        labels_by_task = load_label_mappings(model_cfg["label_mappings"])

        if model_cfg["kind"] == "transformer":
            tokenizer = AutoTokenizer.from_pretrained(
                str(model_cfg["tokenizer_dir"]), local_files_only=True
            )
            session = ort.InferenceSession(
                str(model_cfg["onnx"]), providers=["CPUExecutionProvider"]
            )
            predictions = run_transformer_inference(
                model_cfg, texts, tokenizer, session, labels_by_task
            )
        else:
            session = ort.InferenceSession(
                str(model_cfg["onnx"]), providers=["CPUExecutionProvider"]
            )
            predictions = run_svm_inference(model_cfg, texts, session, labels_by_task)

        for task in TASKS:
            task_frame = compute_metrics(
                y_true[task], predictions[task], labels_by_task[task]
            )
            task_frame.insert(0, "task", task)
            task_frame.insert(0, "model", model_name)
            comparison_frames.append(task_frame)

            matrix_path = REPORTS_DIR / f"{model_name}_cm_{task}.csv"
            save_confusion_matrix(
                y_true[task], predictions[task], labels_by_task[task], matrix_path
            )

            macro = task_frame[task_frame["label"] == "macro"].iloc[0]
            print(
                f"  [{task}] macro precision={macro['precision']:.4f} "
                f"recall={macro['recall']:.4f} f1={macro['f1']:.4f}"
            )

    comparison_df = pd.concat(comparison_frames, ignore_index=True)
    comparison_path = REPORTS_DIR / OUTPUT_BASE
    comparison_path.parent.mkdir(parents=True, exist_ok=True)
    comparison_df.to_csv(comparison_path, index=False)
    print(f"\n[EXPORT] Model comparison -> {comparison_path}")

    print("\n[SUMMARY] Macro F1 by model/task:")
    macro_summary = comparison_df[
        comparison_df["label"] == "macro"
    ].pivot(index="model", columns="task", values="f1").reindex(
        columns=TASKS, index=list(MODELS)
    )
    print(macro_summary.to_string())

    print("\n[DONE] SOP 5.1 evaluation complete.")


if __name__ == "__main__":
    main()