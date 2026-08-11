"""
Grouped, Stratified Dataset Splitting Script for Feeana PID-ABSA Dataset.
Splits data 80% train / 10% val / 10% test grouped by group_id and stratified by issue.
Saves train.csv, val.csv, test.csv in scripts/training/data/
"""

import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from preprocess import preprocess

DATA_PATH = "scripts/training/data/feeana dataset - dataset.csv"
OUTPUT_DIR = "scripts/training/data"
RANDOM_SEED = 42

def create_splits():
    print(f"Loading dataset from {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH)
    print(f"Total dataset rows: {len(df):,}")

    # Add cleaned_text column via parity preprocessor
    print("Preprocessing text for training parity...")
    df["cleaned_text"] = df["text"].astype(str).apply(preprocess)

    # Step 1: Create a table of unique group_ids and their primary issue label
    # Each group_id originates from one seed, so issue is uniform per group_id
    group_df = df.groupby("group_id")["issue"].agg(lambda x: x.mode()[0]).reset_index()
    print(f"Total unique group_ids: {len(group_df):,}")

    # Step 2: Stratified split on group level (80% train, 20% temp)
    train_groups, temp_groups = train_test_split(
        group_df,
        test_size=0.20,
        stratify=group_df["issue"],
        random_state=RANDOM_SEED,
    )

    # Step 3: Stratified split of temp into val (50%) and test (50%) => 10% each overall
    val_groups, test_groups = train_test_split(
        temp_groups,
        test_size=0.50,
        stratify=temp_groups["issue"],
        random_state=RANDOM_SEED,
    )

    train_group_set = set(train_groups["group_id"])
    val_group_set = set(val_groups["group_id"])
    test_group_set = set(test_groups["group_id"])

    # Step 4: Map rows back to splits
    train_df = df[df["group_id"].isin(train_group_set)].copy()
    val_df = df[df["group_id"].isin(val_group_set)].copy()
    test_df = df[df["group_id"].isin(test_group_set)].copy()

    # Step 5: Enforce strict safety assertions
    print("\n--- Verifying Split Integrity ---")
    
    # Leakage check
    assert len(train_group_set & val_group_set) == 0, "Leakage detected between train and val!"
    assert len(train_group_set & test_group_set) == 0, "Leakage detected between train and test!"
    assert len(val_group_set & test_group_set) == 0, "Leakage detected between val and test!"
    print("[PASS] Zero group_id leakage across splits.")

    # Completeness check
    total_split_rows = len(train_df) + len(val_df) + len(test_df)
    assert total_split_rows == len(df), f"Row count mismatch: {total_split_rows} vs {len(df)}"
    print(f"[PASS] Total rows preserved: {total_split_rows:,}")

    # Source diversity check in test set
    all_sources = set(df["source"].unique())
    test_sources = set(test_df["source"].unique())
    assert all_sources.issubset(test_sources), f"Missing sources in test set: {all_sources - test_sources}"
    print(f"[PASS] All {len(all_sources)} sources represented in test set: {sorted(list(all_sources))}")

    # Print summary breakdown
    print("\n--- Split Summary ---")
    print(f"Train set: {len(train_df):,} rows ({len(train_df)/len(df):.1%}), {len(train_group_set):,} groups")
    print(f"Val set:   {len(val_df):,} rows ({len(val_df)/len(df):.1%}), {len(val_group_set):,} groups")
    print(f"Test set:  {len(test_df):,} rows ({len(test_df)/len(df):.1%}), {len(test_group_set):,} groups")

    # Step 6: Save split CSVs
    train_path = os.path.join(OUTPUT_DIR, "train.csv")
    val_path = os.path.join(OUTPUT_DIR, "val.csv")
    test_path = os.path.join(OUTPUT_DIR, "test.csv")

    train_df.to_csv(train_path, index=False, encoding="utf-8")
    val_df.to_csv(val_path, index=False, encoding="utf-8")
    test_df.to_csv(test_path, index=False, encoding="utf-8")

    print(f"\nSuccessfully wrote split files:")
    print(f"  - Train: {train_path}")
    print(f"  - Val:   {val_path}")
    print(f"  - Test:  {test_path}")

if __name__ == "__main__":
    create_splits()
