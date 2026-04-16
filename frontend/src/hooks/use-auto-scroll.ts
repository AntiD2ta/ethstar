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

import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";

/**
 * Auto-scrolls a container horizontally using scrollLeft, producing a seamless
 * loop when the content is duplicated. Pauses on hover/focus/touch so the user
 * can manually scroll through the content.
 *
 * Uses scrollLeft (not CSS transform) so user scrolling and auto-scrolling
 * share the same coordinate system — no visual jump when pausing.
 *
 * Looping expects the container's first child (the flex track) to have ≥2
 * identical content groups laid out side-by-side. The loop *period* is
 * measured from the offset delta between the first two groups — exact even
 * when flex `gap` separates them — and the hook keeps `scrollLeft` in
 * `[period, 2*period)` when three copies are present so manual scroll can
 * wrap in either direction.
 *
 * `externalPausedRef`, when provided, is read on every rAF tick and OR'd with
 * the internal hover/focus/touch pause flag. Lets the caller suppress
 * auto-scroll while running its own scroll animation (e.g. a rAF tween that
 * centers a target card) without racing against this loop.
 */
export function useAutoScroll(
  containerRef: RefObject<HTMLDivElement | null>,
  /** Pixels per second */
  speed: number,
  enabled: boolean,
  externalPausedRef?: MutableRefObject<boolean>,
) {
  const pausedRef = useRef(false);
  const rafRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    // Measure the loop period: distance between the starts of the first two
    // content groups. This is the exact repeat length (includes the inter-
    // group gap), so wrapping by `period` lands on visually identical content.
    // Fall back to half the scroll width (legacy 2-copy approximation) if the
    // track doesn't yet have a second group (reduced-motion or pre-layout).
    const measurePeriod = () => {
      const track = el.firstElementChild;
      const g0 = track?.children[0] as HTMLElement | undefined;
      const g1 = track?.children[1] as HTMLElement | undefined;
      if (g0 && g1) return g1.offsetLeft - g0.offsetLeft;
      return el.scrollWidth / 2;
    };

    // With 3+ copies, center the user in the middle copy once layout settles
    // so backward scroll has a full period of runway before wrapping.
    let period = measurePeriod();
    let copies = el.firstElementChild?.children.length ?? 1;
    if (copies >= 3 && period > 0 && el.scrollLeft < period) {
      el.scrollLeft = period;
    }

    let lastTime = 0;

    function tick(time: number) {
      const externallyPaused = externalPausedRef?.current ?? false;
      if (lastTime > 0 && !pausedRef.current && !externallyPaused) {
        const delta = (time - lastTime) / 1000; // seconds
        el!.scrollLeft += speed * delta;
      }
      // Wrap every frame (even while paused) so manual scroll past either
      // edge of the middle copy loops seamlessly instead of hitting a hard
      // wall at 0 or scrollWidth.
      if (period > 0) {
        if (copies >= 3) {
          if (el!.scrollLeft >= 2 * period) el!.scrollLeft -= period;
          else if (el!.scrollLeft < period) el!.scrollLeft += period;
        } else if (el!.scrollLeft >= period) {
          el!.scrollLeft -= period;
        }
      }
      lastTime = time;
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    // Re-measure on resize — group widths change with viewport and the period
    // must track them. Cheap: one offsetLeft read per observer callback.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        period = measurePeriod();
        copies = el.firstElementChild?.children.length ?? 1;
      });
      ro.observe(el);
    }

    const pause = () => { pausedRef.current = true; };
    const resume = () => { pausedRef.current = false; };

    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", resume);
    el.addEventListener("focusin", pause);
    el.addEventListener("focusout", resume);
    // Touch: pause while finger is down so user can scroll
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchend", resume, { passive: true });

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro?.disconnect();
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", resume);
      el.removeEventListener("focusin", pause);
      el.removeEventListener("focusout", resume);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", resume);
    };
  }, [containerRef, speed, enabled, externalPausedRef]);
}
