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

/**
 * ChalkMark — a hand-drawn underline SVG used as an editorial annotation
 * under a single word in the hero. Authored as one Bézier with intentional
 * imperfection so it reads as a deliberate human mark, not a CSS underline.
 *
 * The default "underline" variant draws a slightly irregular stroke that
 * starts thin, swells in the middle, and tapers — like a marker pulled
 * across paper with a single pass. ETH-blue at 70% alpha so it shares the
 * highlight family without competing with the H1 accent word for focus.
 */

interface ChalkMarkProps {
  /** Optional class for layout (typically absolute positioning under a word). */
  className?: string;
  /** Stroke width in viewBox units. Default 6 (~2px at typical render size). */
  strokeWidth?: number;
  /** A11y: marked decorative by default. */
  ariaHidden?: boolean;
}

export function ChalkMark({
  className,
  strokeWidth = 6,
  ariaHidden = true,
}: ChalkMarkProps) {
  return (
    <svg
      viewBox="0 0 200 18"
      preserveAspectRatio="none"
      className={className}
      aria-hidden={ariaHidden}
      focusable="false"
    >
      {/* Single pass — a slightly bumpy quadratic approximating a human stroke.
          Two control points produce one gentle dip + one upward kick so the
          line doesn't read as machine-perfect. */}
      <path
        d="M 6 11 C 28 6, 70 14, 102 9 S 168 13, 194 7"
        fill="none"
        stroke="oklch(0.620 0.140 270 / 70%)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}
