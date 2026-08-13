"""
Phase 2 — Fine-tuning Script for PID-ABSA Dual-Head DistilXLM-R

Base model:  nreimers/mMiniLMv2-L12-H384-distilled-from-XLMR-Large
Task:        Dual-head classification
             - issue  (15-way): 14 taxonomy tags + Uncategorized
             - polarity (3-way): neg / neu / pos
Architecture: Shared encoder + two separate classification heads, LoRA on q/k/v/output
Compute:     Google Colab T4 (primary) → Kaggle free (fallback) → local CPU LoRA

Usage:
  # Colab/Kaggle (GPU):
  !pip install peft datasets evaluate
  !python finetune.py

  # Local CPU (no GPU):
  python finetune.py --device cpu

Pinned versions (tested):
  torch>=2.1           transformers>=4.38
  peft>=0.9            datasets>=2.18
  evaluate>=0.4        scikit-learn>=1.3
  accelerate>=0.27
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

# Reproducibility — pin every source of randomness
GLOBAL_SEED = 42


def seed_everything(seed: int = GLOBAL_SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    # Deterministic algorithms (slight perf hit, worth it for thesis)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


seed_everything()

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR / "data"
REPORTS_DIR = SCRIPT_DIR / "reports"
CHECKPOINTS_DIR = SCRIPT_DIR / "checkpoints"

TRAIN_CSV = DATA_DIR / "train.csv"
VAL_CSV = DATA_DIR / "val.csv"
TEST_CSV = DATA_DIR / "test.csv"

REPORTS_DIR.mkdir(parents=True, exist_ok=True)
CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)

# Label schema — canonical ordering, persisted as JSON
ISSUE_LABELS: list[str] = [
    "abstract logic gap",
    "clarity deficit",
    "classroom tension",
    "conceptual misalignment",
    "design synthesis failure",
    "evaluation unfairness",
    "feedback latency",
    "instructional cadence",
    "notation struggle",
    "peer distraction",
    "perceived marginalization",
    "procedural bottleneck",
    "relational coldness",
    "subject alienation",
    "uncategorized",
]

POLARITY_LABELS: list[str] = ["neg", "neu", "pos"]

NUM_ISSUES = len(ISSUE_LABELS)      # 15
NUM_POLARITIES = len(POLARITY_LABELS)  # 3

ISSUE_ID2LABEL = {i: l for i, l in enumerate(ISSUE_LABELS)}
ISSUE_LABEL2ID = {l: i for i, l in enumerate(ISSUE_LABELS)}

POLARITY_ID2LABEL = {i: l for i, l in enumerate(POLARITY_LABELS)}
POLARITY_LABEL2ID = {l: i for i, l in enumerate(POLARITY_LABELS)}


def save_label_mappings() -> None:
    """Persist id2label / label2id for both heads — needed at ONNX export."""
    mapping = {
        "issue": {
            "id2label": ISSUE_ID2LABEL,
            "label2id": ISSUE_LABEL2ID,
            "num_labels": NUM_ISSUES,
        },
        "polarity": {
            "id2label": POLARITY_ID2LABEL,
            "label2id": POLARITY_LABEL2ID,
            "num_labels": NUM_POLARITIES,
        },
    }
    path = CHECKPOINTS_DIR / "label_mappings.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(mapping, f, indent=2, ensure_ascii=False)
    print(f"[INFO] Label mappings saved → {path}")


# Dataset
from transformers import AutoTokenizer  # noqa: E402

MODEL_NAME = "nreimers/mMiniLMv2-L12-H384-distilled-from-XLMR-Large"
MAX_LEN = 256  # 100% coverage verified in EDA (max token len = 100)


class FeedbackDataset(Dataset):
    """Tokenises cleaned_text and returns issue + polarity integer labels."""

    def __init__(self, csv_path: Path, tokenizer: AutoTokenizer) -> None:
        df = pd.read_csv(csv_path)
        # Use the pre-cleaned text produced by split_data.py (parity with TS runtime)
        self.texts: list[str] = df["cleaned_text"].astype(str).tolist()
        self.issue_ids: list[int] = df["issue"].map(ISSUE_LABEL2ID).tolist()
        self.polarity_ids: list[int] = df["polarity"].map(POLARITY_LABEL2ID).tolist()
        self.tokenizer = tokenizer

    def __len__(self) -> int:
        return len(self.texts)

    def __getitem__(self, idx: int) -> dict:
        enc = self.tokenizer(
            self.texts[idx],
            max_length=MAX_LEN,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        return {
            "input_ids": enc["input_ids"].squeeze(0),
            "attention_mask": enc["attention_mask"].squeeze(0),
            "issue_label": torch.tensor(self.issue_ids[idx], dtype=torch.long),
            "polarity_label": torch.tensor(self.polarity_ids[idx], dtype=torch.long),
        }


# Dual-head model — shared encoder, two classification heads
from transformers import AutoModel  # noqa: E402


class DualHeadModel(nn.Module):
    """
    Shared XLM-R encoder → two linear heads:
      - issue_head:    hidden_size → 15
      - polarity_head: hidden_size → 3

    Forward returns a dict with 'issue_logits' and 'polarity_logits'.
    """

    def __init__(self, model_name: str, num_issues: int, num_polarities: int) -> None:
        super().__init__()
        self.encoder = AutoModel.from_pretrained(model_name)
        hidden = self.encoder.config.hidden_size  # 384 for mMiniLMv2

        self.issue_head = nn.Linear(hidden, num_issues)
        self.polarity_head = nn.Linear(hidden, num_polarities)

        # Dropout matching the model's default hidden_dropout_prob
        drop_p = getattr(self.encoder.config, "hidden_dropout_prob", 0.1)
        self.dropout = nn.Dropout(drop_p)

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
    ) -> dict[str, torch.Tensor]:
        outputs = self.encoder(input_ids=input_ids, attention_mask=attention_mask)

        # Mean Pooling over non-padded tokens (required for SentenceTransformers models like mMiniLMv2)
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(outputs.last_hidden_state.size()).float()
        sum_embeddings = torch.sum(outputs.last_hidden_state * input_mask_expanded, dim=1)
        sum_mask = torch.clamp(input_mask_expanded.sum(dim=1), min=1e-9)
        pooled = sum_embeddings / sum_mask

        pooled = self.dropout(pooled)
        pooled = pooled.to(self.issue_head.weight.dtype)

        issue_logits = self.issue_head(pooled)
        polarity_logits = self.polarity_head(pooled)

        return {
            "issue_logits": issue_logits,
            "polarity_logits": polarity_logits,
        }


# LoRA — apply to q, k, v, and output projections
from peft import LoraConfig, get_peft_model, TaskType  # noqa: E402


def apply_lora(model: DualHeadModel) -> DualHeadModel:
    """Wrap the encoder with LoRA adapters on attention projections."""
    lora_config = LoraConfig(
        task_type=TaskType.FEATURE_EXTRACTION,  # encoder-only, heads stay full-rank
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        # Target modules: XLM-R attention q/k/v and output dense layers
        target_modules=["query", "key", "value", "output.dense"],
        bias="none",
    )
    model.encoder = get_peft_model(model.encoder, lora_config)
    model.encoder.print_trainable_parameters()
    return model


# Class weights — handle polarity imbalance (~87% neg) and issue imbalance
from sklearn.utils.class_weight import compute_class_weight  # noqa: E402


def compute_weights(labels: list[int], num_classes: int, device: torch.device) -> torch.Tensor:
    """Inverse-frequency class weights via sklearn, moved to device."""
    arr = np.array(labels)
    classes = np.arange(num_classes)
    weights = compute_class_weight("balanced", classes=classes, y=arr)
    return torch.tensor(weights, dtype=torch.float32).to(device)


# Training loop
from evaluate import load as load_metric  # noqa: E402


def train_one_epoch(
    model: DualHeadModel,
    loader: DataLoader,
    optimizer: torch.optim.Optimizer,
    scheduler: torch.optim.lr_scheduler.LRScheduler,
    issue_criterion: nn.CrossEntropyLoss,
    polarity_criterion: nn.CrossEntropyLoss,
    device: torch.device,
    scaler: torch.amp.GradScaler | None,
    use_amp: bool,
    issue_loss_weight: float = 3.0,
) -> dict[str, float]:
    model.train()
    total_loss = 0.0
    total_issue_loss = 0.0
    total_polarity_loss = 0.0
    n_batches = 0

    for batch in loader:
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        issue_labels = batch["issue_label"].to(device)
        polarity_labels = batch["polarity_label"].to(device)

        optimizer.zero_grad()

        with torch.amp.autocast(device_type=device.type, enabled=use_amp):
            outputs = model(input_ids, attention_mask)
            loss_issue = issue_criterion(outputs["issue_logits"], issue_labels)
            loss_polarity = polarity_criterion(outputs["polarity_logits"], polarity_labels)
            loss = (issue_loss_weight * loss_issue) + loss_polarity

        if scaler is not None:
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
        else:
            loss.backward()
            optimizer.step()

        scheduler.step()

        total_loss += loss.item()
        total_issue_loss += loss_issue.item()
        total_polarity_loss += loss_polarity.item()
        n_batches += 1

    return {
        "loss": total_loss / n_batches,
        "issue_loss": total_issue_loss / n_batches,
        "polarity_loss": total_polarity_loss / n_batches,
    }


from collections import Counter
from sklearn.metrics import classification_report


@torch.no_grad()
def evaluate(
    model: DualHeadModel,
    loader: DataLoader,
    issue_criterion: nn.CrossEntropyLoss,
    polarity_criterion: nn.CrossEntropyLoss,
    device: torch.device,
    use_amp: bool,
    verbose: bool = True,
    issue_loss_weight: float = 3.0,
) -> dict[str, any]:
    """Evaluate and return loss, macro-F1, and per-class diagnostics for both heads."""
    model.eval()
    total_loss = 0.0
    all_issue_preds, all_issue_labels = [], []
    all_pol_preds, all_pol_labels = [], []
    n_batches = 0

    for batch in loader:
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        issue_labels = batch["issue_label"].to(device)
        polarity_labels = batch["polarity_label"].to(device)

        with torch.amp.autocast(device_type=device.type, enabled=use_amp):
            outputs = model(input_ids, attention_mask)
            loss_issue = issue_criterion(outputs["issue_logits"], issue_labels)
            loss_polarity = polarity_criterion(outputs["polarity_logits"], polarity_labels)
            loss = (issue_loss_weight * loss_issue) + loss_polarity

        total_loss += loss.item()
        n_batches += 1

        all_issue_preds.extend(outputs["issue_logits"].argmax(dim=-1).cpu().tolist())
        all_issue_labels.extend(issue_labels.cpu().tolist())
        all_pol_preds.extend(outputs["polarity_logits"].argmax(dim=-1).cpu().tolist())
        all_pol_labels.extend(polarity_labels.cpu().tolist())

    # Macro-F1 via HF evaluate
    f1_metric = load_metric("f1")
    issue_f1 = f1_metric.compute(
        predictions=all_issue_preds, references=all_issue_labels, average="macro"
    )["f1"]
    polarity_f1 = f1_metric.compute(
        predictions=all_pol_preds, references=all_pol_labels, average="macro"
    )["f1"]

    # Per-class issue prediction distribution diagnostics
    total_val = len(all_issue_preds)
    pred_counts = Counter(all_issue_preds)
    true_counts = Counter(all_issue_labels)

    report_dict = classification_report(
        all_issue_labels,
        all_issue_preds,
        labels=list(range(NUM_ISSUES)),
        target_names=ISSUE_LABELS,
        output_dict=True,
        zero_division=0,
    )

    per_class_diag = {}
    unique_preds = len(pred_counts)

    if verbose:
        print(f"\n  Validation Issue Class Diagnostics ({unique_preds}/{NUM_ISSUES} classes predicted)")
        print(f"  {'Class Name':<30} {'Pred Count':>10} {'Pred %':>8} {'True Count':>11} {'F1':>8}")

    for idx, name in enumerate(ISSUE_LABELS):
        p_cnt = pred_counts.get(idx, 0)
        t_cnt = true_counts.get(idx, 0)
        p_pct = (p_cnt / total_val) * 100
        f1_val = report_dict[name]["f1-score"]

        per_class_diag[name] = {
            "predicted": p_cnt,
            "predicted_pct": round(p_pct, 2),
            "true": t_cnt,
            "f1": round(f1_val, 4),
        }

        if verbose:
            warn = " !!" if p_cnt == 0 else ""
            print(f"  {name:<30} {p_cnt:>10} {p_pct:>7.1f}% {t_cnt:>11} {f1_val:>8.4f}{warn}")

    if verbose:
        if unique_preds == 1:
            print("  [ALERT] Class collapse detected: Model predicted only 1 issue class!\n")
        else:
            print(f"  [OK] Prediction diversity verified across {unique_preds} issue classes.\n")

    return {
        "loss": total_loss / n_batches,
        "issue_macro_f1": issue_f1,
        "polarity_macro_f1": polarity_f1,
        "unique_issue_classes_predicted": unique_preds,
        "issue_class_diagnostics": per_class_diag,
    }


# Main


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Fine-tune DistilXLM-R for PID-ABSA")
    p.add_argument("--device", type=str, default="auto",
                   help="'cuda', 'cpu', or 'auto' (default: auto-detect)")
    p.add_argument("--epochs", type=int, default=5)
    p.add_argument("--batch-size", type=int, default=16,
                   help="Per-device batch size (16 for T4 16GB, 32 if memory allows)")
    p.add_argument("--lr", type=float, default=2e-5,
                   help="Learning rate for encoder/LoRA parameters (default: 2e-5)")
    p.add_argument("--head-lr", type=float, default=1e-3,
                   help="Learning rate for classification heads (default: 1e-3)")
    p.add_argument("--issue-loss-weight", type=float, default=3.0,
                   help="Multiplier for issue loss relative to polarity loss (default: 3.0)")
    p.add_argument("--warmup-ratio", type=float, default=0.1,
                   help="Fraction of total steps used for linear warmup")
    p.add_argument("--patience", type=int, default=2,
                   help="Early stopping patience (epochs without val macro-F1 improvement)")
    p.add_argument("--seed", type=int, default=GLOBAL_SEED)
    p.add_argument("--no-lora", action="store_true",
                   help="Full fine-tune (no LoRA). Only use with ample VRAM.")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    seed_everything(args.seed)

    # Device
    if args.device == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    else:
        device = torch.device(args.device)
    use_amp = device.type == "cuda"
    print(f"[CONFIG] Device: {device} | AMP: {use_amp}")

    # Tokenizer
    print(f"[INFO] Loading tokenizer: {MODEL_NAME}")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    # Datasets & loaders
    print("[INFO] Loading datasets...")
    train_ds = FeedbackDataset(TRAIN_CSV, tokenizer)
    val_ds = FeedbackDataset(VAL_CSV, tokenizer)

    train_loader = DataLoader(
        train_ds, batch_size=args.batch_size, shuffle=True,
        num_workers=0, pin_memory=(device.type == "cuda"),
    )
    val_loader = DataLoader(
        val_ds, batch_size=args.batch_size * 2, shuffle=False,
        num_workers=0, pin_memory=(device.type == "cuda"),
    )

    # Model
    print(f"[INFO] Building dual-head model on {MODEL_NAME}")
    model = DualHeadModel(MODEL_NAME, NUM_ISSUES, NUM_POLARITIES)

    if not args.no_lora:
        print("[INFO] Applying LoRA adapters to encoder (q/k/v/output.dense)...")
        model = apply_lora(model)
    else:
        print("[INFO] Full fine-tune mode (no LoRA)")

    model.to(device)

    # Class weights
    print("[INFO] Computing class weights...")
    issue_weights = compute_weights(train_ds.issue_ids, NUM_ISSUES, device)
    polarity_weights = compute_weights(train_ds.polarity_ids, NUM_POLARITIES, device)
    print(f"  Issue weights:    {issue_weights.cpu().tolist()}")
    print(f"  Polarity weights: {polarity_weights.cpu().tolist()}")

    issue_criterion = nn.CrossEntropyLoss(weight=issue_weights)
    polarity_criterion = nn.CrossEntropyLoss(weight=polarity_weights)

    # Optimizer + scheduler
    # Differential learning rates: higher LR for newly initialized heads, standard LR for encoder/LoRA
    head_params = list(model.issue_head.parameters()) + list(model.polarity_head.parameters())
    encoder_params = [p for n, p in model.named_parameters() if p.requires_grad and 'head' not in n]

    print(f"[INFO] Optimizer differential LRs: encoder={args.lr:.2e}, heads={args.head_lr:.2e}")
    print(f"[INFO] Multi-task loss weighting: total_loss = {args.issue_loss_weight} * issue_loss + polarity_loss")

    optimizer = torch.optim.AdamW([
        {"params": encoder_params, "lr": args.lr},
        {"params": head_params, "lr": args.head_lr},
    ], weight_decay=0.01)

    total_steps = len(train_loader) * args.epochs
    warmup_steps = int(total_steps * args.warmup_ratio)

    scheduler = torch.optim.lr_scheduler.LinearLR(
        optimizer,
        start_factor=1e-8 / args.lr,  # near-zero start
        end_factor=1.0,
        total_iters=warmup_steps,
    )
    # Chain: warmup → linear decay to 0
    scheduler = torch.optim.lr_scheduler.SequentialLR(
        optimizer,
        schedulers=[
            scheduler,
            torch.optim.lr_scheduler.LinearLR(
                optimizer,
                start_factor=1.0,
                end_factor=0.0,
                total_iters=total_steps - warmup_steps,
            ),
        ],
        milestones=[warmup_steps],
    )

    scaler = torch.amp.GradScaler() if use_amp else None

    # Save label mappings
    save_label_mappings()

    # Training loop with early stopping
    print(f"\nTraining: {args.epochs} epochs | encoder_lr={args.lr} | head_lr={args.head_lr}")
    print(f"  Batch={args.batch_size} | Issue Loss Weight={args.issue_loss_weight}")
    print(f"  Total steps: {total_steps} | Warmup: {warmup_steps}")
    print(f"  Early stopping patience: {args.patience} (on val issue macro-F1)\n")

    best_val_f1 = -1.0
    patience_counter = 0
    run_log: list[dict] = []

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()

        # Train
        train_metrics = train_one_epoch(
            model, train_loader, optimizer, scheduler,
            issue_criterion, polarity_criterion,
            device, scaler, use_amp,
            issue_loss_weight=args.issue_loss_weight,
        )

        # Validate
        val_metrics = evaluate(
            model, val_loader,
            issue_criterion, polarity_criterion,
            device, use_amp,
            issue_loss_weight=args.issue_loss_weight,
        )

        elapsed = time.time() - t0
        current_lr = scheduler.get_last_lr()[0]

        epoch_log = {
            "epoch": epoch,
            "train_loss": round(train_metrics["loss"], 4),
            "train_issue_loss": round(train_metrics["issue_loss"], 4),
            "train_polarity_loss": round(train_metrics["polarity_loss"], 4),
            "val_loss": round(val_metrics["loss"], 4),
            "val_issue_macro_f1": round(val_metrics["issue_macro_f1"], 4),
            "val_polarity_macro_f1": round(val_metrics["polarity_macro_f1"], 4),
            "val_unique_issue_classes_predicted": val_metrics["unique_issue_classes_predicted"],
            "val_issue_class_diagnostics": val_metrics["issue_class_diagnostics"],
            "lr": current_lr,
            "elapsed_s": round(elapsed, 1),
        }
        run_log.append(epoch_log)

        print(
            f"Epoch {epoch}/{args.epochs} "
            f"| train_loss={train_metrics['loss']:.4f} "
            f"| val_loss={val_metrics['loss']:.4f} "
            f"| val_issue_F1={val_metrics['issue_macro_f1']:.4f} "
            f"| val_pol_F1={val_metrics['polarity_macro_f1']:.4f} "
            f"| lr={current_lr:.2e} "
            f"| {elapsed:.0f}s"
        )

        # Checkpoint best model
        if val_metrics["issue_macro_f1"] > best_val_f1:
            best_val_f1 = val_metrics["issue_macro_f1"]
            patience_counter = 0
            ckpt_path = CHECKPOINTS_DIR / "best_model.pt"
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_issue_macro_f1": best_val_f1,
                "val_polarity_macro_f1": val_metrics["polarity_macro_f1"],
                "args": vars(args),
            }, ckpt_path)
            print(f"  → New best! Saved checkpoint → {ckpt_path}")
        else:
            patience_counter += 1
            print(f"  → No improvement ({patience_counter}/{args.patience})")
            if patience_counter >= args.patience:
                print(f"[EARLY STOP] No improvement for {args.patience} epochs. Stopping.")
                break

    # Save run report
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    report = {
        "run_id": f"run_{timestamp}",
        "model": MODEL_NAME,
        "seed": args.seed,
        "device": str(device),
        "use_amp": use_amp,
        "lora": not args.no_lora,
        "hyperparameters": {
            "epochs_planned": args.epochs,
            "epochs_completed": len(run_log),
            "batch_size": args.batch_size,
            "lr": args.lr,
            "warmup_ratio": args.warmup_ratio,
            "max_len": MAX_LEN,
            "patience": args.patience,
        },
        "best_val_issue_macro_f1": best_val_f1,
        "epoch_logs": run_log,
    }

    report_path = REPORTS_DIR / f"training_run_{timestamp}.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"\n[INFO] Run report saved → {report_path}")
    print(f"[DONE] Best val issue macro-F1: {best_val_f1:.4f}")


if __name__ == "__main__":
    main()
