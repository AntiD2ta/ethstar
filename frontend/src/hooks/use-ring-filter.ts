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

export interface UseRingFilterResult {
  filter: RingFilter;
  selectedRepos: Repository[];
  /** Size of the selection (count of repos on the ring). */
  N: number;
  isDefault: boolean;
  toggleSection: (section: RepoCategory) => void;
  toggleRepo: (repo: Repository) => void;
  reset: () => void;
  /** Count `{starred, selected}` derived from live star statuses. */
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
 */
export function useRingFilter(): UseRingFilterResult {
  const [filter, setFilter] = useState<RingFilter>(() => loadInitialFilter());

  // Persist every non-default change. Writing the default clears the key so
  // the stored state stays in sync with the rendered state.
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

  const countProgress = useCallback(
    (statuses: Record<string, StarStatus>): RingFilterProgress => {
      let starred = 0;
      for (const repo of selectedRepos) {
        if (statuses[repoKey(repo)] === "starred") starred++;
      }
      return { starred, selected: selectedRepos.length };
    },
    [selectedRepos],
  );

  return {
    filter,
    selectedRepos,
    N: selectedRepos.length,
    isDefault: isDefaultFilter(filter),
    toggleSection,
    toggleRepo,
    reset,
    countProgress,
  };
}
