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

let _cached: boolean | null = null;

/** Detect WebGL support by probing a throwaway canvas. Result is memoized. */
export function supportsWebGL(): boolean {
  if (_cached !== null) return _cached;
  try {
    const c = document.createElement("canvas");
    _cached = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    _cached = false;
  }
  return _cached;
}

type IdleDeadline = { didTimeout: boolean; timeRemaining: () => number };
type RequestIdleCallback = (
  cb: (d: IdleDeadline) => void,
  opts?: { timeout?: number },
) => number;
type CancelIdleCallback = (handle: number) => void;

/**
 * Schedule `cb` during browser idle time. Falls back to `setTimeout` with the
 * given delay when requestIdleCallback is unavailable (Safari < 16.4). Returns
 * a cancel function that clears whichever scheduler fired. Paired with a 2s
 * safety timeout so a permanently busy main thread can't starve the callback.
 */
export function onIdle(cb: () => void, fallbackDelayMs = 200): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const w = window as unknown as {
    requestIdleCallback?: RequestIdleCallback;
    cancelIdleCallback?: CancelIdleCallback;
  };
  if (w.requestIdleCallback && w.cancelIdleCallback) {
    const id = w.requestIdleCallback(() => cb(), { timeout: 2000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(cb, fallbackDelayMs);
  return () => window.clearTimeout(id);
}

type NavigatorConnection = { saveData?: boolean };
type NavigatorWithLowEndHints = Navigator & {
  deviceMemory?: number;
  connection?: NavigatorConnection;
};

/**
 * Read the user's Save-Data header opt-in via the Network Information API.
 * Returns false when the API is missing (Safari, older Firefox) — treat
 * absence as "no opt-in," never as "yes."
 */
export function prefersSaveData(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as NavigatorWithLowEndHints).connection;
  return conn?.saveData === true;
}

/**
 * Heuristic: the device is likely to struggle with the WebGL scene. Hits on
 * hardwareConcurrency ≤ 4, deviceMemory ≤ 2 GB, or Save-Data opt-in. Any
 * match short-circuits the 3D import entirely in favour of the static PNG
 * fallback — we trade the signature visual on low-end hardware for a
 * paint-within-a-frame hero on devices that can't afford 40s of shader
 * compile. Probabilistic branching: some real users will never see the 3D
 * version, which is an intentional tradeoff tracked via analytics.
 */
export function isLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as NavigatorWithLowEndHints;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) {
    return true;
  }
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 2) {
    return true;
  }
  if (nav.connection?.saveData === true) {
    return true;
  }
  return false;
}
