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

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { SaturnRing } from "./saturn-ring";
import { useSaturnAnimation } from "./use-saturn-animation";
import type { RingConfig } from "./use-saturn-animation";
import { CATEGORIES, REPOS_BY_CATEGORY } from "@/lib/repos";
import type { RepoMeta } from "@/lib/github";
import type { StarStatus } from "@/lib/types";
import { CssDiamond } from "@/components/css-diamond";

interface SaturnCarouselProps {
  starStatuses: Record<string, StarStatus>;
  repoMeta: Record<string, RepoMeta>;
  metaLoading: boolean;
  isDesktop: boolean;
  prefersReducedMotion: boolean;
}

// Desktop ring configs — order must match CATEGORIES in repos.ts
const RING_CONFIGS: RingConfig[] = [
  { radius: 240, speed: 0.18, direction: 1, tiltX: 45, tiltZ: 0, chipCount: REPOS_BY_CATEGORY["Ethereum Core"].length },
  { radius: 350, speed: 0.13, direction: -1, tiltX: 45, tiltZ: 4, chipCount: REPOS_BY_CATEGORY["Execution Clients"].length },
  { radius: 460, speed: 0.10, direction: 1, tiltX: 45, tiltZ: -3, chipCount: REPOS_BY_CATEGORY["Consensus Clients"].length },
  { radius: 570, speed: 0.07, direction: -1, tiltX: 45, tiltZ: 2, chipCount: REPOS_BY_CATEGORY["Validator Tooling"].length },
];

// Mobile ring configs — same radii as above but tilted around the Y axis
// so the ellipse is tall (portrait) instead of wide, matching mobile's
// narrow aspect ratio. Order matches CATEGORIES.
const MOBILE_RING_CONFIGS: RingConfig[] = [
  { radius: 100, speed: 0.15, direction: 1, tiltX: 55, tiltZ: 0, chipCount: REPOS_BY_CATEGORY["Ethereum Core"].length, tiltAxis: "y" },
  { radius: 145, speed: 0.11, direction: -1, tiltX: 55, tiltZ: 4, chipCount: REPOS_BY_CATEGORY["Execution Clients"].length, tiltAxis: "y" },
  { radius: 190, speed: 0.08, direction: 1, tiltX: 55, tiltZ: -3, chipCount: REPOS_BY_CATEGORY["Consensus Clients"].length, tiltAxis: "y" },
  { radius: 235, speed: 0.05, direction: -1, tiltX: 55, tiltZ: 2, chipCount: REPOS_BY_CATEGORY["Validator Tooling"].length, tiltAxis: "y" },
];

if (RING_CONFIGS.length !== CATEGORIES.length) {
  throw new Error(
    `RING_CONFIGS (${RING_CONFIGS.length}) must match CATEGORIES (${CATEGORIES.length})`,
  );
}
if (MOBILE_RING_CONFIGS.length !== CATEGORIES.length) {
  throw new Error(
    `MOBILE_RING_CONFIGS (${MOBILE_RING_CONFIGS.length}) must match CATEGORIES (${CATEGORIES.length})`,
  );
}

const CATEGORY_ORDER = CATEGORIES.map((c) => c.name);

const ZOOM_HINT_TIMEOUT_MS = 4000;

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

  const activeConfigs = isDesktop ? RING_CONFIGS : MOBILE_RING_CONFIGS;

  useSaturnAnimation(activeConfigs, chipRefs, pausedRef, prefersReducedMotion);

  const pause = useCallback(() => {
    pausedRef.current = true;
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
  }, []);

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
      {CATEGORY_ORDER.map((categoryName, ringIndex) => (
        <SaturnRing
          key={categoryName}
          repos={REPOS_BY_CATEGORY[categoryName]}
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
        />
      ))}
    </>
  );

  if (!isDesktop) {
    return (
      <section
        aria-label="Ethereum ecosystem repositories"
        className="relative mx-auto flex w-full flex-col items-center justify-center overflow-hidden py-6"
        style={{ perspective: "800px" }}
      >
        <h2 className="sr-only">Ethereum Ecosystem</h2>
        <MobileSaturnViewport>{rings}</MobileSaturnViewport>
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
      <div className="relative h-[80vh] w-full">{rings}</div>
    </section>
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
