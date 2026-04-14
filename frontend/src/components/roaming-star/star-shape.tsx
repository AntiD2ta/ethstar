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

import { memo, useId } from "react";
import { STAR_PATH, STAR_VIEWBOX } from "./constants";
import type { RoamingStarStatus } from "./types";

interface StarShapeProps {
  size: number;
  /** 0..1. Drives gold fill height from bottom. */
  fillLevel: number;
  status: RoamingStarStatus;
  /** Whether to render the ignition flare (transient on auth success). */
  flaring?: boolean;
  className?: string;
}

/**
 * Pure SVG star. Progressive fill is implemented with a clip rect whose
 * height is driven by `fillLevel`. The star outline (stroke) remains
 * ETH-blue across all states; the fill is gold. On partial-failure, the
 * fill clip shrinks and the stroke warms toward purple-red — consumers
 * pass the appropriate status and lower fillLevel.
 *
 * Why clip-path instead of two stacked paths: one path = stable hit-test
 * for pointer events, no sub-pixel rounding seams between stroke and fill.
 */
export const StarShape = memo(function StarShape({
  size,
  fillLevel,
  status,
  flaring,
  className,
}: StarShapeProps) {
  const uid = useId();
  const clipId = `star-fill-clip-${uid}`;
  const glowId = `star-glow-${uid}`;
  const flareId = `star-flare-${uid}`;

  const clampedFill = Math.max(0, Math.min(1, fillLevel));
  // Clip rect: fills from bottom. viewBox is 100x100.
  const clipY = 100 - clampedFill * 100;
  const clipHeight = clampedFill * 100;

  const strokeColor =
    status === "partial-failure"
      ? "oklch(0.62 0.22 340)" // warm purple-red
      : "var(--eth-blue)";

  const fillColor = "var(--star-gold)";

  return (
    <svg
      viewBox={STAR_VIEWBOX}
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y={clipY} width="100" height={clipHeight} />
        </clipPath>
        {/* Subtle ETH-blue glow behind the outline */}
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Ignition flare — brief burst used on auth-success moment */}
        <radialGradient id={flareId} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="var(--star-gold)" stopOpacity="0.85" />
          <stop offset="60%" stopColor="var(--star-gold)" stopOpacity="0.20" />
          <stop offset="100%" stopColor="var(--star-gold)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {flaring && (
        <circle
          cx="50"
          cy="50"
          r="55"
          fill={`url(#${flareId})`}
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Gold fill, clipped to the progressive rect. */}
      <path
        d={STAR_PATH}
        fill={fillColor}
        clipPath={`url(#${clipId})`}
        style={{
          // `transition: clip-path` would animate the clip rect itself, not the
          // inline y/height we set per render. We drive fillLevel from progress
          // state, so the parent re-renders at a tick rate fast enough to feel
          // continuous without CSS transitions.
          opacity: clampedFill < 0.02 ? 0 : 1,
          transition: "opacity 260ms linear",
        }}
      />

      {/* Outline stroke on top so it stays visible across any fill level. */}
      <path
        d={STAR_PATH}
        fill="none"
        stroke={strokeColor}
        strokeWidth={status === "success" ? 1.2 : 2.5}
        strokeLinejoin="round"
        filter={`url(#${glowId})`}
        style={{ transition: "stroke 360ms ease-out, stroke-width 260ms ease-out" }}
      />
    </svg>
  );
});
