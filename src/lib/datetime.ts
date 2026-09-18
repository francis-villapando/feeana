import { addMinutes, endOfDay, startOfDay } from "date-fns";
import type { DateAfter, DateBefore, DateInterval } from "react-day-picker";

export function toDate(value: string | Date | null | undefined): Date | undefined {
  if (value == null || value === "") return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function isAtOrBefore(a: Date, b: Date): boolean {
  return a.getTime() <= b.getTime();
}

export function roundUpToStep(date: Date, stepMinutes: number): Date {
  const remainder = date.getMinutes() % stepMinutes;
  if (remainder === 0) return date;
  return addMinutes(date, stepMinutes - remainder);
}

// Smallest step-aligned time strictly after `min` (keeps endsAt > startsAt).
export function defaultTimeFrom(min: Date, stepMinutes: number): Date {
  const rounded = roundUpToStep(min, stepMinutes);
  return isAtOrBefore(rounded, min) ? addMinutes(rounded, stepMinutes) : rounded;
}

// True when an existing end is at-or-before a newly selected start (end <= start).
export function endConflictsWithStart(startsAt: string, endsAt: string): boolean {
  const s = toDate(startsAt);
  const e = toDate(endsAt);
  return Boolean(s && e && isAtOrBefore(e, s));
}

export type DayMatcher = DateBefore | DateAfter | DateInterval;

export function dayMatcher(min?: Date, max?: Date): DayMatcher | undefined {
  if (min && max) return { before: startOfDay(min), after: endOfDay(max) };
  if (min) return { before: startOfDay(min) };
  if (max) return { after: endOfDay(max) };
  return undefined;
}
