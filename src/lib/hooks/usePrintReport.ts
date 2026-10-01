import { useCallback, useEffect, useRef } from "react";

/** Settle time after two animation frames so chart measurements stay stable. */
const PRINT_PAINT_DELAY_MS = 50;

/** Upper bound before the theme is restored even if `afterprint` never fires. */
const PRINT_FALLBACK_TIMEOUT_MS = 15000;

/** Characters the OS rejects in a filename; Chromium derives the PDF name from document.title. */
const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;

/**
 * Prints the page on white paper, then restores the caller's theme and title.
 *
 * The two awaited frames matter because window.print() blocks the main thread,
 * so ResponsiveContainer would never observe its narrower print width and the
 * charts would keep their screen dimensions.
 *
 * `documentTitle` becomes the exported PDF's filename, so it is set only for
 * the duration of the dialog and restored afterwards.
 */
export function usePrintReport() {
  const restoreRef = useRef<(() => void) | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Leaving the route mid-dialog must not strand the forced light theme.
  useEffect(() => () => restoreRef.current?.(), []);

  return useCallback(async (documentTitle: string) => {
    const root = document.documentElement;
    const previousTheme = root.classList.contains("dark") ? "dark" : "light";
    const previousTitle = document.title;

    const restore = () => {
      if (fallbackTimerRef.current !== null) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      window.removeEventListener("afterprint", restore);
      restoreRef.current = null;
      document.title = previousTitle;
      root.classList.remove("light", "dark");
      root.classList.add(previousTheme);
    };
    restoreRef.current = restore;

    root.classList.remove("light", "dark");
    root.classList.add("light");

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, PRINT_PAINT_DELAY_MS);
        });
      });
    });

    // The fallback outlives window.print() on purpose: engines that skip the
    // afterprint event would otherwise keep the forced light theme forever.
    window.addEventListener("afterprint", restore);
    fallbackTimerRef.current = setTimeout(restore, PRINT_FALLBACK_TIMEOUT_MS);
    document.title = documentTitle.replace(INVALID_FILENAME_CHARS, "-");
    window.print();
  }, []);
}
