import type { ReactNode } from "react";
import { useState } from "react";
import { AlertCircle, CheckCircle2, Target } from "lucide-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisCard } from "./AnalysisCard";
import type { IloStatus } from "@/lib/hooks/iloStatus";
import { gapLevelFromActual, perLevelGapCounts } from "@/lib/hooks/iloClassification";
import { RBT_LEVELS, RBT_LEVEL_NUMBERS } from "@/lib/algorithm/rules";
import { cn } from "@/lib/hooks/utils";
import type { Feedback, GapItem } from "@/lib/types/types";

interface IloGapCardProps {
  statuses: IloStatus[];
  gaps?: GapItem[];
  feedback?: Map<string, Feedback>;
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// ---------------------------------------------------------------------------

export interface AccentStyle {
  color: string;
  borderColor: string;
  bgTint: string;
}

/** Maps an achievement rate (0-100) to a red -> amber-green -> emerald accent. */
export function rateToAccent(rate: number): AccentStyle {
  const t = Math.max(0, Math.min(100, rate)) / 100;
  const hue = Math.round(t * 142);
  return {
    color: `hsl(${hue}, 75%, 45%)`,
    borderColor: `hsla(${hue}, 75%, 45%, 0.55)`,
    bgTint: `hsla(${hue}, 75%, 45%, 0.07)`,
  };
}

/** Declared goal levels for an ILO; single today, array-typed for multi-goal ILOs. */
export function declareGoalLevels(bloomLevel: string): number[] {
  return [RBT_LEVEL_NUMBERS[bloomLevel] ?? 1];
}

export interface CascadeResolution {
  placementLevel: number;
  lowestGoal: number;
  cascadeLevels: number[];
}

/** Resolves goal levels into placement (highest), lowest goal, and cascade levels below it. */
export function resolveCascade(goalLevels: number[]): CascadeResolution {
  if (goalLevels.length === 0) return { placementLevel: 1, lowestGoal: 1, cascadeLevels: [] };
  const placementLevel = Math.max(...goalLevels);
  const lowestGoal = Math.min(...goalLevels);
  const cascadeLevels = Array.from({ length: lowestGoal - 1 }, (_, i) => i + 1);
  return { placementLevel, lowestGoal, cascadeLevels };
}

export interface GoalSubRow {
  level: number;
  gapCount: number;
  percentage: number;
}

/** Per-goal stats derived from per-level gap counts (100% when the ILO has no gaps). */
export function computeGoalSubRows(
  goalLevels: number[],
  gaps: GapItem[],
  iloId: string,
): GoalSubRow[] {
  const counts = perLevelGapCounts(gaps, iloId);
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  return goalLevels.map((level) => {
    const gapCount = counts.get(level) ?? 0;
    const percentage = total === 0 ? 100 : Math.round(100 - (gapCount / total) * 100);
    return { level, gapCount, percentage };
  });
}

/** Card accent rate: global rate for single-goal ILOs, worst goal level otherwise. */
export function goalAccentRate(rows: GoalSubRow[], baseRate: number): number {
  if (rows.length <= 1) return baseRate;
  return Math.min(baseRate, ...rows.map((row) => row.percentage));
}

/** Levels above the session's highest declared goal, rendered as out of scope. */
export function computeOutOfScopeLevels(maxDeclaredLevel: number): number[] {
  return Array.from(
    { length: Math.max(0, 6 - maxDeclaredLevel) },
    (_, i) => maxDeclaredLevel + 1 + i,
  );
}

// -- Pill kind ---------------------------------------------------------------

export type PillKind = "goal" | "scope" | "out-of-scope";

export function pillForLevel(num: number, hasIlo: boolean, maxDeclaredLevel: number): PillKind {
  if (num > maxDeclaredLevel) return "out-of-scope";
  return hasIlo ? "goal" : "scope";
}

// -- Gap helpers --------------------------------------------------------------

/** Distinct gap items at a given diagnostic level, deduped by feedbackId. */
export function distinctGapsAtLevel(gaps: GapItem[], level: number): GapItem[] {
  const seen = new Set<string>();
  const items: GapItem[] = [];
  for (const gap of gaps) {
    if (gapLevelFromActual(gap.actual) !== level) continue;
    const key = gap.feedbackId ?? `legacy:${gap.actual}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(gap);
  }
  return items;
}

/** Distinct gap items for a specific ILO at its own goal level (direct, non-cascade). */
export function directGapsForIlo(gaps: GapItem[], iloId: string, level: number): GapItem[] {
  const seen = new Set<string>();
  const items: GapItem[] = [];
  for (const gap of gaps) {
    if (gap.iloId !== iloId) continue;
    if (gapLevelFromActual(gap.actual) !== level) continue;
    const key = gap.feedbackId ?? `legacy:${iloId}:${gap.actual}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(gap);
  }
  return items;
}

/** Human-readable fallback label from a gap item's actual string. */
export function formatGapLabel(actual: string): string {
  const issue = actual.match(/^Issue:\s*"([^"]+)"/)?.[1];
  const level = gapLevelFromActual(actual);
  if (issue && level != null) return `${issue} · Level ${level}`;
  return actual;
}

// ---------------------------------------------------------------------------
// Internal components
// ---------------------------------------------------------------------------

function gapSuffix(count: number): string {
  return count > 0 ? ` · ${count} gap${count === 1 ? "" : "s"}` : "";
}

function LevelPill({ kind }: { kind: PillKind }) {
  if (kind === "goal")
    return (
      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-tighter text-primary-foreground">
        Goal
      </span>
    );
  if (kind === "scope")
    return (
      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-tighter text-secondary-foreground">
        Scope
      </span>
    );
  return (
    <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] uppercase tracking-tighter text-muted-foreground">
      Out of scope
    </span>
  );
}

function LevelHeader({ num, pill }: { num: number; pill: PillKind }) {
  const outOfScope = pill === "out-of-scope";
  return (
    <div className={cn("flex items-center gap-2", outOfScope && "opacity-60")}>
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
          outOfScope ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
        )}
      >
        {num}
      </span>
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-tighter",
          outOfScope ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {RBT_LEVELS[num]}
      </span>
      <LevelPill kind={pill} />
    </div>
  );
}

/** Expanded list of gap feedback items (exported for direct test rendering). */
export function GapFeedbackList({
  items,
  feedback,
}: {
  items: GapItem[];
  feedback?: Map<string, Feedback>;
}) {
  return (
    <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
      {items.map((gap, i) => {
        const quote = gap.feedbackId ? feedback?.get(gap.feedbackId)?.rawText : undefined;
        return (
          <p key={i} className="text-[11px] leading-relaxed text-foreground/80">
            &ldquo;{quote ?? formatGapLabel(gap.actual)}&rdquo;
          </p>
        );
      })}
    </div>
  );
}

function FeedbackDropdown({
  items,
  feedback,
  label,
}: {
  items: GapItem[];
  feedback?: Map<string, Feedback>;
  label: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-[10px] font-medium text-primary underline-offset-2 hover:underline"
      >
        {expanded ? "Hide" : "Show"} {items.length} {label}
      </button>
      {expanded && <GapFeedbackList items={items} feedback={feedback} />}
    </div>
  );
}

function IloCard({
  status,
  gaps,
  feedback,
}: {
  status: IloStatus;
  gaps: GapItem[];
  feedback?: Map<string, Feedback>;
}) {
  const { ilo, achieved, achievementRate, gapCount } = status;
  const goalLevels = declareGoalLevels(ilo.bloomLevel);
  const { cascadeLevels } = resolveCascade(goalLevels);
  const subRows = computeGoalSubRows(goalLevels, gaps, ilo.id);
  const accent = rateToAccent(goalAccentRate(subRows, achievementRate));
  const perLevel = perLevelGapCounts(gaps, ilo.id);
  const actualCascades = cascadeLevels.filter((num) => (perLevel.get(num) ?? 0) > 0);
  const directItems = directGapsForIlo(gaps, ilo.id, goalLevels[0]);

  const directLabel = directItems.length === 1 ? "direct feedback quote" : "direct feedback quotes";

  return (
    <div
      className="rounded-lg border p-3"
      style={{ borderColor: accent.borderColor, backgroundColor: accent.bgTint }}
    >
      <p className="flex items-start gap-2 text-sm leading-relaxed">
        {achieved ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accent.color }} />
        ) : (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accent.color }} />
        )}
        <span>{ilo.statement}</span>
      </p>
      {actualCascades.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-tighter text-muted-foreground">
            Cascades from
          </span>
          {actualCascades.map((num) => (
            <span
              key={num}
              className="rounded-md border px-2 py-0.5 text-[10px] font-normal"
              style={{ borderColor: accent.borderColor, color: accent.color }}
            >
              {RBT_LEVELS[num]}
              {gapSuffix(perLevel.get(num) ?? 0)}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs">
        <span className={gapCount > 0 ? "font-medium text-destructive" : "text-muted-foreground"}>
          {gapCount} feedback gap{gapCount === 1 ? "" : "s"}
        </span>
        <span className="text-muted-foreground"> · </span>
        <span className="font-medium" style={{ color: accent.color }}>
          {achievementRate}% achieved
        </span>
      </p>
      <div className="mt-1">
        <FeedbackDropdown items={directItems} feedback={feedback} label={directLabel} />
      </div>
    </div>
  );
}

function LevelCard({
  num,
  items,
  feedback,
}: {
  num: number;
  items: GapItem[];
  feedback?: Map<string, Feedback>;
}) {
  const label = items.length === 1 ? "feedback quote" : "feedback quotes";
  return (
    <div className="rounded-lg border border-secondary/60 bg-secondary/5 p-3">
      <p className="text-xs">
        <span className="font-medium text-destructive">
          {items.length} feedback gap{items.length === 1 ? "" : "s"}
        </span>
        <span className="text-muted-foreground"> at {RBT_LEVELS[num]}</span>
      </p>
      <div className="mt-1">
        <FeedbackDropdown items={items} feedback={feedback} label={label} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function IloGapCard({ statuses, gaps = [], feedback }: IloGapCardProps) {
  const byLevel = new Map<number, IloStatus[]>();
  let maxDeclaredLevel = 0;
  for (const status of statuses) {
    const { placementLevel } = resolveCascade(declareGoalLevels(status.ilo.bloomLevel));
    maxDeclaredLevel = Math.max(maxDeclaredLevel, placementLevel);
    const bucket = byLevel.get(placementLevel) ?? [];
    bucket.push(status);
    byLevel.set(placementLevel, bucket);
  }

  const renderLevel = (num: number): ReactNode => {
    const levelStatuses = byLevel.get(num) ?? [];
    const hasIlo = levelStatuses.length > 0;
    const pill = pillForLevel(num, hasIlo, maxDeclaredLevel);
    const levelGaps = pill === "scope" ? distinctGapsAtLevel(gaps, num) : [];

    return (
      <div key={num} className="space-y-3">
        <LevelHeader num={num} pill={pill} />
        {levelStatuses.map((status) => (
          <IloCard key={status.ilo.id} status={status} gaps={gaps} feedback={feedback} />
        ))}
        {pill === "scope" && levelGaps.length > 0 && (
          <LevelCard num={num} items={levelGaps} feedback={feedback} />
        )}
        {num < 6 && (
          <div className="border-l-2 border-border/60 pl-3.5">{renderLevel(num + 1)}</div>
        )}
      </div>
    );
  };

  return (
    <AnalysisCard className="lg:col-span-12">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4 text-primary" /> ILO gap analysis
        </CardTitle>
        <CardDescription>
          Status of every intended learning outcome for this course.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {statuses.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 bg-background/30 px-3 py-6 text-center text-xs text-muted-foreground">
            No ILOs defined for selected topic.
          </p>
        ) : (
          renderLevel(1)
        )}
      </CardContent>
    </AnalysisCard>
  );
}
