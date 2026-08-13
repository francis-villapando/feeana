from __future__ import annotations

import ast
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE_PATH = ROOT / "scripts" / "training" / "preprocess.py"
OUTPUT_PATH = ROOT / "src" / "lib" / "algorithm" / "data" / "feedback-lexicon.json"

source = SOURCE_PATH.read_text(encoding="utf-8")
module = ast.parse(source)

abbreviations = None
seed_vocabulary = None

for node in module.body:
    if not isinstance(node, ast.Assign):
        continue
    for target in node.targets:
        if isinstance(target, ast.Name):
            if target.id == "ABBREVIATION_MAP":
                abbreviations = ast.literal_eval(node.value)
            elif target.id == "SEED_VOCABULARY":
                seed_vocabulary = ast.literal_eval(node.value)

if abbreviations is None or seed_vocabulary is None:
    raise SystemExit("Unable to locate preprocessing lexicon definitions")

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH.write_text(
    json.dumps(
        {
            "abbreviations": abbreviations,
            "seed_vocabulary": sorted(seed_vocabulary),
        },
        ensure_ascii=False,
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)

print(f"Wrote {OUTPUT_PATH}")
