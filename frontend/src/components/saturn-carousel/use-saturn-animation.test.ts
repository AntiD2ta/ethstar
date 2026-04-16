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

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { isInBand, useSaturnAnimation } from "./use-saturn-animation";
import type { RingConfig } from "./use-saturn-animation";

const configs: RingConfig[] = [
  {
    radius: 140,
    speed: 0.25,
    direction: 1,
    tiltX: 65,
    tiltZ: 0,
    chipCount: 2,
  },
];

function makeChipRefs(ringCount: number, chipCounts: number[]) {
  const refs: HTMLDivElement[][] = [];
  for (let r = 0; r < ringCount; r++) {
    refs[r] = [];
    for (let c = 0; c < chipCounts[r]; c++) {
      refs[r][c] = document.createElement("div");
    }
  }
  return { current: refs };
}

describe("useSaturnAnimation", () => {
  let rafSpy: ReturnType<typeof vi.spyOn>;
  let cafSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1);
    cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockReturnValue();
  });

  afterEach(() => {
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  it("calls requestAnimationFrame on mount", () => {
    const chipRefs = makeChipRefs(1, [2]);
    const pausedRef = { current: false };
    renderHook(() =>
      useSaturnAnimation(configs, chipRefs, pausedRef, false),
    );
    expect(rafSpy).toHaveBeenCalled();
  });

  it("calls cancelAnimationFrame on unmount", () => {
    const chipRefs = makeChipRefs(1, [2]);
    const pausedRef = { current: false };
    const { unmount } = renderHook(() =>
      useSaturnAnimation(configs, chipRefs, pausedRef, false),
    );
    unmount();
    expect(cafSpy).toHaveBeenCalled();
  });

  it("does not call requestAnimationFrame when reduced motion is true", () => {
    const chipRefs = makeChipRefs(1, [2]);
    const pausedRef = { current: false };
    renderHook(() =>
      useSaturnAnimation(configs, chipRefs, pausedRef, true),
    );
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it("positions chips statically when reduced motion is true", () => {
    const chipRefs = makeChipRefs(1, [2]);
    const pausedRef = { current: false };
    renderHook(() =>
      useSaturnAnimation(configs, chipRefs, pausedRef, true),
    );
    // Each chip should have a transform set (static positioning)
    for (const el of chipRefs.current[0]) {
      expect(el.style.transform).not.toBe("");
    }
  });

  it("uses rotateX counter-rotation by default (x-axis tilt)", () => {
    const chipRefs = makeChipRefs(1, [2]);
    const pausedRef = { current: false };
    renderHook(() =>
      useSaturnAnimation(configs, chipRefs, pausedRef, true),
    );
    // Default tilt axis is "x" — chips should be counter-rotated on X to
    // face the camera after the ring's rotateX tilt.
    const transform = chipRefs.current[0][0].style.transform;
    expect(transform).toContain("rotateX(-65deg)");
    expect(transform).not.toContain("rotateY(");
  });

  it("uses rotateY counter-rotation when tiltAxis is 'y' (vertical ring)", () => {
    const verticalConfigs: RingConfig[] = [
      {
        radius: 140,
        speed: 0.25,
        direction: 1,
        tiltX: 55,
        tiltZ: 0,
        chipCount: 2,
        tiltAxis: "y",
      },
    ];
    const chipRefs = makeChipRefs(1, [2]);
    const pausedRef = { current: false };
    renderHook(() =>
      useSaturnAnimation(verticalConfigs, chipRefs, pausedRef, true),
    );
    // Tall ring — counter-rotation should be on Y, not X.
    const transform = chipRefs.current[0][0].style.transform;
    expect(transform).toContain("rotateY(-55deg)");
    expect(transform).not.toContain("rotateX(");
  });
});

describe("isInBand", () => {
  // X-axis tilt (desktop landscape ellipse): the horizontal radius is
  // preserved, the vertical radius is compressed by cos(tiltDeg).
  const xTilt = {
    radius: 570,
    tiltDeg: 45,
    tiltAxis: "x" as const,
  };
  // Desktop card is 220x100 → half width/height 110/50.
  const cardHalf = { w: 110, h: 50 };

  it("returns true for a chip at the side of an X-tilt ring that fits the viewport width", () => {
    // theta=0 → projected (cos0*radius, sin0*radius*cos45) = (570, 0).
    // With viewport width 1400 and half=700, |x_proj|+110=680 ≤ 700 → in band.
    expect(
      isInBand(
        { theta: 0, radius: xTilt.radius, tiltDeg: xTilt.tiltDeg, tiltAxis: xTilt.tiltAxis },
        { halfW: 700, halfH: 400 },
        cardHalf,
      ),
    ).toBe(true);
  });

  it("returns false for a chip at the bottom of an X-tilt ring when it projects below the viewport", () => {
    // theta=π/2 → projected Y = radius * cos(45°) ≈ 403.
    // Viewport half-height 300 (like a 600px band): |y_proj|+50=453 > 300 → out.
    expect(
      isInBand(
        { theta: Math.PI / 2, radius: 570, tiltDeg: 45, tiltAxis: "x" },
        { halfW: 700, halfH: 300 },
        cardHalf,
      ),
    ).toBe(false);
  });

  it("returns true for a chip at the top of an X-tilt ring when it fits the viewport height", () => {
    // theta=-π/2 → projected Y ≈ -403. Viewport half-height 500 → fits.
    expect(
      isInBand(
        { theta: -Math.PI / 2, radius: 570, tiltDeg: 45, tiltAxis: "x" },
        { halfW: 700, halfH: 500 },
        cardHalf,
      ),
    ).toBe(true);
  });

  it("returns false for a Y-tilt chip at the side when the viewport is too narrow", () => {
    // theta=0 → projected X = cos(0)*radius*cos(55°) ≈ 235 * 0.574 ≈ 135.
    // chip half width 90 → |x|+half=225. Viewport half-width 180 → out.
    expect(
      isInBand(
        { theta: 0, radius: 235, tiltDeg: 55, tiltAxis: "y" },
        { halfW: 180, halfH: 270 },
        { w: 90, h: 18 },
      ),
    ).toBe(false);
  });

  it("returns true for a Y-tilt chip at the top where Y projection is 0", () => {
    // theta=-π/2 → projected Y = sin(-π/2)*radius = -radius. Not compressed
    // for Y-axis tilt. Viewport half-height must accommodate.
    expect(
      isInBand(
        { theta: -Math.PI / 2, radius: 100, tiltDeg: 55, tiltAxis: "y" },
        { halfW: 180, halfH: 270 },
        { w: 90, h: 18 },
      ),
    ).toBe(true);
  });
});

describe("useSaturnAnimation band filter", () => {
  let rafSpy2: ReturnType<typeof vi.spyOn>;
  let cafSpy2: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rafSpy2 = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockReturnValue(1);
    cafSpy2 = vi
      .spyOn(globalThis, "cancelAnimationFrame")
      .mockReturnValue();
  });

  afterEach(() => {
    rafSpy2.mockRestore();
    cafSpy2.mockRestore();
  });

  it("dims out-of-band chips under reduced motion while keeping them clickable", () => {
    // Construct a ring whose vertical extent exceeds the viewport height
    // (radius 570 × cos45° ≈ 403), with viewport half-height 300. At
    // theta=π/2 (chip at bottom), the chip falls out of band.
    const configs: RingConfig[] = [
      {
        radius: 570,
        speed: 0,
        direction: 1,
        tiltX: 45,
        tiltZ: 0,
        chipCount: 4,
      },
    ];
    const chipRefs = makeChipRefs(1, [4]);
    const pausedRef = { current: false };
    renderHook(() =>
      useSaturnAnimation(
        configs,
        chipRefs,
        pausedRef,
        true,
        { width: 1400, height: 600 },
        { cardHalfW: 110, cardHalfH: 50, chipHalfW: 90, chipHalfH: 18 },
      ),
    );
    // Chip index 1 sits at θ = 0 + (1/4)*2π = π/2 — the bottom of the ring.
    // Out-of-band chips are dimmed (opacity multiplied by 0.4) but stay
    // interactive — outer ring chips commonly project beyond the viewport
    // band at typical heights, and making them unclickable hurts more than
    // the hover-ghost issue the dimming signals.
    const outOfBand = parseFloat(chipRefs.current[0][1].style.opacity);
    const inBand = parseFloat(chipRefs.current[0][0].style.opacity);
    expect(outOfBand).toBeLessThan(inBand);
    expect(outOfBand).toBeLessThanOrEqual(0.4);
    // Never written inline — pointer events stay default so the chip is
    // clickable wherever it renders.
    expect(chipRefs.current[0][1].style.pointerEvents).toBe("");
    expect(chipRefs.current[0][0].style.pointerEvents).toBe("");
  });

  it("keeps chips at full opacity when the viewport is large enough", () => {
    const configs: RingConfig[] = [
      {
        radius: 240,
        speed: 0,
        direction: 1,
        tiltX: 45,
        tiltZ: 0,
        chipCount: 4,
      },
    ];
    const chipRefs = makeChipRefs(1, [4]);
    const pausedRef = { current: false };
    renderHook(() =>
      useSaturnAnimation(
        configs,
        chipRefs,
        pausedRef,
        true,
        { width: 1400, height: 900 },
        { cardHalfW: 110, cardHalfH: 50, chipHalfW: 90, chipHalfH: 18 },
      ),
    );
    for (const el of chipRefs.current[0]) {
      // No chip should be dimmed below the minimum in-band opacity of 0.5.
      expect(parseFloat(el.style.opacity)).toBeGreaterThanOrEqual(0.5);
      expect(el.style.pointerEvents).toBe("");
    }
  });

  it("skips the band filter when viewportSize is null", () => {
    const configs: RingConfig[] = [
      {
        radius: 570,
        speed: 0,
        direction: 1,
        tiltX: 45,
        tiltZ: 0,
        chipCount: 4,
      },
    ];
    const chipRefs = makeChipRefs(1, [4]);
    const pausedRef = { current: false };
    renderHook(() =>
      useSaturnAnimation(
        configs,
        chipRefs,
        pausedRef,
        true,
        null,
        { cardHalfW: 110, cardHalfH: 50, chipHalfW: 90, chipHalfH: 18 },
      ),
    );
    // Without a viewport measurement yet, band dimming is skipped — every
    // chip keeps the base opacity (>= 0.5) instead of the 0.4× penalty.
    for (const el of chipRefs.current[0]) {
      expect(parseFloat(el.style.opacity)).toBeGreaterThanOrEqual(0.5);
      expect(el.style.pointerEvents).toBe("");
    }
  });
});
