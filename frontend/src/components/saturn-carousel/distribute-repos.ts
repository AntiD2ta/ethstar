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
 * rings hold more chips). The first `radii.length - 1` slices round their
 * share via `Math.round`; the outermost ring absorbs the remainder so the
 * total count is preserved exactly.
 */
export function distributeRepos<T>(
  items: readonly T[],
  radii: readonly number[],
): T[][] {
  if (radii.length === 0) return [];

  const total = radii.reduce((sum, r) => sum + r, 0);
  const last = radii.length - 1;
  const counts = radii.map((r, i) =>
    i === last ? 0 : Math.round((r / total) * items.length),
  );
  const takenByHead = counts.reduce((a, b) => a + b, 0);
  counts[last] = items.length - takenByHead;

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
