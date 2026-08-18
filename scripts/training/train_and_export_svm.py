"""
Trains and exports the SVM baseline for PID-ABSA comparison.

Fits two single-output pipelines (15-way issue, 3-way polarity) on the same
parity-cleaned text consumed by the transformer fine-tunes (cleaned_text from
train.csv), selects hyperparameters via a small grid search on val.csv by issue
macro-F1, then:
  - persists the fitted pipelines to checkpoints/svm/ (joblib)
  - writes browser-ready ONNX models to public/models/trained/svm/ via skl2onnx
  - writes a training run report to reports/svm_training_run_<timestamp>.json,
    mirroring finetune.py's report schema (with SVM-appropriate hyperparameters
    and per-head val metrics for both issue and polarity)

ONNX output contract: both models emit `label` (int64 class index) and
`probabilities` (float32 raw decision scores). skl2onnx does not embed class
names for LinearSVC, so consumers decode the index via label_mappings.json
written alongside the models (same decode-by-index pattern as the transformer
exports).

Usage:
  python train_and_export_svm.py
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import onnxruntime as ort
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, f1_score
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import StringTensorType

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = SCRIPT_DIR / "data"
CHECKPOINTS_DIR = SCRIPT_DIR / "checkpoints" / "svm"
REPORTS_DIR = SCRIPT_DIR / "reports"
PUBLIC_SVM_DIR = ROOT / "public" / "models" / "trained" / "svm"

TRAIN_CSV = DATA_DIR / "train.csv"
VAL_CSV = DATA_DIR / "val.csv"

TARGET_COLUMNS = ["issue", "polarity"]

# Grid search candidates (18 combinations). The best config, chosen by issue
# macro-F1 on val, is applied to both heads.
GRID_NGRAM_RANGES = [(1, 1), (1, 2), (1, 3)]
GRID_MIN_DFS = [1, 2]
GRID_C_VALUES = [0.1, 1.0, 3.0]

ONNX_FILENAMES = {
    "issue": "issue.onnx",
    "polarity": "polarity.onnx",
}

SMOKE_TEST_SAMPLES = [
    "mabilis masyado ang lesson hindi makasabay",
    "the prof is always late and angry",
    "everything is fine",
]


def build_pipeline(config: dict) -> Pipeline:
    """Builds the TF-IDF + LinearSVC pipeline for the given grid config."""
    return Pipeline([
        ("tfidf", TfidfVectorizer(
            lowercase=True,
            ngram_range=config["ngram_range"],
            min_df=config["min_df"],
        )),
        ("clf", LinearSVC(
            C=config["C"],
            class_weight="balanced",
            dual="auto",
        )),
    ])


def train_pipeline(train_df: pd.DataFrame, config: dict, target: str) -> Pipeline:
    """Fits one pipeline on train.csv for the given target column."""
    pipeline = build_pipeline(config)
    pipeline.fit(train_df["cleaned_text"], train_df[target])
    return pipeline


def grid_search(train_df: pd.DataFrame, val_df: pd.DataFrame) -> tuple[dict, float, list[dict]]:
    """Returns (best_config, best_f1, grid_search_log) by issue macro-F1 on val."""
    best_config = None
    best_f1 = -1.0
    grid_search_log: list[dict] = []

    for ngram_range in GRID_NGRAM_RANGES:
        for min_df in GRID_MIN_DFS:
            for c_value in GRID_C_VALUES:
                config = {"ngram_range": ngram_range, "min_df": min_df, "C": c_value}
                pipeline = train_pipeline(train_df, config, "issue")
                preds = pipeline.predict(val_df["cleaned_text"])
                macro_f1 = f1_score(val_df["issue"], preds, average="macro", zero_division=0)
                grid_search_log.append({
                    "ngram_range": str(ngram_range),
                    "min_df": min_df,
                    "C": c_value,
                    "val_issue_macro_f1": round(macro_f1, 4),
                })
                print(f"  ngram={ngram_range} min_df={min_df} C={c_value} -> val issue macro-F1={macro_f1:.4f}")
                if macro_f1 > best_f1:
                    best_f1 = macro_f1
                    best_config = config

    print(f"[GRID] Best config: {best_config} (val issue macro-F1: {best_f1:.4f})")
    return best_config, best_f1, grid_search_log


def save_checkpoint(pipeline: Pipeline, target: str) -> Path:
    """Persists the fitted pipeline to checkpoints/svm/."""
    checkpoint_path = CHECKPOINTS_DIR / f"{target}_pipeline.pkl"
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, checkpoint_path)
    print(f"[CHECKPOINT] Saved {target} pipeline -> {checkpoint_path}")
    return checkpoint_path


def save_label_mappings(pipelines: dict[str, Pipeline]) -> None:
    """Writes id2label/label2id for both heads, mirroring the transformer schema."""
    mapping = {}
    for target, pipeline in pipelines.items():
        classes = list(pipeline.classes_)
        mapping[target] = {
            "id2label": {str(idx): label for idx, label in enumerate(classes)},
            "label2id": {label: str(idx) for idx, label in enumerate(classes)},
            "num_labels": len(classes),
        }

    serialized = json.dumps(mapping, indent=2, ensure_ascii=False) + "\n"
    for out_dir in (CHECKPOINTS_DIR, PUBLIC_SVM_DIR):
        mappings_path = out_dir / "label_mappings.json"
        mappings_path.parent.mkdir(parents=True, exist_ok=True)
        mappings_path.write_text(serialized, encoding="utf-8")
        print(f"[CHECKPOINT] Saved label mappings -> {mappings_path}")


def export_pipeline(pipeline: Pipeline, target: str) -> Path:
    """Converts a fitted pipeline to ONNX and writes it to public/models/trained/svm/."""
    model = convert_sklearn(
        pipeline,
        initial_types=[("string_input", StringTensorType([None, 1]))],
        target_opset=18,
        options={"nocl": True},
    )
    onnx_path = PUBLIC_SVM_DIR / ONNX_FILENAMES[target]
    onnx_path.parent.mkdir(parents=True, exist_ok=True)
    with open(onnx_path, "wb") as handle:
        handle.write(model.SerializeToString())
    print(f"[EXPORT] Saved {target} ONNX model -> {onnx_path}")
    return onnx_path


def smoke_test(onnx_path: Path, pipeline: Pipeline) -> None:
    """Runs inference through the exported ONNX model to validate output shapes."""
    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    num_labels = len(pipeline.classes_)
    num_samples = len(SMOKE_TEST_SAMPLES)

    outputs = session.run(
        None,
        {"string_input": np.array([[sample] for sample in SMOKE_TEST_SAMPLES], dtype=object)},
    )
    label, probabilities = outputs

    assert label.shape == (num_samples,), f"Unexpected label shape: {label.shape}"
    assert probabilities.shape == (num_samples, num_labels), (
        f"Unexpected probabilities shape: {probabilities.shape}"
    )
    decoded = [pipeline.classes_[int(idx)] for idx in label]
    print(f"[SMOKE] {onnx_path.name}: label={label.tolist()} decoded={decoded}")


def compute_val_metrics(pipeline: Pipeline, val_df: pd.DataFrame, target: str) -> dict:
    """Scores the fitted pipeline on val.csv for the given target column."""
    preds = pipeline.predict(val_df["cleaned_text"])
    return {
        "samples": len(val_df),
        "macro_f1": round(
            f1_score(val_df[target], preds, average="macro", zero_division=0), 4
        ),
        "accuracy": round(accuracy_score(val_df[target], preds), 4),
    }


def save_run_report(
    config: dict,
    best_f1: float,
    grid_search_log: list[dict],
    pipelines: dict[str, Pipeline],
    val_df: pd.DataFrame,
    artifacts: dict[str, list[Path]],
) -> Path:
    """Writes a training run report mirroring finetune.py's schema to reports/."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    report = {
        "run_id": f"run_{timestamp}",
        "model": "svm",
        "seed": None,
        "device": "cpu",
        "use_amp": False,
        "lora": False,
        "hyperparameters": {
            "pipeline": "TfidfVectorizer + LinearSVC",
            "best_config": {
                "ngram_range": str(config["ngram_range"]),
                "min_df": config["min_df"],
                "C": config["C"],
            },
            "tfidf": {"lowercase": True, "stop_words": None},
            "linear_svc": {"class_weight": "balanced", "dual": "auto"},
        },
        "best_val_issue_macro_f1": round(best_f1, 4),
        "val_metrics": {
            target: compute_val_metrics(pipeline, val_df, target)
            for target, pipeline in pipelines.items()
        },
        "grid_search_log": grid_search_log,
        "artifacts": {
            "checkpoints": [str(path) for path in artifacts["checkpoints"]],
            "onnx": [str(path) for path in artifacts["onnx"]],
            "label_mappings": [str(path) for path in artifacts["label_mappings"]],
        },
    }

    report_path = REPORTS_DIR / f"svm_training_run_{timestamp}.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, ensure_ascii=False)
    print(f"[INFO] Run report saved -> {report_path}")
    return report_path


def main() -> None:
    train_df = pd.read_csv(TRAIN_CSV)
    val_df = pd.read_csv(VAL_CSV)
    print(f"[INFO] Train rows: {len(train_df)} | Val rows: {len(val_df)}")

    config, best_f1, grid_search_log = grid_search(train_df, val_df)

    pipelines = {}
    checkpoint_paths = {}
    for target in TARGET_COLUMNS:
        print(f"[INFO] Fitting {target} pipeline on train.csv")
        pipeline = train_pipeline(train_df, config, target)
        pipelines[target] = pipeline
        checkpoint_paths[target] = save_checkpoint(pipeline, target)

    save_label_mappings(pipelines)

    onnx_paths = {}
    for target, pipeline in pipelines.items():
        onnx_paths[target] = export_pipeline(pipeline, target)
        smoke_test(onnx_paths[target], pipeline)

    save_run_report(
        config=config,
        best_f1=best_f1,
        grid_search_log=grid_search_log,
        pipelines=pipelines,
        val_df=val_df,
        artifacts={
            "checkpoints": list(checkpoint_paths.values()),
            "onnx": list(onnx_paths.values()),
            "label_mappings": [
                CHECKPOINTS_DIR / "label_mappings.json",
                PUBLIC_SVM_DIR / "label_mappings.json",
            ],
        },
    )

    print("[DONE] SVM training and export complete.")


if __name__ == "__main__":
    main()
