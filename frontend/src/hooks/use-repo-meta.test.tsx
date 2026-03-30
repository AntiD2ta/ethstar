import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import type { RepoMeta, RepoMetaMap } from "@/lib/github";
import { RateLimitError } from "@/lib/github";

// Hoist the spies so vi.mock can reference them.
const fetchRepoMetaSpy = vi.hoisted(() =>
  vi.fn<(owner: string, name: string, token: string | null, signal?: AbortSignal) => Promise<RepoMeta | null>>(),
);
const fetchAllRepoMetaGraphQLSpy = vi.hoisted(() =>
  vi.fn<(repos: Repository[], token: string, signal?: AbortSignal) => Promise<RepoMetaMap>>(),
);

vi.mock("@/lib/github", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/github")>();
  return {
    ...actual,
    fetchRepoMeta: fetchRepoMetaSpy,
    fetchAllRepoMetaGraphQL: fetchAllRepoMetaGraphQLSpy,
  };
});

import { useRepoMeta, REPO_META_CACHE_KEY } from "./use-repo-meta";
import type { Repository } from "@/lib/types";

const REPOS: Repository[] = [
  {
    owner: "ethereum",
    name: "go-ethereum",
    description: "Go Ethereum",
    category: "Ethereum Core",
    url: "https://github.com/ethereum/go-ethereum",
  },
  {
    owner: "sigp",
    name: "lighthouse",
    description: "Lighthouse",
    category: "Consensus Clients",
    url: "https://github.com/sigp/lighthouse",
  },
];

describe("useRepoMeta", () => {
  beforeEach(() => {
    fetchRepoMetaSpy.mockReset();
    fetchAllRepoMetaGraphQLSpy.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("fetches metadata for all repos and returns star counts + descriptions", async () => {
    fetchRepoMetaSpy.mockImplementation(async (owner, name) => {
      if (owner === "ethereum" && name === "go-ethereum")
        return { stargazers_count: 47000, description: "Go impl" };
      if (owner === "sigp" && name === "lighthouse")
        return { stargazers_count: 6000, description: "Rust CL" };
      return null;
    });

    const { result } = renderHook(() => useRepoMeta(REPOS, null));

    await waitFor(() => {
      expect(result.current.repoMeta["ethereum/go-ethereum"]).toBeDefined();
    });

    expect(result.current.repoMeta["ethereum/go-ethereum"]).toEqual({
      stargazers_count: 47000,
      description: "Go impl",
    });
    expect(result.current.repoMeta["sigp/lighthouse"]).toEqual({
      stargazers_count: 6000,
      description: "Rust CL",
    });
    expect(result.current.combinedStars).toBe(53000);
  });

  it("passes token to GraphQL when authenticated", async () => {
    fetchAllRepoMetaGraphQLSpy.mockResolvedValue({
      "ethereum/go-ethereum": { stargazers_count: 100, description: null },
      "sigp/lighthouse": { stargazers_count: 200, description: null },
    });

    const { result } = renderHook(() => useRepoMeta(REPOS, "ghu_token123"));

    await waitFor(() => {
      expect(result.current.repoMeta["ethereum/go-ethereum"]).toBeDefined();
    });

    expect(fetchAllRepoMetaGraphQLSpy).toHaveBeenCalledWith(
      REPOS,
      "ghu_token123",
      expect.any(AbortSignal),
    );
    expect(fetchRepoMetaSpy).not.toHaveBeenCalled();
  });

  it("caches results in localStorage", async () => {
    fetchRepoMetaSpy.mockResolvedValue({ stargazers_count: 5000, description: null });

    const { result } = renderHook(() => useRepoMeta(REPOS, null));

    await waitFor(() => {
      expect(result.current.repoMeta["ethereum/go-ethereum"]).toBeDefined();
    });

    const cached = localStorage.getItem(REPO_META_CACHE_KEY);
    expect(cached).toBeTruthy();
    const parsed = JSON.parse(cached!);
    expect(parsed.data["ethereum/go-ethereum"]).toEqual({
      stargazers_count: 5000,
      description: null,
    });
    expect(typeof parsed.fetchedAt).toBe("number");
  });

  it("returns cached data immediately on mount", async () => {
    const cachedData = {
      data: {
        "ethereum/go-ethereum": { stargazers_count: 42000 },
        "sigp/lighthouse": { stargazers_count: 5500 },
      },
      fetchedAt: Date.now(), // fresh cache
    };
    localStorage.setItem(REPO_META_CACHE_KEY, JSON.stringify(cachedData));

    // Don't resolve fetches yet — we want to verify cache is used immediately.
    fetchRepoMetaSpy.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    const { result } = renderHook(() => useRepoMeta(REPOS, null));

    // Cached data should be available synchronously (after first render).
    expect(result.current.repoMeta["ethereum/go-ethereum"]).toEqual({
      stargazers_count: 42000,
    });
    expect(result.current.combinedStars).toBe(47500);
  });

  it("re-fetches when cache is stale (older than 1 hour)", async () => {
    const staleCache = {
      data: {
        "ethereum/go-ethereum": { stargazers_count: 40000 },
        "sigp/lighthouse": { stargazers_count: 5000 },
      },
      fetchedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
    };
    localStorage.setItem(REPO_META_CACHE_KEY, JSON.stringify(staleCache));

    fetchRepoMetaSpy.mockResolvedValue({ stargazers_count: 50000, description: null });

    const { result } = renderHook(() => useRepoMeta(REPOS, null));

    // Stale cache returned immediately.
    expect(result.current.repoMeta["ethereum/go-ethereum"]).toEqual({
      stargazers_count: 40000,
    });

    // Fresh data arrives.
    await waitFor(() => {
      expect(result.current.repoMeta["ethereum/go-ethereum"]?.stargazers_count).toBe(
        50000,
      );
    });
  });

  it("does not re-fetch when cache is fresh", async () => {
    const freshCache = {
      data: {
        "ethereum/go-ethereum": { stargazers_count: 42000 },
        "sigp/lighthouse": { stargazers_count: 5500 },
      },
      fetchedAt: Date.now() - 30 * 60 * 1000, // 30 min ago — within 1hr TTL
    };
    localStorage.setItem(REPO_META_CACHE_KEY, JSON.stringify(freshCache));

    const { result } = renderHook(() => useRepoMeta(REPOS, null));

    // Flush microtasks to give the effect a chance to fire if it would.
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchRepoMetaSpy).not.toHaveBeenCalled();
    expect(result.current.repoMeta["ethereum/go-ethereum"]).toEqual({
      stargazers_count: 42000,
    });
  });

  it("handles partial fetch failures gracefully", async () => {
    fetchRepoMetaSpy.mockImplementation(async (owner, name) => {
      if (owner === "ethereum" && name === "go-ethereum")
        return { stargazers_count: 47000, description: null };
      return null; // lighthouse fetch fails
    });

    const { result } = renderHook(() => useRepoMeta(REPOS, null));

    await waitFor(() => {
      expect(result.current.repoMeta["ethereum/go-ethereum"]).toBeDefined();
    });

    expect(result.current.repoMeta["ethereum/go-ethereum"]).toEqual({
      stargazers_count: 47000,
      description: null,
    });
    expect(result.current.repoMeta["sigp/lighthouse"]).toBeUndefined();
    expect(result.current.combinedStars).toBe(47000);
  });

  it("returns null combinedStars when no data is available", () => {
    const { result } = renderHook(() => useRepoMeta(REPOS, null));

    expect(result.current.combinedStars).toBeNull();
    expect(result.current.repoMeta).toEqual({});
  });

  it("aborts in-flight requests on unmount", async () => {
    let capturedSignal: AbortSignal | undefined;
    fetchRepoMetaSpy.mockImplementation(
      async (_owner, _name, _token, signal) => {
        capturedSignal = signal;
        return new Promise(() => {}); // never resolves
      },
    );

    const { unmount } = renderHook(() => useRepoMeta(REPOS, null));

    // Let the effect fire and workers start.
    await act(async () => {
      await Promise.resolve();
    });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal!.aborted).toBe(false);

    unmount();

    expect(capturedSignal!.aborted).toBe(true);
  });

  it("stops all workers on rate limit and caches partial results", async () => {
    const manyRepos: Repository[] = Array.from({ length: 10 }, (_, i) => ({
      owner: `org${i}`,
      name: `repo${i}`,
      description: `Repo ${i}`,
      category: "Ethereum Core" as const,
      url: `https://github.com/org${i}/repo${i}`,
    }));

    let callCount = 0;
    fetchRepoMetaSpy.mockImplementation(async (owner) => {
      callCount++;
      if (owner === "org0") {
        return { stargazers_count: 5000, description: "First repo" };
      }
      // All subsequent calls hit rate limit.
      throw new RateLimitError("60");
    });

    const { result } = renderHook(() => useRepoMeta(manyRepos, null));

    await waitFor(() => {
      expect(result.current.repoMeta["org0/repo0"]).toBeDefined();
    });

    // Workers should have stopped early — fewer calls than 10 total repos.
    expect(callCount).toBeLessThan(10);

    // Partial result is in state.
    expect(result.current.repoMeta["org0/repo0"]).toEqual({
      stargazers_count: 5000,
      description: "First repo",
    });

    // Partial result is cached in localStorage.
    const cached = localStorage.getItem(REPO_META_CACHE_KEY);
    expect(cached).toBeTruthy();
    const parsed = JSON.parse(cached!);
    expect(parsed.data["org0/repo0"]).toEqual({
      stargazers_count: 5000,
      description: "First repo",
    });
  });

  it("validates cached data shape", () => {
    // Corrupt cache.
    localStorage.setItem(REPO_META_CACHE_KEY, '{"bad": true}');

    fetchRepoMetaSpy.mockResolvedValue({ stargazers_count: 1000, description: null });

    const { result } = renderHook(() => useRepoMeta(REPOS, null));

    // Should not crash — starts with empty state.
    expect(result.current.repoMeta).toEqual({});
  });

  it("uses GraphQL when token is present", async () => {
    const graphQLResult: RepoMetaMap = {
      "ethereum/go-ethereum": { stargazers_count: 47000, description: "Go impl" },
      "sigp/lighthouse": { stargazers_count: 6000, description: "Rust CL" },
    };
    fetchAllRepoMetaGraphQLSpy.mockResolvedValue(graphQLResult);

    const { result } = renderHook(() => useRepoMeta(REPOS, "ghu_token123"));

    await waitFor(() => {
      expect(result.current.repoMeta["ethereum/go-ethereum"]).toBeDefined();
    });

    expect(fetchAllRepoMetaGraphQLSpy).toHaveBeenCalledWith(
      REPOS,
      "ghu_token123",
      expect.any(AbortSignal),
    );
    expect(fetchRepoMetaSpy).not.toHaveBeenCalled();
    expect(result.current.combinedStars).toBe(53000);
  });

  it("uses REST worker pool when token is null", async () => {
    fetchRepoMetaSpy.mockResolvedValue({ stargazers_count: 100, description: null });

    const { result } = renderHook(() => useRepoMeta(REPOS, null));

    await waitFor(() => {
      expect(result.current.repoMeta["ethereum/go-ethereum"]).toBeDefined();
    });

    expect(fetchAllRepoMetaGraphQLSpy).not.toHaveBeenCalled();
    expect(fetchRepoMetaSpy).toHaveBeenCalled();
  });

  it("handles GraphQL rate limit without crashing", async () => {
    fetchAllRepoMetaGraphQLSpy.mockRejectedValue(new RateLimitError("60"));

    const { result } = renderHook(() => useRepoMeta(REPOS, "ghu_token"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // No partial results from GraphQL — but hook should settle without crashing.
    expect(result.current.repoMeta).toEqual({});
    expect(result.current.combinedStars).toBeNull();
  });

  it("caches GraphQL results in localStorage", async () => {
    const graphQLResult: RepoMetaMap = {
      "ethereum/go-ethereum": { stargazers_count: 47000, description: "Go impl" },
    };
    fetchAllRepoMetaGraphQLSpy.mockResolvedValue(graphQLResult);

    const { result } = renderHook(() => useRepoMeta(REPOS, "ghu_token"));

    await waitFor(() => {
      expect(result.current.repoMeta["ethereum/go-ethereum"]).toBeDefined();
    });

    const cached = localStorage.getItem(REPO_META_CACHE_KEY);
    expect(cached).toBeTruthy();
    const parsed = JSON.parse(cached!);
    expect(parsed.data["ethereum/go-ethereum"]).toEqual({
      stargazers_count: 47000,
      description: "Go impl",
    });
  });
});
