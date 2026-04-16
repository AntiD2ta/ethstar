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

/**
 * Viewport dimensions in CSS pixels of the ring container (the element
 * whose centre is the ring origin). `null` means "not measured yet" —
 * typical on first render before the ResizeObserver resolves. While null
 * the band filter is skipped so we don't spuriously disable every chip.
 */
export interface SaturnViewportSize {
  width: number;
  height: number;
}

/**
 * Half-size constants for the two chip variants. Used to decide whether a
 * chip's projected position keeps it inside the visible ring band — a chip
 * at the edge of the band is considered clipped when
 * `|projected| + half >= viewportHalf`. The rectangles match the `*_OFFSET`
 * values in `saturn-ring.tsx`.
 */
export interface SaturnChipSizes {
  /** Desktop SaturnCard half-width (220/2). */
  cardHalfW: number;
  /** Desktop SaturnCard half-height (100/2). */
  cardHalfH: number;
  /** Mobile SaturnChip half-width (180/2). */
  chipHalfW: number;
  /** Mobile SaturnChip half-height (36/2). */
  chipHalfH: number;
}

const TWO_PI = Math.PI * 2;
const DEG2RAD = Math.PI / 180;

/** Default chip half-sizes. Overridable per call site via the `chipSizes` parameter. */
export const DEFAULT_CHIP_SIZES: SaturnChipSizes = {
  cardHalfW: 110,
  cardHalfH: 50,
  chipHalfW: 90,
  chipHalfH: 18,
};

// Cache previous zIndex per element to avoid per-frame stacking context
// invalidation — only write when the rounded value actually changes.
const prevZIndex = new WeakMap<HTMLDivElement, number>();

/**
 * Pure predicate — is a chip at angle `theta` on a ring of `radius`, tilted
 * by `tiltDeg` on `tiltAxis`, inside the rectangular viewport band?
 *
 * - X-axis tilt (landscape ellipse): horizontal radius is preserved,
 *   vertical radius is compressed by `cos(tiltDeg)` (top/bottom recedes).
 * - Y-axis tilt (portrait ellipse): vertical radius is preserved,
 *   horizontal radius is compressed by `cos(tiltDeg)` (left/right recedes).
 *
 * A chip is in band iff the rect it paints (projected centre ± chip half)
 * fits the viewport half-size on both axes.
 */
export function isInBand(
  params: {
    theta: number;
    radius: number;
    tiltDeg: number;
    tiltAxis: "x" | "y";
  },
  viewport: { halfW: number; halfH: number },
  chipHalf: { w: number; h: number },
): boolean {
  const cosTilt = Math.cos(params.tiltDeg * DEG2RAD);
  const px =
    params.tiltAxis === "y"
      ? Math.cos(params.theta) * params.radius * cosTilt
      : Math.cos(params.theta) * params.radius;
  const py =
    params.tiltAxis === "y"
      ? Math.sin(params.theta) * params.radius
      : Math.sin(params.theta) * params.radius * cosTilt;
  return (
    Math.abs(px) + chipHalf.w <= viewport.halfW &&
    Math.abs(py) + chipHalf.h <= viewport.halfH
  );
}

interface BandContext {
  halfW: number;
  halfH: number;
  chipHalfW: number;
  chipHalfH: number;
}

function positionChip(
  el: HTMLDivElement,
  theta: number,
  radius: number,
  tilt: number,
  tiltAxis: "x" | "y",
  depthFactor: number,
  band: BandContext | null,
  // Precomputed `cos(tilt * DEG2RAD)` — hoisted out of the per-chip band
  // check in `isInBand` so 58 chips × 60fps don't recompute the same
  // constant per ring. Computed once per ring in `positionAllChips`.
  cosTilt: number,
) {
  const t = (depthFactor + 1) / 2; // normalize -1..1 to 0..1
  const scale = 0.85 + 0.15 * t;
  let opacity = 0.5 + 0.5 * t;
  const zIndex = Math.round(t * 100);

  // Counter-rotate around the same axis the ring is tilted on so the chip
  // faces the camera regardless of orientation.
  const counter =
    tiltAxis === "y" ? `rotateY(${-tilt}deg)` : `rotateX(${-tilt}deg)`;

  if (band) {
    // Inline the band check with the precomputed `cosTilt` to avoid the
    // per-chip Math.cos call that `isInBand` would otherwise perform.
    const px =
      tiltAxis === "y"
        ? Math.cos(theta) * radius * cosTilt
        : Math.cos(theta) * radius;
    const py =
      tiltAxis === "y"
        ? Math.sin(theta) * radius
        : Math.sin(theta) * radius * cosTilt;
    const inBand =
      Math.abs(px) + band.chipHalfW <= band.halfW &&
      Math.abs(py) + band.chipHalfH <= band.halfH;
    if (!inBand) {
      // Visually hint that this chip is out of the interactive band so a
      // user hovering the "ghost" area isn't surprised that it's leaning
      // into empty space. 0.4 keeps the silhouette readable while clearly
      // muting it. We deliberately do NOT disable pointer events — the
      // outer ring's natural orbit pushes chips out of the container's
      // vertical band at typical viewport sizes, and making them
      // unclickable was worse than the hover-ghost issue it aimed to fix.
      opacity *= 0.4;
    }
  }

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
  viewportSize: SaturnViewportSize | null,
  chipSizes: SaturnChipSizes,
  chipVariant: "card" | "chip",
) {
  const band: BandContext | null = viewportSize
    ? {
        halfW: viewportSize.width / 2,
        halfH: viewportSize.height / 2,
        chipHalfW:
          chipVariant === "chip" ? chipSizes.chipHalfW : chipSizes.cardHalfW,
        chipHalfH:
          chipVariant === "chip" ? chipSizes.chipHalfH : chipSizes.cardHalfH,
      }
    : null;

  for (let r = 0; r < configs.length; r++) {
    const cfg = configs[r];
    const chips = chipRefs[r];
    if (!chips) continue;

    const tiltAxis = cfg.tiltAxis ?? "x";
    // `cfg.tiltX` is a constant per ring; hoist the cos computation out of
    // the per-chip band check (58 chips × 60fps would otherwise recompute
    // the same value every frame).
    const cosTilt = Math.cos(cfg.tiltX * DEG2RAD);

    for (let c = 0; c < cfg.chipCount; c++) {
      const el = chips[c];
      if (!el) continue;

      const theta = angles[r] + (c / cfg.chipCount) * TWO_PI;
      // For X-axis tilt: top of ring (θ=π/2) comes forward → sin(θ).
      // For Y-axis tilt: left of ring (θ=π) comes forward → −cos(θ).
      const depthFactor =
        tiltAxis === "y" ? -Math.cos(theta) : Math.sin(theta);
      positionChip(
        el,
        theta,
        cfg.radius,
        cfg.tiltX,
        tiltAxis,
        depthFactor,
        band,
        cosTilt,
      );
    }
  }
}

export function useSaturnAnimation(
  configs: RingConfig[],
  chipRefs: MutableRefObject<HTMLDivElement[][]>,
  pausedRef: MutableRefObject<boolean>,
  prefersReducedMotion: boolean,
  viewportSize: SaturnViewportSize | null = null,
  chipSizes: SaturnChipSizes = DEFAULT_CHIP_SIZES,
  chipVariant: "card" | "chip" = "card",
): void {
  const anglesRef = useRef<Float64Array | null>(null);

  useEffect(() => {
    if (!prefersReducedMotion) return;

    const angles = new Float64Array(configs.length);
    positionAllChips(
      configs,
      chipRefs.current,
      angles,
      viewportSize,
      chipSizes,
      chipVariant,
    );
  }, [
    prefersReducedMotion,
    configs,
    chipRefs,
    viewportSize,
    chipSizes,
    chipVariant,
  ]);

  // Animation loop for normal motion. `viewportSize` is captured in the
  // effect's closure so a resize re-subscribes the rAF with the fresh band.
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

      positionAllChips(
        configs,
        chipRefs.current,
        angles,
        viewportSize,
        chipSizes,
        chipVariant,
      );
      rafId = requestAnimationFrame(animate);
    }

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [
    prefersReducedMotion,
    configs,
    chipRefs,
    pausedRef,
    viewportSize,
    chipSizes,
    chipVariant,
  ]);
}
