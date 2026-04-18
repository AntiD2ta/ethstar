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

/**
 * Read the user's Save-Data header opt-in via the Network Information API.
 * Returns false when the API is missing (Safari, older Firefox) — treat
 * absence as "no opt-in," never as "yes."
 */
export function prefersSaveData(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: NavigatorConnection }).connection;
  return conn?.saveData === true;
}
