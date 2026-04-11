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

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";

export interface RingConfig {
  radius: number;
  speed: number;
  direction: 1 | -1;
  /** Tilt angle in degrees. Applied around whichever axis `tiltAxis`
   *  specifies — kept as `tiltX` for historical reasons. */
  tiltX: number;
  tiltZ: number;
  chipCount: number;
  /** Axis of tilt — `"x"` (default) tilts the top of the ring back and
   *  forward for a wide (landscape) ellipse; `"y"` tilts the right back
   *  and left forward for a tall (portrait) ellipse. */
  tiltAxis?: "x" | "y";
}

const TWO_PI = Math.PI * 2;

// Cache previous zIndex per element to avoid per-frame stacking context
// invalidation — only write when the rounded value actually changes.
const prevZIndex = new WeakMap<HTMLDivElement, number>();

function positionChip(
  el: HTMLDivElement,
  theta: number,
  radius: number,
  tilt: number,
  tiltAxis: "x" | "y",
  depthFactor: number,
) {
  const t = (depthFactor + 1) / 2; // normalize -1..1 to 0..1
  const scale = 0.85 + 0.15 * t;
  const opacity = 0.5 + 0.5 * t;
  const zIndex = Math.round(t * 100);

  // Counter-rotate around the same axis the ring is tilted on so the chip
  // faces the camera regardless of orientation.
  const counter =
    tiltAxis === "y" ? `rotateY(${-tilt}deg)` : `rotateX(${-tilt}deg)`;

  el.style.transform = `rotateZ(${theta}rad) translateX(${radius}px) rotateZ(${-theta}rad) ${counter} scale(${scale})`;
  el.style.opacity = String(opacity);

  if (prevZIndex.get(el) !== zIndex) {
    el.style.zIndex = String(zIndex);
    prevZIndex.set(el, zIndex);
  }
}

function positionAllChips(
  configs: RingConfig[],
  chipRefs: HTMLDivElement[][],
  angles: Float64Array,
) {
  for (let r = 0; r < configs.length; r++) {
    const cfg = configs[r];
    const chips = chipRefs[r];
    if (!chips) continue;

    const tiltAxis = cfg.tiltAxis ?? "x";

    for (let c = 0; c < cfg.chipCount; c++) {
      const el = chips[c];
      if (!el) continue;

      const theta = angles[r] + (c / cfg.chipCount) * TWO_PI;
      // For X-axis tilt: top of ring (θ=π/2) comes forward → sin(θ).
      // For Y-axis tilt: left of ring (θ=π) comes forward → −cos(θ).
      const depthFactor =
        tiltAxis === "y" ? -Math.cos(theta) : Math.sin(theta);
      positionChip(el, theta, cfg.radius, cfg.tiltX, tiltAxis, depthFactor);
    }
  }
}

export function useSaturnAnimation(
  configs: RingConfig[],
  chipRefs: MutableRefObject<HTMLDivElement[][]>,
  pausedRef: MutableRefObject<boolean>,
  prefersReducedMotion: boolean,
): void {
  const anglesRef = useRef<Float64Array | null>(null);

  // Static positioning for reduced-motion preference
  useEffect(() => {
    if (!prefersReducedMotion) return;

    const angles = new Float64Array(configs.length);
    positionAllChips(configs, chipRefs.current, angles);
  }, [prefersReducedMotion, configs, chipRefs]);

  // Animation loop for normal motion
  useEffect(() => {
    if (prefersReducedMotion) return;

    const angles =
      anglesRef.current ?? new Float64Array(configs.length);
    anglesRef.current = angles;

    let lastTime = performance.now();
    let rafId: number;

    function animate(now: number) {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      if (!pausedRef.current) {
        for (let r = 0; r < configs.length; r++) {
          angles[r] =
            (angles[r] + configs[r].speed * configs[r].direction * dt) %
            TWO_PI;
        }
      }

      positionAllChips(configs, chipRefs.current, angles);
      rafId = requestAnimationFrame(animate);
    }

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [prefersReducedMotion, configs, chipRefs, pausedRef]);
}
