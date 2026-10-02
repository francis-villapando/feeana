import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/hooks/utils";
import {
  TUTORIAL_STEPS,
  shouldBlockTutorial,
  type TutorialPlacement,
} from "@/lib/tutorial/tutorialSteps";
import { useTutorialStore } from "@/lib/tutorial/tutorialStore";
import { ConfirmationDialog } from "@/components/faculty";

const ANCHOR_ATTEMPTS = 50;
const ANCHOR_RETRY_MS = 100;
const SCROLL_SETTLE_MS = 300;
const TOOLTIP_WIDTH = 360;
const TOOLTIP_GAP = 12;
const VIEWPORT_MARGIN = 16;
const CUTOUT_PADDING = 6;
const POPPER_MERGE_MARGIN = 24;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SPOTLIGHT_SHADOW = "0 0 0 9999px rgba(9, 9, 11, 0.62), 0 0 0 2px hsl(var(--primary))";
const EXTRA_HOLE_SHADOW = "0 0 0 2px hsl(var(--primary) / 0.5)";

function toRect(el: HTMLElement): Rect | null {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function mergeNearbyPoppers(target: Rect): Rect {
  let merged = target;
  const expanded = {
    top: target.top - POPPER_MERGE_MARGIN,
    left: target.left - POPPER_MERGE_MARGIN,
    right: target.left + target.width + POPPER_MERGE_MARGIN,
    bottom: target.top + target.height + POPPER_MERGE_MARGIN,
  };
  for (const el of document.querySelectorAll<HTMLElement>("[data-radix-popper-content-wrapper]")) {
    const r = toRect(el);
    if (!r) continue;
    const overlaps =
      r.left < expanded.right &&
      r.left + r.width > expanded.left &&
      r.top < expanded.bottom &&
      r.top + r.height > expanded.top;
    if (!overlaps) continue;
    const top = Math.min(merged.top, r.top);
    const left = Math.min(merged.left, r.left);
    const bottom = Math.max(merged.top + merged.height, r.top + r.height);
    const right = Math.max(merged.left + merged.width, r.left + r.width);
    merged = { top, left, width: right - left, height: bottom - top };
  }
  return merged;
}

function holeStyle(rect: Rect): React.CSSProperties {
  return {
    top: rect.top - CUTOUT_PADDING,
    left: rect.left - CUTOUT_PADDING,
    width: rect.width + CUTOUT_PADDING * 2,
    height: rect.height + CUTOUT_PADDING * 2,
    borderRadius: 12,
  };
}

export function TutorialOverlay() {
  const { step, stepIndex, isActive, isFinished, advanceIfStep, finish, skip, spotlightAnchor } =
    useTutorialStore();
  const [rect, setRect] = useState<Rect | null>(null);
  const [hasAnchor, setHasAnchor] = useState(false);
  const [extras, setExtras] = useState<Rect[]>([]);
  const [degraded, setDegraded] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipSize, setTooltipSize] = useState<{ width: number; height: number }>({
    width: TOOLTIP_WIDTH,
    height: 220,
  });

  const anchor = spotlightAnchor ?? step?.anchor ?? null;
  const interactiveKey = step?.interactive?.join("|") ?? "";

  const measure = useCallback((): boolean => {
    if (!anchor) {
      setRect(null);
      setHasAnchor(false);
      setExtras([]);
      return false;
    }
    const el = document.querySelector<HTMLElement>(`[data-tutorial="${anchor}"]`);
    const target = el ? toRect(el) : null;
    if (!el || !target) {
      setRect(null);
      setHasAnchor(false);
      setExtras([]);
      return false;
    }
    setHasAnchor(true);
    setDegraded(false);
    setRect(mergeNearbyPoppers(target));
    setExtras(
      (interactiveKey ? interactiveKey.split("|") : [])
        .filter((selector) => selector !== anchor)
        .map((selector) => document.querySelector<HTMLElement>(`[data-tutorial="${selector}"]`))
        .map((found) => (found ? toRect(found) : null))
        .filter((r): r is Rect => r !== null),
    );
    return true;
  }, [anchor, interactiveKey]);

  useEffect(() => {
    if (!isActive || !anchor) {
      setRect(null);
      setHasAnchor(false);
      setExtras([]);
      setDegraded(false);
      return;
    }

    let attempts = 0;
    let retryTimer = 0;
    let settleTimer = 0;
    let scrolled = false;

    const retry = () => {
      attempts += 1;
      if (!measure()) {
        if (attempts >= ANCHOR_ATTEMPTS) {
          console.warn(
            `[tutorial] anchor "${anchor}" unresolved after ${ANCHOR_ATTEMPTS} attempts; showing the centered card.`,
          );
          setDegraded(true);
          return;
        }
        retryTimer = window.setTimeout(retry, ANCHOR_RETRY_MS);
        return;
      }
      if (scrolled) return;
      scrolled = true;
      document
        .querySelector<HTMLElement>(`[data-tutorial="${anchor}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      settleTimer = window.setTimeout(measure, SCROLL_SETTLE_MS);
    };
    retry();

    const observer = new MutationObserver(measure);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-tutorial"],
    });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("orientationchange", measure);
    return () => {
      observer.disconnect();
      window.clearTimeout(retryTimer);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("orientationchange", measure);
    };
  }, [isActive, anchor, measure]);

  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) setTooltipSize({ width: r.width, height: r.height });
  }, [step?.id, rect]);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel: string;
    showCancel: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  if (!isActive || !step || stepIndex === null) return null;

  const spotlit = rect !== null;
  const blocking = shouldBlockTutorial(spotlit, step.placement);
  const centered = !spotlit || step.placement === "center";
  const style = centered ? centeredStyle : tooltipStyle(rect, step.placement, tooltipSize);
  const total = TUTORIAL_STEPS.length;
  const index = stepIndex;

  const isAcknowledgement = step.trigger.type === "acknowledgement";
  const acknowledgeLabel =
    step.trigger.type === "acknowledgement" ? (step.trigger.buttonLabel ?? "Continue") : null;

  const actionHint = (() => {
    if (centered || !hasAnchor || degraded) return null;
    if (isAcknowledgement) return null;
    if (step.trigger.type === "worker-complete") return null;
    if (step.trigger.type === "navigation") {
      return extras.length > 0
        ? "Highlighted above — click it, then navigate."
        : "Highlighted above — click it to continue.";
    }
    return extras.length > 0
      ? "Highlighted above — click it, then the outlined control."
      : "Highlighted above — go ahead and click it.";
  })();

  const modalOpen = confirmDialog !== null;

  const handleAcknowledge = () => {
    if (isFinished) {
      setConfirmDialog({
        isOpen: true,
        title: "Complete Tutorial & Clean Up",
        description:
          "Congratulations on completing the walkthrough! All sample curriculum, classes, and feedback sessions created during this tour will now be permanently deleted from your workspace.",
        actionLabel: "Finish & Delete Sample Data",
        showCancel: false,
        onConfirm: () => {
          setConfirmDialog(null);
          finish();
        },
      });
    } else {
      advanceIfStep(step.id);
    }
  };

  const handleSkipRequest = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Exit Tutorial & Delete Data",
      description:
        "Are you sure you want to exit the guided tour? All sample curriculum, classes, and feedback created during this run will be permanently deleted.",
      actionLabel: "Exit & Delete Data",
      showCancel: true,
      onConfirm: () => {
        setConfirmDialog(null);
        skip();
      },
    });
  };

  const topEdge = rect ? Math.max(0, rect.top - CUTOUT_PADDING) : 0;
  const leftEdge = rect ? Math.max(0, rect.left - CUTOUT_PADDING) : 0;
  const rightEdge = rect ? rect.left + rect.width + CUTOUT_PADDING : 0;
  const bottomEdge = rect ? rect.top + rect.height + CUTOUT_PADDING : 0;

  return (
    <div
      className="fixed inset-0 z-[80] pointer-events-none print:hidden"
      role="dialog"
      aria-label="Guided tour"
    >
      {!modalOpen &&
        (spotlit ? (
          <>
            <div
              className={cn(
                "fixed left-0 right-0 top-0 bg-zinc-950/65 transition-all duration-200 ease-out",
                blocking ? "pointer-events-auto cursor-default" : "pointer-events-none",
              )}
              style={{ height: topEdge }}
            />
            <div
              className={cn(
                "fixed bottom-0 left-0 right-0 bg-zinc-950/65 transition-all duration-200 ease-out",
                blocking ? "pointer-events-auto cursor-default" : "pointer-events-none",
              )}
              style={{ top: bottomEdge }}
            />
            <div
              className={cn(
                "fixed left-0 bg-zinc-950/65 transition-all duration-200 ease-out",
                blocking ? "pointer-events-auto cursor-default" : "pointer-events-none",
              )}
              style={{ top: topEdge, width: leftEdge, height: Math.max(0, bottomEdge - topEdge) }}
            />
            <div
              className={cn(
                "fixed right-0 bg-zinc-950/65 transition-all duration-200 ease-out",
                blocking ? "pointer-events-auto cursor-default" : "pointer-events-none",
              )}
              style={{ top: topEdge, left: rightEdge, height: Math.max(0, bottomEdge - topEdge) }}
            />
          </>
        ) : (
          <div
            className={cn(
              "fixed inset-0 bg-zinc-950/65 transition-all duration-200 ease-out",
              blocking ? "pointer-events-auto cursor-default" : "pointer-events-none",
            )}
          />
        ))}

      {/* Main spotlight highlight ring */}
      {spotlit && !modalOpen && (
        <div
          className="pointer-events-none fixed z-[85] rounded-xl border-2 border-primary ring-4 ring-primary/25 shadow-[0_0_20px_hsl(var(--primary)/0.4)] transition-all duration-200 ease-out"
          style={holeStyle(rect)}
        />
      )}

      {/* Extra interactive highlight rings */}
      {spotlit &&
        !modalOpen &&
        extras.map((extra, i) => (
          <div
            key={`${extra.top}-${extra.left}-${i}`}
            className="pointer-events-none fixed z-[85] rounded-xl border-2 border-dashed border-primary/60 ring-2 ring-primary/15 transition-all duration-200 ease-out"
            style={holeStyle(extra)}
          />
        ))}

      {!modalOpen && (
        <div
          ref={tooltipRef}
          className={cn(
            "pointer-events-auto fixed z-[90] rounded-xl border border-border/70 bg-popover/95 p-4 text-popover-foreground shadow-2xl backdrop-blur-xl",
            centered
              ? "left-1/2 top-1/2 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 sm:w-96"
              : "w-[min(360px,calc(100vw-2rem))]",
          )}
          style={style}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-semibold">{step.title}</h2>
            <button
              type="button"
              onClick={handleSkipRequest}
              aria-label="Skip tour"
              className="-m-2 flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-2 cursor-text text-sm leading-relaxed text-muted-foreground">
            {step.body}
          </p>

          {actionHint && (
            <p className="mt-2 cursor-text text-xs text-muted-foreground/80">{actionHint}</p>
          )}

          {degraded && !isAcknowledgement && (
            <p className="mt-2 cursor-text text-xs text-muted-foreground/80">
              This step's target couldn't be found. Use the ✕ to exit the tour, or restart it from
              your profile menu (top right).
            </p>
          )}

          {/* Footer: only acknowledgement steps render a primary action button. */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs tabular-nums text-muted-foreground">
              {index + 1} of {total}
            </span>
            <div className="flex items-center gap-2">
              {isAcknowledgement && (
                <Button size="sm" onClick={handleAcknowledge} className="min-h-11 gap-1.5">
                  {isFinished ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      {acknowledgeLabel}
                    </>
                  ) : (
                    acknowledgeLabel
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <ConfirmationDialog
          isOpen={confirmDialog.isOpen}
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          description={confirmDialog.description}
          actionType="delete"
          confirmLabel={confirmDialog.actionLabel}
          showCancel={confirmDialog.showCancel}
        />
      )}
    </div>
  );
}

const centeredStyle: React.CSSProperties = {};

function tooltipStyle(
  rect: Rect,
  placement: TutorialPlacement,
  size: { width: number; height: number },
): React.CSSProperties {
  const vw = typeof window === "undefined" ? 0 : window.innerWidth;
  const vh = typeof window === "undefined" ? 0 : window.innerHeight;
  const { top, left, width, height } = rect;
  const { width: tw, height: th } = size;

  const fits: Record<Exclude<TutorialPlacement, "center">, boolean> = {
    top: top >= th + VIEWPORT_MARGIN,
    bottom: top + height + th + TOOLTIP_GAP <= vh - VIEWPORT_MARGIN,
    left: left >= tw + VIEWPORT_MARGIN,
    right: left + width + tw + TOOLTIP_GAP <= vw - VIEWPORT_MARGIN,
  };
  const order: Record<TutorialPlacement, Exclude<TutorialPlacement, "center">[]> = {
    top: ["top", "bottom", "right", "left"],
    bottom: ["bottom", "top", "right", "left"],
    left: ["left", "right", "bottom", "top"],
    right: ["right", "left", "bottom", "top"],
    center: [],
  };
  const resolved = order[placement].find((p) => fits[p]);
  if (!resolved) return centeredStyle;

  const clampX = (x: number) =>
    Math.min(Math.max(x, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, vw - tw - VIEWPORT_MARGIN));
  const clampY = (y: number) =>
    Math.min(Math.max(y, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, vh - th - VIEWPORT_MARGIN));

  switch (resolved) {
    case "top":
      return { top: clampY(top - th - TOOLTIP_GAP), left: clampX(left + width / 2 - tw / 2) };
    case "bottom":
      return {
        top: clampY(top + height + TOOLTIP_GAP),
        left: clampX(left + width / 2 - tw / 2),
      };
    case "left":
      return { top: clampY(top + height / 2 - th / 2), left: clampX(left - tw - TOOLTIP_GAP) };
    default:
      return {
        top: clampY(top + height / 2 - th / 2),
        left: clampX(left + width + TOOLTIP_GAP),
      };
  }
}
