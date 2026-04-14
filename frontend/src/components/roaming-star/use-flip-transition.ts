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
 * Core invariant: when re-triggered mid-flight, we read the *current computed
 * transform* (not the originally measured First), treat that as the new First,
 * and re-invert from the new target. This avoids the scroll-reversal glitch
 * where the star jumps to wherever the last animation thought it was going.
 */
export function useFlipTransition() {
  const activeAnimationRef = useRef<Animation | null>(null);

  const flipTo = useCallback((params: FlipParams) => {
    const { element, target, durationMs, easing, onDone } = params;

    // Cancel any in-flight animation and capture its *current* computed
    // transform so we start from where the element actually is right now.
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
