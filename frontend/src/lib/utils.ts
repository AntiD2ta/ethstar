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

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a star count for compact display on repo cards (e.g. "1.5k", "142k").
 * Uses single-letter suffix and one decimal place.
 */
export function formatStarCount(count: number): string {
  if (count >= 1000) {
    const tenths = Math.round(count / 100);
    const whole = Math.floor(tenths / 10);
    const remainder = tenths % 10;
    return remainder === 0 ? `${whole}k` : `${whole}.${remainder}k`;
  }
  return count.toString();
}

/**
 * Format a combined star total for the hero ribbon (e.g. "142,000+").
 * Floors to the nearest thousand so the trailing "+" is always truthful
 * (a count of 1,999 must not display as "2,000+").
 */
export function formatHeroStars(count: number): string {
  if (count >= 1000) {
    const k = Math.floor(count / 1000);
    return `${k.toLocaleString()},000+`;
  }
  return count.toString();
}

/**
 * Derive the hero's combined-stars display from live data + a conservative
 * fallback. When live data is present, the label is the formatted count and
 * `isLive` is true. When live data is null (pre-fetch or failure), the label
 * is `~` + formatted fallback, and `isLive` is false — this is the honest
 * placeholder marker. See `home.tsx` for callsite rationale.
 */
export function deriveHeroStarsDisplay(
  combinedStars: number | null,
  fallback: number,
): { label: string; isLive: boolean } {
  const formatted = formatHeroStars(combinedStars ?? fallback);
  if (combinedStars === null) {
    return { label: `~${formatted}`, isLive: false };
  }
  return { label: formatted, isLive: true };
}
