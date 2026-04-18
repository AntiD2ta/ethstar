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

import { useCallback, useRef } from "react";

interface FlipParams {
  /** Element to translate. */
  element: HTMLElement;
  /** Absolute target viewport position (css px) for the element's top-left. */
  target: { x: number; y: number };
  /** Duration of the animation. */
  durationMs: number;
  /** Easing curve string. */
  easing: string;
  /** Called when animation ends (or is cancelled by a new flipTo call). */
  onDone?: () => void;
}

/**
 * Manual FLIP (First-Last-Invert-Play) hook for interruptible translations.
 *
 * The element itself is laid out by the parent (css `position: fixed; left; top`
 * or transform origin); `flipTo` handles the animated transition between two
 * *visual* positions without changing layout.
 *
 * Re-trigger semantics: when called while an animation is in flight, we
 * `cancel()` the old animation (WAAPI reverts the animated transform — the
 * element `fill: "none"` means no residual transform is committed) and then
 * measure `getBoundingClientRect()` — so the new "First" is the element's
 * post-cancel CSS-laid-out position. This keeps the next flight visually
 * continuous when callers keep the element's CSS layout stable (the
 * RoamingStar portal does this by pinning `left`/`top` to the roaming
 * position). If a caller changes CSS layout between the cancel and the next
 * `flipTo`, the measured First will reflect the new layout.
 *
 * Note: this does *not* read the live computed transform at the instant of
 * cancellation — upgrading to `animation.commitStyles()` + pre-cancel
 * transform capture would require behavior-change stress testing and is
 * deliberately deferred.
 */
export function useFlipTransition() {
  const activeAnimationRef = useRef<Animation | null>(null);

  const flipTo = useCallback((params: FlipParams) => {
    const { element, target, durationMs, easing, onDone } = params;

    // Cancel any in-flight animation. WAAPI reverts the animated transform
    // on cancel (no `commitStyles`), so the subsequent `getBoundingClientRect`
    // measures the element's post-cancel CSS-laid-out position. See the
    // hook-level comment for the re-trigger contract this implies.
    if (activeAnimationRef.current) {
      activeAnimationRef.current.cancel();
      activeAnimationRef.current = null;
    }

    // Element must be in its "final" CSS position at this point; we animate
    // *from* the negative delta back to identity.
    const rect = element.getBoundingClientRect();
    const dx = rect.left - target.x;
    const dy = rect.top - target.y;

    // If the element is already at the target, skip work.
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      onDone?.();
      return;
    }

    // Caller is responsible for setting the element's final position before
    // calling this; we inject the First→Last translation as a one-shot
    // Web Animations API animation.
    const anim = element.animate(
      [
        { transform: `translate(${-dx}px, ${-dy}px)` },
        { transform: "translate(0px, 0px)" },
      ],
      { duration: durationMs, easing, fill: "none" },
    );
    activeAnimationRef.current = anim;

    anim.onfinish = () => {
      if (activeAnimationRef.current === anim) {
        activeAnimationRef.current = null;
      }
      onDone?.();
    };
    anim.oncancel = () => {
      if (activeAnimationRef.current === anim) {
        activeAnimationRef.current = null;
      }
      // Don't call onDone — caller will re-flip with a fresh target.
    };
  }, []);

  const cancel = useCallback(() => {
    if (activeAnimationRef.current) {
      activeAnimationRef.current.cancel();
      activeAnimationRef.current = null;
    }
  }, []);

  return { flipTo, cancel };
}
