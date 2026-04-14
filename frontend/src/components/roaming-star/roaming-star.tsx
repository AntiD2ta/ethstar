// Copyright © 2026 Miguel Tenorio Potrony - AntiD2ta.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  BREATHE_PERIOD_MS,
  BREATHE_SCALE_MAX,
  CANCEL_CONFIRM_TIMEOUT_MS,
  CANCEL_GESTURE,
  DORMANT_STAR_SIZE_PX,
  DURATION_FLIP_DORMANT_TO_ROAMING,
  DURATION_FLIP_TO_TAKEOVER,
  EASE_OUT_EXPO,
  EASE_OUT_QUART,
  ROAMING_STAR_SIZE_PX,
  TAKEOVER_SCALE,
  TAKEOVER_SPIN_PERIOD_MS,
  TAKEOVER_X_RATIO,
  TAKEOVER_Y_RATIO,
} from "./constants";
import { isDismissed, markDismissed } from "./session-persistence";
import { StarShape } from "./star-shape";
import { useFlipTransition } from "./use-flip-transition";
import { useHeroVisibility } from "./use-hero-visibility";
import { useRoamingPath } from "./use-roaming-path";
import { useTrailCanvas } from "./use-trail-canvas";
import type { RoamingStarMode, RoamingStarState } from "./types";

export interface RoamingStarProps {
  /** Hero element — intersection observed to flip between dormant/roaming. */
  heroRef: RefObject<HTMLElement | null>;
  /** Auth / progression snapshot pushed from parent. */
  state: RoamingStarState;
  /** True when StarModal is in its progress step — drives takeover mode. */
  inProgress: boolean;
  /** True when a completion result is available — triggers supernova + dismiss. */
  completed: boolean;
  /** Called on user click/Enter/Space. Parent opens StarModal. */
  onTrigger: () => void;
  /** Called when the user wants to cancel in-progress starring. */
  onCancel?: () => void;
  /** Suppress rendering entirely (e.g. all repos already starred, unauth + dismissed). */
  hidden?: boolean;
}

/**
 * The roaming star. Three modes, one silhouette, progressive form.
 *
 * Rendering strategy:
 *  - "dormant": star lives in-hero as a normal button.
 *  - "roaming" / "takeover" / "supernova": star is portaled to document.body
 *    behind a fixed canvas trail layer.
 *
 * The switch between these substrates uses a manual FLIP: we measure the
 * dormant-slot rect before unmount, render in the portal at that same
 * viewport position, then animate to the roaming or takeover target.
 */
export const RoamingStar = memo(function RoamingStar({
  heroRef,
  state,
  inProgress,
  completed,
  onTrigger,
  onCancel,
  hidden,
}: RoamingStarProps) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const heroVisible = useHeroVisibility(heroRef, 0.2);

  // Session-persistent dismissal. Once supernova has played out, the star
  // stays hidden until localStorage is cleared. Gate on hidden to avoid
  // reading storage when we aren't going to render anyway.
  const [dismissedBySession, setDismissedBySession] = useState<boolean>(() =>
    typeof window === "undefined" ? false : isDismissed(),
  );

  // Derive the *visual* mode from inputs.
  const mode: RoamingStarMode = useMemo(() => {
    if (dismissedBySession) return "dismissed";
    if (completed) return "supernova";
    if (inProgress) return "takeover";
    return heroVisible ? "dormant" : "roaming";
  }, [dismissedBySession, completed, inProgress, heroVisible]);

  // Refs for DOM elements and live position used by the rAF trail.
  const dormantSlotRef = useRef<HTMLDivElement | null>(null);
  const floatingElRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const starLivePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const statusRef = useRef(state.status);
  statusRef.current = state.status;
  // Captured before the user triggers takeover so focus can be returned to
  // the prior element after supernova (a11y brief: "Focus returns…").
  const preTriggerFocusRef = useRef<HTMLElement | null>(null);

  const { flipTo, cancel: cancelFlip } = useFlipTransition();

  const roamingSize = ROAMING_STAR_SIZE_PX;
  const dormantSize = DORMANT_STAR_SIZE_PX;
  const halfRoaming = roamingSize / 2;

  // Drive free-floating position when in roaming mode (idle drift).
  // The hook writes `floatingElRef.current.style.left/top` directly each rAF
  // tick, and mutates `starLivePosRef` in place — no per-frame React render.
  const { labelHovered } = useRoamingPath({
    elementRef: floatingElRef,
    starPosRef: starLivePosRef,
    halfSize: halfRoaming,
    active: mode === "roaming",
    reducedMotion,
  });

  // Canvas trail + supernova.
  const trail = useTrailCanvas({
    canvasRef,
    starPosRef: starLivePosRef,
    statusRef,
    enabled: !reducedMotion && (mode === "roaming" || mode === "takeover" || mode === "supernova"),
  });

  // Track the center-viewport takeover target.
  const takeoverTarget = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const computeTakeoverTarget = useCallback(() => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const centerX = vw * TAKEOVER_X_RATIO - (dormantSize * TAKEOVER_SCALE) / 2;
    const centerY = vh * TAKEOVER_Y_RATIO - (dormantSize * TAKEOVER_SCALE) / 2;
    takeoverTarget.current = { x: centerX, y: centerY };
    return takeoverTarget.current;
  }, [dormantSize]);

  // Position the floating element for takeover/supernova. Roaming drift is
  // written directly by `useRoamingPath`'s rAF — no React re-render per frame.
  useLayoutEffect(() => {
    if (mode !== "takeover" && mode !== "supernova") return;
    const el = floatingElRef.current;
    if (!el) return;
    const { x, y } = computeTakeoverTarget();
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    starLivePosRef.current.x = x + (dormantSize * TAKEOVER_SCALE) / 2;
    starLivePosRef.current.y = y + (dormantSize * TAKEOVER_SCALE) / 2;
  }, [mode, dormantSize, computeTakeoverTarget]);

  // FLIP orchestration on substrate-swap transitions only.
  // Within-portal transitions (roaming → takeover) are handled by a CSS
  // transition on left/top driven by the position effect above.
  const prevModeRef = useRef<RoamingStarMode>(mode);
  const prevSlotRectRef = useRef<DOMRect | null>(null);
  useLayoutEffect(() => {
    const prev = prevModeRef.current;
    prevModeRef.current = mode;
    // Cache slot rect while dormant so we can FLIP from it on the swap.
    if (mode === "dormant" && dormantSlotRef.current) {
      prevSlotRectRef.current = dormantSlotRef.current.getBoundingClientRect();
    }
    if (prev === mode) return;
    if (reducedMotion) return;

    const floating = floatingElRef.current;

    // dormant → roaming: the floating layer just mounted at roamingPos.
    // FLIP from the cached slot rect so the jump from inline to portal
    // reads as a single smooth flight.
    if (prev === "dormant" && mode === "roaming" && floating && prevSlotRectRef.current) {
      const slotRect = prevSlotRectRef.current;
      flipTo({
        element: floating,
        target: {
          x: slotRect.left + slotRect.width / 2 - halfRoaming,
          y: slotRect.top + slotRect.height / 2 - halfRoaming,
        },
        durationMs: DURATION_FLIP_DORMANT_TO_ROAMING,
        easing: EASE_OUT_QUART,
      });
    }

    // roaming → dormant: cancel any in-flight FLIP. The portal unmounts;
    // the dormant slot restores in its CSS layout. Acceptable cross-fade.
    if (prev === "roaming" && mode === "dormant") {
      cancelFlip();
    }

    // any → takeover: the position effect sets left/top to the target;
    // CSS `transition: left, top` (applied only during takeover mode) animates
    // from the previous roaming/drift position to center. We also bump the
    // star live position for the supernova origin.
    if (mode === "takeover") {
      const { x, y } = computeTakeoverTarget();
      starLivePosRef.current.x = x + (dormantSize * TAKEOVER_SCALE) / 2;
      starLivePosRef.current.y = y + (dormantSize * TAKEOVER_SCALE) / 2;
    }
  }, [mode, reducedMotion, flipTo, cancelFlip, halfRoaming, dormantSize, computeTakeoverTarget]);

  // Supernova trigger on completion. Restores focus to the element that held
  // it before takeover so keyboard users don't land on <body>.
  const supernovaPlayedRef = useRef(false);
  useEffect(() => {
    if (mode !== "supernova" || supernovaPlayedRef.current) return;
    supernovaPlayedRef.current = true;

    const run = async () => {
      try {
        await trail.triggerSupernova();
      } finally {
        markDismissed();
        setDismissedBySession(true);
        // A11y: return focus to the prior focused element (brief §Accessibility).
        const prior = preTriggerFocusRef.current;
        preTriggerFocusRef.current = null;
        if (prior && typeof prior.focus === "function" && prior.isConnected) {
          // Defer so React has a chance to unmount the star button first —
          // otherwise a focus() call while the button is still in the tree
          // would fight our own blur as we unmount.
          queueMicrotask(() => {
            try {
              prior.focus();
            } catch {
              // ignore — element may have been removed between queue and run.
            }
          });
        }
      }
    };
    void run();
  }, [mode, trail]);

  // Pause trail spawning during takeover (brief says orbiting ring instead of tail).
  useEffect(() => {
    trail.setSpawning(mode === "roaming");
  }, [mode, trail]);

  // ARIA label per brief.
  const ariaLabel = useMemo(() => {
    switch (state.status) {
      case "disconnected":
        return "Light it up — continue with GitHub to start starring repositories";
      case "ready":
        return "Begin starring all Ethereum repositories";
      case "in-progress":
        return `Starring ${state.fillLevel > 0 ? Math.round(state.fillLevel * 100) : 0} percent complete`;
      case "partial-failure":
        return `Retry — ${state.failedCount ?? 0} couldn't be starred`;
      case "success":
        return "All repositories starred";
    }
  }, [state.status, state.fillLevel, state.failedCount]);

  // Two-line label text. The disconnected secondary line is dynamic per brief:
  // pending popup → "Waiting for GitHub…"; blocked → "Popup blocked — click to retry".
  const labelLines = useMemo<[string, string | null]>(() => {
    if (state.status === "disconnected") {
      const secondary =
        state.oauthStatus === "pending"
          ? "Waiting for GitHub…"
          : state.oauthStatus === "blocked"
            ? "Popup blocked — click to retry"
            : "↗ Continue with GitHub";
      return ["Light it up", secondary];
    }
    if (state.status === "ready") {
      return ["Begin starring", null];
    }
    if (state.status === "in-progress") {
      return [state.counterLabel ?? "Starring…", null];
    }
    if (state.status === "partial-failure") {
      return [`Retry · ${state.failedCount ?? 0} couldn't be starred`, null];
    }
    return ["All starred", null];
  }, [state.status, state.counterLabel, state.failedCount, state.oauthStatus]);

  // Wrap onTrigger so we snapshot the prior focused element *before* firing.
  // The parent opens a Radix Dialog (which steals focus) on takeover; we need
  // the prior element captured synchronously on user input, not post-mount.
  const triggerWithFocusCapture = useCallback(() => {
    if (typeof document !== "undefined") {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) {
        preTriggerFocusRef.current = active;
      }
    }
    onTrigger();
  }, [onTrigger]);

  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        triggerWithFocusCapture();
      }
    },
    [triggerWithFocusCapture],
  );

  // Click-on-star gesture confirm helper (variant B of the cancel prototype).
  const [pendingCancel, setPendingCancel] = useState(false);
  useEffect(() => {
    if (!pendingCancel) return;
    const t = setTimeout(() => setPendingCancel(false), CANCEL_CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [pendingCancel]);

  const handleStarClick = useCallback(() => {
    if (mode === "takeover" && CANCEL_GESTURE === "click") {
      if (pendingCancel) {
        setPendingCancel(false);
        onCancel?.();
      } else {
        setPendingCancel(true);
      }
      return;
    }
    if (mode === "takeover") return;
    triggerWithFocusCapture();
  }, [mode, pendingCancel, onCancel, triggerWithFocusCapture]);

  if (hidden || mode === "dismissed") return null;

  // ===== Dormant slot (in-hero) =====
  const dormantBlock = (
    <div
      ref={dormantSlotRef}
      className="inline-flex flex-col items-center gap-3"
      data-testid="roaming-star-dormant-slot"
    >
      {mode === "dormant" && (
        <StarButton
          size={dormantSize}
          fillLevel={state.fillLevel}
          status={state.status}
          reducedMotion={reducedMotion}
          ariaLabel={ariaLabel}
          onClick={handleStarClick}
          onKey={handleKey}
          breathing={!reducedMotion}
        />
      )}
      {mode === "dormant" && (
        <div className="flex flex-col items-center gap-0.5 text-sm">
          <span className="font-heading text-base font-semibold text-foreground">
            {labelLines[0]}
          </span>
          {labelLines[1] && (
            <span className="text-xs text-muted-foreground">{labelLines[1]}</span>
          )}
        </div>
      )}
    </div>
  );

  // ===== Floating layer (portal) =====
  const floatingSize =
    mode === "takeover" ? dormantSize * TAKEOVER_SCALE : roamingSize;

  // Takeover / supernova position via left/top: CSS transitions from last
  // roaming position to center. Roaming drift updates position per rAF
  // (~16ms), so a transition that long would smear the motion — we pay the
  // cost only in takeover/supernova where the position is stable.
  const takeoverTransition = `left ${DURATION_FLIP_TO_TAKEOVER}ms ${EASE_OUT_EXPO}, top ${DURATION_FLIP_TO_TAKEOVER}ms ${EASE_OUT_EXPO}, width ${DURATION_FLIP_TO_TAKEOVER}ms ${EASE_OUT_EXPO}, height ${DURATION_FLIP_TO_TAKEOVER}ms ${EASE_OUT_EXPO}`;

  const floatingStyle: CSSProperties = {
    position: "fixed",
    left: 0,
    top: 0,
    width: floatingSize,
    height: floatingSize,
    zIndex: mode === "takeover" || mode === "supernova" ? 55 : 40,
    pointerEvents: mode === "takeover" || mode === "roaming" ? "auto" : "none",
    transition:
      reducedMotion
        ? "opacity 220ms linear, width 220ms linear, height 220ms linear"
        : mode === "takeover" || mode === "supernova"
          ? takeoverTransition
          : undefined,
    willChange: mode === "takeover" ? "left, top" : "transform",
  };

  const spinStyle: CSSProperties =
    mode === "takeover" && !reducedMotion
      ? {
          animation: `roaming-star-spin ${TAKEOVER_SPIN_PERIOD_MS}ms linear infinite`,
          transformStyle: "preserve-3d",
        }
      : {};

  const floatingBlock = (mode === "roaming" || mode === "takeover" || mode === "supernova") && (
    <>
      {/* Dimmer backdrop during takeover (brief: ~8%) */}
      {mode === "takeover" && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "oklch(0 0 0 / 0.08)",
            zIndex: 54,
            pointerEvents: "none",
          }}
        />
      )}

      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "100vw",
          height: "100vh",
          zIndex: mode === "takeover" ? 54 : 39,
          pointerEvents: "none",
        }}
      />

      <div ref={floatingElRef} style={floatingStyle}>
        <div style={spinStyle}>
          <StarButton
            size={floatingSize}
            fillLevel={state.fillLevel}
            status={state.status}
            reducedMotion={reducedMotion}
            ariaLabel={
              mode === "takeover" && pendingCancel
                ? "Click again to cancel"
                : ariaLabel
            }
            onClick={handleStarClick}
            onKey={handleKey}
            breathing={false}
          />
        </div>

        {/* Roaming label — revealed on cursor gravity (desktop) or tap (mobile). */}
        {mode === "roaming" && labelHovered && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "absolute",
              top: "110%",
              left: "50%",
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              padding: "4px 10px",
              borderRadius: 999,
              backgroundColor: "oklch(0.23 0.022 280 / 0.85)",
              color: "var(--foreground)",
              fontSize: 12,
              backdropFilter: "blur(8px)",
              border: "1px solid oklch(0.38 0.028 280 / 0.35)",
              pointerEvents: "none",
            }}
          >
            {labelLines[0]}
          </div>
        )}
      </div>

      {/* Takeover counter + cancel (both variants rendered conditionally) */}
      {mode === "takeover" && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            top: `calc(${TAKEOVER_Y_RATIO * 100}% + ${(dormantSize * TAKEOVER_SCALE) / 2 + 24}px)`,
            transform: "translateX(-50%)",
            zIndex: 56,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <p
            role="status"
            aria-live="polite"
            className="font-heading text-lg text-foreground"
          >
            {state.counterLabel ?? labelLines[0]}
          </p>
          {CANCEL_GESTURE === "button" && onCancel && (
            <button
              type="button"
              onClick={() => onCancel?.()}
              className="rounded-full border border-border bg-background/50 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
          )}
          {CANCEL_GESTURE === "click" && pendingCancel && (
            <p className="text-xs text-muted-foreground">Click again to cancel</p>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {dormantBlock}
      {typeof document !== "undefined" &&
        floatingBlock &&
        createPortal(floatingBlock, document.body)}
      {/* Per-instance keyframes injected once. `inert` is unused; the parent
          makes the page inert via StarModal's Radix Dialog during takeover. */}
      <style>{`
        @keyframes roaming-star-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(${BREATHE_SCALE_MAX}); }
        }
        @keyframes roaming-star-spin {
          from { transform: rotateY(0deg); }
          to { transform: rotateY(360deg); }
        }
        .roaming-star-breathing {
          animation: roaming-star-breathe ${BREATHE_PERIOD_MS}ms ease-in-out infinite;
          transform-origin: center;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .roaming-star-breathing { animation: none !important; }
        }
      `}</style>
    </>
  );
});

// === Inner button === //

interface StarButtonProps {
  size: number;
  fillLevel: number;
  status: RoamingStarState["status"];
  reducedMotion: boolean;
  ariaLabel: string;
  onClick: () => void;
  onKey: (e: KeyboardEvent<HTMLButtonElement>) => void;
  breathing: boolean;
}

function StarButton({
  size,
  fillLevel,
  status,
  reducedMotion,
  ariaLabel,
  onClick,
  onKey,
  breathing,
}: StarButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={onKey}
      data-testid="roaming-star-button"
      data-status={status}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full"
      style={{
        background: "transparent",
        border: 0,
        padding: 0,
        cursor: "pointer",
        width: size,
        height: size,
      }}
    >
      <span className={breathing && !reducedMotion ? "roaming-star-breathing" : undefined} style={{ display: "inline-block" }}>
        <StarShape
          size={size}
          fillLevel={fillLevel}
          status={status}
          flaring={false}
        />
      </span>
    </button>
  );
}

export { CANCEL_GESTURE } from "./constants";
