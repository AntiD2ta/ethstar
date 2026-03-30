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
});
