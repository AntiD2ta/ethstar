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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider } from "./use-auth";
import { useAuth } from "./auth-context";
import { useStars } from "./use-stars";
import { REPOSITORIES } from "@/lib/repos";
import type { Repository, StarStatus } from "@/lib/types";
import { installFetchStub } from "@/test/fetch-stub";
import type { FetchStub } from "@/test/fetch-stub";
import { STORAGE_KEY } from "@/test/render";
import type {
  StarAllResult,
  StarCheckResult,
} from "@/test/github-spy";

const spy = vi.hoisted(() => ({
  getUser: vi.fn(),
  checkAllStars: vi.fn(),
  starAllUnstarred: vi.fn(),
  starRepo: vi.fn(),
  isStarred: vi.fn(),
}));

vi.mock("@/lib/github", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/github")>("@/lib/github");
  return {
    ...actual,
    getUser: spy.getUser,
    checkAllStars: spy.checkAllStars,
    starAllUnstarred: spy.starAllUnstarred,
    starRepo: spy.starRepo,
    isStarred: spy.isStarred,
  };
});

function seedToken() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      access_token: "test-token",
      expires_at: Date.now() + 3600_000,
      refresh_token: "r",
      user: { login: "u", avatar_url: "a", name: "U" },
    }),
  );
}

function Wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

function useStarsWithAuth() {
  const auth = useAuth();
  const stars = useStars();
  return { auth, stars };
}

describe("useStars — checkStars", () => {
  let fetchStub: FetchStub;

  beforeEach(() => {
    fetchStub = installFetchStub();
    spy.getUser.mockReset().mockResolvedValue({
      login: "u",
      avatar_url: "a",
      name: "U",
    });
    spy.checkAllStars.mockReset();
    spy.starAllUnstarred.mockReset();
    spy.starRepo.mockReset();
    spy.isStarred.mockReset();
    seedToken();
  });
  afterEach(() => {
    fetchStub.reset();
  });

  it("initializes every repo with 'unknown' status", async () => {
    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    const statuses = result.current.stars.starStatuses;
    expect(Object.keys(statuses)).toHaveLength(REPOSITORIES.length);
    for (const repo of REPOSITORIES) {
      expect(statuses[`${repo.owner}/${repo.name}`]).toBe("unknown");
    }
  });

  it("populates starStatuses from onProgress calls", async () => {
    spy.checkAllStars.mockImplementation(
      async (
        _token: string,
        repos: Repository[],
        onProgress?: (r: StarCheckResult) => void,
      ) => {
        const results: StarCheckResult[] = [];
        for (let i = 0; i < repos.length; i++) {
          const status: StarStatus = i % 2 === 0 ? "starred" : "unstarred";
          const result: StarCheckResult = { repo: repos[i], status };
          results.push(result);
          onProgress?.(result);
        }
        return results;
      },
    );

    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    await act(async () => {
      await result.current.stars.checkStars();
    });

    expect(result.current.stars.isChecking).toBe(false);
    const firstKey = `${REPOSITORIES[0].owner}/${REPOSITORIES[0].name}`;
    expect(result.current.stars.starStatuses[firstKey]).toBe("starred");
    const secondKey = `${REPOSITORIES[1].owner}/${REPOSITORIES[1].name}`;
    expect(result.current.stars.starStatuses[secondKey]).toBe("unstarred");
  });

  it("refreshes token and retries on TokenExpiredError, then succeeds", async () => {
    const { TokenExpiredError } = await import("@/lib/github");
    // First call: 401, second call (after refresh): succeeds.
    let calls = 0;
    spy.checkAllStars.mockImplementation(async (token: string) => {
      calls++;
      if (calls === 1) throw new TokenExpiredError();
      // On retry with new token, succeed.
      expect(token).toBe("refreshed-token");
      return [];
    });

    // Seed refresh fetch response.
    fetchStub.enqueue({
      status: 200,
      body: {
        access_token: "refreshed-token",
        expires_in: 28800,
        refresh_token: "r2",
      },
    });

    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    await act(async () => {
      await result.current.stars.checkStars();
    });

    expect(calls).toBe(2);
    expect(result.current.auth.isAuthenticated).toBe(true);
    expect(result.current.auth.token).toBe("refreshed-token");
  });

  it("calls onSessionExpired and logs out when refresh fails", async () => {
    const { TokenExpiredError } = await import("@/lib/github");
    spy.checkAllStars.mockRejectedValue(new TokenExpiredError());
    // Refresh fails with 401.
    fetchStub.enqueue({ status: 401 });

    const onSessionExpired = vi.fn();

    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));
    expect(result.current.auth.isAuthenticated).toBe(true);

    await act(async () => {
      await result.current.stars.checkStars({ onSessionExpired });
    });

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(result.current.auth.isAuthenticated).toBe(false);
    expect(result.current.auth.token).toBeNull();
  });

  it("calls onNetworkError on NetworkError", async () => {
    const { NetworkError } = await import("@/lib/github");
    spy.checkAllStars.mockRejectedValue(new NetworkError());
    const onNetworkError = vi.fn();

    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    await act(async () => {
      await result.current.stars.checkStars({ onNetworkError });
    });

    expect(onNetworkError).toHaveBeenCalledTimes(1);
    // Network errors don't log the user out.
    expect(result.current.auth.isAuthenticated).toBe(true);
  });

  it("no-op when no token", async () => {
    localStorage.clear();
    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    await act(async () => {
      await result.current.stars.checkStars();
    });

    expect(spy.checkAllStars).not.toHaveBeenCalled();
  });
});

describe("useStars — starAll", () => {
  let fetchStub: FetchStub;

  beforeEach(() => {
    fetchStub = installFetchStub();
    spy.getUser.mockReset().mockResolvedValue({
      login: "u",
      avatar_url: "a",
      name: "U",
    });
    spy.checkAllStars.mockReset();
    spy.starAllUnstarred.mockReset();
    spy.starRepo.mockReset();
    spy.isStarred.mockReset();
    seedToken();
  });
  afterEach(() => {
    fetchStub.reset();
  });

  it("only stars repos with 'unstarred' status", async () => {
    // First, run checkStars: mark repo 0 starred, repos 1-2 unstarred.
    spy.checkAllStars.mockImplementation(
      async (
        _token: string,
        repos: Repository[],
        onProgress?: (r: StarCheckResult) => void,
      ) => {
        const statuses: StarStatus[] = ["starred", "unstarred", "unstarred"];
        const results: StarCheckResult[] = [];
        for (let i = 0; i < Math.min(3, repos.length); i++) {
          const result: StarCheckResult = { repo: repos[i], status: statuses[i] };
          results.push(result);
          onProgress?.(result);
        }
        for (let i = 3; i < repos.length; i++) {
          const result: StarCheckResult = {
            repo: repos[i],
            status: "starred",
          };
          results.push(result);
          onProgress?.(result);
        }
        return results;
      },
    );

    let capturedReposToStar: Repository[] = [];
    spy.starAllUnstarred.mockImplementation(
      async (
        _token: string,
        repos: Repository[],
        onProgress: (repo: Repository, status: StarStatus) => void,
      ): Promise<StarAllResult> => {
        capturedReposToStar = repos;
        for (const repo of repos) {
          onProgress(repo, "starring");
          onProgress(repo, "starred");
        }
        return { starred: repos.length, failed: 0 };
      },
    );

    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    await act(async () => {
      await result.current.stars.checkStars();
    });

    await act(async () => {
      await result.current.stars.starAll();
    });

    expect(capturedReposToStar).toHaveLength(2);
    expect(capturedReposToStar[0].name).toBe(REPOSITORIES[1].name);
    expect(capturedReposToStar[1].name).toBe(REPOSITORIES[2].name);
  });

  it("refreshes token and retries starAll on TokenExpiredError", async () => {
    const { TokenExpiredError } = await import("@/lib/github");
    // Mark all repos unstarred.
    spy.checkAllStars.mockImplementation(
      async (
        _token: string,
        repos: Repository[],
        onProgress?: (r: StarCheckResult) => void,
      ) => {
        const results: StarCheckResult[] = [];
        for (const repo of repos) {
          const r: StarCheckResult = { repo, status: "unstarred" };
          results.push(r);
          onProgress?.(r);
        }
        return results;
      },
    );
    let starCalls = 0;
    spy.starAllUnstarred.mockImplementation(
      async (token: string, repos: Repository[]): Promise<StarAllResult> => {
        starCalls++;
        if (starCalls === 1) throw new TokenExpiredError();
        expect(token).toBe("refreshed-token");
        return { starred: repos.length, failed: 0 };
      },
    );

    // Seed refresh response.
    fetchStub.enqueue({
      status: 200,
      body: {
        access_token: "refreshed-token",
        expires_in: 28800,
        refresh_token: "r2",
      },
    });

    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    await act(async () => {
      await result.current.stars.checkStars();
    });

    const starResult = await act(async () => {
      return result.current.stars.starAll();
    });

    expect(starCalls).toBe(2);
    expect(starResult.starred).toBeGreaterThan(0);
    expect(result.current.auth.isAuthenticated).toBe(true);
  });

  it("logs out on TokenExpiredError during starAll", async () => {
    const { TokenExpiredError } = await import("@/lib/github");
    // Mark all repos unstarred, so starAll has work to do.
    spy.checkAllStars.mockImplementation(
      async (
        _token: string,
        repos: Repository[],
        onProgress?: (r: StarCheckResult) => void,
      ) => {
        const results: StarCheckResult[] = [];
        for (const repo of repos) {
          const r: StarCheckResult = { repo, status: "unstarred" };
          results.push(r);
          onProgress?.(r);
        }
        return results;
      },
    );
    spy.starAllUnstarred.mockRejectedValue(new TokenExpiredError());
    // Refresh fails.
    fetchStub.enqueue({ status: 401 });

    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    await act(async () => {
      await result.current.stars.checkStars();
    });

    const onSessionExpired = vi.fn();
    const starResult = await act(async () => {
      return result.current.stars.starAll({ onSessionExpired });
    });
    expect(starResult).toEqual({ starred: 0, failed: 0 });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(result.current.auth.isAuthenticated).toBe(false);
  });

  it("starAll identity remains stable across status updates (ref-based pattern)", async () => {
    spy.checkAllStars.mockImplementation(
      async (
        _token: string,
        repos: Repository[],
        onProgress?: (r: StarCheckResult) => void,
      ) => {
        const results: StarCheckResult[] = [];
        for (const repo of repos) {
          const r: StarCheckResult = { repo, status: "unstarred" };
          results.push(r);
          onProgress?.(r);
        }
        return results;
      },
    );

    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    const starAllBefore = result.current.stars.starAll;

    await act(async () => {
      await result.current.stars.checkStars();
    });

    // After many state updates during checkStars, starAll identity should
    // still be stable because it depends only on (token, logout), not on
    // starStatuses (which is read through a ref).
    expect(result.current.stars.starAll).toBe(starAllBefore);
  });

  it("starAll uses external token when provided", async () => {
    spy.checkAllStars.mockImplementation(
      async (
        _token: string,
        repos: Repository[],
        onProgress?: (r: StarCheckResult) => void,
      ) => {
        const results: StarCheckResult[] = [];
        for (const repo of repos) {
          const r: StarCheckResult = { repo, status: "unstarred" };
          results.push(r);
          onProgress?.(r);
        }
        return results;
      },
    );

    let capturedToken = "";
    spy.starAllUnstarred.mockImplementation(
      async (
        token: string,
        repos: Repository[],
      ): Promise<StarAllResult> => {
        capturedToken = token;
        return { starred: repos.length, failed: 0 };
      },
    );

    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    await act(async () => {
      await result.current.stars.checkStars();
    });

    await act(async () => {
      await result.current.stars.starAll({ token: "ephemeral-classic-token" });
    });

    expect(capturedToken).toBe("ephemeral-classic-token");
  });

  it("starAll with external token does NOT retry on TokenExpiredError", async () => {
    const { TokenExpiredError } = await import("@/lib/github");
    spy.checkAllStars.mockImplementation(
      async (
        _token: string,
        repos: Repository[],
        onProgress?: (r: StarCheckResult) => void,
      ) => {
        const results: StarCheckResult[] = [];
        for (const repo of repos) {
          const r: StarCheckResult = { repo, status: "unstarred" };
          results.push(r);
          onProgress?.(r);
        }
        return results;
      },
    );
    spy.starAllUnstarred.mockRejectedValue(new TokenExpiredError());

    const onSessionExpired = vi.fn();

    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    await act(async () => {
      await result.current.stars.checkStars();
    });

    const starResult = await act(async () => {
      return result.current.stars.starAll({
        token: "ephemeral-token",
        onSessionExpired,
      });
    });

    // Should not have attempted refresh — no fetch calls for refresh
    expect(starResult).toEqual({ starred: 0, failed: 0 });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    // User should still be authenticated (ephemeral token failure doesn't log out)
    expect(result.current.auth.isAuthenticated).toBe(true);
  });

  it("retryStar stars a single repo and updates its status", async () => {
    spy.starRepo.mockResolvedValue(undefined);
    // Seed a failed status for the first repo.
    spy.checkAllStars.mockImplementation(
      async (
        _token: string,
        repos: Repository[],
        onProgress?: (r: StarCheckResult) => void,
      ) => {
        const results: StarCheckResult[] = [];
        for (let i = 0; i < repos.length; i++) {
          const status: StarStatus = i === 0 ? "failed" : "unstarred";
          const r: StarCheckResult = { repo: repos[i], status };
          results.push(r);
          onProgress?.(r);
        }
        return results;
      },
    );

    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    await act(async () => {
      await result.current.stars.checkStars();
    });

    const repo = REPOSITORIES[0];
    const key = `${repo.owner}/${repo.name}`;
    expect(result.current.stars.starStatuses[key]).toBe("failed");

    await act(async () => {
      await result.current.stars.retryStar(repo);
    });

    expect(spy.starRepo).toHaveBeenCalledWith(
      "test-token",
      repo.owner,
      repo.name,
    );
    expect(result.current.stars.starStatuses[key]).toBe("starred");
  });

  it("retryStar marks repo as failed on error", async () => {
    spy.starRepo.mockRejectedValue(new Error("GitHub API error: 500"));

    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    const repo = REPOSITORIES[0];
    const key = `${repo.owner}/${repo.name}`;

    await act(async () => {
      await result.current.stars.retryStar(repo);
    });

    expect(result.current.stars.starStatuses[key]).toBe("failed");
  });

  it("progress derivation reflects status map", async () => {
    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    const progress = result.current.stars.progress;
    expect(progress.total).toBe(REPOSITORIES.length);
    expect(progress.starred).toBe(0);
    expect(progress.remaining).toBe(REPOSITORIES.length);
    expect(progress.current).toBeNull();
  });
});

describe("useStars — recheckRepo", () => {
  let fetchStub: FetchStub;

  beforeEach(() => {
    fetchStub = installFetchStub();
    spy.getUser.mockReset().mockResolvedValue({
      login: "u",
      avatar_url: "a",
      name: "U",
    });
    spy.checkAllStars.mockReset();
    spy.starAllUnstarred.mockReset();
    spy.starRepo.mockReset();
    spy.isStarred.mockReset();
    seedToken();
  });
  afterEach(() => {
    fetchStub.reset();
  });

  it("updates status to 'starred' when isStarred returns true", async () => {
    spy.isStarred.mockResolvedValue(true);

    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    const repo = REPOSITORIES[0];
    const key = `${repo.owner}/${repo.name}`;
    expect(result.current.stars.starStatuses[key]).toBe("unknown");

    await act(async () => {
      await result.current.stars.recheckRepo(repo);
    });

    expect(spy.isStarred).toHaveBeenCalledWith("test-token", repo.owner, repo.name);
    expect(result.current.stars.starStatuses[key]).toBe("starred");
  });

  it("updates status to 'unstarred' when isStarred returns false", async () => {
    spy.isStarred.mockResolvedValue(false);

    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    const repo = REPOSITORIES[0];
    const key = `${repo.owner}/${repo.name}`;

    await act(async () => {
      await result.current.stars.recheckRepo(repo);
    });

    expect(result.current.stars.starStatuses[key]).toBe("unstarred");
  });

  it("silently ignores errors from isStarred", async () => {
    spy.isStarred.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    const repo = REPOSITORIES[0];
    const key = `${repo.owner}/${repo.name}`;

    await act(async () => {
      await result.current.stars.recheckRepo(repo);
    });

    // Status should remain unchanged on error.
    expect(result.current.stars.starStatuses[key]).toBe("unknown");
  });

  it("no-op when no token", async () => {
    localStorage.clear();
    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    await act(async () => {
      await result.current.stars.recheckRepo(REPOSITORIES[0]);
    });

    expect(spy.isStarred).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent recheckRepo calls for the same repo", async () => {
    // isStarred resolves after a small delay to simulate network latency.
    spy.isStarred.mockImplementation(
      () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 50)),
    );

    const { result } = renderHook(() => useStarsWithAuth(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.auth.isLoading).toBe(false));

    const repo = REPOSITORIES[0];

    // Fire two concurrent recheckRepo calls for the same repo.
    await act(async () => {
      const p1 = result.current.stars.recheckRepo(repo);
      const p2 = result.current.stars.recheckRepo(repo);
      await Promise.all([p1, p2]);
    });

    // Only one isStarred call should have been made due to deduplication.
    expect(spy.isStarred).toHaveBeenCalledTimes(1);
  });
});
