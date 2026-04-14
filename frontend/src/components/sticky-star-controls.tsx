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

import { memo, useEffect, useState, type RefObject } from "react";
import { StarAllButton } from "./star-all-button";

interface StickyStarControlsProps {
  /** Ref to the hero section element. The sticky CTA mounts when the hero
   *  is fully scrolled past (no longer intersecting the viewport). A
   *  sentinel placed *beneath* the hero would false-positive on short
   *  viewports where the sentinel starts below the fold. */
  heroRef: RefObject<HTMLElement | null>;
  /** Only the `remaining` count is consumed — passing the full `StarProgress`
   *  object would defeat memoisation because `progress.current` changes on
   *  every tick during `starAll`. */
  remaining: number;
  isStarring: boolean;
  allDone: boolean;
  onStarAll: () => void;
  /** Force-hide the control (e.g. while a modal is open). */
  hidden?: boolean;
}

export const StickyStarControls = memo(function StickyStarControls({
  heroRef,
  remaining,
  isStarring,
  allDone,
  onStarAll,
  hidden,
}: StickyStarControlsProps) {
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setPastHero(!entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [heroRef]);

  if (hidden) return null;
  if (!pastHero) return null;
  if (allDone || remaining === 0) return null;

  return (
    <div
      role="region"
      aria-label="Starring controls"
      data-testid="sticky-star-controls"
      className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pointer-events-none"
    >
      <div className="glass pointer-events-auto rounded-full px-2 py-2 shadow-lg ring-1 ring-border/40 backdrop-blur">
        <StarAllButton
          remaining={remaining}
          isStarring={isStarring}
          allDone={allDone}
          onClick={onStarAll}
        />
      </div>
    </div>
  );
});
