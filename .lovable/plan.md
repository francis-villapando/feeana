
# Feeana MVP — Implementation Plan

A dark-mode, outcome-aligned feedback intelligence app for CS instructors. All data is mocked in TypeScript modules; no backend wired yet.

## Design system
- Deep slate background (`#1e293b` family) with subtle abstract dark image + overlay applied globally in `__root.tsx`.
- Vibrant emerald/green accents on actions, charts, and active states.
- Bento Grid dashboards, shadcn/ui throughout, Lucide icons (no emojis), Inter typography.
- Generate one abstract dark background image with the AI image tool; store under `src/assets/`.

## Routes (TanStack Start, file-based)
- `/` — marketing landing with role chooser (Instructor / Student).
- `/login` and `/register` — separate forms, role tab (Instructor/Student). Hardcoded creds: `admin@feeana.edu` / `admin123`, `student@feeana.edu` / `student123`. Stored in `localStorage` via an `AuthContext`. Public route `/privacy` linked from both portals.
- `/_student/submit` — student feedback portal: select session → free-text Taglish feedback → submit (writes to in-memory store via context, toast confirms).
- `/_instructor/dashboard` — Bento Grid: ILO selector, "Start Feedback Collection" CTA, KPI tiles (active sessions, total responses, avg sentiment), sessions table (active + archived).
- `/_instructor/analysis/$sessionId` — Trigger Analysis flow + results (see below).
- `/_instructor/history` — Before/After trends with line + bar charts (sentiment over sessions, issue persistence per aspect).
- `/_instructor/settings` — placeholder for later (background swap stubbed).
- Root layout includes a top nav with role-aware links, route guards via `_instructor` and `_student` pathless layouts (`beforeLoad` redirect to `/login`).

## Mock data shape (1 course, 2 sessions)
```ts
Course { id, code, title }
ILO { id, courseId, code, statement, bloomLevel }
Session { id, courseId, topic, iloIds[], status: 'active'|'archived', createdAt }
Feedback { id, sessionId, rawText, cleanedText, isPedagogical, aspects: AspectExtraction[] }
AspectExtraction { aspect, issue, polarity: 'pos'|'neu'|'neg' }
AnalysisResult { sessionId, mode: 'online'|'offline', aspectDist, issueDist, polarityDist, gaps: GapItem[], recommendations: Recommendation[] }
GapItem { iloId, expected, actual, severity }
Recommendation { id, cue, theory: 'RBT'|'CLT'|'TTI', theoryDetail, triggerPattern }
```
Seed: Intro to Programming course, 2 sessions ("Variables & Data Types", "Control Structures"), ~12 mock Taglish feedback entries each, pre-computed analysis results for both online and offline modes.

## Analysis page logic
- Page loads with empty state + large "Trigger Analysis" button.
- Click opens a Dialog with two cards: **Online Analysis (Server)** and **Offline Analysis (Local Machine)**.
- On selection: 2.5s simulated loading skeleton, then reveal results from the chosen mode (online = richer cues, more confident polarity; offline = lighter subset, fewer recs) — illustrating the distinction.
- Results layout (Bento):
  - Aspect distribution (bar chart, recharts)
  - Issue distribution (horizontal bar)
  - Polarity distribution (donut)
  - **Gap Analysis card**: side-by-side Expected ILO vs Actual feedback themes, color-coded severity.
  - **Recommendation cues**: list of sentence-level cues, each wrapped in shadcn `HoverCard` showing theory tag (RBT/CLT/TTI), theory explanation, and the feedback pattern that triggered it.

## Validation & UX
- Sonner toasts for: missing topic/ILO before starting, missing analysis mode, empty feedback submission, login errors.
- Loading skeletons, empty states, and error boundaries per route.
- Mobile-first responsive Bento (1 col → 2 col → 3 col).

## Deliverable for this pass
UI + mock data + full navigation + analysis flow + hoverable theory-grounded recommendations + history charts. No Supabase. Code organized so a future FastAPI/XLM-RoBERTa backend can replace the mock analysis functions in one place (`src/lib/analysis.ts`).
