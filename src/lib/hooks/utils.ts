import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function friendlyError(err: unknown, fallback = "Something went wrong."): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const isNetworkError =
    !navigator.onLine ||
    msg.toLowerCase().includes("failed to fetch") ||
    msg.toLowerCase().includes("network error");
  return isNetworkError
    ? "Could not connect to the server. Please check your internet connection or try again later."
    : fallback;
}

export type ComparableField = {
  label: string;
  oldValue: string | Date | null | undefined;
  newValue: string | Date | null | undefined;
};

function toComparable(v: ComparableField["oldValue"]): string {
  return v instanceof Date ? v.toISOString() : (v ?? "").toString().trim().toLowerCase();
}

export function unchangedFields(fields: ComparableField[]): string[] {
  return fields
    .filter((f) => toComparable(f.newValue) === toComparable(f.oldValue))
    .map((f) => f.label);
}

export function noChangesMessage(unchanged: string[]): string {
  const list =
    unchanged.length > 2
      ? `${unchanged.slice(0, -1).join(", ")}, or ${unchanged.at(-1)}`
      : unchanged.length === 2
        ? `${unchanged[0]} or ${unchanged[1]}`
        : unchanged[0];
  return `No changes were made — update the ${list}.`;
}
