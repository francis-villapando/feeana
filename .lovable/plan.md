# Update Plan — Instructor & Student Portal Refinements

Frontend-only refinements layered on top of the class-centric workspace. All data continues to live in mock stores + `localStorage`.

## 1. Home page — small fix

- `_instructor.home.tsx`: in the welcome banner, move the **Create class** + **View dashboard** buttons from the right-center column to bottom-right of the banner using `flex flex-col` + `items-end justify-end` (or absolute `bottom-6 right-6`). Banner copy stays on the left.

## 2. Dashboard — major rebuild

Drop the old layout. New structure:

**Top KPI row (2 cards only):**

- Avg feedback submission rate (mock: derived from `responses / studentCount` per session, averaged)
- Avg ILO achievement rate (mock: precomputed % per session, averaged)
- Removes "ILOs Tracked" and "Total Responses" tiles. Keeps "Active classes" + "Active sessions" alongside the two new ones (4-tile grid total).

**Course Management Hub (new card with 3 tabs: Courses · Topics · ILOs):**

- Each tab = sortable list with **Add**, **Edit**, **Archive/Restore** actions (no hard delete). Edits/creates open shadcn `Dialog`s; archive flips a boolean and dims the row.
- Show an "Archived" toggle to reveal soft-deleted entries with **Restore** button.
- Every CRUD action pushes an entry into a new `activityLog` store (`{ id, entity, entityId, action, label, timestamp }`).

**Activity Feed card (right column on desktop):**

- Reverse-chronological list filtered to the **last 30 days** and entity types `course | topic | ILO`.
- Shows ~6 most recent rows with icons; **View all** button opens a `Dialog` with the full 30-day list (scrollable).

**Cross-Class Feedback Creator card (full width, below):**

- Fields: Topic (text), and a multi-select Class picker built with shadcn `Popover` + `Command` (checkbox list of active classes).
- Per selected class: an inline row appears with its own **Starts** and **Ends** datetime pickers (both required). Delete button per row.
- Submit creates one `Session` per selected class via `createSession` and toasts a summary.

**New files / changes:**

- `src/lib/courseStore.tsx` — courses, topics, ILOs (CRUD + archived flag) + `activityLog`. Seeds from `MOCK_COURSE` and `MOCK_ILOS`. Persists to `localStorage`.
- `src/components/dashboard/CourseManagementHub.tsx`, `ActivityFeed.tsx`, `ActivityFeedDialog.tsx`, `CrossClassFeedbackCreator.tsx`, `EntityFormDialog.tsx`.
- Extend `classStore.createSession` → already supports per-class `startsAt`/`endsAt`; the cross-class form just loops over selections.

## 3. Class page — layout flip + trend on top

`_instructor.classes.$classId.tsx`:

- **Top:** kpi card for **Submission rate %** and **ILO achievement %.** 
- **below kpi card:** new full-width **Trend card** with a single recharts `LineChart` plotting three lines over the class's sessions (x-axis = session topic chronological): most prevalent aspect, issue, polarity. Mock data derived per session.
- **Below trend, two-column row:**
  - **Left (wider, ~2fr):** Sessions list — no tabs, no header, just the grid of `SessionCard`s rendered directly (the old "Feedback collection sessions" tab content). Add a **Students** sub-tab toggle (see §5) using shadcn `Tabs` with two values: `Sessions` (default) and `Students`. Tabs sit at the top of this left column with no surrounding heading.
  - **Right (~1fr, stacked):** **Class details** card on top, **Start feedback collection** card directly below it. Both keep current content.
- Delete `_instructor.classes.$classId.trend.tsx` route (its line/bar charts move into a redesigned single trend card on the class page; the old `/trend` URL is removed).
- `SessionCard`: anonymous open-ended feedback preview — add a small expandable list (shadcn `Accordion`) showing the latest 3 anonymous submissions inline, "View all" links to analysis page.

## 4. Calendar / datetime pickers — themed

Replace raw `<input type="datetime-local">` in `CreateSessionForm` and the cross-class creator with a composed shadcn date+time picker:

- shadcn `Popover` + `Calendar` for date (with `pointer-events-auto`).
- Two shadcn `Select`s for hour + minute below the calendar.
- Result formatted to ISO and stored as before.
Wrap this in a reusable `src/components/ui/DateTimePicker.tsx`.

## 5. Students tab (per class)

- New component `ClassStudentsTab.tsx` rendered inside the left-column `Tabs`.
- Mock data: `src/lib/mockData.ts` gains `MOCK_STUDENTS_BY_CLASS: Record<classId, { id, name, email, joinedAt }[]>`. Store accessor + `removeStudent(classId, studentId)` in `classStore`.
- UI: shadcn `Table` with name, email, joined date, **Remove** button → confirm via shadcn `AlertDialog`.
- Footer line: shows "**Participation: 64%**" (mock = responses across class / (students × sessions)) — never names tied to feedback.
- Removing a student decrements `studentCount`; toast confirms.

## 6. Notifications — dismiss + auto-close

Update `src/components/ui/sonner.tsx`:

- Pass `closeButton` and `duration={5000}` to the `<Toaster />` so every toast auto-closes after 5s and shows an X for manual dismiss. No per-call changes needed.

## 7. Student portal — mobile feedback layout

`_student.student.submit.$sessionId.tsx`:

- Keep all element sizes (no shrinking, no hiding). The card uses `flex flex-col` so on mobile (`md:` breakpoint), the **Submit feedback** button is moved to the bottom of the card via `mt-auto` and the card itself uses `min-h-[calc(100dvh-…)]` so the button anchors near the bottom while content sits up top.
- No vertical scroll inside the card — overflow handled by the page, not the card.
- Remove the inactive status indicator: only render the "active" badge (drop `session.status === 'closed'` rendering). Submission for non-active sessions hides the form with a single "This collection has ended" notice in its place.
- Student home (`_student.student.home.tsx`): also filter the dropdown / list to **active** sessions only, with class name · section · topic · time window each shown so students can distinguish.

## 8. Data model additions

```ts
// types.ts
type EntityKind = "course" | "topic" | "ILO";
type Topic = { id: string; courseId: string; title: string; archived: boolean; createdAt: string };
type ActivityEntry = {
  id: string; entity: EntityKind; entityId: string;
  action: "created" | "updated" | "archived" | "restored";
  label: string; timestamp: string;
};
// Course and ILO get `archived: boolean`.
// Class gets optional `students: { id; name; email; joinedAt }[]` (or kept in mockData map).
```

## 9. Files affected (summary)

**Created:** `src/lib/courseStore.tsx`, `src/components/ui/DateTimePicker.tsx`, `src/components/dashboard/CourseManagementHub.tsx`, `ActivityFeed.tsx`, `ActivityFeedDialog.tsx`, `CrossClassFeedbackCreator.tsx`, `EntityFormDialog.tsx`, `src/components/ClassStudentsTab.tsx`.

**Modified:** `src/routes/_instructor.home.tsx` (banner button alignment), `_instructor.dashboard.tsx` (full rebuild), `_instructor.classes.$classId.tsx` (layout flip + trend on top + tabs), `_instructor.classes.$classId.index.tsx` (no header, anonymous feedback preview), `src/components/CreateSessionForm.tsx` (themed picker), `src/components/SessionCard.tsx` (anonymous preview), `src/components/ui/sonner.tsx` (close button + 5s), `src/lib/types.ts`, `src/lib/mockData.ts`, `src/lib/classStore.tsx` (students + remove), `_student.student.submit.$sessionId.tsx` (mobile layout, active-only), `_student.student.home.tsx` (active-only).

**Deleted:** `src/routes/_instructor.classes.$classId.trend.tsx` and the associated nav tab.

## 10. Notes / things flagged

- The old `/classes/$classId/trend` URL goes away — links from anywhere else are removed in the same pass.
- Soft-delete uses an `archived: boolean` and dims rows with `opacity-60` + an Archive badge; same pattern as classes.
- All mock metric calculations live in pure helpers under `src/lib/metrics.ts` so a real backend can replace them later.
- No backend, no database, no API calls — strictly mock + `localStorage`.