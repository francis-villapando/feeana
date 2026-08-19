"""
Trains and exports the SVM baseline for PID-ABSA comparison.

Fits a shared TF-IDF featurizer on the parity-cleaned text consumed by the
transformer fine-tunes (cleaned_text from train.csv) and then fits two
LinearSVC heads (15-way issue, 3-way polarity) on the SAME feature matrix,
so both tasks share a single feature extraction (mirroring the transformers'
shared-encoder structure). Hyperparameters are selected via a small grid
search on val.csv by issue macro-F1, then:
  - persists the fitted pipelines to checkpoints/svm/ (joblib)
  - writes a single browser-ready, dual-head ONNX model to
    public/models/trained/svm/svm.onnx: one string_input -> shared TF-IDF
    -> two parallel linear heads -> four outputs, so both tasks run in a
    single session.run(), a 1:1 match with the transformer baselines
  - writes a training run report to reports/svm_training_run_<timestamp>.json,
    mirroring finetune.py's report schema (with SVM-appropriate hyperparameters
    and per-head val metrics for both issue and polarity)

ONNX output contract: the combined model emits, for both heads, a `label`
(int64 class index) and `probabilities` (float32 raw decision scores).
skl2onnx does not embed class names for LinearSVC, so consumers decode the
index via label_mappings.json written alongside the model (same
decode-by-index pattern as the transformer exports).

Usage:
  python train_and_export_svm.py
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import onnx
import onnxruntime as ort
import pandas as pd
from onnx import TensorProto, helper, numpy_helper
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

# The best config, chosen by issue macro-F1 on val, is applied to the shared
# featurizer and both heads.
GRID_NGRAM_RANGES = [(1, 1), (1, 2), (1, 3)]
GRID_MIN_DFS = [1, 2]
GRID_C_VALUES = [0.1, 1.0, 3.0]

ONNX_FILENAME = "svm.onnx"

SMOKE_TEST_SAMPLES = [
    "mabilis masyado ang lesson hindi makasabay",
    "the prof is always late and angry",
    "everything is fine",
]


def build_featurizer(config: dict) -> TfidfVectorizer:
    """Builds the shared TF-IDF featurizer for the given grid config."""
    return TfidfVectorizer(
        lowercase=True,
        ngram_range=config["ngram_range"],
        min_df=config["min_df"],
    )


def build_head(config: dict) -> LinearSVC:
    """Builds a LinearSVC head for the given grid config."""
    return LinearSVC(
        C=config["C"],
        class_weight="balanced",
        dual="auto",
    )


def grid_search(train_df: pd.DataFrame, val_df: pd.DataFrame) -> tuple[dict, float, list[dict]]:
    """Returns (best_config, best_f1, grid_search_log) by issue macro-F1 on val.

    Each candidate fits a shared TF-IDF featurizer on train.csv and an issue
    head on the resulting matrix, mirroring the final training structure.
    """
    best_config = None
    best_f1 = -1.0
    grid_search_log: list[dict] = []

    for ngram_range in GRID_NGRAM_RANGES:
        for min_df in GRID_MIN_DFS:
            for c_value in GRID_C_VALUES:
                config = {"ngram_range": ngram_range, "min_df": min_df, "C": c_value}
                tfidf = build_featurizer(config)
                X_train = tfidf.fit_transform(train_df["cleaned_text"])
                clf = build_head(config)
                clf.fit(X_train, train_df["issue"])
                preds = clf.predict(tfidf.transform(val_df["cleaned_text"]))
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


def train_pipelines(
    train_df: pd.DataFrame, config: dict
) -> tuple[TfidfVectorizer, dict[str, Pipeline]]:
    """Fits the shared TF-IDF featurizer and one LinearSVC head per target.

    Both heads consume the same feature matrix, so the exported ONNX model
    computes the featurization exactly once per sample. Returns
    (shared_featurizer, {target: Pipeline}).
    """
    shared_tfidf = build_featurizer(config)
    X_train = shared_tfidf.fit_transform(train_df["cleaned_text"])

    pipelines: dict[str, Pipeline] = {}
    for target in TARGET_COLUMNS:
        clf = build_head(config)
        clf.fit(X_train, train_df[target])
        pipelines[target] = Pipeline([("tfidf", shared_tfidf), ("clf", clf)])
        print(f"[INFO] Fitted {target} head on shared feature matrix ({X_train.shape[1]} features)")
    return shared_tfidf, pipelines


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


def export_combined_onnx(pipelines: dict[str, Pipeline]) -> Path:
    """Builds a single dual-head ONNX model and writes it to public/models/trained/svm/.

    The graph is composed from the converted shared TF-IDF subgraph plus two
    Gemm heads (LinearSVC is linear, so scores = X @ coef_.T + intercept_) and
    an ArgMax per head to emit the label indices. Outputs:
      issue_label / polarity_label (int64 [N]),
      issue_probabilities / polarity_probabilities (float32 [N, num_labels]).
    """
    tfidf = pipelines["issue"].named_steps["tfidf"]
    issue_head = pipelines["issue"].named_steps["clf"]
    polarity_head = pipelines["polarity"].named_steps["clf"]

    tfidf_model = convert_sklearn(
        Pipeline([("tfidf", tfidf)]),
        initial_types=[("string_input", StringTensorType([None, 1]))],
        target_opset=18,
    )
    sub_graph = tfidf_model.graph
    features_name = sub_graph.output[0].name

    num_issue = len(issue_head.classes_)
    num_polarity = len(polarity_head.classes_)

    nodes = list(sub_graph.node) + [
        helper.make_node(
            "Gemm",
            [features_name, "issue_coef", "issue_intercept"],
            ["issue_probabilities"],
            alpha=1.0,
            beta=1.0,
            transB=1,
        ),
        helper.make_node(
            "Gemm",
            [features_name, "polarity_coef", "polarity_intercept"],
            ["polarity_probabilities"],
            alpha=1.0,
            beta=1.0,
            transB=1,
        ),
        helper.make_node("ArgMax", ["issue_probabilities"], ["issue_label"], axis=-1, keepdims=0),
        helper.make_node(
            "ArgMax", ["polarity_probabilities"], ["polarity_label"], axis=-1, keepdims=0
        ),
    ]

    initializers = list(sub_graph.initializer) + [
        numpy_helper.from_array(issue_head.coef_.astype(np.float32), name="issue_coef"),
        numpy_helper.from_array(issue_head.intercept_.astype(np.float32), name="issue_intercept"),
        numpy_helper.from_array(polarity_head.coef_.astype(np.float32), name="polarity_coef"),
        numpy_helper.from_array(
            polarity_head.intercept_.astype(np.float32), name="polarity_intercept"
        ),
    ]

    graph = helper.make_graph(
        nodes,
        "svm_dual_head",
        list(sub_graph.input),
        [
            helper.make_tensor_value_info("issue_label", TensorProto.INT64, [None]),
            helper.make_tensor_value_info(
                "issue_probabilities", TensorProto.FLOAT, [None, num_issue]
            ),
            helper.make_tensor_value_info("polarity_label", TensorProto.INT64, [None]),
            helper.make_tensor_value_info(
                "polarity_probabilities", TensorProto.FLOAT, [None, num_polarity]
            ),
        ],
        initializer=initializers,
    )
    model = helper.make_model(
        graph,
        opset_imports=list(tfidf_model.opset_import),
        ir_version=tfidf_model.ir_version,
    )
    onnx.checker.check_model(model)

    onnx_path = PUBLIC_SVM_DIR / ONNX_FILENAME
    onnx_path.parent.mkdir(parents=True, exist_ok=True)
    with open(onnx_path, "wb") as handle:
        handle.write(model.SerializeToString())
    print(f"[EXPORT] Saved combined dual-head SVM ONNX -> {onnx_path}")
    return onnx_path


def smoke_test(onnx_path: Path, pipelines: dict[str, Pipeline]) -> None:
    """Runs inference through the exported ONNX model to validate output shapes.

    Also asserts each ONNX label matches the fitted sklearn head's prediction
    for the same sample, proving the hand-composed graph reproduces sklearn.
    """
    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    num_samples = len(SMOKE_TEST_SAMPLES)

    outputs = session.run(
        None,
        {"string_input": np.array([[sample] for sample in SMOKE_TEST_SAMPLES], dtype=object)},
    )
    issue_label, issue_probs, polarity_label, polarity_probs = outputs

    assert issue_label.shape == (num_samples,), f"Unexpected issue label shape: {issue_label.shape}"
    assert polarity_label.shape == (num_samples,), (
        f"Unexpected polarity label shape: {polarity_label.shape}"
    )
    assert issue_probs.shape == (num_samples, len(pipelines["issue"].classes_)), (
        f"Unexpected issue probabilities shape: {issue_probs.shape}"
    )
    assert polarity_probs.shape == (num_samples, len(pipelines["polarity"].classes_)), (
        f"Unexpected polarity probabilities shape: {polarity_probs.shape}"
    )

    for i, sample in enumerate(SMOKE_TEST_SAMPLES):
        expected_issue = pipelines["issue"].predict([sample])[0]
        expected_polarity = pipelines["polarity"].predict([sample])[0]
        assert pipelines["issue"].classes_[int(issue_label[i])] == expected_issue, (
            f"ONNX issue label {int(issue_label[i])} != sklearn {expected_issue}"
        )
        assert pipelines["polarity"].classes_[int(polarity_label[i])] == expected_polarity, (
            f"ONNX polarity label {int(polarity_label[i])} != sklearn {expected_polarity}"
        )

    decoded_issue = [pipelines["issue"].classes_[int(idx)] for idx in issue_label]
    decoded_polarity = [pipelines["polarity"].classes_[int(idx)] for idx in polarity_label]
    print(
        f"[SMOKE] {onnx_path.name}: issue={decoded_issue} polarity={decoded_polarity} "
        f"(all labels match sklearn)"
    )


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
        "hyperparameters": {
            "pipeline": "shared TfidfVectorizer + dual LinearSVC heads (single ONNX)",
            "best_config": {
                "ngram_range": str(config["ngram_range"]),
                "min_df": config["min_df"],
                "C": config["C"],
            },
            "tfidf": {"lowercase": True, "stop_words": None, "shared": True},
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

    _, pipelines = train_pipelines(train_df, config)

    checkpoint_paths = {
        target: save_checkpoint(pipeline, target)
        for target, pipeline in pipelines.items()
    }

    save_label_mappings(pipelines)

    onnx_path = export_combined_onnx(pipelines)
    smoke_test(onnx_path, pipelines)

    save_run_report(
        config=config,
        best_f1=best_f1,
        grid_search_log=grid_search_log,
        pipelines=pipelines,
        val_df=val_df,
        artifacts={
            "checkpoints": list(checkpoint_paths.values()),
            "onnx": [onnx_path],
            "label_mappings": [
                CHECKPOINTS_DIR / "label_mappings.json",
                PUBLIC_SVM_DIR / "label_mappings.json",
            ],
        },
    )

    print("[DONE] SVM training and export complete.")


if __name__ == "__main__":
    main()
