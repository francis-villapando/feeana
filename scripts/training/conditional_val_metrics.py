"""Conditional issue and polarity diagnostics for a DistilXLM-R checkpoint."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from torch.utils.data import DataLoader
from transformers import AutoTokenizer

from checkpoint_paths import resolve_checkpoint_paths, resolve_tag
from finetune import (
    DualHeadModel,
    FeedbackDataset,
    ISSUE_LABEL2ID,
    ISSUE_LABELS,
    MODEL_NAME,
    NUM_ISSUES,
    POLARITY_LABEL2ID,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=Path, default=None)
    parser.add_argument("--data", type=Path, default=Path("data/val.csv"))
    parser.add_argument(
        "--output", type=Path, default=Path("reports/conditional_val_metrics.json")
    )
    return parser.parse_args()


def macro_f1(targets: np.ndarray, predictions: np.ndarray) -> float:
    return float(f1_score(targets, predictions, average="macro", zero_division=0))


def binary_metrics(targets: np.ndarray, predictions: np.ndarray) -> dict:
    return {
        "precision": float(precision_score(targets, predictions, zero_division=0)),
        "recall": float(recall_score(targets, predictions, zero_division=0)),
        "f1": float(f1_score(targets, predictions, zero_division=0)),
        "confusion_matrix": confusion_matrix(targets, predictions, labels=[0, 1]).tolist(),
    }


def subset_metrics(
    issue_targets: np.ndarray,
    issue_predictions: np.ndarray,
    polarity_targets: np.ndarray,
    polarity_predictions: np.ndarray,
    mask: np.ndarray,
) -> dict:
    return {
        "samples": int(mask.sum()),
        "issue_accuracy": float(
            accuracy_score(issue_targets[mask], issue_predictions[mask])
        ),
        "issue_macro_f1": macro_f1(issue_targets[mask], issue_predictions[mask]),
        "polarity_macro_f1": macro_f1(
            polarity_targets[mask], polarity_predictions[mask]
        ),
    }


def main() -> None:
    args = parse_args()
    checkpoint_path = args.checkpoint
    if checkpoint_path is None:
        checkpoint_path, _ = resolve_checkpoint_paths(resolve_tag(MODEL_NAME))

    frame = pd.read_csv(args.data)
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    dataset = FeedbackDataset(args.data, tokenizer)
    loader = DataLoader(dataset, batch_size=32, shuffle=False)

    model = DualHeadModel(MODEL_NAME, NUM_ISSUES, 3)
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    issue_predictions: list[int] = []
    issue_targets: list[int] = []
    issue_confidences: list[float] = []
    polarity_predictions: list[int] = []
    polarity_targets: list[int] = []
    with torch.no_grad():
        for batch in loader:
            outputs = model(batch["input_ids"], batch["attention_mask"])
            issue_probabilities = torch.softmax(outputs["issue_logits"], dim=-1)
            issue_predictions.extend(outputs["issue_logits"].argmax(-1).tolist())
            issue_targets.extend(batch["issue_label"].tolist())
            issue_confidences.extend(issue_probabilities.max(-1).values.tolist())
            polarity_predictions.extend(outputs["polarity_logits"].argmax(-1).tolist())
            polarity_targets.extend(batch["polarity_label"].tolist())

    issue_targets_array = np.asarray(issue_targets)
    issue_predictions_array = np.asarray(issue_predictions)
    issue_confidences_array = np.asarray(issue_confidences)
    polarity_targets_array = np.asarray(polarity_targets)
    polarity_predictions_array = np.asarray(polarity_predictions)

    uncat_id = ISSUE_LABEL2ID["uncategorized"]
    true_uncategorized = issue_targets_array == uncat_id
    predicted_uncategorized = issue_predictions_array == uncat_id
    named_issues = ~true_uncategorized
    issue_correct = issue_targets_array == issue_predictions_array

    threshold_rows = []
    for threshold in np.arange(0.30, 0.75, 0.05):
        threshold_predictions = issue_predictions_array.copy()
        threshold_predictions[issue_confidences_array < threshold] = uncat_id
        routed_uncategorized = threshold_predictions == uncat_id
        threshold_rows.append(
            {
                "threshold": round(float(threshold), 2),
                "routed_percentage": float(routed_uncategorized.mean() * 100),
                "overall_issue_macro_f1": macro_f1(
                    issue_targets_array, threshold_predictions
                ),
                "uncategorized_binary_f1": macro_f1(
                    true_uncategorized.astype(int), routed_uncategorized.astype(int)
                ),
            }
        )

    report = {
        "checkpoint": str(checkpoint_path),
        "data": str(args.data),
        "samples": len(frame),
        "issue_labels": ISSUE_LABELS,
        "polarity_labels": list(POLARITY_LABEL2ID),
        "raw": {
            "overall_issue_accuracy": float(
                accuracy_score(issue_targets_array, issue_predictions_array)
            ),
            "overall_issue_macro_f1": macro_f1(
                issue_targets_array, issue_predictions_array
            ),
            "overall_polarity_macro_f1": macro_f1(
                polarity_targets_array, polarity_predictions_array
            ),
            "uncategorized_vs_named": binary_metrics(
                true_uncategorized.astype(int), predicted_uncategorized.astype(int)
            ),
            "ground_truth_uncategorized": subset_metrics(
                issue_targets_array,
                issue_predictions_array,
                polarity_targets_array,
                polarity_predictions_array,
                true_uncategorized,
            ),
            "ground_truth_named": subset_metrics(
                issue_targets_array,
                issue_predictions_array,
                polarity_targets_array,
                polarity_predictions_array,
                named_issues,
            ),
            "named_issue_macro_f1_14_class": macro_f1(
                issue_targets_array[named_issues], issue_predictions_array[named_issues]
            ),
            "polarity_when_issue_correct": {
                "samples": int(issue_correct.sum()),
                "macro_f1": macro_f1(
                    polarity_targets_array[issue_correct],
                    polarity_predictions_array[issue_correct],
                ),
            },
            "polarity_when_issue_incorrect": {
                "samples": int((~issue_correct).sum()),
                "macro_f1": macro_f1(
                    polarity_targets_array[~issue_correct],
                    polarity_predictions_array[~issue_correct],
                ),
            },
        },
        "threshold_sweep_validation_only": threshold_rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()