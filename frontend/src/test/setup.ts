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

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

// Node 25 exposes a stub `localStorage` global that shadows happy-dom's
// implementation and lacks setItem/clear. Install a simple Map-backed
// polyfill so tests can use localStorage/sessionStorage reliably.
class MapStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

// A single MapStorage instance is installed on both `globalThis` and `window`
// so that production code (which reads `window.localStorage`) and test helpers
// (which may use `globalThis.localStorage`) share the same backing store.
beforeAll(() => {
  const localStore = new MapStorage();
  const sessionStore = new MapStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: localStore,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: sessionStore,
    writable: true,
    configurable: true,
  });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: localStore,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "sessionStorage", {
      value: sessionStore,
      writable: true,
      configurable: true,
    });
  }
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

// Web Animations API shim for happy-dom: jsdom/happy-dom don't implement
// `element.animate()`, and any component relying on a FLIP useLayoutEffect
// (e.g. `useFlipTransition` in RoamingStar) would throw when the effect
// runs. Installing a minimal Animation-shaped stub here — instead of inside
// each test — prevents tests that only incidentally touch FLIP code from
// reinventing the shim. Restored after the suite so leakage to other
// runners is avoided.
type AnimationShim = {
  cancel: () => void;
  finish: () => void;
  onfinish: (() => void) | null;
  oncancel: (() => void) | null;
};
let previousAnimate: unknown;
let animateShimInstalled = false;

beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as { animate?: unknown };
  if (typeof proto.animate !== "function") {
    previousAnimate = proto.animate;
    proto.animate = function animate(): AnimationShim {
      return {
        cancel: () => {},
        finish: () => {},
        onfinish: null,
        oncancel: null,
      };
    };
    animateShimInstalled = true;
  }
});

afterAll(() => {
  if (!animateShimInstalled) return;
  const proto = HTMLElement.prototype as unknown as { animate?: unknown };
  if (previousAnimate === undefined) {
    delete proto.animate;
  } else {
    proto.animate = previousAnimate;
  }
});
