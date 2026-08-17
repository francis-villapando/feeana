"""
Feeana PID-ABSA Phase 3 Evaluation Script

Runs full evaluation of fine-tuned DistilXLM-R model on test.csv:
1. Thesis primary metrics: Issue Macro-F1, Polarity Macro-F1, 15x15 Confusion Matrix.
2. Breakdown by language (Tagalog, Taglish, English, etc.) and source (real, synthetic, augmented).
3. Confidence threshold sweep for Uncategorized fallback on val.csv.
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score
from torch.utils.data import DataLoader
from transformers import AutoTokenizer

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR / "data"
CHECKPOINTS_DIR = SCRIPT_DIR / "checkpoints"
REPORTS_DIR = SCRIPT_DIR / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

sys.path.insert(0, str(SCRIPT_DIR))
from finetune import (
    DualHeadModel,
    FeedbackDataset,
    apply_lora,
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


def evaluate_dataset(model, loader, dataset, device):
    all_issue_preds = []
    all_issue_targets = []
    all_issue_probs = []
    all_pol_preds = []
    all_pol_targets = []

    with torch.no_grad():
        for batch in loader:
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

    return {
        "issue_preds": np.array(all_issue_preds),
        "issue_targets": np.array(all_issue_targets),
        "issue_probs": np.array(all_issue_probs),
        "pol_preds": np.array(all_pol_preds),
        "pol_targets": np.array(all_pol_targets),
    }


def run_phase_3_evaluation():
    tag = resolve_tag(MODEL_NAME)
    ckpt_path, json_path = resolve_checkpoint_paths(tag)

    if not ckpt_path.exists():
        print(f"Error: Checkpoint file not found at {ckpt_path}")
        print(f"Please copy the checkpoint to scripts/training/checkpoints/{tag}/best_model.pt")
        return

    if not json_path.exists():
        print(f"Error: Label mappings file not found at {json_path}")
        print(f"Please copy label_mappings.json to scripts/training/checkpoints/{tag}/label_mappings.json")
        return

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("Feeana PID-ABSA Thesis Evaluation")
    print(f"Device: {device}")

    # Load model and weights
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = DualHeadModel(MODEL_NAME, NUM_ISSUES, NUM_POLARITIES)
    model = apply_lora(model)

    ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)
    model.load_state_dict(ckpt["model_state_dict"])
    model.to(device)
    model.eval()
    print(f"[INFO] Loaded checkpoint from epoch {ckpt.get('epoch')}")

    # Evaluate test dataset
    test_df = pd.read_csv(DATA_DIR / "test.csv")
    test_ds = FeedbackDataset(DATA_DIR / "test.csv", tokenizer)
    test_loader = DataLoader(test_ds, batch_size=32, shuffle=False)

    print("\nRunning test set inference...")
    results = evaluate_dataset(model, test_loader, test_ds, device)

    issue_acc = accuracy_score(results["issue_targets"], results["issue_preds"])
    issue_macro_f1 = f1_score(results["issue_targets"], results["issue_preds"], average="macro", zero_division=0)
    pol_macro_f1 = f1_score(results["pol_targets"], results["pol_preds"], average="macro", zero_division=0)

    cm = confusion_matrix(
        results["issue_targets"],
        results["issue_preds"],
        labels=list(range(NUM_ISSUES)),
    )

    print("\nIssue Confusion Matrix:")
    print(cm)

    print("\nTest Set Primary Metrics")
    print(f"  Total Test Samples:      {len(results['issue_targets'])}")
    print(f"  Issue Overall Accuracy:  {issue_acc:.4f} ({issue_acc*100:.2f}%)")
    print(f"  Issue Macro-F1:          {issue_macro_f1:.4f}")
    print(f"  Polarity Macro-F1:       {pol_macro_f1:.4f}")

    # Per-class classification report
    print("\nPer-Class Issue Performance:")
    report = classification_report(
        results["issue_targets"],
        results["issue_preds"],
        labels=list(range(NUM_ISSUES)),
        target_names=ISSUE_LABELS,
        digits=4,
        zero_division=0,
    )
    print(report)

    # Language breakdown
    if "language" in test_df.columns:
        print("\nBreakdown by Language:")
        for lang in test_df["language"].dropna().unique():
            mask = (test_df["language"] == lang).values
            if mask.sum() == 0:
                continue
            sub_targets = results["issue_targets"][mask]
            sub_preds = results["issue_preds"][mask]
            sub_f1 = f1_score(sub_targets, sub_preds, average="macro", zero_division=0)
            sub_acc = accuracy_score(sub_targets, sub_preds)
            print(f"  Language: {lang:<12} (n={mask.sum():<4}) -> Issue Macro-F1: {sub_f1:.4f} | Accuracy: {sub_acc:.4f}")

    # Data source breakdown
    if "source" in test_df.columns:
        print("\nBreakdown by Data Source:")
        for src in test_df["source"].dropna().unique():
            mask = (test_df["source"] == src).values
            if mask.sum() == 0:
                continue
            sub_targets = results["issue_targets"][mask]
            sub_preds = results["issue_preds"][mask]
            sub_f1 = f1_score(sub_targets, sub_preds, average="macro", zero_division=0)
            sub_acc = accuracy_score(sub_targets, sub_preds)
            print(f"  Source: {src:<12} (n={mask.sum():<4}) -> Issue Macro-F1: {sub_f1:.4f} | Accuracy: {sub_acc:.4f}")

    # Uncategorized confidence fallback threshold sweep (Validation set)
    print("\nUncategorized Fallback Threshold Sweep (Validation Set):")
    val_ds = FeedbackDataset(DATA_DIR / "val.csv", tokenizer)
    val_loader = DataLoader(val_ds, batch_size=32, shuffle=False)
    val_res = evaluate_dataset(model, val_loader, val_ds, device)

    uncat_id = ISSUE_LABEL2ID.get("Uncategorized", 0)
    print(f"  Uncategorized label ID: {uncat_id}")
    print(f"  {'Threshold':<10} {'Routed to Uncategorized':<25} {'Pct Routed':<12} {'Macro-F1':<10}")

    for thresh in np.arange(0.30, 0.75, 0.05):
        fallback_preds = val_res["issue_preds"].copy()
        low_conf_mask = val_res["issue_probs"] < thresh
        fallback_preds[low_conf_mask] = uncat_id

        num_routed = low_conf_mask.sum()
        pct_routed = (num_routed / len(val_res["issue_preds"])) * 100
        f1_val = f1_score(val_res["issue_targets"], fallback_preds, average="macro", zero_division=0)
        print(f"  {thresh:<10.2f} {num_routed:<25d} {pct_routed:<11.2f}% {f1_val:<10.4f}")

    # Save summary report
    summary = {
        "test_issue_macro_f1": float(issue_macro_f1),
        "test_polarity_macro_f1": float(pol_macro_f1),
        "test_issue_accuracy": float(issue_acc),
        "num_test_samples": len(test_df),
    }
    out_file = REPORTS_DIR / f"test_evaluation_report_{tag}.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"\n[INFO] Evaluation report saved to {out_file}")


if __name__ == "__main__":
    run_phase_3_evaluation()
