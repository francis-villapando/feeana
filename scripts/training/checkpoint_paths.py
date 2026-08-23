"""
Shared checkpoint / export path resolution for the PID-ABSA training pipeline.

Model assets are organised per base-model tag (folder-per-model), e.g.:

    checkpoints/distilxlmr/best_model.pt      checkpoints/mbert/best_model.pt
    checkpoints/distilxlmr/label_mappings.json
    exports/distilxlmr/int8.onnx              exports/mbert/int8.onnx

Legacy flat names (checkpoints/best_model.pt, checkpoints/{tag}_best_model.pt)
are still supported as fallbacks so older checkpoints keep working.
"""

from __future__ import annotations

from pathlib import Path

CHECKPOINTS_DIR = Path(__file__).resolve().parent / "checkpoints"
DEFAULT_MODEL_NAME = "nreimers/mMiniLMv2-L12-H384-distilled-from-XLMR-Large"
TAG_BY_MODEL_NAME: dict[str, str] = {
    DEFAULT_MODEL_NAME: "distilxlmr",
    "bert-base-multilingual-cased": "mbert",
}


def resolve_tag(model_name: str, cli_tag: str | None = None) -> str:
    """Resolve tag: explicit --tag > known model mapping > slug fallback."""
    if cli_tag:
        return cli_tag
    return TAG_BY_MODEL_NAME.get(
        model_name, model_name.split("/")[-1].replace(".", "-").lower()
    )


def resolve_checkpoint_paths(
    tag: str, cli_ckpt: Path | None = None, cli_label_mappings: Path | None = None
) -> tuple[Path, Path]:
    """Resolve checkpoint + label-mappings paths: explicit flag > folder > prefixed > legacy."""
    folder_ckpt = CHECKPOINTS_DIR / tag / "best_model.pt"
    folder_lm = CHECKPOINTS_DIR / tag / "label_mappings.json"
    prefixed_ckpt = CHECKPOINTS_DIR / f"{tag}_best_model.pt"
    prefixed_lm = CHECKPOINTS_DIR / f"{tag}_label_mappings.json"
    legacy_ckpt = CHECKPOINTS_DIR / "best_model.pt"
    legacy_lm = CHECKPOINTS_DIR / "label_mappings.json"

    ckpt = (
        cli_ckpt
        or (folder_ckpt if folder_ckpt.exists() else None)
        or (prefixed_ckpt if prefixed_ckpt.exists() else None)
        or legacy_ckpt
    )
    label_mappings = (
        cli_label_mappings
        or (folder_lm if folder_lm.exists() else None)
        or (prefixed_lm if prefixed_lm.exists() else None)
        or legacy_lm
    )
    return ckpt, label_mappings