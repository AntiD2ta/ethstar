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

import { memo, useCallback } from "react";
import type { MutableRefObject } from "react";
import { SaturnCard } from "./saturn-card";
import { SaturnChip } from "./saturn-chip";
import type { RepoMeta } from "@/lib/github";
import type { Repository, StarStatus } from "@/lib/types";
import { repoKey } from "@/lib/repo-key";

/** Card is 220x100 -- offset is half of each to center at position */
const CARD_OFFSET = { x: -110, y: -50 };
/** Chip is 180x36 -- offset is half of each to center at position */
const CHIP_OFFSET = { x: -90, y: -18 };

type SaturnRingVariant = "card" | "chip";

interface SaturnRingProps {
  repos: Repository[];
  starStatuses: Record<string, StarStatus>;
  repoMeta: Record<string, RepoMeta>;
  metaLoading: boolean;
  ringIndex: number;
  tiltX: number;
  tiltZ: number;
  radius: number;
  chipRefs: MutableRefObject<HTMLDivElement[][]>;
  /** Pause animation when a card is hovered/focused. */
  onChipEnter?: () => void;
  /** Resume animation when a card is unhovered/unfocused. */
  onChipLeave?: () => void;
  /** Visual variant — `"card"` renders a SaturnCard (desktop, 220x100),
   *  `"chip"` renders a SaturnChip (mobile, 180x36). Default: `"card"`. */
  variant?: SaturnRingVariant;
}

export const SaturnRing = memo(function SaturnRing({
  repos,
  starStatuses,
  repoMeta,
  metaLoading,
  ringIndex,
  tiltX,
  tiltZ,
  radius,
  chipRefs,
  onChipEnter,
  onChipLeave,
  variant = "card",
}: SaturnRingProps) {
  const setChipRef = useCallback(
    (chipIndex: number) => (el: HTMLDivElement | null) => {
      if (!chipRefs.current[ringIndex]) {
        chipRefs.current[ringIndex] = [];
      }
      if (el) {
        chipRefs.current[ringIndex][chipIndex] = el;
      }
    },
    [chipRefs, ringIndex],
  );

  const offset = variant === "chip" ? CHIP_OFFSET : CARD_OFFSET;

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{
        transformStyle: "preserve-3d",
        transform: `translate(-50%, -50%) rotateX(${tiltX}deg) rotateZ(${tiltZ}deg)`,
      }}
    >
      {/* Orbital path ellipse */}
      <div
        className="absolute left-1/2 top-1/2 rounded-full border border-white/[0.08]"
        style={{
          width: radius * 2,
          height: radius * 2,
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Repo items */}
      {repos.map((repo, chipIndex) => {
        const k = repoKey(repo);
        const status = starStatuses[k] ?? "unknown";
        return (
          <div
            key={k}
            ref={setChipRef(chipIndex)}
            className="pointer-events-auto absolute left-0 top-0"
            style={{
              marginLeft: offset.x,
              marginTop: offset.y,
              willChange: "transform, opacity",
            }}
            onMouseEnter={onChipEnter}
            onMouseLeave={onChipLeave}
            onFocus={onChipEnter}
            onBlur={onChipLeave}
          >
            {variant === "chip" ? (
              <SaturnChip repo={repo} status={status} />
            ) : (
              <SaturnCard
                repo={repo}
                status={status}
                starCount={repoMeta[k]?.stargazers_count}
                liveDescription={repoMeta[k]?.description}
                metaLoading={metaLoading}
              />
            )}
          </div>
        );
      })}
    </div>
  );
});
