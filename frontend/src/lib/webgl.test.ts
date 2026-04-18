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

import { afterEach, describe, expect, it, vi } from "vitest";

// Each helper memoizes at module scope, so every test that wants a fresh
// cache imports webgl via a dynamic import after `vi.resetModules()`.
async function freshModule() {
  vi.resetModules();
  return await import("./webgl");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("prefersReducedMotion", () => {
  it("returns true when matchMedia reports reduce", async () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", matchMedia);
    const { prefersReducedMotion } = await freshModule();
    expect(prefersReducedMotion()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });

  it("returns false when matchMedia reports no-preference", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    const { prefersReducedMotion } = await freshModule();
    expect(prefersReducedMotion()).toBe(false);
  });

  it("returns false when matchMedia is unavailable", async () => {
    // jsdom exposes matchMedia; simulate its absence by stubbing to undefined.
    vi.stubGlobal("matchMedia", undefined);
    const { prefersReducedMotion } = await freshModule();
    expect(prefersReducedMotion()).toBe(false);
  });

  it("memoizes the matchMedia read across calls", async () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", matchMedia);
    const { prefersReducedMotion } = await freshModule();
    prefersReducedMotion();
    prefersReducedMotion();
    prefersReducedMotion();
    expect(matchMedia).toHaveBeenCalledTimes(1);
  });
});

describe("prefersSaveData", () => {
  it("memoizes the navigator.connection read across calls", async () => {
    const connGetter = vi.fn().mockReturnValue({ saveData: true });
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      get: connGetter,
    });
    const { prefersSaveData } = await freshModule();
    prefersSaveData();
    prefersSaveData();
    prefersSaveData();
    // The memoization also avoids re-reading the getter; the first call
    // stores the boolean and subsequent calls short-circuit.
    expect(connGetter).toHaveBeenCalledTimes(1);
  });
});

describe("isLowEndDevice", () => {
  it("memoizes the navigator reads across repeated calls", async () => {
    const hwGetter = vi.fn().mockReturnValue(2);
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      get: hwGetter,
    });
    const { isLowEndDevice } = await freshModule();
    // First invocation populates the cache; subsequent calls must not hit
    // the getter at all. The first call itself may read the property more
    // than once inside the body (typeof guard + comparison), so we snapshot
    // after it and assert that further calls add zero reads.
    isLowEndDevice();
    const callsAfterFirst = hwGetter.mock.calls.length;
    isLowEndDevice();
    isLowEndDevice();
    isLowEndDevice();
    expect(hwGetter.mock.calls.length).toBe(callsAfterFirst);
  });
});
