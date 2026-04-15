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
import { STAR_PATH, STAR_PATH_LOWER, STAR_PATH_UPPER, STAR_VIEWBOX } from "./constants";
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
 * Pure SVG Ethereum-octahedral silhouette: upper triangle + lower triangle
 * mirrored across a narrow equatorial gap. Vertically symmetric so the
 * clip-driven fill reads as accurate proportion (fillLevel=0.5 ≈ half the
 * visible ink, not 60%+ the way an asymmetric pentagram filled).
 *
 * Progressive fill uses a clip rect whose height is driven by `fillLevel`.
 * The outline stroke stays ETH-blue; the fill is gold. On partial-failure,
 * the stroke warms toward purple-red.
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
  // Clip rect: fills from bottom. viewBox is 100x100. IEEE-754 multiplication
  // leaks FP noise (0.58*100 → 58.00000000000001), so round to 2 decimals —
  // SVG parsers accept any numeric format and tests assert exact values.
  const clipHeightRaw = Math.round(clampedFill * 10000) / 100;
  const clipHeight = clipHeightRaw;
  const clipY = Math.round((100 - clipHeightRaw) * 100) / 100;

  const strokeColor =
    status === "partial-failure"
      ? "oklch(0.62 0.22 340)" // warm purple-red
      : "var(--eth-blue)";

  const fillColor = "var(--star-gold)";
  const strokeWidth = status === "success" ? 1.2 : 2;

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
        {/* Quiet ETH-blue glow behind the outline. stdDeviation reduced from
            2.2 → 1.2 so the silhouette stays defined rather than haloed
            (review: "Glow + blur + scrim + spin stack up"). */}
        <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
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

      {/* Gold fill — single combined path clipped to the progressive rect.
          Opacity transition keeps the fade-in graceful at fillLevel≈0. */}
      <path
        d={STAR_PATH}
        fill={fillColor}
        fillRule="evenodd"
        clipPath={`url(#${clipId})`}
        style={{
          opacity: clampedFill < 0.02 ? 0 : 1,
          transition: "opacity 260ms linear",
        }}
      />

      {/* Outline stroke — two separate paths so the equatorial gap reads as
          a deliberate Ethereum-style split, not a closing seam. */}
      <path
        d={STAR_PATH_UPPER}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        filter={`url(#${glowId})`}
        style={{ transition: "stroke 360ms ease-out, stroke-width 260ms ease-out" }}
      />
      <path
        d={STAR_PATH_LOWER}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        filter={`url(#${glowId})`}
        style={{ transition: "stroke 360ms ease-out, stroke-width 260ms ease-out" }}
      />
    </svg>
  );
});
