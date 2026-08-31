# Feeana

**A pedagogical feedback-diagnosis system powered by a fine-tuned DistilXLM-R dual-head PID-ABSA model for multilingual Philippine computer-science classrooms.**

Feeana turns unstructured student feedback into theory-grounded, actionable insight for faculty. Each feedback entry is classified into one of 14 pedagogical issue tags plus a sentiment polarity, then mapped onto established instructional frameworks — **RBT** (Revised Bloom's Taxonomy), **CLT** (Cognitive Load Theory), and **TTI** (Teaching Through Interactions) — to surface prioritized recommendations and learning-outcome gaps. The entire inference pipeline runs **client-side in the browser** via ONNX Runtime Web, so no student feedback ever leaves the device.

---

## Table of Contents

- [Abstract](#abstract)
- [Proposed Solution & System Overview](#proposed-solution--system-overview)
- [The Algorithm: DistilXLM-R PID-ABSA](#the-algorithm-distilxlmr-pid-absa)
- [Preliminary Evaluation](#preliminary-evaluation)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Database Schema Overview](#database-schema-overview)
- [Getting Started](#getting-started)
- [Model Fine-tuning Workflow](#model-fine-tuning-workflow)
- [Acknowledgements](#acknowledgements)

---

## Abstract

Student feedback is a rich but largely unstructured signal. Faculty routinely collect open-ended responses yet lack a systematic, theory-grounded way to turn them into targeted instructional decisions. Existing approaches either rely on manual reading, likert-scale, or on generic sentiment analysis that ignores the pedagogical context of the classroom.

This thesis addresses that gap with **Feeana**, a faculty–student feedback analysis system whose core contribution is a **fine-tuned DistilXLM-R dual-head model for Pedagogical Issue-Driven and Aspect-Based Sentiment Analysis (PID-ABSA)**. The model classifies each feedback entry into one of 14 pedagogical issue tags (plus an `Uncategorized` fallback) and a three-way sentiment polarity (`neg` / `neu` / `pos`). A deterministic rule layer then maps each detected issue onto the Revised Bloom's Taxonomy (RBT), Cognitive Load Theory (CLT), and the Classroom Assessment Scoring System (CLASS) domains, computes learning-outcome gaps, and generates prioritized, evidence-based pedagogical recommendations.

The model is fine-tuned on a multilingual Philippine dataset of English, Tagalog, and code-switched **Taglish** feedback, exported to a quantized ONNX artifact, and deployed entirely in the browser so that inference is private, offline-capable after first load, and free of server-side ML cost.

---

## Proposed Solution & System Overview

Feeana provides two role-based portals:

- **Faculty portal** — create courses, topics, and Intended Learning Outcomes (ILOs); manage classes and sessions; collect student feedback; trigger the analysis pipeline; and review a dashboard of distributions, ILO gaps, and prioritized recommendations.
- **Student portal** — enroll in a class via a join code, submit anonymous feedback for an active session, and view session status.

The analysis flow is orchestrated by a six-module pipeline that runs in a Web Worker to keep the UI responsive:

```mermaid
flowchart LR
    A[Student Feedback] --> M1[Module 1<br/>Data Collection]
    M1 --> M2[Module 2<br/>Preprocessing]
    M2 --> M3[Module 3<br/>Information Extraction<br/>DistilXLM-R PID-ABSA]
    M3 --> M4[Module 4<br/>Pedagogical Diagnostic Mapping]
    M4 --> M5[Module 5<br/>Strategy Generation]
    M5 --> M6[Module 6<br/>Dashboard Output]
    M6 --> D[Faculty Dashboard]
```

---

## The Algorithm: DistilXLM-R PID-ABSA

### Model naming note

The thesis refers to the base model as **"DistilXLM-R"**. In this repository the base checkpoint is
[`nreimers/mMiniLMv2-L12-H384-distilled-from-XLMR-Large`](https://huggingface.co/nreimers/mMiniLMv2-L12-H384-distilled-from-XLMR-Large) — a distilled checkpoint in the XLM-R family. The naming is locked for the thesis paper and is used consistently throughout the codebase and documentation.

### Dual-head architecture

The model uses a **shared encoder with two classification heads** (full fine-tune, no LoRA):

- **`issue` head** — 15-way classification: the 14 taxonomy issue tags + `Uncategorized`.
- **`polarity` head** — 3-way classification: `neg` / `neu` / `pos`.

A mean-pooling layer over non-padded tokens feeds both heads. The model is trained with inverse-frequency class weights to counter the heavy polarity imbalance (~89% negative) and issue imbalance, and with a weighted multi-task loss (`total_loss = 3.0 × issue_loss + polarity_loss`).

### The six-module pipeline

The implementation maps 1:1 to the pseudocode in [`src/lib/algorithm/algorithm.pseudo`](src/lib/algorithm/algorithm.pseudo).

| Module                                 | Responsibility                                                                                                                                                    | Implementation                                                                         |
| :------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| **1 — Data Collection**                | Assemble session context (course, topic, target ILO RBT level) and the raw feedback stream.                                                                       | [`dataCollection.ts`](src/lib/algorithm/dataCollection.ts)                             |
| **2 — Preprocessing**                  | Normalize feedback text: strip URLs/mentions/hashtags/emoji, compress repeated letters, expand abbreviations/slang, and tokenize to fixed-length (256) encodings. | [`preprocess.ts`](src/lib/algorithm/preprocess.ts)                                     |
| **3 — Information Extraction**         | Run the fine-tuned DistilXLM-R model via `onnxruntime-web` to produce `{ issue, polarity }`.                                                                      | [`informationExtraction.ts`](src/lib/algorithm/informationExtraction.ts)               |
| **4 — Pedagogical Diagnostic Mapping** | Map each issue to TTI domain, RBT level, and CLT category; compute the ILO-gap flag.                                                                              | [`pedagogicalDiagnosticMapping.ts`](src/lib/algorithm/pedagogicalDiagnosticMapping.ts) |
| **5 — Strategy Generation**            | Compute distributions, score issues, and generate recommendations or warnings.                                                                                    | [`strategyGeneration.ts`](src/lib/algorithm/strategyGeneration.ts)                     |
| **6 — Dashboard Output**               | Format the final payload for the dashboard (distributions, gaps, recommendations, warnings).                                                                      | [`dashboardOutput.ts`](src/lib/algorithm/dashboardOutput.ts)                           |

The pipeline orchestrator is [`pipeline.ts`](src/lib/algorithm/pipeline.ts), and the Web Worker entry point is [`worker.ts`](src/lib/algorithm/worker.ts) (exposed via [Comlink](https://github.com/GoogleChromeLabs/comlink)).

### Taxonomy mapping

Each of the 14 issue tags is mapped to a TTI domain/dimension, an RBT level (1–6), and a CLT category. The full rule tables live in [`rules.ts`](src/lib/algorithm/rules.ts) and are derived from [`docs/pedagogical_mapping_taxonomy.md`](docs/pedagogical_mapping_taxonomy.md).

| Issue Tag                 | TTI Domain             | TTI Dimension                   | RBT Level  | CLT Load   |
| :------------------------ | :--------------------- | :------------------------------ | :--------- | :--------- |
| Relational Coldness       | Emotional Support      | Positive Climate                | Remember   | Extraneous |
| Classroom Tension         | Emotional Support      | Negative Climate                | Remember   | Extraneous |
| Evaluation Unfairness     | Emotional Support      | Teacher Sensitivity             | Remember   | Extraneous |
| Perceived Marginalization | Emotional Support      | Regard for Student Perspectives | Remember   | Extraneous |
| Subject Alienation        | Emotional Support      | Regard for Student Perspectives | Remember   | Extraneous |
| Peer Distraction          | Classroom Organization | Behavior Management             | Remember   | Extraneous |
| Instructional Cadence     | Classroom Organization | Productivity                    | Understand | Extraneous |
| Clarity Deficit           | Classroom Organization | Instructional Learning Formats  | Understand | Extraneous |
| Abstract Logic Gap        | Instructional Support  | Concept Development             | Analyze    | Intrinsic  |
| Procedural Bottleneck     | Instructional Support  | Concept Development             | Apply      | Intrinsic  |
| Conceptual Misalignment   | Instructional Support  | Concept Development             | Understand | Intrinsic  |
| Design Synthesis Failure  | Instructional Support  | Concept Development             | Create     | Intrinsic  |
| Feedback Latency          | Instructional Support  | Quality of Feedback             | Understand | Extraneous |
| Notation Struggle         | Instructional Support  | Language Modeling               | Remember   | Intrinsic  |

### Gap detection

A diagnostic is flagged as an **ILO gap** when the issue's RBT level is at or below the session's target ILO level **and** the CLT load is intrinsic:

```
is_gap = (rbt <= target_ILO_rbt) AND (clt == "Intrinsic")
```

Gap items follow the RBT cascade rule: a diagnostic at level _N_ flags ILOs at level _N_ or above.

### Unified Priority Scoring

Each unique issue is scored by prevalence weighted by whether it is a gap:

```
w_c = is_gap ? 1.5 : 1.0
P   = (issue_count / Total_F) * w_c
```

- **`P ≥ 0.30`** → a full pedagogical recommendation is generated.
- **`P < 0.30`** → a passive diagnostic warning is surfaced on the dashboard.

### Client-side inference

- The fine-tuned model is exported to an **INT8-quantized ONNX** artifact (~118 MB) and served as a static asset.
- Inference runs in a **Web Worker** via `onnxruntime-web` (WASM), keeping the main thread at 60 FPS.
- Model weights and tokenizer are cached in the browser (Cache Storage / IndexedDB) so the payload downloads exactly once.
- A three-phase `ModelLoaderOverlay` reports download → compile → classify progress, with a cancel path.

---

## Preliminary Evaluation

Evaluation is performed on a held-out grouped test set of **1,031 rows** (grouped by `group_id` to prevent leakage). The three compared models are the full-fine-tuned INT8 ONNX artifacts: `distilxlmr`, `mbert`, and a TF-IDF + LinearSVC `svm` baseline. Full per-class results are in [`scripts/training/reports/`](scripts/training/reports/).

### Overall results (macro F1)

| Model          | Issue F1   | Issue Precision | Issue Recall | Polarity F1 | Polarity Precision | Polarity Recall |
| :------------- | :--------- | :-------------- | :----------- | :---------- | :----------------- | :-------------- |
| svm            | 0.7999     | 0.8042          | 0.8008       | 0.9293      | 0.9804             | 0.8887          |
| mbert          | 0.7690     | 0.7708          | 0.7748       | 0.8707      | 0.8568             | 0.8854          |
| **distilxlmr** | **0.6544** | **0.6886**      | **0.6551**   | **0.8727**  | **0.8445**         | **0.9047**      |

DistilXLM-R's own held-out test metrics (from [`test_evaluation_report_distilxlmr.json`](scripts/training/reports/test_evaluation_report_distilxlmr.json)): **issue macro-F1 0.7159**, **polarity macro-F1 0.8558**, issue accuracy 0.7498.

### Discussion

- **Speed/size tradeoff.** DistilXLM-R is ~3.5× smaller than mBERT (hidden size 384 vs 768) and is the deployment choice for client-side inference. It trails mBERT by ~0.11 issue F1 — the cost of the smaller capacity on the fine-grained 15-way task.
- **Polarity parity.** DistilXLM-R is essentially tied with mBERT on polarity (0.8727 vs 0.8707) and has the highest polarity recall (0.9047).
- **Multilingual wins.** DistilXLM-R edges SVM on **Tagalog polarity** (0.8855 vs 0.8785) and beats mBERT on augmented + real polarity — the cells where lexical n-gram signatures break down and contextual understanding matters most.
- **Generalization gap.** DistilXLM-R's issue F1 drops from 0.7383 (val) to 0.6544 (test), a larger drop than mBERT's — it generalizes to the mixed test set noticeably worse.
- **Caveat.** 91% of the test set is generated (synthetic + augmented) with formulaic patterns that TF-IDF/SVM exploits near ceiling. The "SVM beats transformers" conclusion is therefore partly an artifact of the generated-data composition; transformer advantages emerge precisely where lexical signatures disappear (Tagalog, real code-mixed data).

These results are presented transparently as part of the thesis discussion rather than cherry-picked; the deployment decision favors DistilXLM-R for its client-side footprint and multilingual polarity performance.

---

## Tech Stack

| Layer         | Technology                                                                           |
| :------------ | :----------------------------------------------------------------------------------- |
| Frontend      | React 19, TanStack Start / Router, Vite, Tailwind CSS, Radix UI / shadcn, Recharts   |
| ML (training) | PyTorch, Hugging Face Transformers, scikit-learn, ONNX                               |
| ML (browser)  | `@huggingface/transformers` (tokenizer), `onnxruntime-web` (WASM inference), Comlink |
| Backend / DB  | Supabase (Postgres, Row-Level Security, Realtime), Edge Functions                    |
| Deployment    | Cloudflare / Vercel (COOP/COEP headers for WASM shared-array-buffer support)         |

---

## Repository Structure

```
feeana/
├── src/
│   ├── lib/
│   │   ├── algorithm/            # Core 6-module pipeline (thesis focus)
│   │   │   ├── algorithm.pseudo  # Pseudocode the implementation maps 1:1 to
│   │   │   ├── pipeline.ts       # Orchestrator (Modules 1–6)
│   │   │   ├── dataCollection.ts # Module 1
│   │   │   ├── preprocess.ts     # Module 2
│   │   │   ├── informationExtraction.ts # Module 3 (DistilXLM-R)
│   │   │   ├── pedagogicalDiagnosticMapping.ts # Module 4
│   │   │   ├── strategyGeneration.ts # Module 5
│   │   │   ├── dashboardOutput.ts # Module 6
│   │   │   ├── rules.ts          # Taxonomy rule tables (TTI/RBT/CLT)
│   │   │   ├── worker.ts         # Web Worker entry (Comlink)
│   │   │   └── models/           # Model adapters (distilxlmr, mbert, svm)
│   │   ├── ml/                   # Worker store + comparison worker
│   │   ├── db/                   # Supabase client + admin SQL
│   │   └── services/             # Feedback, course, status services
│   ├── components/
│   │   ├── analysis/             # ModelLoaderOverlay, AnalysisTriggerModal, charts
│   │   ├── faculty/              # Faculty portal components
│   │   ├── student/              # Student portal components
│   │   └── ui/                   # Reusable UI primitives
│   ├── routes/                   # TanStack Router routes
│   └── tests/                    # Unit + integration tests
├── scripts/
│   ├── training/                 # Python fine-tuning pipeline
│   │   ├── finetune.py           # Dual-head training
│   │   ├── split_data.py         # Grouped, stratified split
│   │   ├── export_model_onnx.py  # ONNX export + INT8 PTQ
│   │   ├── preprocess.py         # Python preprocessing (parity with TS)
│   │   └── reports/              # Training runs + evaluation CSVs
│   ├── seed/                     # Database seeding
│   └── dev/                      # Dev utilities
├── public/
│   ├── models/finetuned/         # INT8 ONNX artifacts (Git LFS)
│   └── onnxruntime/              # WASM binaries
├── supabase/
│   └── migrations/               # Schema + RLS migrations
├── docs/
│   └── pedagogical_mapping_taxonomy.md
└── package.json
```

---

## Database Schema Overview

Key tables (see [`supabase/migrations/`](supabase/migrations/)):

| Table                         | Purpose                                                                              |
| :---------------------------- | :----------------------------------------------------------------------------------- |
| `sessions`                    | A class session with topic, target ILOs, status, and `last_analyzed_at`.             |
| `feedback`                    | Raw student feedback entries for a session.                                          |
| `analysis_results`            | Raw ML output per feedback (`issue`, `polarity`) — written once, immutable.          |
| `feedback_diagnostics`        | Cached computed result per session (JSONB + `rules_version` for cache invalidation). |
| `courses` / `topics` / `ilos` | Course structure and Intended Learning Outcomes.                                     |
| `classes` / `enrollments`     | Class management and student enrollment.                                             |
| `activity_log`                | Audit trail of course/topic/ILO changes.                                             |

**Row-Level Security (RLS):** access is locked down so that only the faculty member who owns a class/session can read or modify its diagnostics. Core tables use a `prevent_delete()` trigger that blocks hard deletes except through admin paths (see [`supabase/README.md`](supabase/README.md)).

---

## Getting Started

### Prerequisites

- **Node.js 22+** and a package manager (`npm` or `bun`)
- A **Supabase** project (for the database, auth, and Realtime)
- Git LFS (to check out the large ONNX model artifacts)

### Install

```bash
# Install dependencies (postinstall syncs ONNX WASM assets)
npm install
# or
bun install
```

### Configure environment

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```bash
cp .env.example .env
```

Key variables:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SERVER_SALT=...
```

### Run

```bash
npm run dev        # Start the dev server
npm run build      # Production build
npm run preview    # Preview the production build
```

### Test & lint

```bash
npm run lint       # ESLint
npm test           # Vitest
```

> **Note:** Unit tests (`src/tests/unit`) run in CI. Integration tests (`src/tests/integration`) require live Supabase credentials and seeded data, so they are not run in CI.

### Database

```bash
npm run db:reset   # Reset + seed the database
npm run db:seed    # Seed SQL data
```

---

## Model Fine-tuning Workflow

The training pipeline lives in [`scripts/training/`](scripts/training/) and is designed for reproducibility on free compute (Google Colab → Kaggle → local CPU).

1. **Dataset preparation** — a multilingual (English / Tagalog / Taglish) dataset of 10,250 rows with a `group_id` column for leakage control.
2. **Exploratory analysis** — [`eda.py`](scripts/training/eda.py) reports distributions and token-length histograms.
3. **Preprocessing parity** — [`preprocess.py`](scripts/training/preprocess.py) replicates the TypeScript `Preprocess` so training matches production.
4. **Grouped, stratified split** — [`split_data.py`](scripts/training/split_data.py) splits on `group_id` (80/10/10) so no seed leaks across splits.
5. **Fine-tuning** — [`finetune.py`](scripts/training/finetune.py) trains the dual-head model with class weights, differential learning rates, warmup + linear decay, and early stopping on validation macro-F1.
6. **Export & quantization** — [`export_model_onnx.py`](scripts/training/export_model_onnx.py) merges to FP32 ONNX then applies **INT8 post-training quantization** (PTQ) for browser deployment.
7. **Browser swap** — the quantized artifact is served from `public/models/finetuned/` and loaded by the `DistilXlmrAdapter`.

---

## Acknowledgements

This project is developed as a BSCS thesis titled **"AI-Powered Feedback Analyzer for Enhancing Teaching Strategies in Digital Classrooms."**

We would like to express our sincere gratitude to the following people who made this study possible:

- **Our Thesis Adviser** — Asst. Prof. Christian Baña, for the guidance, constructive feedback, and continuous support throughout the development of this system.
- **Our Panelists** — Dr. Angelica Aquino, Asst. Prof. Janus Raymond Tan, and Mr. Mark Anthony Ciso, for their valuable insights and recommendations that shaped the final output.
- **Our Institution** — University of Cabuyao (Pamantasan ng Cabuyao), College of Computing Studies, for providing the resources and environment to conduct this research.

### The Researchers

This thesis is a collaborative effort of the following group members:

- Lexin Andrei Artillero
- Roseanne Borbe
- Francis Villapando

Finally, we thank our families and friends for their unwavering encouragement and support.

---

_Built with React, TanStack, Supabase, PyTorch, and ONNX Runtime Web._
