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

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_RING_FILTER,
  RING_FILTER_STORAGE_KEY,
  applyFilter,
  deserializeFilter,
  isDefaultFilter,
  serializeFilter,
  toggleRepo as toggleRepoFilter,
  toggleSection as toggleSectionFilter,
} from "@/lib/ring-filter";
import type { RingFilter } from "@/lib/ring-filter";
import { REPOSITORIES } from "@/lib/repos";
import { repoKey } from "@/lib/repo-key";
import type { RepoCategory, Repository, StarStatus } from "@/lib/types";

export interface RingFilterProgress {
  starred: number;
  selected: number;
}

// Signed-out users always render the default Core+EL+CL spine. Hoisted to
// module level so `effectiveRepos` stays referentially stable across renders
// regardless of what customisation lives in `selectedRepos`.
const DEFAULT_EFFECTIVE_REPOS = applyFilter(DEFAULT_RING_FILTER, REPOSITORIES);

export interface UseRingFilterResult {
  /** Raw stored filter (reflects user preference, even when signed out). */
  filter: RingFilter;
  /** Repos derived from the raw `filter`. Feeds the filter sheet. */
  selectedRepos: Repository[];
  /** Size of the raw selection (count of repos the filter would render). */
  N: number;
  /**
   * Filter actually rendered on the ring. Equal to `filter` when
   * authenticated; falls back to `DEFAULT_RING_FILTER` when signed out so
   * visitors always see the core Ethereum spine regardless of any prior
   * customisation the user made while signed in.
   */
  effectiveFilter: RingFilter;
  /** Repos derived from `effectiveFilter`. Feeds the Saturn ring render. */
  effectiveRepos: Repository[];
  /** Size of the rendered selection. */
  effectiveN: number;
  isDefault: boolean;
  toggleSection: (section: RepoCategory) => void;
  toggleRepo: (repo: Repository) => void;
  reset: () => void;
  /**
   * Count `{starred, selected}` derived from live star statuses. Uses
   * `effectiveRepos`, so the signed-out counter reflects what's actually
   * rendered on the ring rather than the hidden raw preference.
   */
  countProgress: (
    statuses: Record<string, StarStatus>,
  ) => RingFilterProgress;
}

function loadInitialFilter(): RingFilter {
  if (typeof window === "undefined") return DEFAULT_RING_FILTER;
  try {
    const raw = window.localStorage.getItem(RING_FILTER_STORAGE_KEY);
    if (!raw) return DEFAULT_RING_FILTER;
    return deserializeFilter(raw) ?? DEFAULT_RING_FILTER;
  } catch {
    return DEFAULT_RING_FILTER;
  }
}

/**
 * Manages the Saturn-ring filter selection. Persists to
 * `localStorage[RING_FILTER_STORAGE_KEY]`; corrupt / shape-mismatched entries
 * fall back to `DEFAULT_RING_FILTER` (and the stale entry is NOT cleared so
 * callers can diagnose separately).
 *
 * Signed-out visitors always see `DEFAULT_RING_FILTER` rendered on the ring
 * via `effectiveFilter` / `effectiveRepos`, even if localStorage holds a
 * customised preference from a prior session. The stored preference is
 * preserved across sign-out, so signing back in restores the user's choice.
 */
export function useRingFilter(isAuthenticated: boolean): UseRingFilterResult {
  const [filter, setFilter] = useState<RingFilter>(() => loadInitialFilter());

  // Persist every non-default change. Writing the default clears the key so
  // the stored state stays in sync with the rendered state. Runs regardless
  // of `isAuthenticated` — the signed-out override is purely a render-time
  // concern and must not touch storage (otherwise a signed-in customisation
  // would be wiped on sign-out).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (isDefaultFilter(filter)) {
        window.localStorage.removeItem(RING_FILTER_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          RING_FILTER_STORAGE_KEY,
          serializeFilter(filter),
        );
      }
    } catch {
      // Storage quota / disabled storage — the UI keeps working in memory.
    }
  }, [filter]);

  const toggleSection = useCallback((section: RepoCategory) => {
    setFilter((prev) => toggleSectionFilter(prev, section));
  }, []);

  const toggleRepo = useCallback((repo: Repository) => {
    setFilter((prev) => toggleRepoFilter(prev, repo));
  }, []);

  const reset = useCallback(() => {
    setFilter(DEFAULT_RING_FILTER);
  }, []);

  const selectedRepos = useMemo(
    () => applyFilter(filter, REPOSITORIES),
    [filter],
  );

  // When signed out, pin the rendered filter to the DEFAULT slice regardless
  // of the raw stored preference. Returning the same `filter` reference when
  // authed keeps `effectiveFilter === filter` (and downstream memos stable).
  const effectiveFilter = useMemo<RingFilter>(
    () => (isAuthenticated ? filter : DEFAULT_RING_FILTER),
    [isAuthenticated, filter],
  );

  const effectiveRepos = useMemo(
    () => (isAuthenticated ? selectedRepos : DEFAULT_EFFECTIVE_REPOS),
    [isAuthenticated, selectedRepos],
  );

  const countProgress = useCallback(
    (statuses: Record<string, StarStatus>): RingFilterProgress => {
      let starred = 0;
      for (const repo of effectiveRepos) {
        if (statuses[repoKey(repo)] === "starred") starred++;
      }
      return { starred, selected: effectiveRepos.length };
    },
    [effectiveRepos],
  );

  return {
    filter,
    selectedRepos,
    N: selectedRepos.length,
    effectiveFilter,
    effectiveRepos,
    effectiveN: effectiveRepos.length,
    isDefault: isDefaultFilter(filter),
    toggleSection,
    toggleRepo,
    reset,
    countProgress,
  };
}
