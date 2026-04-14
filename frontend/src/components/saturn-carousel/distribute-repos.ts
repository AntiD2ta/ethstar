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

import type { RepoCategory, Repository } from "@/lib/types";

/**
 * Partition `items` into as many contiguous slices as there are `radii`,
 * weighting each slice by its radius (proxy for circumference so outer
 * rings hold more chips). Total count is preserved exactly and the
 * result is monotone non-decreasing (outer ring ≥ inner ring).
 *
 * Precondition: `radii` MUST be sorted non-decreasing (inner → outer).
 * Violation throws — the sort-ascending step at the end only realigns
 * counts with the intended ring order when radii are themselves ordered.
 *
 * Uses the largest-remainder (Hamilton) apportionment: floor the raw
 * proportional share for each ring, then distribute the leftover to the
 * rings with the largest fractional remainders. This avoids the
 * "last-ring remainder" trap where naive `Math.round` on head slots can
 * overshoot the total (e.g. N=2, radii=[1,1,1,1] → head rounds 0.5→1
 * three times = 3 > N, leaving the last ring at -1).
 */
export function distributeRepos<T>(
  items: readonly T[],
  radii: readonly number[],
): T[][] {
  if (radii.length === 0) return [];

  for (let i = 1; i < radii.length; i++) {
    if (radii[i] < radii[i - 1]) {
      throw new Error(
        `distributeRepos: radii must be non-decreasing, got [${radii.join(", ")}]`,
      );
    }
  }

  const total = radii.reduce((sum, r) => sum + r, 0);
  const n = items.length;
  const raw = radii.map((r) => (total === 0 ? 0 : (r / total) * n));
  const counts = raw.map(Math.floor);
  const remainder = n - counts.reduce((a, b) => a + b, 0);

  const byFrac = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder && k < byFrac.length; k++) {
    counts[byFrac[k].i]++;
  }

  counts.sort((a, b) => a - b);

  const out: T[][] = [];
  let idx = 0;
  for (const c of counts) {
    out.push(items.slice(idx, idx + c));
    idx += c;
  }
  return out;
}

/**
 * Sort repos deterministically by (category order, owner, name) without
 * mutating the input. Ring membership derived from this order stays stable
 * across refreshes even when the repo list grows.
 */
export function sortReposForDistribution(
  repos: readonly Repository[],
  categoryOrder: readonly RepoCategory[],
): Repository[] {
  const rank = new Map<RepoCategory, number>();
  categoryOrder.forEach((c, i) => rank.set(c, i));

  return [...repos].sort((a, b) => {
    const ra = rank.get(a.category) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.category) ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    if (a.owner !== b.owner) return a.owner < b.owner ? -1 : 1;
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return 0;
  });
}
