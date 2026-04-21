
# Reorganization Plan — Class-Centric Workspace

A Google-Classroom-style restructuring: instructors live inside a persistent right-side drawer, work happens inside **Classes**, and students join classes by code.

## 1. Information architecture

**Top-level entities (mock):**
- `Class { id, name, course, section, code (6-char), createdAt, archived }` — replaces today's single course concept
- `Session { id, classId, topic, startsAt, endsAt, status }` — ILOs no longer surfaced in UI (kept internally on `Session.iloIds` so analysis still works)
- `JoinedClass { studentId, classId }` — for student membership
- Seed: 2 active classes + 1 archived, each with 2 sessions, plus existing feedback wired by `sessionId`

**Instructor routes (all wrapped by `_instructor` layout with persistent drawer):**
```
/home                           → banner intro + grid of class cards
/dashboard                      → existing KPI dashboard (no "Start collection" form anymore)
/classes/$classId               → class banner + tabs
/classes/$classId  (tab)        → "Sessions" (default)
/classes/$classId  (tab)        → "Trend" (renamed History, scoped per class)
/classes/$classId/analysis/$sessionId  → existing analysis page, re-parented
/archived                       → grid of archived class cards
```

**Student routes:**
```
/student/home    → banner + flat list of active sessions, grouped by class
/student/join    → enter class code (dialog from home is fine too)
/student/submit/$sessionId → existing submit form, pre-filled with session
```

## 2. Persistent right-side drawer (instructor)

Built on shadcn `Sidebar` with `side="right"` and `collapsible="icon"`.

- **Two states:** icon-only (~56px) ↔ icon+label (~240px). Toggle via `SidebarTrigger` pinned in the top header (always visible).
- **Mobile (≤768px):** off-canvas overlay using shadcn `Sheet` (handled automatically by `Sidebar` mobile mode); hidden by default, opens via header button.
- **Items (top→bottom):**
  1. **Home** (`Home` icon) → `/home`
  2. **Dashboard** (`LayoutDashboard`) → `/dashboard`
  3. **Classes** (`GraduationCap`) — shadcn `Collapsible` listing each active class as a sub-link; footer item **+ New class** opens a `Dialog` with fields **Class name**, **Course**, **Section** → adds to in-memory store, generates a 6-char join code
  4. **Archived classes** (`Archive`) → `/archived`
- Active route highlighted via `Link activeProps`. Group stays expanded when a child class route is active.
- Drawer persists across all `_instructor/*` routes by living in `_instructor.tsx` layout.

## 3. Home page (`/home`)

- **Banner:** gradient card introducing Feeana ("AI-powered feedback intelligence…"), small CTA buttons → "Create class" / "View dashboard".
- **Below:** "Your classes" heading + responsive grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`) of class cards. Each card shows: class name, course · section, join code (with copy button), session count, last-activity timestamp, and a footer link "Open class →".

## 4. Class page (`/classes/$classId`)

**Top banner (two-column on desktop, stacked on mobile):**

```text
┌────────────────────────────────────────────┬──────────────────────────────┐
│ Start feedback collection                  │ Class details                │
│ ┌─ Topic [input] ──────────────────────┐   │ Class: Intro to Programming  │
│ ├─ Starts [datetime-local] ────────────┤   │ Course: CS 101               │
│ ├─ Ends   [datetime-local] ────────────┤   │ Section: A                   │
│ └─ [ Start collection ] (primary btn)  ┘   │ Code: 7K2P9X  [copy]         │
│                                            │ Students: 24                 │
└────────────────────────────────────────────┴──────────────────────────────┘
```

- Left card uses inline shadcn `Input`, `Input type="datetime-local"` x2, primary `Button`. No ILO field. Validation via Sonner toast.
- Right card is read-only metadata.

**Below banner — shadcn `Tabs`** with two tabs:
- **Feedback collection sessions** (default): grid of session cards. Each card shows **topic**, **status badge** (active/closed), **start → end datetime**, **# of responses**, footer "Open analysis →" linking to the analysis route.
- **Trend**: contents of the current `_instructor.history.tsx`, scoped to the class's sessions. Same line + bar charts, retitled "Class trend".

## 5. Archived classes (`/archived`)

Same card grid as home, but pulled from `classes.filter(c => c.archived)`. Card menu offers "Restore". Empty state when none.

## 6. Student portal updates

- New `/student/home`: banner + **flat list of active sessions grouped by class** (shadcn list with class-name subheaders). Each row shows topic, class name · section, time window, and a primary "Submit feedback" button → `/student/submit/$sessionId`.
- **Join class:** `Dialog` triggered from header button "Join class" — single 6-char code input, validates against mock classes, toast on success/failure, adds to in-memory `joinedClassIds`.
- `/student/submit/$sessionId` replaces today's session-picker dropdown; session is locked from the URL. Banner shows class + topic + time window. Existing privacy link kept.
- Student `AppShell` keeps the simple top header (no right drawer) — drawer is instructor-only per the brief.

## 7. Component & file plan

**New files:**
- `src/components/InstructorSidebar.tsx` — the right drawer
- `src/components/CreateClassDialog.tsx`
- `src/components/CreateSessionForm.tsx` — inline form used in class banner
- `src/components/ClassCard.tsx`, `src/components/SessionCard.tsx`
- `src/components/JoinClassDialog.tsx`
- `src/lib/classStore.tsx` — context for classes, sessions, joined memberships (in-memory + localStorage)
- Routes: `_instructor.home.tsx`, `_instructor.archived.tsx`, `_instructor.classes.$classId.tsx` (layout w/ tabs + Outlet), `_instructor.classes.$classId.index.tsx` (sessions tab), `_instructor.classes.$classId.trend.tsx`, `_instructor.classes.$classId.analysis.$sessionId.tsx`, `_student.home.tsx`, `_student.submit.$sessionId.tsx`

**Modified files:**
- `_instructor.tsx` — wrap children in `SidebarProvider` + `InstructorSidebar`, header keeps brand + user chip + sign-out + `SidebarTrigger`
- `_student.tsx` — add "Join class" button in header
- `_instructor.dashboard.tsx` — strip out Start-collection card and sessions table (now lives in class pages); keep KPIs as a global overview
- Old `_instructor.history.tsx` — content moves into the class Trend tab; route deleted (or kept as redirect)
- Old `_student.submit.tsx` — replaced by `/student/home` + `/student/submit/$sessionId`
- `mockData.ts` — extend with classes + join codes; sessions gain `classId`, `startsAt`, `endsAt`

## 8. Things worth flagging

- **History route deletion:** the old top-level `/history` link is removed; bookmarks break. I'll leave a redirect to `/home`.
- **Default landing after instructor login:** changes from `/dashboard` to `/home`. Login redirect updated.
- **Drawer collapse state:** persisted to `localStorage` so it survives navigation/refresh.
- **Empty states:** new home (no classes yet → "Create your first class"), class page (no sessions yet), archived (none), student home (no joined classes → big "Join a class" CTA).
- **Join code generation:** 6-char base32-ish (no ambiguous chars) on class creation; displayed with copy-to-clipboard on class card and class banner.
- **Mock data alignment:** existing analysis results keyed by `sessionId` continue to work — only routing changes around them.
- **ILO removal from UI:** still exists on `Session` internally so analysis output keeps surfacing ILO codes inside the gap-analysis card (the only place they remain visible).
- **Unchanged for now:** auth, analysis pipeline mocks, theme/background, recommendation hover cards.
