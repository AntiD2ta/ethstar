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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  checkAllStars,
  ForbiddenError,
  isStarred,
  NetworkError,
  starAllUnstarred,
  starRepo,
  TokenExpiredError,
} from "@/lib/github";
import { REPOSITORIES } from "@/lib/repos";
import { useAuth } from "./auth-context";
import type { Repository, StarProgress, StarStatus } from "@/lib/types";
import { repoKey } from "@/lib/repo-key";

type StarStatusMap = Record<string, StarStatus>;

interface StarErrorCallbacks {
  onSessionExpired?: () => void;
  onNetworkError?: () => void;
  onForbidden?: () => void;
}

interface StarAllOptions extends StarErrorCallbacks {
  onRateLimit?: (waitMs: number) => void;
  /** Ephemeral token for starring (e.g. classic OAuth). If provided, skips
   *  token refresh on 401 — the caller must re-authorize instead. */
  token?: string;
}

interface UseStarsReturn {
  starStatuses: StarStatusMap;
  isChecking: boolean;
  isStarring: boolean;
  progress: StarProgress;
  checkStars: (options?: StarErrorCallbacks) => Promise<void>;
  starAll: (
    options?: StarAllOptions,
  ) => Promise<{ starred: number; failed: number }>;
  retryStar: (repo: Repository, options?: StarErrorCallbacks) => Promise<void>;
  recheckRepo: (repo: Repository) => Promise<void>;
}

export function useStars(): UseStarsReturn {
  const { token, logout, refreshToken } = useAuth();
  const [starStatuses, setStarStatuses] = useState<StarStatusMap>(() => {
    const initial: StarStatusMap = {};
    for (const repo of REPOSITORIES) {
      initial[repoKey(repo)] = "unknown";
    }
    return initial;
  });
  const [isChecking, setIsChecking] = useState(false);
  const [isStarring, setIsStarring] = useState(false);

  // Use a ref for the abort flag so callbacks don't need it as a dependency.
  const abortRef = useRef(false);

  // Reset statuses to "unknown" whenever the user becomes unauthenticated
  // (e.g. session expired + logged out). Prevents stale "checking" cards.
  // Guarded so the cold-mount (token=null) case doesn't trigger a redundant
  // state write when the initial state is already "unknown" for every repo.
  const hadTokenRef = useRef(false);
  useEffect(() => {
    if (token) {
      hadTokenRef.current = true;
      return;
    }
    if (!hadTokenRef.current) return;
    hadTokenRef.current = false;
    abortRef.current = true;
    setStarStatuses(() => {
      const next: StarStatusMap = {};
      for (const repo of REPOSITORIES) {
        next[repoKey(repo)] = "unknown";
      }
      return next;
    });
  }, [token]);

  // Mirror starStatuses in a ref so starAll can read current values without
  // having starStatuses in its dependency array (avoids reconstruction on every
  // status update during the starring loop).
  const starStatusesRef = useRef(starStatuses);
  starStatusesRef.current = starStatuses;

  const checkStars = useCallback(
    async (options?: StarErrorCallbacks) => {
      if (!token) return;
      setIsChecking(true);
      abortRef.current = false;

      // Mark all as "checking".
      setStarStatuses((prev) => {
        const next = { ...prev };
        for (const repo of REPOSITORIES) {
          next[repoKey(repo)] = "checking";
        }
        return next;
      });

      const progressHandler = (result: { repo: Repository; status: StarStatus }) => {
        if (abortRef.current) return;
        setStarStatuses((prev) => ({
          ...prev,
          [repoKey(result.repo)]: result.status,
        }));
      };

      try {
        await checkAllStars(token, REPOSITORIES, progressHandler);
      } catch (err) {
        if (err instanceof TokenExpiredError) {
          const newToken = await refreshToken();
          if (newToken) {
            // Retry once with the refreshed token.
            try {
              await checkAllStars(newToken, REPOSITORIES, progressHandler);
            } catch (err2) {
              if (err2 instanceof TokenExpiredError) {
                logout();
                options?.onSessionExpired?.();
              } else if (err2 instanceof NetworkError) {
                options?.onNetworkError?.();
              } else if (err2 instanceof ForbiddenError) {
                options?.onForbidden?.();
              }
            }
          } else {
            // refreshToken() already logged the user out.
            options?.onSessionExpired?.();
          }
        } else if (err instanceof NetworkError) {
          options?.onNetworkError?.();
        } else if (err instanceof ForbiddenError) {
          options?.onForbidden?.();
        }
      } finally {
        setIsChecking(false);
      }
    },
    [token, logout, refreshToken],
  );

  const starAll = useCallback(
    async (options?: StarAllOptions) => {
      // Use ephemeral token if provided, otherwise the auth context token.
      const effectiveToken = options?.token ?? token;
      if (!effectiveToken) return { starred: 0, failed: 0 };
      setIsStarring(true);
      abortRef.current = false;

      const progressHandler = (repo: Repository, status: StarStatus) => {
        if (abortRef.current) return;
        setStarStatuses((prev) => ({
          ...prev,
          [repoKey(repo)]: status,
        }));
      };

      const selectUnstarred = () =>
        REPOSITORIES.filter(
          (r) => starStatusesRef.current[repoKey(r)] === "unstarred",
        );

      try {
        const result = await starAllUnstarred(
          effectiveToken,
          selectUnstarred(),
          progressHandler,
          options?.onRateLimit,
        );
        return result;
      } catch (err) {
        if (err instanceof TokenExpiredError) {
          // Ephemeral tokens cannot be refreshed — fail immediately.
          if (options?.token) {
            options?.onSessionExpired?.();
            return { starred: 0, failed: 0 };
          }
          const newToken = await refreshToken();
          if (newToken) {
            try {
              return await starAllUnstarred(
                newToken,
                selectUnstarred(),
                progressHandler,
                options?.onRateLimit,
              );
            } catch (err2) {
              if (err2 instanceof TokenExpiredError) {
                logout();
                options?.onSessionExpired?.();
              } else if (err2 instanceof NetworkError) {
                options?.onNetworkError?.();
              } else if (err2 instanceof ForbiddenError) {
                options?.onForbidden?.();
              }
              return { starred: 0, failed: 0 };
            }
          } else {
            options?.onSessionExpired?.();
          }
        } else if (err instanceof NetworkError) {
          options?.onNetworkError?.();
        } else if (err instanceof ForbiddenError) {
          options?.onForbidden?.();
        }
        return { starred: 0, failed: 0 };
      } finally {
        setIsStarring(false);
      }
    },
    [token, logout, refreshToken],
  );

  const retryStar = useCallback(
    async (repo: Repository, options?: StarErrorCallbacks) => {
      if (!token) return;
      const key = repoKey(repo);
      setStarStatuses((prev) => ({ ...prev, [key]: "starring" }));

      const attempt = async (t: string) => {
        await starRepo(t, repo.owner, repo.name);
      };

      try {
        await attempt(token);
        setStarStatuses((prev) => ({ ...prev, [key]: "starred" }));
      } catch (err) {
        if (err instanceof TokenExpiredError) {
          const newToken = await refreshToken();
          if (newToken) {
            try {
              await attempt(newToken);
              setStarStatuses((prev) => ({ ...prev, [key]: "starred" }));
              return;
            } catch (err2) {
              if (err2 instanceof TokenExpiredError) {
                logout();
                options?.onSessionExpired?.();
              } else if (err2 instanceof NetworkError) {
                options?.onNetworkError?.();
              } else if (err2 instanceof ForbiddenError) {
                options?.onForbidden?.();
              }
              setStarStatuses((prev) => ({ ...prev, [key]: "failed" }));
              return;
            }
          } else {
            options?.onSessionExpired?.();
            setStarStatuses((prev) => ({ ...prev, [key]: "failed" }));
            return;
          }
        }
        if (err instanceof NetworkError) {
          options?.onNetworkError?.();
        }
        if (err instanceof ForbiddenError) {
          options?.onForbidden?.();
        }
        setStarStatuses((prev) => ({ ...prev, [key]: "failed" }));
      }
    },
    [token, logout, refreshToken],
  );

  const recheckRepo = useCallback(
    async (repo: Repository) => {
      if (!token) return;
      const key = repoKey(repo);
      try {
        const starred = await isStarred(token, repo.owner, repo.name);
        setStarStatuses((prev) => ({
          ...prev,
          [key]: starred ? "starred" : "unstarred",
        }));
      } catch {
        // Silently ignore — this is a best-effort background recheck.
      }
    },
    [token],
  );

  const progress = useMemo(() => computeProgress(starStatuses), [starStatuses]);

  return {
    starStatuses,
    isChecking,
    isStarring,
    progress,
    checkStars,
    starAll,
    retryStar,
    recheckRepo,
  };
}

function computeProgress(statuses: StarStatusMap): StarProgress {
  let total = 0;
  let starred = 0;
  let remaining = 0;
  let current: string | null = null;

  for (const key in statuses) {
    total++;
    const status = statuses[key];
    if (status === "starred") starred++;
    else if (status === "unstarred" || status === "unknown" || status === "failed") remaining++;
    else if (status === "starring") {
      current = key;
      remaining++;
    }
  }

  return { total, starred, remaining, current };
}
