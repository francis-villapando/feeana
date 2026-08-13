"""
Exploratory Data Analysis (EDA) script for Feeana PID-ABSA Dataset.
Analyzes issue, source, polarity distributions, token length distribution,
and checks for near-duplicates across sources.
Generates scripts/training/reports/eda.md.
"""

import os
import pandas as pd
import numpy as np
from collections import Counter
from transformers import AutoTokenizer
from preprocess import preprocess

DATA_PATH = "scripts/training/data/feeana dataset - dataset.csv"
REPORT_PATH = "scripts/training/reports/eda.md"
MODEL_NAME = "nreimers/mMiniLMv2-L12-H384-distilled-from-XLMR-Large"

def df_to_markdown_simple(df: pd.DataFrame) -> str:
    """Converts a pandas DataFrame to a simple markdown table without requiring tabulate."""
    lines = []
    headers = [str(col) for col in df.columns]
    if df.index.name or any(df.index != range(len(df))):
        headers = [df.index.name or ""] + headers
        lines.append("| " + " | ".join(headers) + " |")
        lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
        for idx, row in df.iterrows():
            row_vals = [str(idx)] + [str(val) for val in row.values]
            lines.append("| " + " | ".join(row_vals) + " |")
    else:
        lines.append("| " + " | ".join(headers) + " |")
        lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
        for _, row in df.iterrows():
            row_vals = [str(val) for val in row.values]
            lines.append("| " + " | ".join(row_vals) + " |")
    return "\n".join(lines)

def run_eda():
    print(f"Loading dataset from {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH)
    print(f"Total rows: {len(df)}")

    # Ensure required columns
    required_cols = {"id", "category", "issue", "polarity", "source", "language", "text", "group_id"}
    assert required_cols.issubset(df.columns), f"Missing columns: {required_cols - set(df.columns)}"

    # Apply preprocessing to text
    df["cleaned_text"] = df["text"].astype(str).apply(preprocess)
    df["char_len_raw"] = df["text"].astype(str).apply(len)
    df["char_len_cleaned"] = df["cleaned_text"].apply(len)

    # Load tokenizer
    print(f"Loading tokenizer {MODEL_NAME}...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    # Compute token lengths
    print("Tokenizing cleaned texts...")
    token_lengths = [len(tokens) for tokens in tokenizer(df["cleaned_text"].tolist(), truncation=False)["input_ids"]]
    df["token_len"] = token_lengths

    # 1. Distribution counts: issue x source x polarity
    issue_counts = df["issue"].value_counts()
    polarity_counts = df["polarity"].value_counts()
    source_counts = df["source"].value_counts()
    lang_counts = df["language"].value_counts()

    pivot_issue_polarity = pd.crosstab(df["issue"], df["polarity"], margins=True)
    pivot_issue_source = pd.crosstab(df["issue"], df["source"], margins=True)

    # 2. Token-length statistics
    token_stats = {
        "mean": np.mean(token_lengths),
        "std": np.std(token_lengths),
        "median": np.median(token_lengths),
        "min": np.min(token_lengths),
        "max": np.max(token_lengths),
        "p95": np.percentile(token_lengths, 95),
        "p99": np.percentile(token_lengths, 99),
        "pct_under_256": (np.array(token_lengths) <= 256).mean() * 100,
        "pct_under_128": (np.array(token_lengths) <= 128).mean() * 100,
    }

    # 3. Check max char length vs 500-char deployment constraint
    over_500_char = (df["char_len_raw"] > 500).sum()

    # 4. Near-duplicate scan (exact cleaned duplicates)
    dup_mask = df.duplicated(subset=["cleaned_text"], keep=False)
    dup_count = dup_mask.sum()
    dup_groups = df[dup_mask].groupby("cleaned_text")["group_id"].nunique()
    cross_group_dups = (dup_groups > 1).sum()

    # 5. Group ID statistics
    num_unique_groups = df["group_id"].nunique()
    rows_per_group = df["group_id"].value_counts()

    # Generate Markdown Report
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("# Feeana Dataset Exploratory Data Analysis (EDA) Report\n\n")
        f.write(f"**Dataset Path**: `{DATA_PATH}`\n")
        f.write(f"**Total Records**: {len(df):,}\n")
        f.write(f"**Unique Group IDs**: {num_unique_groups:,}\n\n")

        f.write("---\n\n")
        f.write("## 1. Summary Statistics\n\n")
        f.write(f"- **Polarity Breakdown**:\n")
        for pol, count in polarity_counts.items():
            f.write(f"  - `{pol}`: {count:,} ({count/len(df):.1%})\n")
        f.write("\n")

        f.write(f"- **Source Breakdown**:\n")
        for src, count in source_counts.items():
            f.write(f"  - `{src}`: {count:,} ({count/len(df):.1%})\n")
        f.write("\n")

        f.write(f"- **Language Breakdown**:\n")
        for lang, count in lang_counts.items():
            f.write(f"  - `{lang}`: {count:,} ({count/len(df):.1%})\n")
        f.write("\n")

        f.write("---\n\n")
        f.write("## 2. Token Length Distribution (`distilled-XLMR` Tokenizer)\n\n")
        f.write(f"- **Mean Token Length**: {token_stats['mean']:.2f} ± {token_stats['std']:.2f}\n")
        f.write(f"- **Median**: {token_stats['median']:.0f}\n")
        f.write(f"- **Max Token Length**: {token_stats['max']}\n")
        f.write(f"- **95th Percentile**: {token_stats['p95']:.1f} tokens\n")
        f.write(f"- **99th Percentile**: {token_stats['p99']:.1f} tokens\n")
        f.write(f"- **% of inputs <= 256 tokens**: {token_stats['pct_under_256']:.2f}%\n")
        f.write(f"- **% of inputs <= 128 tokens**: {token_stats['pct_under_128']:.2f}%\n\n")
        f.write(f"> **Conclusion**: `max_len = 256` covers **{token_stats['pct_under_256']:.2f}%** of all dataset inputs without truncation. Raw inputs > 500 chars: **{over_500_char}**.\n\n")

        f.write("---\n\n")
        f.write("## 3. Issue Distribution & Cross-tabulations\n\n")
        f.write("### Issue × Polarity\n\n")
        f.write(df_to_markdown_simple(pivot_issue_polarity))
        f.write("\n\n")

        f.write("### Issue × Source\n\n")
        f.write(df_to_markdown_simple(pivot_issue_source))
        f.write("\n\n")

        f.write("---\n\n")
        f.write("## 4. Near-Duplicate & Leakage Checks\n\n")
        f.write(f"- **Exact Cleaned Text Duplicates**: {dup_count} rows\n")
        f.write(f"- **Duplicates Across Different `group_id`s**: {cross_group_dups} text patterns\n")
        f.write(f"- **Avg Rows per Group**: {rows_per_group.mean():.2f} (Min: {rows_per_group.min()}, Max: {rows_per_group.max()})\n\n")

    print(f"EDA report successfully saved to {REPORT_PATH}")

if __name__ == "__main__":
    run_eda()
