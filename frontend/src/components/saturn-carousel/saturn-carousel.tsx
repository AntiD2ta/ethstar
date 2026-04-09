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

import { useCallback, useRef } from "react";
import { SaturnRing } from "./saturn-ring";
import { SaturnChip } from "./saturn-chip";
import { useSaturnAnimation } from "./use-saturn-animation";
import type { RingConfig } from "./use-saturn-animation";
import { CATEGORIES, REPOS_BY_CATEGORY } from "@/lib/repos";
import type { RepoMeta } from "@/lib/github";
import type { StarStatus } from "@/lib/types";
import { CssDiamond } from "@/components/css-diamond";
import { repoKey } from "@/lib/repo-key";

interface SaturnCarouselProps {
  starStatuses: Record<string, StarStatus>;
  repoMeta: Record<string, RepoMeta>;
  metaLoading: boolean;
  isDesktop: boolean;
  prefersReducedMotion: boolean;
}

// Must stay in the same order as CATEGORIES in repos.ts
const RING_CONFIGS: RingConfig[] = [
  { radius: 240, speed: 0.18, direction: 1, tiltX: 45, tiltZ: 0, chipCount: REPOS_BY_CATEGORY["Ethereum Core"].length },
  { radius: 350, speed: 0.13, direction: -1, tiltX: 45, tiltZ: 4, chipCount: REPOS_BY_CATEGORY["Execution Clients"].length },
  { radius: 460, speed: 0.10, direction: 1, tiltX: 45, tiltZ: -3, chipCount: REPOS_BY_CATEGORY["Consensus Clients"].length },
  { radius: 570, speed: 0.07, direction: -1, tiltX: 45, tiltZ: 2, chipCount: REPOS_BY_CATEGORY["Validator Tooling"].length },
];

if (RING_CONFIGS.length !== CATEGORIES.length) {
  throw new Error(
    `RING_CONFIGS (${RING_CONFIGS.length}) must match CATEGORIES (${CATEGORIES.length})`,
  );
}

const CATEGORY_ORDER = CATEGORIES.map((c) => c.name);

// Named export for direct imports (tests); default export for React.lazy().
export function SaturnCarousel({
  starStatuses,
  repoMeta,
  metaLoading,
  isDesktop,
  prefersReducedMotion,
}: SaturnCarouselProps) {
  const chipRefs = useRef<HTMLDivElement[][]>([]);
  const pausedRef = useRef(false);

  useSaturnAnimation(RING_CONFIGS, chipRefs, pausedRef, prefersReducedMotion || !isDesktop);

  const pause = useCallback(() => {
    pausedRef.current = true;
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
  }, []);

  if (!isDesktop) {
    return (
      <section
        aria-label="Ethereum ecosystem repositories"
        className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 py-8"
      >
        <h2 className="sr-only">Ethereum Ecosystem</h2>
        <div aria-hidden="true" className="mx-auto size-20 opacity-70">
          <CssDiamond />
        </div>
        {CATEGORY_ORDER.map((categoryName) => (
          <div key={categoryName} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {categoryName}
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {REPOS_BY_CATEGORY[categoryName].map((repo) => {
                const k = repoKey(repo);
                return (
                  <SaturnChip
                    key={k}
                    repo={repo}
                    status={starStatuses[k] ?? "unknown"}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section
      aria-label="Ethereum ecosystem repositories"
      className="relative mx-auto flex min-h-dvh w-full flex-col items-center justify-center"
      style={{ perspective: "1200px" }}
    >
      <h2 className="sr-only">Ethereum Ecosystem</h2>
      <div className="relative h-[80vh] w-full">
        {/* Central 3D diamond */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 size-32 -translate-x-1/2 -translate-y-1/2 opacity-60"
        >
          <CssDiamond />
        </div>

        {/* Orbiting rings */}
        {CATEGORY_ORDER.map((categoryName, ringIndex) => (
          <SaturnRing
            key={categoryName}
            repos={REPOS_BY_CATEGORY[categoryName]}
            starStatuses={starStatuses}
            repoMeta={repoMeta}
            metaLoading={metaLoading}
            ringIndex={ringIndex}
            tiltX={RING_CONFIGS[ringIndex].tiltX}
            tiltZ={RING_CONFIGS[ringIndex].tiltZ}
            radius={RING_CONFIGS[ringIndex].radius}
            chipRefs={chipRefs}
            onChipEnter={pause}
            onChipLeave={resume}
          />
        ))}
      </div>
    </section>
  );
}

export default SaturnCarousel;
