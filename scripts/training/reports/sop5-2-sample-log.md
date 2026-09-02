# SOP 5.2 Benchmark Sample - Reproducibility Log

| Field | Value |
|---|---|
| **Generated** | 2026-09-02T12:20:15Z |
| **Source file** | `scripts/training/data/test.csv` |
| **Source rows** | 1031 |
| **Output file** | `scripts/training/data/sop5-2-benchmark-sample.csv` |
| **Output rows** | 50 |
| **Random seed** | 42 |
| **Sampling method** | Proportional stratified sampling by `issue` column, largest-remainder rounding, `pd.DataFrame.sample(random_state=42)` within each stratum |
| **Constraint** | No forced balancing on `source` or `language` - sampled naturally within each tag stratum |

## Per-tag allocation

| Tag | Full dataset % | Allocated rows |
|---|---|---|
| abstract logic gap | 7.5% | 4 |
| clarity deficit | 5.1% | 3 |
| classroom tension | 4.9% | 2 |
| conceptual misalignment | 6.9% | 3 |
| design synthesis failure | 7.5% | 4 |
| evaluation unfairness | 4.6% | 2 |
| feedback latency | 4.6% | 2 |
| instructional cadence | 4.8% | 2 |
| notation struggle | 8.1% | 4 |
| peer distraction | 4.8% | 2 |
| perceived marginalization | 5.4% | 3 |
| procedural bottleneck | 7.0% | 4 |
| relational coldness | 4.9% | 3 |
| subject alienation | 4.8% | 2 |
| uncategorized | 19.1% | 10 |
| **TOTAL** | **100.0%** | **50** |

## Runner notes

- Script: `scripts/training/generate_sop5_2_sample.py`
- Run this script **once** to produce the fixed artifact.
- All three models (DistilXLM-R, mBERT, SVM) consume `sop5-2-benchmark-sample.csv` as-is.
- Do not re-sample; the output is a reproducible, seeded artifact.
