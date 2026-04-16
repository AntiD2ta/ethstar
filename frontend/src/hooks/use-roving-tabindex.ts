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

import { useCallback, useState } from "react";
import type { KeyboardEvent } from "react";

export interface UseRovingTabindexResult {
  /** Return the tabIndex value for the item at `index` (0 if current, -1 otherwise). */
  tabIndexFor: (index: number) => number;
  /** Handle ArrowLeft/Right/Up/Down + Home/End on the item at `index`. */
  onKeyDown: (event: KeyboardEvent<HTMLElement>, index: number) => void;
  /** Mark an item as the current tabbable one (usually wired to onFocus). */
  setCurrent: (index: number) => void;
  /** The currently active index (clamped to `[0, count-1]`; -1 when count is 0). */
  current: number;
}

/**
 * Roving-tabindex controller for a linear collection of focusable siblings.
 *
 * - Exactly one item has `tabIndex=0` at a time; the rest have `tabIndex=-1`.
 * - Arrow keys (both axes — H/V) move focus and swap the tabbable index.
 * - Home/End jump to ends.
 * - Wraps circularly on Arrow overflow.
 *
 * Works across an arbitrary number of siblings; the ring uses this at the
 * *ring-system* level (flattened across rings) so Tab exits the ring after
 * the first chip rather than hopping ring-to-ring.
 */
export function useRovingTabindex(count: number): UseRovingTabindexResult {
  const [storedCurrent, setCurrentState] = useState(0);

  // Derived, not state: if `count` shrinks below the stored index (user
  // narrows the filter mid-focus), fall back to 0 at render time. We
  // deliberately don't `setState` in an effect here — cascading renders are
  // bad, and the stored value can stay stale until the next user action.
  const current = count === 0 ? -1 : Math.min(storedCurrent, count - 1);

  const focusAt = useCallback(
    (next: number, element: HTMLElement | null | undefined) => {
      if (!element) return;
      // Walk up to the shared [data-roving-scope] container and query for the
      // sibling carrying data-roving-index. Cheaper than tracking a refs array
      // and avoids stale-ref issues when the ring re-renders.
      const scope = element.closest<HTMLElement>("[data-roving-scope]");
      const root: ParentNode = scope ?? document;
      const target = root.querySelector<HTMLElement>(
        `[data-roving-index="${next}"]`,
      );
      target?.focus();
    },
    [],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, index: number) => {
      if (count <= 0) return;
      let next: number | null = null;
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          next = (index + 1) % count;
          break;
        case "ArrowLeft":
        case "ArrowUp":
          next = (index - 1 + count) % count;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = count - 1;
          break;
        default:
          return;
      }
      event.preventDefault();
      setCurrentState(next);
      focusAt(next, event.currentTarget);
    },
    [count, focusAt],
  );

  const setCurrent = useCallback((index: number) => {
    setCurrentState(index);
  }, []);

  const tabIndexFor = useCallback(
    (index: number): number => {
      // With no items there's nothing to focus — callers render 0 chips so
      // this is only hit by edge probes; -1 is the honest answer.
      if (count === 0) return -1;
      return index === current ? 0 : -1;
    },
    [count, current],
  );

  return { tabIndexFor, onKeyDown, setCurrent, current };
}
