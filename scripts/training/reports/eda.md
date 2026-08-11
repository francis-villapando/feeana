# Feeana Dataset Exploratory Data Analysis (EDA) Report

**Dataset Path**: `scripts/training/data/feeana dataset - dataset.csv`
**Total Records**: 10,250
**Unique Group IDs**: 6,150

---

## 1. Summary Statistics

- **Polarity Breakdown**:
  - `neg`: 8,916 (87.0%)
  - `pos`: 667 (6.5%)
  - `neu`: 667 (6.5%)

- **Source Breakdown**:
  - `synthetic`: 5,124 (50.0%)
  - `augmented`: 4,100 (40.0%)
  - `real`: 1,026 (10.0%)

- **Language Breakdown**:
  - `taglish`: 5,123 (50.0%)
  - `tagalog`: 3,075 (30.0%)
  - `english`: 2,052 (20.0%)

---

## 2. Token Length Distribution (`distilled-XLMR` Tokenizer)

- **Mean Token Length**: 21.39 ± 9.34
- **Median**: 19
- **Max Token Length**: 100
- **95th Percentile**: 39.0 tokens
- **99th Percentile**: 56.0 tokens
- **% of inputs <= 256 tokens**: 100.00%
- **% of inputs <= 128 tokens**: 100.00%

> **Conclusion**: `max_len = 256` covers **100.00%** of all dataset inputs without truncation. Raw inputs > 500 chars: **0**.

---

## 3. Issue Distribution & Cross-tabulations

### Issue × Polarity

| issue | neg | neu | pos | All |
| --- | --- | --- | --- | --- |
| abstract logic gap | 750 | 0 | 0 | 750 |
| clarity deficit | 500 | 0 | 0 | 500 |
| classroom tension | 500 | 0 | 0 | 500 |
| conceptual misalignment | 750 | 0 | 0 | 750 |
| design synthesis failure | 750 | 0 | 0 | 750 |
| evaluation unfairness | 500 | 0 | 0 | 500 |
| feedback latency | 500 | 0 | 0 | 500 |
| instructional cadence | 500 | 0 | 0 | 500 |
| notation struggle | 750 | 0 | 0 | 750 |
| peer distraction | 500 | 0 | 0 | 500 |
| perceived marginalization | 500 | 0 | 0 | 500 |
| procedural bottleneck | 750 | 0 | 0 | 750 |
| relational coldness | 500 | 0 | 0 | 500 |
| subject alienation | 500 | 0 | 0 | 500 |
| uncategorized | 666 | 667 | 667 | 2000 |
| All | 8916 | 667 | 667 | 10250 |

### Issue × Source

| issue | augmented | real | synthetic | All |
| --- | --- | --- | --- | --- |
| abstract logic gap | 300 | 75 | 375 | 750 |
| clarity deficit | 200 | 50 | 250 | 500 |
| classroom tension | 200 | 50 | 250 | 500 |
| conceptual misalignment | 300 | 75 | 375 | 750 |
| design synthesis failure | 300 | 75 | 375 | 750 |
| evaluation unfairness | 200 | 50 | 250 | 500 |
| feedback latency | 200 | 50 | 250 | 500 |
| instructional cadence | 200 | 50 | 250 | 500 |
| notation struggle | 300 | 75 | 375 | 750 |
| peer distraction | 200 | 50 | 250 | 500 |
| perceived marginalization | 200 | 50 | 250 | 500 |
| procedural bottleneck | 300 | 75 | 375 | 750 |
| relational coldness | 200 | 50 | 250 | 500 |
| subject alienation | 200 | 50 | 250 | 500 |
| uncategorized | 800 | 201 | 999 | 2000 |
| All | 4100 | 1026 | 5124 | 10250 |

---

## 4. Near-Duplicate & Leakage Checks

- **Exact Cleaned Text Duplicates**: 0 rows
- **Duplicates Across Different `group_id`s**: 0 text patterns
- **Avg Rows per Group**: 1.67 (Min: 1, Max: 5)

