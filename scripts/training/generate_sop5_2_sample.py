"""
Generate a fixed 50-row benchmark sample for SOP 5.2 (operational efficiency)
evaluation, stratified proportionally by issue tag.

This script is run ONCE to produce a reusable artifact consumed by all three
models (DistilXLM-R, mBERT, SVM) across all repeated benchmark runs.

Source:   scripts/training/data/test.csv (1031 rows, split_data.py output)
Output:   scripts/training/data/sop5-2-benchmark-sample.csv
Log:      scripts/training/reports/sop5-2-sample-log.md

Method:   Proportional stratified sampling by `issue` column, seed=42.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

# Paths
SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR / "data"
REPORTS_DIR = SCRIPT_DIR / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

SOURCE_CSV = DATA_DIR / "test.csv"
OUTPUT_CSV = DATA_DIR / "sop5-2-benchmark-sample.csv"
LOG_FILE = REPORTS_DIR / "sop5-2-sample-log.md"

SAMPLE_SIZE = 50
SEED = 42
TAG_COL = "issue"


# Helpers
def largest_remainder_allocation(
    proportions: dict[str, float], total: int
) -> dict[str, int]:
    """Allocate `total` seats across tags using the largest-remainder method.

    Guarantees:
      - Every tag with at least 1 row in the source gets >= 1 seat if
        proportionally possible (fractional remainders used as tiebreaker).
      - Final sum is exactly `total`.
    """
    # Floor allocation
    raw = {tag: p * total for tag, p in proportions.items()}
    floored = {tag: int(math.floor(v)) for tag, v in raw.items()}
    remainders = {tag: raw[tag] - floored[tag] for tag in raw}

    allocated = sum(floored.values())
    deficit = total - allocated

    # Distribute remaining seats to tags with largest fractional remainders
    sorted_tags = sorted(remainders, key=lambda t: remainders[t], reverse=True)
    for tag in sorted_tags[:deficit]:
        floored[tag] += 1

    return floored


# 1. Load
if not SOURCE_CSV.exists():
    raise FileNotFoundError(f"Source file not found: {SOURCE_CSV}")

df = pd.read_csv(SOURCE_CSV)
total_rows = len(df)

print(f"Source file: {SOURCE_CSV.name}")
print(f"Total rows:  {total_rows}")
print(f"Columns:     {list(df.columns)}")
print()

# Validate the tag column exists
if TAG_COL not in df.columns:
    raise KeyError(
        f"Expected column '{TAG_COL}' not found. Available: {list(df.columns)}"
    )

# Full dataset tag distribution
full_tag_counts = df[TAG_COL].value_counts()
full_tag_pcts = df[TAG_COL].value_counts(normalize=True) * 100

print("=" * 50)
print(f"FULL DATASET - '{TAG_COL}' distribution")
print("=" * 50)
print(f"{'Tag':<30} {'Count':>6} {'Pct':>7}")
print("-" * 50)
for tag in full_tag_counts.index:
    print(f"  {tag:<28} {full_tag_counts[tag]:>6} {full_tag_pcts[tag]:>6.1f}%")
print(f"  {'TOTAL':<28} {total_rows:>6} {'100.0%':>7}")
print()


# 2. Stratify by issue tag (proportional allocation to 50 rows)
proportions = full_tag_counts / total_rows
allocation = largest_remainder_allocation(proportions.to_dict(), SAMPLE_SIZE)

print("=" * 50)
print("ALLOCATION - target count per tag (sum = 50)")
print("=" * 50)
print(f"{'Tag':<30} {'Full %':>7} {'Alloc':>6}")
print("-" * 50)
for tag in sorted(allocation, key=lambda t: allocation[t], reverse=True):
    print(f"  {tag:<28} {proportions[tag]*100:>6.1f}% {allocation[tag]:>6}")
print(f"  {'TOTAL':<28} {'':>7} {sum(allocation.values()):>6}")
print()

# Validate total
if sum(allocation.values()) != SAMPLE_SIZE:
    raise RuntimeError(
        f"Allocation bug: sum is {sum(allocation.values())}, expected {SAMPLE_SIZE}"
    )

# Check for excluded tags
source_tags = set(df[TAG_COL].unique())
allocated_tags = set(allocation.keys())
excluded = source_tags - allocated_tags
if excluded:
    print(f"[WARN] EXCLUDED TAGS (space constraint): {excluded}")
else:
    print("[OK] All tags in the source dataset received at least 1 seat.")
print()


# 3. Random sample within each stratum (seed = 42)
samples: list[pd.DataFrame] = []
print("=" * 50)
print("SAMPLING - per-tag sample sizes")
print("=" * 50)

for tag in sorted(allocation):
    target_count = allocation[tag]
    tag_subset = df[df[TAG_COL] == tag]

    if len(tag_subset) < target_count:
        raise ValueError(
            f"Tag '{tag}' has {len(tag_subset)} rows but needs {target_count}. "
            f"Cannot sample without replacement."
        )

    sampled = tag_subset.sample(n=target_count, random_state=SEED)
    samples.append(sampled)
    print(f"  {tag:<28} available={len(tag_subset):<5}  sampled={target_count}")

print()


# 4. Assemble and validate
sample_df = pd.concat(samples, ignore_index=True)

# Shuffle so tags aren't in allocation order (cosmetic, reproducible)
sample_df = sample_df.sample(frac=1, random_state=SEED).reset_index(drop=True)

# Assert row count
if len(sample_df) != SAMPLE_SIZE:
    print("DIAGNOSTICS:")
    print(f"  Expected rows: {SAMPLE_SIZE}")
    print(f"  Actual rows:   {len(sample_df)}")
    print(f"  Per-tag allocation: {allocation}")
    raise AssertionError(
        f"Final sample has {len(sample_df)} rows, expected {SAMPLE_SIZE}"
    )

print(f"[OK] Final sample: {len(sample_df)} rows (assertion passed)")
print()

# Comparison tables
sample_tag_counts = sample_df[TAG_COL].value_counts()
sample_tag_pcts = sample_df[TAG_COL].value_counts(normalize=True) * 100

all_tags = sorted(set(full_tag_counts.index) | set(sample_tag_counts.index))

print("=" * 60)
print("COMPARISON - issue tag distribution (%)")
print("=" * 60)
print(f"  {'Tag':<30} {'Full %':>7} {'Sample %':>9}")
print("  " + "-" * 50)
for tag in all_tags:
    fp = full_tag_pcts.get(tag, 0.0)
    sp = sample_tag_pcts.get(tag, 0.0)
    print(f"  {tag:<30} {fp:>6.1f}% {sp:>8.1f}%")
print()

# Source distribution
full_src_pcts = df["source"].value_counts(normalize=True) * 100
sample_src_pcts = sample_df["source"].value_counts(normalize=True) * 100
all_src = sorted(set(full_src_pcts.index) | set(sample_src_pcts.index))

print("=" * 60)
print("COMPARISON - source distribution (%)")
print("=" * 60)
print(f"  {'Source':<30} {'Full %':>7} {'Sample %':>9}")
print("  " + "-" * 50)
for src in all_src:
    fp = full_src_pcts.get(src, 0.0)
    sp = sample_src_pcts.get(src, 0.0)
    print(f"  {src:<30} {fp:>6.1f}% {sp:>8.1f}%")
print()

# Language distribution
full_lang_pcts = df["language"].value_counts(normalize=True) * 100
sample_lang_pcts = sample_df["language"].value_counts(normalize=True) * 100
all_lang = sorted(set(full_lang_pcts.index) | set(sample_lang_pcts.index))

print("=" * 60)
print("COMPARISON - language distribution (%)")
print("=" * 60)
print(f"  {'Language':<30} {'Full %':>7} {'Sample %':>9}")
print("  " + "-" * 50)
for lang in all_lang:
    fp = full_lang_pcts.get(lang, 0.0)
    sp = sample_lang_pcts.get(lang, 0.0)
    print(f"  {lang:<30} {fp:>6.1f}% {sp:>8.1f}%")
print()

# Check for tags with zero representation in the sample
zero_tags = [tag for tag in all_tags if sample_tag_counts.get(tag, 0) == 0]
if zero_tags:
    print(f"[WARN] TAGS WITH ZERO SAMPLE REPRESENTATION: {zero_tags}")
else:
    print("[OK] All source tags have at least 1 representative in the sample.")
print()


# 5. Export
sample_df.to_csv(OUTPUT_CSV, index=False)
print(f"[OK] Written: {OUTPUT_CSV}")
print(f"  Rows: {len(sample_df)}  |  Columns: {list(sample_df.columns)}")
print()


# 6. Reproducibility log
now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
log_content = f"""# SOP 5.2 Benchmark Sample - Reproducibility Log

| Field | Value |
|---|---|
| **Generated** | {now} |
| **Source file** | `scripts/training/data/test.csv` |
| **Source rows** | {total_rows} |
| **Output file** | `scripts/training/data/sop5-2-benchmark-sample.csv` |
| **Output rows** | {SAMPLE_SIZE} |
| **Random seed** | {SEED} |
| **Sampling method** | Proportional stratified sampling by `{TAG_COL}` column, largest-remainder rounding, `pd.DataFrame.sample(random_state={SEED})` within each stratum |
| **Constraint** | No forced balancing on `source` or `language` - sampled naturally within each tag stratum |

## Per-tag allocation

| Tag | Full dataset % | Allocated rows |
|---|---|---|
"""

for tag in sorted(all_tags):
    fp = full_tag_pcts.get(tag, 0.0)
    alloc = allocation.get(tag, 0)
    log_content += f"| {tag} | {fp:.1f}% | {alloc} |\n"

log_content += f"| **TOTAL** | **100.0%** | **{SAMPLE_SIZE}** |\n"

if excluded:
    log_content += f"\n## Excluded tags\n\nThe following tags were excluded due to sample-size constraints: {excluded}\n"

log_content += f"""
## Runner notes

- Script: `scripts/training/generate_sop5_2_sample.py`
- Run this script **once** to produce the fixed artifact.
- All three models (DistilXLM-R, mBERT, SVM) consume `sop5-2-benchmark-sample.csv` as-is.
- Do not re-sample; the output is a reproducible, seeded artifact.
"""

LOG_FILE.write_text(log_content, encoding="utf-8")
print(f"[OK] Reproducibility log: {LOG_FILE}")
print()
print("Done. Use sop5-2-benchmark-sample.csv for all SOP 5.2 benchmark runs.")
