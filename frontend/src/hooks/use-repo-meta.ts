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

import { useEffect, useMemo, useState } from "react";
import {
  fetchAllRepoMetaGraphQL,
  fetchRepoMeta,
  ForbiddenError,
  RateLimitError,
} from "@/lib/github";
import type { RepoMetaMap } from "@/lib/github";
import type { Repository } from "@/lib/types";
import { repoKey } from "@/lib/repo-key";

export { type RepoMetaMap } from "@/lib/github";

export const REPO_META_CACHE_KEY = "ethstar_repo_meta";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CONCURRENCY_LIMIT = 5;

interface CacheShape {
  data: RepoMetaMap;
  fetchedAt: number;
}

interface UseRepoMetaReturn {
  repoMeta: RepoMetaMap;
  /** Sum of all fetched star counts, or null if no data is available. */
  combinedStars: number | null;
  /** True while the initial fetch is in progress and no cached data exists. */
  isLoading: boolean;
}

function loadCache(): CacheShape | null {
  try {
    const raw = localStorage.getItem(REPO_META_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof parsed.data !== "object" ||
      parsed.data === null ||
      typeof parsed.fetchedAt !== "number"
    ) {
      return null;
    }
    return parsed as unknown as CacheShape;
  } catch {
    return null;
  }
}

function isCacheFresh(cache: CacheShape | null): boolean {
  if (!cache) return false;
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

function saveCache(data: RepoMetaMap): void {
  try {
    const entry: CacheShape = { data, fetchedAt: Date.now() };
    localStorage.setItem(REPO_META_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently drop.
  }
}

function computeCombinedStars(meta: RepoMetaMap): number | null {
  const values = Object.values(meta);
  if (values.length === 0) return null;
  return values.reduce((sum, m) => sum + m.stargazers_count, 0);
}

/**
 * Fetch live star counts and descriptions for all repos from GitHub API
 * with localStorage caching and stale-while-revalidate semantics.
 */
export function useRepoMeta(
  repos: Repository[],
  token: string | null,
): UseRepoMetaReturn {
  const [{ meta: repoMetaInit, fresh }] = useState(() => {
    const cached = loadCache();
    return { meta: cached?.data ?? ({} as RepoMetaMap), fresh: isCacheFresh(cached) };
  });
  const [repoMeta, setRepoMeta] = useState<RepoMetaMap>(repoMetaInit);
  const [settled, setSettled] = useState(fresh);

  useEffect(() => {
    if (fresh) return;

    const controller = new AbortController();
    let abortedByError = false;

    async function fetchAll() {
      let results: RepoMetaMap = {};

      try {
        if (token) {
          // Authenticated: single GraphQL request for all repos.
          results = await fetchAllRepoMetaGraphQL(
            repos, token, controller.signal,
          );
        } else {
          // Anonymous: concurrent REST calls with worker pool.
          const queue = [...repos];

          async function worker() {
            while (queue.length > 0) {
              if (controller.signal.aborted) return;
              const repo = queue.shift()!;
              try {
                const meta = await fetchRepoMeta(
                  repo.owner, repo.name, token, controller.signal,
                );
                if (meta) {
                  results[repoKey(repo)] = meta;
                }
              } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") return;
                if (err instanceof RateLimitError || err instanceof ForbiddenError) {
                  abortedByError = true;
                  controller.abort();
                  return;
                }
              }
            }
          }

          const workers = Array.from(
            { length: Math.min(CONCURRENCY_LIMIT, repos.length) },
            () => worker(),
          );
          await Promise.all(workers);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (err instanceof RateLimitError) {
          console.warn("[useRepoMeta] rate-limited:", err.message);
        } else if (err instanceof ForbiddenError) {
          console.error("[useRepoMeta] permission denied:", err.message);
        } else {
          console.error("[useRepoMeta] unexpected error:", err);
        }
      }

      // Save partial results on rate-limit abort; skip only on unmount abort.
      const wasUnmounted = controller.signal.aborted && !abortedByError;
      if (!wasUnmounted) {
        if (Object.keys(results).length > 0) {
          setRepoMeta(results);
          saveCache(results);
        }
        setSettled(true);
      }
    }

    fetchAll();

    return () => {
      controller.abort();
    };
    // fresh is constant after mount (from useState initializer); listed for exhaustive-deps compliance.
  }, [repos, token, fresh]);

  const combinedStars = useMemo(
    () => computeCombinedStars(repoMeta),
    [repoMeta],
  );

  // Loading = not yet settled AND no cached data to display.
  const isLoading = !settled && combinedStars === null;

  return { repoMeta, combinedStars, isLoading };
}
