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

import { CATEGORIES, DEFAULT_RING_FILTER_SECTIONS, REPOSITORIES } from "./repos";
import { repoKey } from "./repo-key";
import type { RepoCategory, Repository } from "./types";

/**
 * Saturn ring filter shape.
 *
 * Persisted to `localStorage[RING_FILTER_STORAGE_KEY]`. Schema is versioned;
 * a version bump force-drops older entries back to the default rather than
 * attempting a migration (filter is UX state, not user data).
 *
 * - `sections`: categories included in the ring
 * - `excludedRepos`: per-repo opt-outs *within* included sections
 * - `includedExtras`: per-repo opt-ins from sections NOT in `sections`
 */
export interface RingFilter {
  version: 1;
  sections: RepoCategory[];
  excludedRepos: string[];
  includedExtras: string[];
}

export const RING_FILTER_STORAGE_KEY = "ethstar_ring_filter";
const CURRENT_VERSION: RingFilter["version"] = 1;

const VALID_CATEGORIES = new Set<RepoCategory>(CATEGORIES.map((c) => c.name));

export const DEFAULT_RING_FILTER: RingFilter = Object.freeze({
  version: CURRENT_VERSION,
  sections: [...DEFAULT_RING_FILTER_SECTIONS],
  excludedRepos: [],
  includedExtras: [],
}) as RingFilter;

/** True iff `filter` matches `DEFAULT_RING_FILTER` by shape (not reference). */
export function isDefaultFilter(filter: RingFilter): boolean {
  return (
    arraysEqual(filter.sections, DEFAULT_RING_FILTER.sections) &&
    filter.excludedRepos.length === 0 &&
    filter.includedExtras.length === 0
  );
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Produce the filtered, category-ordered repo list. The return preserves the
 * order of `allRepos` (which already sorts by category then owner/name via the
 * authoring convention in `repos.ts`), so a caller can feed the output
 * straight into `sortReposForDistribution` without a re-sort.
 */
export function applyFilter(
  filter: RingFilter,
  allRepos: readonly Repository[],
): Repository[] {
  const includedSections = new Set(filter.sections);
  const excluded = new Set(filter.excludedRepos);
  const extras = new Set(filter.includedExtras);

  return allRepos.filter((repo) => {
    const key = repoKey(repo);
    if (extras.has(key)) return true;
    if (!includedSections.has(repo.category)) return false;
    return !excluded.has(key);
  });
}

/**
 * Toggle a section's inclusion. If removed, also prune any `excludedRepos`
 * that belonged only to that section — keeping the persisted filter compact.
 */
export function toggleSection(
  filter: RingFilter,
  section: RepoCategory,
): RingFilter {
  const sections = filter.sections.includes(section)
    ? filter.sections.filter((s) => s !== section)
    : [...filter.sections, section];
  // Re-sort sections by canonical category order so equality checks are
  // positional.
  const sorted = CATEGORIES.map((c) => c.name).filter((c) =>
    sections.includes(c),
  );
  return { ...filter, sections: sorted };
}

/**
 * Toggle a single repo. Behavior depends on whether its category is already
 * in the filter:
 * - In-section + currently visible → add to `excludedRepos`.
 * - In-section + in `excludedRepos` → remove from `excludedRepos`.
 * - Out-of-section + in `includedExtras` → remove from `includedExtras`.
 * - Out-of-section + not in `includedExtras` → add to `includedExtras`.
 */
export function toggleRepo(filter: RingFilter, repo: Repository): RingFilter {
  const key = repoKey(repo);
  const sectionActive = filter.sections.includes(repo.category);
  const excluded = new Set(filter.excludedRepos);
  const extras = new Set(filter.includedExtras);

  if (sectionActive) {
    if (excluded.has(key)) {
      excluded.delete(key);
    } else {
      excluded.add(key);
    }
  } else if (extras.has(key)) {
    extras.delete(key);
  } else {
    extras.add(key);
  }

  return {
    ...filter,
    excludedRepos: [...excluded].sort(),
    includedExtras: [...extras].sort(),
  };
}

export function serializeFilter(filter: RingFilter): string {
  return JSON.stringify(filter);
}

/**
 * Deserialize a filter payload. Returns `null` on any shape mismatch so the
 * caller can fall back to `DEFAULT_RING_FILTER`. Unknown repo keys are
 * silently dropped so a repo removed from `repos.ts` doesn't brick the ring.
 */
export function deserializeFilter(raw: string): RingFilter | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (p.version !== CURRENT_VERSION) return null;
  if (!Array.isArray(p.sections)) return null;
  if (!Array.isArray(p.excludedRepos)) return null;
  if (!Array.isArray(p.includedExtras)) return null;

  for (const s of p.sections) {
    if (typeof s !== "string") return null;
    if (!VALID_CATEGORIES.has(s as RepoCategory)) return null;
  }
  for (const k of p.excludedRepos) {
    if (typeof k !== "string") return null;
  }
  for (const k of p.includedExtras) {
    if (typeof k !== "string") return null;
  }

  const validKeys = new Set(REPOSITORIES.map((r) => repoKey(r)));
  const keep = (k: string) => validKeys.has(k);

  return {
    version: CURRENT_VERSION,
    sections: (p.sections as RepoCategory[]).slice(),
    excludedRepos: (p.excludedRepos as string[]).filter(keep).slice(),
    includedExtras: (p.includedExtras as string[]).filter(keep).slice(),
  };
}
