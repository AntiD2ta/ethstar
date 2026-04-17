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
  DISCOVERY_HINT_DELAY_MS,
  DISCOVERY_HINT_TEXT,
  DISCOVERY_HINT_VISIBLE_MS,
  DORMANT_STAR_SIZE_PX,
  DURATION_FLIP_DORMANT_TO_ROAMING,
  DURATION_FLIP_TO_TAKEOVER,
  EASE_OUT_EXPO,
  EASE_OUT_QUART,
  LABEL_INTRO_MS,
  REDUCED_MOTION_FLASH_MS,
  ROAMING_STAR_SIZE_PX,
  SUPERNOVA_REPLAY_THROTTLE_MS,
  TAKEOVER_SCALE,
  TAKEOVER_SPIN_PERIOD_MS,
  TAKEOVER_X_RATIO,
  TAKEOVER_Y_RATIO,
} from "./constants";
import {
  clearDismissed,
  hasSeenDiscoveryHint,
  isDismissed,
  markDiscoveryHintSeen,
  markDismissed,
} from "./session-persistence";
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
  // Touch-only devices have no cursor, so the gravity-reveal path is
  // unreachable. Keep the label permanently visible while roaming so the
  // floating diamond never reads as a mystery element.
  const touchOnly = useMediaQuery("(hover: none)");

  // Session-persistent dismissal. Once supernova has played out, the star
  // stays hidden until localStorage is cleared. Gate on hidden to avoid
  // reading storage when we aren't going to render anyway.
  const [dismissedBySession, setDismissedBySession] = useState<boolean>(() =>
    typeof window === "undefined" ? false : isDismissed(),
  );

  // If the user ends up disconnected while dismissal is still persisted
  // (e.g. they completed a cycle, then logged out, then came back), the
  // primary CTA would be gone on a page that shows the "Connect via
  // GitHub" header — confusing first-timer state. Treat dismissal as
  // tied to *this connected session*: any time the status resolves to
  // "disconnected" we clear the flag so the dormant star reappears.
  useEffect(() => {
    if (state.status === "disconnected" && dismissedBySession) {
      clearDismissed();
      setDismissedBySession(false);
    }
  }, [state.status, dismissedBySession]);

  // Phase E.2 — supernova settles into the all-starred terminal state in
  // place rather than auto-dismissing. Once the burst's particles fade, we
  // flip this flag so mode resolution falls back through to dormant/roaming
  // (where `state.status === "success"` drives the "All starred" gold
  // diamond the user can tap to replay). Reset when `completed` goes false
  // so a second session can re-play a fresh supernova.
  const [supernovaSettled, setSupernovaSettled] = useState(false);

  // One-time discovery hint — fires ~DISCOVERY_HINT_DELAY_MS after the slot
  // settles, telling keyboard + mobile users the diamond is replayable. The
  // hint is paired with a soft pulse on the diamond so sighted users see the
  // affordance too. Suppressed entirely under reduced-motion (motion-sensitive
  // users get no surprise pulse) and gated by sessionStorage so it fires at
  // most once per tab.
  const [discoveryHintVisible, setDiscoveryHintVisible] = useState(false);

  // Derive the *visual* mode from inputs.
  const mode: RoamingStarMode = useMemo(() => {
    if (dismissedBySession) return "dismissed";
    // `completed` is sticky once the parent sets it (the starResult ref
    // lives for the rest of the session). Gating on `!supernovaSettled`
    // here lets the burst play once, then hand the dormant slot back to
    // the success-terminal path — no reload required.
    if (completed && !supernovaSettled) return "supernova";
    if (inProgress) return "takeover";
    return heroVisible ? "dormant" : "roaming";
  }, [dismissedBySession, completed, supernovaSettled, inProgress, heroVisible]);

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

  // Intro-label visibility — the roaming star would otherwise be a silent
  // 40px diamond drifting across the page with its label hidden behind a
  // 180px cursor-gravity radius (and tap-to-reveal on mobile). First-time
  // visitors scrolling past the hero never discover the CTA. We persist the
  // primary-line label for the first LABEL_INTRO_MS on every dormant →
  // roaming transition; touch-only devices keep it visible indefinitely.
  const [introVisible, setIntroVisible] = useState(false);
  useEffect(() => {
    if (mode !== "roaming") {
      setIntroVisible(false);
      return;
    }
    setIntroVisible(true);
    if (touchOnly) return; // Touch: persist indefinitely — no cursor to rediscover.
    const id = window.setTimeout(() => setIntroVisible(false), LABEL_INTRO_MS);
    return () => window.clearTimeout(id);
  }, [mode, touchOnly]);

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

  // Canvas trail + supernova. We extend the enabled range to include the
  // terminal `success` state (in any mode) so the user can re-tap the
  // all-starred diamond for a celebratory replay. The trail rAF loop stays
  // cheap while idle — spawning is paused via setSpawning(false), so the loop
  // just paints an empty particle list each frame.
  const trailEnabled =
    !reducedMotion &&
    (mode === "roaming" ||
      mode === "takeover" ||
      mode === "supernova" ||
      state.status === "success");
  const trail = useTrailCanvas({
    canvasRef,
    starPosRef: starLivePosRef,
    statusRef,
    enabled: trailEnabled,
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

  // Supernova trigger on completion. Phase E.2: the burst plays *once* per
  // completion, then the slot settles into the all-starred terminal state in
  // place — `setSupernovaSettled(true)` flips the mode off supernova so the
  // dormant/success branch re-renders the diamond. The dismissal flag is no
  // longer written here; only explicit × / "Done" writes it (see
  // `handleExplicitDismiss` below). Focus still returns to the element that
  // held it before takeover so keyboard users don't land on <body>.
  //
  // Keyed on `completed` (not `mode`) so a second session (starResult
  // cleared → set again) can re-play. `supernovaPlayedRef` guards against
  // StrictMode double-mounts firing the burst twice within one completion.
  const supernovaPlayedRef = useRef(false);
  useEffect(() => {
    if (!completed) {
      // Completion unwound (e.g. parent cleared starResult) — reset the
      // one-shot guards so the next completion cycle fires its own burst.
      // Gate on playedRef (which becomes true before settled, so a strict
      // superset) — reset iff a cycle actually played.
      if (supernovaPlayedRef.current) {
        supernovaPlayedRef.current = false;
        setSupernovaSettled(false);
      }
      return;
    }
    if (supernovaPlayedRef.current) return;
    supernovaPlayedRef.current = true;

    const run = async () => {
      try {
        await trail.triggerSupernova();
      } finally {
        setSupernovaSettled(true);
        // A11y: return focus to the prior focused element (brief §Accessibility).
        const prior = preTriggerFocusRef.current;
        preTriggerFocusRef.current = null;
        if (prior && typeof prior.focus === "function" && prior.isConnected) {
          // Defer so React has a chance to render the dormant-success slot
          // first — otherwise a focus() call would land while the star
          // button is mid-remount.
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
  }, [completed, trail]);

  // Pause trail spawning during takeover (brief says orbiting ring instead of tail).
  useEffect(() => {
    trail.setSpawning(mode === "roaming");
  }, [mode, trail]);

  // Discovery hint — fires once per tab, ~DISCOVERY_HINT_DELAY_MS after the
  // slot settles. Suppressed under reduced-motion (we'd otherwise pulse the
  // diamond, and "don't animate" is a bright-line rule for this user).
  useEffect(() => {
    if (!supernovaSettled) return;
    if (reducedMotion) return;
    if (hasSeenDiscoveryHint()) return;

    let hideId: number | undefined;
    const showId = window.setTimeout(() => {
      setDiscoveryHintVisible(true);
      markDiscoveryHintSeen();
      hideId = window.setTimeout(() => {
        setDiscoveryHintVisible(false);
      }, DISCOVERY_HINT_VISIBLE_MS);
    }, DISCOVERY_HINT_DELAY_MS);

    return () => {
      window.clearTimeout(showId);
      if (hideId !== undefined) window.clearTimeout(hideId);
    };
  }, [supernovaSettled, reducedMotion]);

  // ARIA label per brief. Primary label copy is verb + count, paired with
  // the H1 "Support Ethereum's builders" so the screen-reader experience
  // matches the visible primary line ("Star all 58 now") and avoids
  // duplicating the framing headline.
  const ariaLabel = useMemo(() => {
    switch (state.status) {
      case "disconnected":
        // When the count hasn't resolved, don't announce a concrete "0" —
        // "Star all 0 repos" reads as "already done" to screen readers, the
        // opposite of the loading intent. Drop the count instead.
        return state.remaining == null
          ? "Star all Ethereum repos — sign in with GitHub to begin"
          : `Star all ${state.remaining} Ethereum repos — sign in with GitHub to begin`;
      case "ready":
        return "Begin starring all Ethereum repositories";
      case "in-progress":
        return `Starring ${state.fillLevel > 0 ? Math.round(state.fillLevel * 100) : 0} percent complete`;
      case "partial-failure":
        return `Retry — ${state.failedCount ?? 0} repos failed to star`;
      case "success":
        return "All repositories starred";
    }
  }, [state.status, state.fillLevel, state.failedCount, state.remaining]);

  // Two-line label text. The disconnected primary line is verb + count
  // ("Star all 58 now") — paired with the H1 "Support Ethereum's builders"
  // so the eye reads framing → action without semantic duplication. The
  // secondary line carries the auth-popup lifecycle so first-timers see
  // exactly what the click will do.
  const labelLines = useMemo<[string, string | null]>(() => {
    if (state.status === "disconnected") {
      const secondary =
        state.oauthStatus === "pending"
          ? "Waiting for GitHub…"
          : state.oauthStatus === "blocked"
            ? "Popup blocked — click to retry"
            : "Sign in with GitHub ↗";
      // Mirror the aria-label branch: drop the count while we don't know it
      // yet rather than painting "Star all 0 now".
      const primary =
        state.remaining == null
          ? "Star all now"
          : `Star all ${state.remaining} now`;
      return [primary, secondary];
    }
    if (state.status === "ready") {
      // While the initial check is in flight, the final count is not yet
      // knowable. Don't stream a flickering number that drifts down as each
      // repo resolves — render a skeleton via `labelLines[1] === null` and
      // let the JSX branch into a skeleton node. Once `checking` clears, the
      // real "N repos to go" text replaces it in one clean transition.
      if (state.checking) {
        return ["Begin starring", null];
      }
      return ["Begin starring", `${state.remaining ?? 0} repos to go`];
    }
    if (state.status === "in-progress") {
      return [state.counterLabel ?? "Starring…", null];
    }
    if (state.status === "partial-failure") {
      return [`${state.failedCount ?? 0} failed — retry`, null];
    }
    return ["All starred", null];
  }, [state.status, state.counterLabel, state.failedCount, state.remaining, state.oauthStatus, state.checking]);

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

  // Delight replay — clicking the all-starred diamond fires a fresh supernova
  // at the button's current screen position, without changing mode or
  // dismissing. `celebratePulseKey` bumps on each click so the CSS pulse
  // animation restarts (using the key to remount the wrapper).
  //
  // Phase E.2: reduced-motion users still get an acknowledgement — a
  // brightness-only flash on the wrapper instead of the canvas burst — so the
  // "tap to celebrate" affordance works identically across motion settings,
  // just with different visual intensity.
  const [celebratePulseKey, setCelebratePulseKey] = useState(0);
  // Throttle replays to one per SUPERNOVA_REPLAY_THROTTLE_MS so a rapid
  // click-storm can't queue overlapping bursts. Sentinel is `-Infinity` so
  // the first tap always passes — early in the page lifecycle (or in test
  // harnesses where `performance.now()` is still small) a zero sentinel
  // would misfire the throttle on the first real call.
  const lastReplayAtRef = useRef<number>(Number.NEGATIVE_INFINITY);

  const fireCelebrationBurst = useCallback((origin: HTMLElement | null) => {
    const now = performance.now();
    if (now - lastReplayAtRef.current < SUPERNOVA_REPLAY_THROTTLE_MS) return;
    lastReplayAtRef.current = now;

    // Pulse the wrapper — under full motion this is the scale-bounce
    // `roaming-star-celebrate`; under reduced motion it swaps to a
    // brightness-only flash (see JSX class picker + keyframes below).
    setCelebratePulseKey((k) => k + 1);

    // Tapping replay counts as hint discovery — suppress the discovery
    // announcement if it hasn't already fired (and hide it if it's visible).
    if (!hasSeenDiscoveryHint()) markDiscoveryHintSeen();
    setDiscoveryHintVisible(false);

    if (reducedMotion) return; // No canvas burst under reduced motion.

    const el = origin ?? dormantSlotRef.current ?? floatingElRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    starLivePosRef.current.x = rect.left + rect.width / 2;
    starLivePosRef.current.y = rect.top + rect.height / 2;
    void trail.triggerSupernova();
  }, [reducedMotion, trail]);

  const handleStarClick = useCallback((origin?: HTMLElement | null) => {
    // The star is inert during takeover — the Cancel button + Esc handle abort.
    // Shipping a single cancel affordance (button) keeps the surface consistent
    // and removes the "click once to arm, again to cancel" prototype.
    if (mode === "takeover") return;
    // "success" (all repos already starred) is a terminal visual state — the
    // diamond reads as a confirmation, not a CTA. Clicking must not open
    // StarModal with 0 unstarred repos. Instead we replay the supernova as a
    // pure delight moment — it's the user's reward for having supported every
    // repo, not a navigation target.
    if (state.status === "success") {
      fireCelebrationBurst(origin ?? null);
      return;
    }
    triggerWithFocusCapture();
  }, [mode, state.status, fireCelebrationBurst, triggerWithFocusCapture]);

  // Phase E.2 — explicit dismissal. The terminal diamond now persists after
  // the supernova settles; only clicking this × / "Done" affordance writes
  // the session-dismissal flag. Keyboard- and SR-reachable with an explicit
  // `aria-label` so it doesn't read as a decorative glyph.
  const handleExplicitDismiss = useCallback(() => {
    markDismissed();
    setDismissedBySession(true);
  }, []);

  // Click variant that also stops propagation so the click doesn't bubble
  // back to the parent star (which would throttle out the next real replay
  // attempt). Stable via `useCallback` for consistency with the other
  // handlers in this component.
  const handleDismissClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      handleExplicitDismiss();
    },
    [handleExplicitDismiss],
  );

  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        // Route keyboard activation through handleStarClick so the success +
        // takeover guards apply identically to Enter/Space and mouse clicks.
        // Pass the button as origin so the supernova replay lands centered on
        // the focused element rather than the slot wrapper.
        handleStarClick(e.currentTarget);
      }
    },
    [handleStarClick],
  );

  // Keyboard reach for cancel — Alex (keyboard-first persona) should be able
  // to abort without chasing the Cancel button. Esc fires onCancel directly
  // during takeover. StarModal already suppresses Esc-close at its level;
  // this listener sits underneath and captures first.
  useEffect(() => {
    if (mode !== "takeover") return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && onCancel) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [mode, onCancel]);

  if (hidden || mode === "dismissed") return null;

  // ===== Dormant slot (in-hero) =====
  // Phase E.2 — pulse-wrapper class picker. Under full motion we reuse the
  // existing `roaming-star-celebrate` (scale+brightness bounce). Under
  // reduced motion we fall back to a transform-free brightness-only flash
  // via `roaming-star-celebrate-rm` so the tap-to-replay still reads as an
  // acknowledgement without animating the element's position.
  const pulseClass =
    celebratePulseKey > 0
      ? reducedMotion
        ? "roaming-star-celebrate-rm"
        : "roaming-star-celebrate"
      : undefined;

  // The × dismiss affordance lights up in the success-terminal state only.
  // It's rendered alongside the keyed pulse wrapper so the click target is
  // visually adjacent to the diamond but not overlapping it.
  const showDismissButton =
    mode === "dormant" && state.status === "success" && !dismissedBySession;

  const dormantBlock = (
    <div
      ref={dormantSlotRef}
      className="inline-flex flex-col items-center gap-3"
      data-testid="roaming-star-dormant-slot"
    >
      {mode === "dormant" && (
        // `group` + `relative` so the × dismiss button can anchor itself at
        // the top-right of the star and reveal on hover / focus-within.
        <div className="group relative inline-flex" style={{ lineHeight: 0 }}>
          {/* Keyed wrapper — `key` bumps on every celebration replay so the
              pulse keyframe restarts from 0% on each click. Line-height 0
              prevents inline whitespace baseline fudge from shifting the
              cluster vertically when the pulse runs. */}
          <span
            key={celebratePulseKey}
            className={pulseClass}
            style={{ display: "inline-flex", lineHeight: 0 }}
          >
            <StarButton
              size={dormantSize}
              fillLevel={state.fillLevel}
              status={state.status}
              reducedMotion={reducedMotion}
              ariaLabel={ariaLabel}
              onClick={handleStarClick}
              onKey={handleKey}
              breathing={!reducedMotion}
              /* Paired soft pulse while the discovery hint is on-screen —
                 applied directly to the StarShape wrapper inside the button
                 so the tap target itself glows. Gated with reducedMotion at
                 source (no class ⇒ no animation ⇒ no motion). */
              extraClassName={
                discoveryHintVisible && !reducedMotion
                  ? "roaming-star-discovery-pulse"
                  : undefined
              }
            />
          </span>
          {showDismissButton && (
            <button
              type="button"
              data-testid="roaming-star-dismiss"
              aria-label="Dismiss completion"
              onClick={handleDismissClick}
              className="roaming-star-dismiss absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-background/80 text-muted-foreground opacity-0 shadow-sm transition-opacity duration-150 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background group-hover:opacity-100 group-focus-within:opacity-100"
              style={{ fontSize: 14, lineHeight: 1 }}
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
      )}
      {mode === "dormant" && (
        <div className="flex flex-col items-center gap-1.5">
          {/* Primary line matches the hero H1 register: same family, bold,
              tracking-tight. Scaled down from 4xl → lg/xl so it acts as a
              sub-headline to the CTA, not a competing heading. */}
          <span className="font-heading text-lg font-bold tracking-tight text-foreground md:text-xl">
            {labelLines[0]}
          </span>
          {labelLines[1] && (
            // Uppercase-tracked secondary — mirrors the hero stats row, so
            // the cluster reads as one voice instead of 2–3 typefaces.
            <span className="font-heading text-[11px] uppercase tracking-widest text-muted-foreground">
              {labelLines[1]}
            </span>
          )}
          {/* Skeleton placeholder while the initial star-status check runs —
              keeps the layout stable so the label doesn't jump by a line's
              height when the real "N repos to go" text appears. Three gold
              dots pulsing in sequence read as "working on it" rather than
              "error" or "loading forever". aria-hidden because the primary
              line already conveys the state; we don't want SR users hearing
              each dot pulse announced. */}
          {state.status === "ready" && state.checking && !labelLines[1] && (
            <span
              aria-hidden="true"
              data-testid="roaming-star-checking-skeleton"
              className="flex h-[11px] items-center gap-1"
            >
              <span className="roaming-star-check-dot" />
              <span className="roaming-star-check-dot" style={{ animationDelay: "140ms" }} />
              <span className="roaming-star-check-dot" style={{ animationDelay: "280ms" }} />
            </span>
          )}
          {/* One-time discovery hint — announced politely to screen readers
              and shown as a small pill below the label. Mounted for every
              dormant render (not just state.status === "success") so the
              live region is registered with the accessibility tree before
              its text content changes: some screen readers (e.g. NVDA +
              Chrome) only track live regions that existed at DOM mount
              time, so a late-mounting region can silently miss its first
              announcement. `role="status"` is implicitly aria-live="polite"
              per the ARIA spec (see docs/learnings/a11y.md), so we avoid
              redundantly setting both. `aria-atomic` ensures the full pill
              is announced as one chunk (not per-word as content streams in);
              `aria-hidden` pulls the empty state out of the a11y tree so
              ATs don't traverse an empty status on every page sweep. */}
          <span
            role="status"
            aria-atomic="true"
            aria-hidden={!discoveryHintVisible}
            data-testid="roaming-star-discovery-hint"
            className="font-heading text-[11px] uppercase tracking-widest text-muted-foreground"
            style={{
              visibility: discoveryHintVisible ? "visible" : "hidden",
              // Reserve a fixed height so showing/hiding doesn't shift the
              // vertical rhythm of the label cluster.
              minHeight: "1em",
            }}
          >
            {discoveryHintVisible ? DISCOVERY_HINT_TEXT : ""}
          </span>
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
  //
  // Only `left` and `top` are transitioned. `width`/`height` are layout
  // properties — transitioning them triggers layout every frame (flagged by
  // the deterministic anti-pattern scan). Size changes on mode flip snap
  // and are masked by the scale/position flight.
  const takeoverTransition = `left ${DURATION_FLIP_TO_TAKEOVER}ms ${EASE_OUT_EXPO}, top ${DURATION_FLIP_TO_TAKEOVER}ms ${EASE_OUT_EXPO}`;

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
        ? "opacity 220ms linear"
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

  // Disintegration — during the supernova the silhouette should feel like it
  // *released* its energy, not like it politely sat there while particles flew
  // past. A one-shot scale-up + fade-out, timed to land just after the core
  // flash peaks, sells the "the star is the gift" narrative.
  const disintegrateStyle: CSSProperties =
    mode === "supernova" && !reducedMotion
      ? {
          animation: `roaming-star-disintegrate 520ms ${EASE_OUT_EXPO} forwards`,
          willChange: "transform, opacity, filter",
        }
      : {};

  // The canvas layer mounts whenever the trail is enabled — that's any
  // floating mode (roaming/takeover/supernova) AND the terminal success
  // state (so a re-click on the all-starred diamond can paint a replay
  // burst). Kept as its own portal node so the canvas's lifetime isn't tied
  // to the floating star's own lifetime.
  const canvasBlock = trailEnabled && (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        width: "100vw",
        height: "100vh",
        // In success state we need the burst to visibly bloom above the
        // dormant hero content; zIndex 39 threads above hero background
        // graphics but below sticky chrome.
        zIndex: mode === "takeover" ? 54 : 39,
        pointerEvents: "none",
      }}
    />
  );

  const floatingBlock = (mode === "roaming" || mode === "takeover" || mode === "supernova") && (
    <>
      {/* Takeover scrim is provided by Radix's DialogOverlay (50% black)
          behind StarModal. A second 22% layer here stacked on top read as
          ~60% dim and over-dulled the page; the single Radix overlay is
          strong enough. */}

      <div ref={floatingElRef} style={floatingStyle}>
        <div style={{ ...spinStyle, ...disintegrateStyle }}>
          <StarButton
            size={floatingSize}
            fillLevel={state.fillLevel}
            status={state.status}
            reducedMotion={reducedMotion}
            ariaLabel={ariaLabel}
            onClick={handleStarClick}
            onKey={handleKey}
            breathing={false}
          />
        </div>

        {/* Roaming label — persistent intro on detach, then cursor-gravity
            reveal on hover devices. `introVisible` keeps the pill up for
            LABEL_INTRO_MS after the star flies free (or indefinitely on
            touch-only devices where there's no pointer to rediscover it).
            `roaming-star-label-intro` animates the bounce-in on appearance. */}
        {mode === "roaming" && (labelHovered || introVisible) && (
          <div
            role="status"
            aria-live="polite"
            data-testid="roaming-star-label"
            className={reducedMotion ? undefined : "roaming-star-label-intro"}
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
            {/* Remaining-count badge on the sticky floating CTA — the
                `(N left)` affordance requested by the trust-safety spec.
                Surfaces the unstarred count without forcing the user back
                to the hero to see the dormant label. Only shown when we
                have a positive remaining count so an all-done state keeps
                its clean look. */}
            {labelLines[1] && state.remaining !== undefined && state.remaining > 0 && (
              <span
                data-testid="roaming-star-count-badge"
                style={{
                  marginLeft: 8,
                  paddingLeft: 8,
                  borderLeft: "1px solid oklch(0.45 0.028 280 / 0.4)",
                  color: "var(--muted-foreground)",
                }}
              >
                {state.remaining} left
              </span>
            )}
          </div>
        )}
      </div>

      {/* During takeover, the counter + help sublabel + Cancel button are
          rendered by `StarModal` inside its `DialogContent` — Radix's
          DismissableLayer swallows pointer events on anything sibling to
          the dialog portal, so the cancel click only lands when it lives
          inside the dialog tree. The RoamingStar keeps ownership of the
          visual star + the global Esc handler below. */}
    </>
  );

  return (
    <>
      {dormantBlock}
      {typeof document !== "undefined" &&
        canvasBlock &&
        createPortal(canvasBlock, document.body)}
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
        /* Supernova disintegration. The diamond brightens and blooms, then
           expands + dissolves in step with the particle burst. A filter
           "brightness" pulse at the start reads as the star "charging up"
           before releasing — even at 520ms total it feels intentional. */
        @keyframes roaming-star-disintegrate {
          0%   { transform: scale(1);   opacity: 1; filter: brightness(1)    blur(0px); }
          22%  { transform: scale(1.18); opacity: 1; filter: brightness(1.9) blur(0.5px); }
          60%  { transform: scale(1.6);  opacity: 0.55; filter: brightness(2.2) blur(2px); }
          100% { transform: scale(2.2);  opacity: 0;    filter: brightness(2.4) blur(6px); }
        }
        /* Celebration pulse — fired when the user taps the all-starred
           diamond. Short scale+brightness bounce that plays in sync with
           the replay supernova burst. Shorter than the disintegrate (the
           star stays). */
        @keyframes roaming-star-celebrate {
          0%   { transform: scale(1);    filter: brightness(1); }
          28%  { transform: scale(1.18); filter: brightness(1.9); }
          68%  { transform: scale(0.98); filter: brightness(1.15); }
          100% { transform: scale(1);    filter: brightness(1); }
        }
        .roaming-star-celebrate {
          animation: roaming-star-celebrate 420ms cubic-bezier(0.16, 1, 0.3, 1);
          transform-origin: center;
          will-change: transform, filter;
        }
        /* Phase E.2 reduced-motion replay — no transform, brightness-only
           flash. Matches the "tap to celebrate" affordance across motion
           settings without violating prefers-reduced-motion. */
        @keyframes roaming-star-celebrate-rm {
          0%   { filter: brightness(1); }
          40%  { filter: brightness(1.55); }
          100% { filter: brightness(1); }
        }
        .roaming-star-celebrate-rm {
          animation: roaming-star-celebrate-rm ${REDUCED_MOTION_FLASH_MS}ms linear;
          will-change: filter;
        }
        /* Discovery-hint soft pulse — paired with the "Tap again to
           celebrate" aria-live announcement. Two gentle scale+brightness
           beats, then still. Motion is only added under the !reducedMotion
           branch (see JSX class picker above), so it's safe to not override
           here — the class simply isn't applied when motion is reduced. */
        @keyframes roaming-star-discovery-pulse {
          0%, 100% { transform: scale(1);   filter: brightness(1); }
          50%      { transform: scale(1.06); filter: brightness(1.35); }
        }
        .roaming-star-discovery-pulse {
          animation: roaming-star-discovery-pulse 1400ms ease-in-out 2;
          transform-origin: center;
          will-change: transform, filter;
        }
        /* Checking skeleton — three gold dots pulsing in sequence. Size
           and gap match the uppercase-tracked secondary line's metrics so
           swapping dots → text on resolution doesn't shift layout. */
        @keyframes roaming-star-check-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.82); }
          40%           { opacity: 1;    transform: scale(1); }
        }
        .roaming-star-check-dot {
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 9999px;
          background: var(--star-gold, #e2b453);
          animation: roaming-star-check-pulse 1100ms ease-in-out infinite;
          will-change: opacity, transform;
        }
        /* Reduced-motion disables animation on these classes. The
           disintegrate keyframe is not overridden here: its parent style is
           only applied when !reducedMotion (see \`disintegrateStyle\` above),
           so redefining keyframes inside the media block was dead code and
           brittle against future renames. Gate motion at the source. */
        @media (prefers-reduced-motion: reduce) {
          .roaming-star-celebrate { animation: none !important; }
          .roaming-star-check-dot { animation: none !important; opacity: 0.6 !important; }
        }
        .roaming-star-breathing {
          animation: roaming-star-breathe ${BREATHE_PERIOD_MS}ms ease-in-out infinite;
          transform-origin: center;
          will-change: transform;
        }
        /* Intro bounce — label reveals with a short upward slide so users'
           eyes track from the star to the copy on the first detach. Uses
           translate(-50%, …) because the pill is centered via translateX. */
        @keyframes roaming-star-label-intro {
          0%   { opacity: 0; transform: translate(-50%, -4px) scale(0.94); }
          60%  { opacity: 1; transform: translate(-50%, 0) scale(1); }
          100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        .roaming-star-label-intro {
          animation: roaming-star-label-intro 420ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .roaming-star-breathing { animation: none !important; }
          .roaming-star-label-intro { animation: none !important; }
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
  /** Receives the button element so callers can read its on-screen rect — we
   *  use this to anchor the all-starred supernova replay to the click target. */
  onClick: (el: HTMLButtonElement) => void;
  onKey: (e: KeyboardEvent<HTMLButtonElement>) => void;
  breathing: boolean;
  /** Optional class applied to the inner wrapper (e.g. the Phase E.2
   *  discovery-hint pulse). Composed with the breathing class when present. */
  extraClassName?: string;
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
  extraClassName,
}: StarButtonProps) {
  // Ternary rather than array/filter/join — this renders on every parent
  // progress tick while roaming, so we keep the class composition
  // allocation-free.
  const breathe = breathing && !reducedMotion;
  const wrapperClass = breathe
    ? extraClassName
      ? `roaming-star-breathing ${extraClassName}`
      : "roaming-star-breathing"
    : extraClassName || undefined;
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={(e) => onClick(e.currentTarget)}
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
      <span className={wrapperClass} style={{ display: "inline-block" }}>
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

