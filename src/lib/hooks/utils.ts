import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Converts a snake/lowercase label into Title Case for display.
export function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

export function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object" && "status" in err && (err as { status?: number }).status === 429) {
    return true;
  }
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("429") ||
    msg.includes("security purposes") ||
    msg.includes("over_email_send_rate_limit")
  );
}

export function friendlyError(err: unknown, fallback = "Something went wrong."): string {
  if (!err) return fallback;
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const isNetworkError =
    !navigator.onLine ||
    msg.toLowerCase().includes("failed to fetch") ||
    msg.toLowerCase().includes("network error");
  if (isNetworkError) {
    return "Could not connect to the server. Please check your internet connection or try again later.";
  }
  if (isRateLimitError(err)) {
    return "Too many requests. Please wait a minute before trying again.";
  }
  return msg && !msg.toLowerCase().includes("[object object]") && msg !== "Error" ? msg : fallback;
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
