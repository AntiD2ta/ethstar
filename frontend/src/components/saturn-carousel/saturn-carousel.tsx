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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { SaturnRing } from "./saturn-ring";
import { useSaturnAnimation } from "./use-saturn-animation";
import type { RingConfig } from "./use-saturn-animation";
import { distributeRepos, sortReposForDistribution } from "./distribute-repos";
import { CATEGORIES, REPOSITORIES } from "@/lib/repos";
import type { RepoMeta } from "@/lib/github";
import type { Repository, StarStatus } from "@/lib/types";
import { CssDiamond } from "@/components/css-diamond";
import { useRovingTabindex } from "@/hooks/use-roving-tabindex";

interface SaturnCarouselProps {
  starStatuses: Record<string, StarStatus>;
  repoMeta: Record<string, RepoMeta>;
  metaLoading: boolean;
  isDesktop: boolean;
  prefersReducedMotion: boolean;
  /** Subset of repos to render on the ring. Defaults to the full list. */
  repos?: Repository[];
  /** Primary action on a chip/card: jump to the matching marquee card. */
  onJump?: (repo: Repository) => void;
  /** Secondary action (shift+click menu): trigger the star flow. */
  onStarTrigger?: (repo: Repository) => void;
}

// Radii ordered inner → outer. Outer rings have larger circumference so
// they receive proportionally more chips (see `distributeRepos`).
// Exported so a drift-detection test can assert MOBILE_RADII stays
// proportional to DESKTOP_RADII (same slice counts are used on both).
export const DESKTOP_RADII = [240, 350, 460, 570] as const;
export const MOBILE_RADII = [100, 145, 190, 235] as const;

const CATEGORY_ORDER = CATEGORIES.map((c) => c.name);

// Desktop ring base configs (radii fixed; chipCount per ring is computed
// per-render from the filtered repo list).
const DESKTOP_BASE: Omit<RingConfig, "chipCount">[] = [
  { radius: DESKTOP_RADII[0], speed: 0.18, direction: 1, tiltX: 45, tiltZ: 0 },
  { radius: DESKTOP_RADII[1], speed: 0.13, direction: -1, tiltX: 45, tiltZ: 4 },
  { radius: DESKTOP_RADII[2], speed: 0.10, direction: 1, tiltX: 45, tiltZ: -3 },
  { radius: DESKTOP_RADII[3], speed: 0.07, direction: -1, tiltX: 45, tiltZ: 2 },
];

// Mobile ring base configs (Y-axis tilt for portrait ellipse).
const MOBILE_BASE: Omit<RingConfig, "chipCount">[] = [
  { radius: MOBILE_RADII[0], speed: 0.15, direction: 1, tiltX: 55, tiltZ: 0, tiltAxis: "y" },
  { radius: MOBILE_RADII[1], speed: 0.11, direction: -1, tiltX: 55, tiltZ: 4, tiltAxis: "y" },
  { radius: MOBILE_RADII[2], speed: 0.08, direction: 1, tiltX: 55, tiltZ: -3, tiltAxis: "y" },
  { radius: MOBILE_RADII[3], speed: 0.05, direction: -1, tiltX: 55, tiltZ: 2, tiltAxis: "y" },
];

const ZOOM_HINT_TIMEOUT_MS = 4000;

// Named export for direct imports (tests); default export for React.lazy().
export function SaturnCarousel({
  starStatuses,
  repoMeta,
  metaLoading,
  isDesktop,
  prefersReducedMotion,
  repos = REPOSITORIES,
  onJump,
  onStarTrigger,
}: SaturnCarouselProps) {
  const chipRefs = useRef<HTMLDivElement[][]>([]);
  const pausedRef = useRef(false);

  // Recompute slices whenever the filtered repo set changes. Sorting stays
  // category-first so ring membership is deterministic across filter tweaks.
  const ringSlices = useMemo(() => {
    const sorted = sortReposForDistribution(repos, CATEGORY_ORDER);
    return distributeRepos(sorted, DESKTOP_RADII);
  }, [repos]);

  const activeConfigs: RingConfig[] = useMemo(() => {
    const base = isDesktop ? DESKTOP_BASE : MOBILE_BASE;
    return base.map((b, i) => ({ ...b, chipCount: ringSlices[i].length }));
  }, [isDesktop, ringSlices]);

  useSaturnAnimation(activeConfigs, chipRefs, pausedRef, prefersReducedMotion);

  const pause = useCallback(() => {
    pausedRef.current = true;
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
  }, []);

  const totalCount = repos.length;
  const { tabIndexFor, onKeyDown, setCurrent } = useRovingTabindex(totalCount);

  // Precompute the cumulative base index per ring so every chip's global
  // roving index is O(1) at render time.
  const globalBases = useMemo(() => {
    const bases: number[] = [];
    let total = 0;
    for (const slice of ringSlices) {
      bases.push(total);
      total += slice.length;
    }
    return bases;
  }, [ringSlices]);

  const rings = (
    <>
      {/* Central 3D diamond */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 opacity-60 md:size-32"
      >
        <CssDiamond />
      </div>

      {/* Orbiting rings */}
      {ringSlices.map((slice, ringIndex) => (
        <SaturnRing
          key={`ring-${ringIndex}`}
          repos={slice}
          starStatuses={starStatuses}
          repoMeta={repoMeta}
          metaLoading={metaLoading}
          ringIndex={ringIndex}
          tiltX={activeConfigs[ringIndex].tiltX}
          tiltZ={activeConfigs[ringIndex].tiltZ}
          radius={activeConfigs[ringIndex].radius}
          chipRefs={chipRefs}
          onChipEnter={pause}
          onChipLeave={resume}
          variant={isDesktop ? "card" : "chip"}
          tiltAxis={activeConfigs[ringIndex].tiltAxis}
          onJump={onJump}
          onStarTrigger={onStarTrigger}
          globalBase={globalBases[ringIndex]}
          tabIndexFor={tabIndexFor}
          onRovingKeyDown={onKeyDown}
          onRovingFocus={setCurrent}
        />
      ))}
    </>
  );

  const emptySelection = totalCount === 0;

  if (!isDesktop) {
    return (
      <section
        aria-label={`Saturn repository navigator, ${totalCount} of ${REPOSITORIES.length} repositories`}
        data-roving-scope="saturn"
        className="relative mx-auto flex w-full flex-col items-center justify-center overflow-hidden py-6"
        style={{ perspective: "800px" }}
      >
        <h2 className="sr-only">Ethereum Ecosystem</h2>
        <MobileSaturnViewport>{rings}</MobileSaturnViewport>
        {emptySelection && <EmptySelectionHint />}
      </section>
    );
  }

  return (
    <section
      aria-label={`Saturn repository navigator, ${totalCount} of ${REPOSITORIES.length} repositories`}
      data-roving-scope="saturn"
      className="relative mx-auto flex w-full flex-col items-center justify-center py-12"
      style={{ perspective: "1200px" }}
    >
      <h2 className="sr-only">Ethereum Ecosystem</h2>
      <div className="relative h-[80vh] w-full">{rings}</div>
      {emptySelection && <EmptySelectionHint />}
    </section>
  );
}

function EmptySelectionHint() {
  return (
    <p
      role="status"
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground"
    >
      Choose what to track →
    </p>
  );
}

/**
 * Mobile-only Saturn viewport — wraps the 3D ring in a pinch-to-zoom
 * container so users can explore the outer chips that fall off a 375px
 * viewport. Initial scale is below 1 to fit the widest ring.
 */
function MobileSaturnViewport({ children }: { children: ReactNode }) {
  // Hint fades out after ZOOM_HINT_TIMEOUT_MS. We intentionally do NOT wire
  // `onZoom`/`onPanning` dismissers onto TransformWrapper — `centerOnInit`
  // fires those events during the initial center calculation and would
  // instantly dismiss the hint before the user ever sees it.
  const [hintVisible, setHintVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setHintVisible(false),
      ZOOM_HINT_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, []);

  return (
    // Fixed height sized to the outer ring at mobile scale:
    // 2 × 235 (radius) × 0.85 (initialScale) ≈ 400px visible ring +
    // ~140px of pinch/pan headroom = 540px.
    <div className="relative h-[540px] w-full">
      <TransformWrapper
        initialScale={0.85}
        minScale={0.5}
        maxScale={3}
        centerOnInit
        doubleClick={{ mode: "reset" }}
        wheel={{ disabled: true }}
        pinch={{ step: 5 }}
        panning={{ velocityDisabled: true }}
      >
        <TransformComponent
          wrapperClass="!h-full !w-full"
          contentClass="!h-full !w-full"
        >
          <div className="relative h-full w-full">{children}</div>
        </TransformComponent>
      </TransformWrapper>
      {hintVisible && (
        <div
          role="status"
          className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm"
        >
          Pinch to explore
        </div>
      )}
    </div>
  );
}

export default SaturnCarousel;
