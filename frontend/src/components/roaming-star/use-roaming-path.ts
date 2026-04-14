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

import { useEffect, useRef, useState } from "react";
import {
  PATH_SEGMENT_DURATION_MS,
  ROAMING_PATH_SEGMENTS,
  CURSOR_GRAVITY_RADIUS_PX,
  CURSOR_LEAN_FACTOR,
} from "./constants";

interface RoamingPosition {
  /** Viewport-fixed css px, top-left of star. */
  x: number;
  y: number;
  /** Whether the cursor is within gravity radius — reveals label. */
  labelHovered: boolean;
}

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
  /** Half the star size so we can center the coordinate. */
  halfSize: number;
  /** When false, the hook pauses its rAF loop. */
  active: boolean;
  /** Reduced motion: pin to static anchor (top-right). */
  reducedMotion: boolean;
}

/**
 * Drives the star's free-floating drift along precomputed bezier segments.
 * Cursor gravity pulls the star toward the pointer and flags `labelHovered`
 * so the consumer can reveal the secondary-line label.
 *
 * Single rAF loop. Returns a live-updating position; the consumer applies
 * it via `style={{ left, top }}` on the fixed-positioned layer.
 */
export function useRoamingPath({
  halfSize,
  active,
  reducedMotion,
}: UseRoamingPathOptions): RoamingPosition {
  const [pos, setPos] = useState<RoamingPosition>(() => ({
    x: typeof window !== "undefined" ? window.innerWidth - 80 : 800,
    y: 80,
    labelHovered: false,
  }));

  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    if (reducedMotion) {
      // Static anchored star top-right. No rAF, no cursor gravity.
      const place = () => {
        setPos({
          x: window.innerWidth - halfSize * 2 - 24,
          y: 24,
          labelHovered: false,
        });
      };
      place();
      window.addEventListener("resize", place);
      return () => window.removeEventListener("resize", place);
    }

    let rafId = 0;
    startRef.current = null;

    const onPointerMove = (e: PointerEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY };
    };
    const onPointerLeave = () => {
      cursorRef.current = null;
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
      let labelHovered = false;
      const cursor = cursorRef.current;
      if (cursor) {
        const cx = x + halfSize;
        const cy = y + halfSize;
        const dx = cursor.x - cx;
        const dy = cursor.y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < CURSOR_GRAVITY_RADIUS_PX) {
          labelHovered = true;
          const lean = (1 - dist / CURSOR_GRAVITY_RADIUS_PX) * CURSOR_LEAN_FACTOR;
          x += dx * lean;
          y += dy * lean;
        }
      }

      setPos({ x, y, labelHovered });
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerLeave);
    };
  }, [active, halfSize, reducedMotion]);

  return pos;
}
