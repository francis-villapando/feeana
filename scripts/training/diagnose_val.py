"""
Validation Diagnostic Script for Feeana PID-ABSA Fine-Tuning

Performs a comprehensive diagnostic audit on the validation dataset:
1. Label schema parity check across train.csv, val.csv, test.csv
2. Target tensor & loss inclusion verification
3. Class weights alignment check
4. 15x15 Confusion matrix
5. Per-class precision, recall, F1, and support
6. Overall accuracy and Macro-F1
7. Sample of 25 validation examples with input text, true issue, predicted issue, and softmax confidence
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score
from torch.utils.data import DataLoader
from transformers import AutoTokenizer

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR / "data"
CHECKPOINTS_DIR = SCRIPT_DIR / "checkpoints"

sys.path.insert(0, str(SCRIPT_DIR))
from finetune import (
    DualHeadModel,
    FeedbackDataset,
    compute_weights,
    ISSUE_LABELS,
    ISSUE_LABEL2ID,
    ISSUE_ID2LABEL,
    POLARITY_LABELS,
    POLARITY_LABEL2ID,
    POLARITY_ID2LABEL,
    MODEL_NAME,
    NUM_ISSUES,
    NUM_POLARITIES,
)
from checkpoint_paths import resolve_checkpoint_paths, resolve_tag


def run_diagnostics(checkpoint_path: Path | None = None) -> None:
    print("Feeana PID-ABSA Validation Diagnostic Audit")

    # 1. Label Schema Parity Verification
    print("\n1. Label Schema Parity Verification")
    train_df = pd.read_csv(DATA_DIR / "train.csv")
    val_df = pd.read_csv(DATA_DIR / "val.csv")
    test_df = pd.read_csv(DATA_DIR / "test.csv")

    train_issues = sorted(train_df["issue"].unique())
    val_issues = sorted(val_df["issue"].unique())
    test_issues = sorted(test_df["issue"].unique())

    assert train_issues == ISSUE_LABELS, f"Mismatch in train issues vs ISSUE_LABELS: {train_issues}"
    assert val_issues == ISSUE_LABELS, f"Mismatch in val issues vs ISSUE_LABELS: {val_issues}"
    assert test_issues == ISSUE_LABELS, f"Mismatch in test issues vs ISSUE_LABELS: {test_issues}"
    print("  [PASS] ISSUE_LABELS exactly matches train.csv, val.csv, and test.csv (15 unique classes).")

    # 2. Environment & Model Setup
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n2. Environment & Model Setup (Device: {device})")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    val_ds = FeedbackDataset(DATA_DIR / "val.csv", tokenizer)
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False)

    model = DualHeadModel(MODEL_NAME, NUM_ISSUES, NUM_POLARITIES)

    if checkpoint_path and checkpoint_path.exists():
        ckpt = torch.load(checkpoint_path, map_location=device, weights_only=False)
        model.load_state_dict(ckpt["model_state_dict"])
        print(f"  [INFO] Loaded model checkpoint from {checkpoint_path}")
        print(f"    - Saved Epoch: {ckpt.get('epoch')}")
        print(f"    - Saved Val Issue Macro-F1: {ckpt.get('val_issue_macro_f1')}")
    else:
        print("  [INFO] No checkpoint specified or found. Evaluating model initial state.")

    model.to(device)
    model.eval()

    # 3. Class Weights & Loss Logic Verification
    print("\n3. Class Weights & Loss Alignment Verification")
    train_issue_ids = train_df["issue"].map(ISSUE_LABEL2ID).tolist()
    train_pol_ids = train_df["polarity"].map(POLARITY_LABEL2ID).tolist()

    issue_weights = compute_weights(train_issue_ids, NUM_ISSUES, device)
    polarity_weights = compute_weights(train_pol_ids, NUM_POLARITIES, device)

    print("  Issue Class Weights:")
    for idx, (name, w) in enumerate(zip(ISSUE_LABELS, issue_weights.cpu().tolist())):
        print(f"    [{idx:2d}] {name:<30}: weight = {w:.4f}")

    print("\n  Loss Calculation Check:")
    dummy_input = torch.zeros((2, 16), dtype=torch.long, device=device)
    dummy_mask = torch.ones((2, 16), dtype=torch.long, device=device)
    dummy_issue_target = torch.tensor([0, 14], dtype=torch.long, device=device)
    dummy_pol_target = torch.tensor([0, 1], dtype=torch.long, device=device)

    issue_crit = nn.CrossEntropyLoss(weight=issue_weights)
    pol_crit = nn.CrossEntropyLoss(weight=polarity_weights)

    out = model(dummy_input, dummy_mask)
    l_issue = issue_crit(out["issue_logits"], dummy_issue_target)
    l_pol = pol_crit(out["polarity_logits"], dummy_pol_target)
    l_total = l_issue + l_pol

    print(f"    - Sample Issue Loss:    {l_issue.item():.4f}")
    print(f"    - Sample Polarity Loss: {l_pol.item():.4f}")
    print(f"    - Sample Total Loss:    {l_total.item():.4f}")
    assert not torch.isnan(l_issue) and l_issue.item() > 0, "Issue loss is NaN or zero!"
    print("  [PASS] Issue loss is active and non-zero in total loss.")

    # 4. Perform Validation Inference
    print("\n4. Running Full Validation Inference")
    all_issue_preds = []
    all_issue_targets = []
    all_issue_probs = []
    all_pol_preds = []
    all_pol_targets = []
    sample_records = []

    val_texts = val_ds.texts

    with torch.no_grad():
        for b_idx, batch in enumerate(val_loader):
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            issue_labels = batch["issue_label"].to(device)
            polarity_labels = batch["polarity_label"].to(device)

            out = model(input_ids, attention_mask)
            issue_logits = out["issue_logits"]
            pol_logits = out["polarity_logits"]

            issue_probs = F.softmax(issue_logits, dim=-1)
            issue_preds = issue_logits.argmax(dim=-1)
            pol_preds = pol_logits.argmax(dim=-1)

            all_issue_preds.extend(issue_preds.cpu().tolist())
            all_issue_targets.extend(issue_labels.cpu().tolist())
            all_issue_probs.extend(issue_probs.max(dim=-1).values.cpu().tolist())

            all_pol_preds.extend(pol_preds.cpu().tolist())
            all_pol_targets.extend(polarity_labels.cpu().tolist())

            # Collect sample records for detailed report
            start_idx = b_idx * 32
            for i in range(len(issue_labels)):
                global_idx = start_idx + i
                if len(sample_records) < 30:
                    sample_records.append({
                        "text": val_texts[global_idx],
                        "actual_issue": ISSUE_ID2LABEL[issue_labels[i].item()],
                        "pred_issue": ISSUE_ID2LABEL[issue_preds[i].item()],
                        "confidence": issue_probs[i, issue_preds[i]].item(),
                        "actual_polarity": POLARITY_ID2LABEL[polarity_labels[i].item()],
                        "pred_polarity": POLARITY_ID2LABEL[pol_preds[i].item()],
                    })

    # 5. Diagnostics Metrics Calculation
    total_val = len(all_issue_targets)
    overall_acc = accuracy_score(all_issue_targets, all_issue_preds)
    macro_f1 = f1_score(all_issue_targets, all_issue_preds, average="macro", zero_division=0)
    pol_macro_f1 = f1_score(all_pol_targets, all_pol_preds, average="macro", zero_division=0)

    print("\nValidation Overall Results:")
    print(f"  Total Validation Samples:    {total_val}")
    print(f"  Issue Overall Accuracy:      {overall_acc:.4f} ({overall_acc*100:.2f}%)")
    print(f"  Issue Macro-F1:              {macro_f1:.4f}")
    print(f"  Polarity Macro-F1:           {pol_macro_f1:.4f}")

    # 6. Actual vs Predicted Class Distribution Table
    print("\nIssue Class Distribution (Actual vs Predicted):")
    print(f"  {'Index':<5} {'Class Name':<30} {'Actual':>10} {'Predicted':>12} {'Pred %':>8}")

    pred_counts = pd.Series(all_issue_preds).value_counts().to_dict()
    target_counts = pd.Series(all_issue_targets).value_counts().to_dict()

    for idx, name in enumerate(ISSUE_LABELS):
        act_cnt = target_counts.get(idx, 0)
        pred_cnt = pred_counts.get(idx, 0)
        pred_pct = (pred_cnt / total_val) * 100
        print(f"  [{idx:2d}]  {name:<30} {act_cnt:>10d} {pred_cnt:>12d} {pred_pct:>7.2f}%")

    unique_pred_count = len(pred_counts)
    print(f"\n  Unique issue classes predicted: {unique_pred_count} / {NUM_ISSUES}")

    # 7. Per-Class Performance Summary
    print("\nPer-Class Performance Summary:")
    report = classification_report(
        all_issue_targets,
        all_issue_preds,
        labels=list(range(NUM_ISSUES)),
        target_names=ISSUE_LABELS,
        digits=4,
        zero_division=0,
    )
    print(report)

    # 8. 15x15 Issue Confusion Matrix
    print("\n15x15 Issue Confusion Matrix:")
    cm = confusion_matrix(all_issue_targets, all_issue_preds, labels=list(range(NUM_ISSUES)))

    hdr = "     " + " ".join([f"{i:3d}" for i in range(NUM_ISSUES)])
    print(hdr)
    for i in range(NUM_ISSUES):
        row_str = " ".join([f"{cm[i, j]:3d}" for j in range(NUM_ISSUES)])
        print(f"{i:2d} | {row_str}")

    # 9. Sample Validation Predictions (25 Examples)
    print("\nSample Validation Predictions (25 Examples):")
    print(f"  {'#':<3} {'Text (truncated)':<45} {'Actual Issue':<25} {'Pred Issue':<25} {'Conf':>6}")

    for idx, rec in enumerate(sample_records[:25], 1):
        trunc_text = (rec["text"][:42] + "...") if len(rec["text"]) > 45 else rec["text"]
        match_symbol = "✓" if rec["actual_issue"] == rec["pred_issue"] else "✗"
        print(
            f"  {idx:<3d} {trunc_text:<45} {rec['actual_issue']:<25} {rec['pred_issue']:<25} {rec['confidence']:>5.2f} {match_symbol}"
        )

    print("\nDiagnostic complete.")


if __name__ == "__main__":
    ckpt, _ = resolve_checkpoint_paths(resolve_tag(MODEL_NAME))
    run_diagnostics(ckpt if ckpt.exists() else None)
