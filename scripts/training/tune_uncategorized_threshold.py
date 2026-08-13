'''\
Tune Uncategorised Threshold (validation only)
\
Runs a fine‑grained sweep of the confidence threshold on the validation set
using the exact same model / tokenizer / LoRA configuration as evaluate_test.py.
It prints a table for thresholds 0.10‑0.50 (step 0.01) and also includes the
coarse thresholds 0.55, 0.60, 0.65, 0.70.
The script never touches test.csv and never modifies any checkpoint.
'''\

import json
import pathlib
import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from sklearn.metrics import accuracy_score, f1_score
from torch.utils.data import DataLoader
from transformers import AutoTokenizer

# Re‑use definitions from the training package (same imports as evaluate_test.py)
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR / "data"
CHECKPOINTS_DIR = SCRIPT_DIR / "checkpoints"

# Ensure finetune module is on the path
import sys
sys.path.insert(0, str(SCRIPT_DIR))
from finetune import (
    DualHeadModel,
    FeedbackDataset,
    apply_lora,
    MODEL_NAME,
    NUM_ISSUES,
    NUM_POLARITIES,
    ISSUE_LABEL2ID,
)


def evaluate_dataset(model, loader, device):
    """Run inference on a DataLoader and return predictions & probs.

    Returns a dict with:
        issue_preds – np.ndarray of predicted class ids
        issue_targets – np.ndarray of ground‑truth ids
        issue_probs – np.ndarray of max softmax probability per sample
    """
    all_preds = []
    all_targets = []
    all_probs = []
    model.eval()
    with torch.no_grad():
        for batch in loader:
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            issue_labels = batch["issue_label"].to(device)

            out = model(input_ids, attention_mask)
            issue_logits = out["issue_logits"]
            probs = F.softmax(issue_logits, dim=-1)
            preds = issue_logits.argmax(dim=-1)

            all_preds.extend(preds.cpu().tolist())
            all_targets.extend(issue_labels.cpu().tolist())
            all_probs.extend(probs.max(dim=-1).values.cpu().tolist())
    return {
        "issue_preds": np.array(all_preds),
        "issue_targets": np.array(all_targets),
        "issue_probs": np.array(all_probs),
    }


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("Feeana – Validation Threshold Sweep (fine grained)")
    print(f"Device: {device}\n")

    # Load model & checkpoint (identical to evaluate_test.py)
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = DualHeadModel(MODEL_NAME, NUM_ISSUES, NUM_POLARITIES)
    model = apply_lora(model)

    ckpt_path = CHECKPOINTS_DIR / "best_model.pt"
    if not ckpt_path.exists():
        raise FileNotFoundError(f"Checkpoint not found at {ckpt_path}")
    ckpt = torch.load(ckpt_path, map_location=device, weights_only=False)
    model.load_state_dict(ckpt["model_state_dict"])
    model.to(device)
    model.eval()

    # Load label mappings (required for completeness; not used directly)
    label_map_path = CHECKPOINTS_DIR / "label_mappings.json"
    if label_map_path.exists():
        with open(label_map_path, "r", encoding="utf-8") as f:
            _ = json.load(f)
    else:
        print(f"[WARN] label_mappings.json not found at {label_map_path}")

    # Validation data
    val_dataset = FeedbackDataset(DATA_DIR / "val.csv", tokenizer)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)
    val_res = evaluate_dataset(model, val_loader, device)

    uncat_id = ISSUE_LABEL2ID.get("Uncategorized", 0)

    # Prepare thresholds
    fine_thresholds = np.arange(0.10, 0.51, 0.01)  # 0.10‑0.50 inclusive
    coarse_extra = [0.55, 0.60, 0.65, 0.70]
    thresholds = list(fine_thresholds) + coarse_extra

    # Header for the table
    header = (
        f"{'Threshold':<10} {'Routed':<12} {'% Routed':<10} "
        f"{'Issue Acc':<10} {'Macro-F1':<9} {'Weighted-F1':<12} "
        f"{'Unique Classes':<15}"
    )
    print(header)
    print('-' * len(header))

    best_thresh = None
    best_macro_f1 = -1.0
    best_metrics = None

    for thresh in thresholds:
        fallback_preds = val_res["issue_preds"].copy()
        low_conf_mask = val_res["issue_probs"] < thresh
        fallback_preds[low_conf_mask] = uncat_id

        num_routed = int(low_conf_mask.sum())
        pct_routed = (num_routed / len(val_res["issue_preds"])) * 100
        acc = accuracy_score(val_res["issue_targets"], fallback_preds)
        macro_f1 = f1_score(val_res["issue_targets"], fallback_preds, average="macro", zero_division=0)
        weighted_f1 = f1_score(val_res["issue_targets"], fallback_preds, average="weighted", zero_division=0)
        unique_classes = np.unique(fallback_preds).size

        print(f"{thresh:<10.2f} {num_routed:<12d} {pct_routed:<10.2f} {acc:<10.4f} {macro_f1:<9.4f} {weighted_f1:<12.4f} {unique_classes:<15d}")

        if macro_f1 > best_macro_f1:
            best_macro_f1 = macro_f1
            best_thresh = thresh
            best_metrics = (acc, pct_routed)

    # ---------------------------------------------------------------------
    # Summary of best threshold
    # ---------------------------------------------------------------------
    if best_thresh is not None:
        best_acc, best_pct = best_metrics
        print("\nBEST VALIDATION THRESHOLD: {:.2f}".format(best_thresh))
        print("BEST VALIDATION ISSUE MACRO-F1: {:.4f}".format(best_macro_f1))
        print("CORRESPONDING VALIDATION ACCURACY: {:.4f}".format(best_acc))
        print("PERCENT ROUTED TO UNCATEGORIZED: {:.2f}%".format(best_pct))
    else:
        print("No thresholds evaluated.")

if __name__ == "__main__":
    main()
