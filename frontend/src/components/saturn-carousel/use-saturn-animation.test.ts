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
import { useSaturnAnimation } from "./use-saturn-animation";
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
