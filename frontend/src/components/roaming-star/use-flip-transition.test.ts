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

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFlipTransition } from "./use-flip-transition";

// Baseline coverage for useFlipTransition's control flow. These tests verify
// the sequence of DOM calls the hook makes (measure → cancel → animate),
// not the animation output — happy-dom has no WAAPI layout, and a real
// animation would also require real timers.
//
// The setup.ts global `HTMLElement.prototype.animate` shim returns a no-op
// stub; we override `animate` per-element to capture calls and return a
// controllable Animation-like stub.

type AnimationStub = {
  cancel: ReturnType<typeof vi.fn>;
  onfinish: (() => void) | null;
  oncancel: (() => void) | null;
};

function makeMockElement({
  left,
  top,
}: {
  left: number;
  top: number;
}): {
  element: HTMLElement;
  animate: ReturnType<typeof vi.fn>;
  animations: AnimationStub[];
} {
  const element = document.createElement("div");
  const animations: AnimationStub[] = [];
  const animate = vi.fn(() => {
    const stub: AnimationStub = {
      cancel: vi.fn(),
      onfinish: null,
      oncancel: null,
    };
    animations.push(stub);
    return stub as unknown as Animation;
  });
  // Override per-element — doesn't touch the setup.ts prototype shim, so
  // other tests that incidentally rely on the shim stay unaffected.
  Object.defineProperty(element, "animate", {
    value: animate,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(element, "getBoundingClientRect", {
    value: () => ({
      left,
      top,
      right: left,
      bottom: top,
      width: 0,
      height: 0,
      x: left,
      y: top,
      toJSON: () => ({}),
    }),
    writable: true,
    configurable: true,
  });
  return { element, animate, animations };
}

describe("useFlipTransition", () => {
  it("flipTo calls element.animate with the inverse-delta keyframes when dx/dy exceed 0.5px", () => {
    const { result } = renderHook(() => useFlipTransition());
    const { element, animate } = makeMockElement({ left: 100, top: 100 });

    act(() => {
      result.current.flipTo({
        element,
        target: { x: 50, y: 50 },
        durationMs: 300,
        easing: "linear",
      });
    });

    // rect {100,100} - target {50,50} → dx=50, dy=50 → First keyframe must
    // translate by (-50, -50) back to the "First" visual position before
    // animating forward to (0, 0).
    expect(animate).toHaveBeenCalledTimes(1);
    const [keyframes, options] = animate.mock.calls[0];
    expect(keyframes).toEqual([
      { transform: "translate(-50px, -50px)" },
      { transform: "translate(0px, 0px)" },
    ]);
    expect(options).toMatchObject({
      duration: 300,
      easing: "linear",
      fill: "none",
    });
  });

  it("flipTo skips animation and calls onDone synchronously when within the 0.5px snap threshold", () => {
    const { result } = renderHook(() => useFlipTransition());
    // Sub-pixel drift — the hook must treat this as "already there" to
    // avoid a 1-frame jitter for a visually indistinguishable target.
    const { element, animate } = makeMockElement({ left: 50.2, top: 50.1 });
    const onDone = vi.fn();

    act(() => {
      result.current.flipTo({
        element,
        target: { x: 50, y: 50 },
        durationMs: 300,
        easing: "linear",
        onDone,
      });
    });

    expect(animate).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("flipTo while in-flight cancels the previous animation before starting the next", () => {
    const { result } = renderHook(() => useFlipTransition());
    const { element, animate, animations } = makeMockElement({
      left: 100,
      top: 100,
    });

    act(() => {
      result.current.flipTo({
        element,
        target: { x: 50, y: 50 },
        durationMs: 300,
        easing: "linear",
      });
    });

    // First animation is in-flight; re-triggering must cancel it before the
    // new `animate()` call lands. This is the scroll-reversal guard.
    expect(animations).toHaveLength(1);
    expect(animations[0].cancel).not.toHaveBeenCalled();

    act(() => {
      result.current.flipTo({
        element,
        target: { x: 20, y: 20 },
        durationMs: 300,
        easing: "linear",
      });
    });

    expect(animations[0].cancel).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledTimes(2);
    // The second animation must be a fresh stub — not the same reference.
    expect(animations).toHaveLength(2);
    expect(animations[1]).not.toBe(animations[0]);
  });

  it("cancel() calls cancel() on an active animation and clears the internal ref", () => {
    const { result } = renderHook(() => useFlipTransition());
    const { element, animations } = makeMockElement({ left: 100, top: 100 });

    act(() => {
      result.current.flipTo({
        element,
        target: { x: 50, y: 50 },
        durationMs: 300,
        easing: "linear",
      });
    });

    expect(animations).toHaveLength(1);
    expect(animations[0].cancel).not.toHaveBeenCalled();

    act(() => {
      result.current.cancel();
    });

    expect(animations[0].cancel).toHaveBeenCalledTimes(1);

    // A follow-up cancel() must be a no-op — the ref is cleared, so there's
    // nothing to cancel. This guards against a double-cancel sneaking a
    // stale reference back in.
    act(() => {
      result.current.cancel();
    });
    expect(animations[0].cancel).toHaveBeenCalledTimes(1);
  });
});
