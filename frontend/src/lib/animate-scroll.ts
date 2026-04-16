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

/** Cancellation token for an in-flight `animateScrollToCenter` call. The
 *  caller flips `cancelled = true` to stop the rAF loop early; the promise
 *  still resolves so awaiters never hang. */
export interface AnimateScrollController {
  cancelled: boolean;
}

/** Returns the `scrollLeft` value that visually centers `target` inside
 *  `container`, clamped to the valid scroll range `[0, scrollWidth -
 *  clientWidth]`. Uses `getBoundingClientRect` to handle nested offset
 *  parents (`target.offsetLeft` is relative to its nearest positioned
 *  ancestor, which often is not `container`). */
export function computeCenterScrollLeft(
  container: HTMLElement,
  target: HTMLElement,
): number {
  const cRect = container.getBoundingClientRect();
  const tRect = target.getBoundingClientRect();
  const targetLeftWithinContent = tRect.left - cRect.left + container.scrollLeft;
  const raw = targetLeftWithinContent - (container.clientWidth - tRect.width) / 2;
  const max = Math.max(0, container.scrollWidth - container.clientWidth);
  return Math.max(0, Math.min(max, raw));
}

/** Animates `container.scrollLeft` to a position that centers `target`,
 *  using `requestAnimationFrame` and the supplied easing function. Resolves
 *  when the animation finishes or when `controller.cancelled` flips true. */
export function animateScrollToCenter(
  container: HTMLElement,
  target: HTMLElement,
  durationMs: number,
  easing: (t: number) => number,
  controller?: AnimateScrollController,
): Promise<void> {
  const start = container.scrollLeft;
  const end = computeCenterScrollLeft(container, target);
  const delta = end - start;

  if (delta === 0 || durationMs <= 0) {
    container.scrollLeft = end;
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let startTime = 0;

    function tick(now: number) {
      if (controller?.cancelled) {
        resolve();
        return;
      }
      if (startTime === 0) startTime = now;
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      container.scrollLeft = start + delta * easing(t);
      if (t >= 1) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  });
}
