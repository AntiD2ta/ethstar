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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { animateScrollToCenter, computeCenterScrollLeft } from "./animate-scroll";

/** Build a container/target pair with mocked layout properties. happy-dom
 *  doesn't compute layout, so we patch the read-only properties via
 *  Object.defineProperty. The container is treated as the scroll viewport
 *  with its left edge at x=0; the target's bounding rect is derived from
 *  `targetOffsetLeft`, `targetWidth`, and the initial `scrollLeft`. */
function buildContainerWithTarget(opts: {
  containerWidth: number;
  scrollWidth: number;
  targetOffsetLeft: number;
  targetWidth: number;
  initialScrollLeft?: number;
}): { container: HTMLDivElement; target: HTMLDivElement } {
  const container = document.createElement("div");
  const target = document.createElement("div");
  container.appendChild(target);
  document.body.appendChild(container);

  Object.defineProperty(container, "clientWidth", {
    configurable: true,
    value: opts.containerWidth,
  });
  Object.defineProperty(container, "scrollWidth", {
    configurable: true,
    value: opts.scrollWidth,
  });
  Object.defineProperty(target, "clientWidth", {
    configurable: true,
    value: opts.targetWidth,
  });

  container.scrollLeft = opts.initialScrollLeft ?? 0;

  // Container sits at viewport x=0. Target's on-screen left = its
  // offset-within-content minus the current scrollLeft.
  container.getBoundingClientRect = () =>
    ({
      left: 0,
      right: opts.containerWidth,
      top: 0,
      bottom: 0,
      width: opts.containerWidth,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  target.getBoundingClientRect = () => {
    const left = opts.targetOffsetLeft - container.scrollLeft;
    return {
      left,
      right: left + opts.targetWidth,
      top: 0,
      bottom: 0,
      width: opts.targetWidth,
      height: 0,
      x: left,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };

  return { container, target };
}

describe("computeCenterScrollLeft", () => {
  it("centers the target inside the container", () => {
    const { container, target } = buildContainerWithTarget({
      containerWidth: 800,
      scrollWidth: 4000,
      targetOffsetLeft: 1500,
      targetWidth: 200,
    });
    // Center: 1500 - (800 - 200) / 2 = 1500 - 300 = 1200
    expect(computeCenterScrollLeft(container, target)).toBe(1200);
  });

  it("clamps to 0 when the target sits near the left edge", () => {
    const { container, target } = buildContainerWithTarget({
      containerWidth: 800,
      scrollWidth: 4000,
      targetOffsetLeft: 50,
      targetWidth: 200,
    });
    // Raw: 50 - 300 = -250 → clamped to 0
    expect(computeCenterScrollLeft(container, target)).toBe(0);
  });

  it("clamps to scrollWidth - clientWidth when the target sits near the right edge", () => {
    const { container, target } = buildContainerWithTarget({
      containerWidth: 800,
      scrollWidth: 4000,
      targetOffsetLeft: 3900,
      targetWidth: 100,
    });
    // Raw: 3900 - 350 = 3550. Max is 4000 - 800 = 3200 → clamped to 3200.
    expect(computeCenterScrollLeft(container, target)).toBe(3200);
  });
});

describe("animateScrollToCenter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("animates scrollLeft toward the centered position over the given duration", async () => {
    const { container, target } = buildContainerWithTarget({
      containerWidth: 400,
      scrollWidth: 2000,
      targetOffsetLeft: 1000,
      targetWidth: 100,
      initialScrollLeft: 0,
    });
    // Center target: 1000 - (400 - 100)/2 = 1000 - 150 = 850

    const easing = (t: number) => 1 - Math.pow(1 - t, 5);
    const promise = animateScrollToCenter(container, target, 200, easing);

    // Run all rAF/timers until the promise resolves.
    await vi.runAllTimersAsync();
    await promise;

    expect(container.scrollLeft).toBe(850);
  });

  it("cancels in-flight animations when controller.cancel() is called", async () => {
    const { container, target } = buildContainerWithTarget({
      containerWidth: 400,
      scrollWidth: 2000,
      targetOffsetLeft: 1000,
      targetWidth: 100,
      initialScrollLeft: 0,
    });

    const easing = (t: number) => 1 - Math.pow(1 - t, 5);
    const controller = { cancelled: false };
    const promise = animateScrollToCenter(
      container,
      target,
      200,
      easing,
      controller,
    );

    // Advance partway, then cancel.
    await vi.advanceTimersByTimeAsync(20);
    controller.cancelled = true;
    await vi.runAllTimersAsync();
    await promise;

    // Cancelled mid-flight, so scrollLeft must NOT have reached the final
    // 850 target — it should be paused somewhere along the way.
    expect(container.scrollLeft).toBeLessThan(850);
  });

  it("resolves immediately when the target is already centered", async () => {
    const { container, target } = buildContainerWithTarget({
      containerWidth: 400,
      scrollWidth: 2000,
      targetOffsetLeft: 1000,
      targetWidth: 100,
      initialScrollLeft: 850,
    });

    const promise = animateScrollToCenter(
      container,
      target,
      200,
      (t) => 1 - Math.pow(1 - t, 5),
    );
    await vi.runAllTimersAsync();
    await promise;
    expect(container.scrollLeft).toBe(850);
  });
});
