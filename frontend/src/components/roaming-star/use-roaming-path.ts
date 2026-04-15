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

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  PATH_SEGMENT_DURATION_MS,
  ROAMING_PATH_SEGMENTS,
  CURSOR_GRAVITY_RADIUS_PX,
  CURSOR_LEAN_FACTOR,
} from "./constants";

/** Cubic bezier at parameter t ∈ [0,1]. */
function cubicBezier(
  t: number,
  p0: number,
  c1: number,
  c2: number,
  p1: number,
): number {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * c1 + 3 * mt * t * t * c2 + t * t * t * p1;
}

interface UseRoamingPathOptions {
  /** The fixed-positioned floating element whose `left`/`top` the hook writes each frame. */
  elementRef: RefObject<HTMLElement | null>;
  /** Live position ref the consumer reads to keep the trail/supernova in sync. */
  starPosRef: RefObject<{ x: number; y: number }>;
  /** Half the star size so we can center the coordinate. */
  halfSize: number;
  /** When false, the hook pauses its rAF loop. */
  active: boolean;
  /** Reduced motion: pin to static anchor (top-right). */
  reducedMotion: boolean;
}

interface UseRoamingPathReturn {
  /** True while the cursor is within gravity radius — reveals label. Toggles rarely. */
  labelHovered: boolean;
}

/**
 * Drives the star's free-floating drift along precomputed bezier segments.
 * Cursor gravity pulls the star toward the pointer and flags `labelHovered`
 * so the consumer can reveal the secondary-line label.
 *
 * Perf: the rAF loop writes `element.style.left/top` directly and mutates
 * `starPosRef` in place. Only `labelHovered` lives in React state, and
 * `setLabelHovered` is only called when the boolean flips — not every frame.
 */
export function useRoamingPath({
  elementRef,
  starPosRef,
  halfSize,
  active,
  reducedMotion,
}: UseRoamingPathOptions): UseRoamingPathReturn {
  const [labelHovered, setLabelHovered] = useState(false);

  // Reusable in-place mutable cursor record (no per-frame allocation).
  const cursorRef = useRef<{ x: number; y: number; has: boolean }>({
    x: 0,
    y: 0,
    has: false,
  });
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    // Capture the stable ref object up-front so the cleanup closure doesn't
    // touch `cursorRef.current` after a potential re-render swap (lint hint).
    const cursor = cursorRef.current;

    const writePos = (x: number, y: number) => {
      const el = elementRef.current;
      if (el) {
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      }
      starPosRef.current.x = x + halfSize;
      starPosRef.current.y = y + halfSize;
    };

    if (reducedMotion) {
      // Static anchored star top-right. No rAF, no cursor gravity.
      const place = () => {
        writePos(window.innerWidth - halfSize * 2 - 24, 24);
        setLabelHovered(false);
      };
      place();
      window.addEventListener("resize", place);
      return () => window.removeEventListener("resize", place);
    }

    let rafId = 0;
    startRef.current = null;
    let localHovered = false;

    const onPointerMove = (e: PointerEvent) => {
      cursor.x = e.clientX;
      cursor.y = e.clientY;
      cursor.has = true;
    };
    const onPointerLeave = () => {
      cursor.has = false;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerout", onPointerLeave, { passive: true });

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const totalSegments = ROAMING_PATH_SEGMENTS.length;
      const segTotal = totalSegments * PATH_SEGMENT_DURATION_MS;
      const loopT = (elapsed % segTotal) / PATH_SEGMENT_DURATION_MS;
      const segIdx = Math.floor(loopT) % totalSegments;
      const t = loopT - Math.floor(loopT);
      const seg = ROAMING_PATH_SEGMENTS[segIdx]!;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let x = cubicBezier(t, seg.p0[0], seg.c1[0], seg.c2[0], seg.p1[0]) * vw;
      let y = cubicBezier(t, seg.p0[1], seg.c1[1], seg.c2[1], seg.p1[1]) * vh;

      // Center the star on (x, y) — translate to top-left for `style.left/top`.
      x -= halfSize;
      y -= halfSize;

      // Cursor gravity.
      let hovered = false;
      if (cursor.has) {
        const cx = x + halfSize;
        const cy = y + halfSize;
        const dx = cursor.x - cx;
        const dy = cursor.y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < CURSOR_GRAVITY_RADIUS_PX) {
          hovered = true;
          const lean = (1 - dist / CURSOR_GRAVITY_RADIUS_PX) * CURSOR_LEAN_FACTOR;
          x += dx * lean;
          y += dy * lean;
        }
      }

      writePos(x, y);

      // Only fire React setState when the boolean actually flips — not every frame.
      if (hovered !== localHovered) {
        localHovered = hovered;
        setLabelHovered(hovered);
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerLeave);
      cursor.has = false;
    };
  }, [active, halfSize, reducedMotion, elementRef, starPosRef]);

  return { labelHovered };
}
