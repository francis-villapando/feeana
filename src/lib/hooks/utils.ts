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
