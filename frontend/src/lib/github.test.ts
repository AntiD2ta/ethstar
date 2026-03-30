import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkAllStars,
  fetchAllRepoMetaGraphQL,
  fetchRepoMeta,
  ForbiddenError,
  getUser,
  isStarred,
  NetworkError,
  RateLimitError,
  starAllUnstarred,
  starRepo,
  TokenExpiredError,
} from "./github";
import type { Repository } from "./types";
import { installFetchStub } from "@/test/fetch-stub";

const TOKEN = "ghu_testtoken";

function assertAuthHeaders(headers: HeadersInit | undefined) {
  expect(headers).toBeDefined();
  const h = headers as Record<string, string>;
  expect(h.Authorization).toBe(`Bearer ${TOKEN}`);
  expect(h.Accept).toBe("application/vnd.github+json");
  expect(h["X-GitHub-Api-Version"]).toBe("2026-03-10");
}

describe("getUser", () => {
  it("returns parsed user on 200", async () => {
    const stub = installFetchStub();
    stub.enqueue({
      status: 200,
      body: { login: "alice", avatar_url: "https://a", name: "Alice" },
    });

    const user = await getUser(TOKEN);

    expect(user.login).toBe("alice");
    expect(user.name).toBe("Alice");
    stub.expectUrlStartsWith(0, "https://api.github.com/user");
    assertAuthHeaders(stub.initAt(0)?.headers);
  });

  it("throws TokenExpiredError on 401", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 401 });
    await expect(getUser(TOKEN)).rejects.toBeInstanceOf(TokenExpiredError);
  });

  it("throws generic Error on 500", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 500 });
    await expect(getUser(TOKEN)).rejects.toThrow(/500/);
  });

  it("throws NetworkError when fetch rejects", async () => {
    const stub = installFetchStub();
    stub.enqueue(new TypeError("Failed to fetch"));
    await expect(getUser(TOKEN)).rejects.toBeInstanceOf(NetworkError);
  });
});

describe("isStarred", () => {
  it("returns true on 204", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 204 });
    await expect(isStarred(TOKEN, "ethereum", "solidity")).resolves.toBe(true);
    stub.expectUrlStartsWith(
      0,
      "https://api.github.com/user/starred/ethereum/solidity",
    );
    assertAuthHeaders(stub.initAt(0)?.headers);
  });

  it("returns false on 404", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 404 });
    await expect(isStarred(TOKEN, "ethereum", "solidity")).resolves.toBe(false);
  });

  it("throws TokenExpiredError on 401", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 401 });
    await expect(isStarred(TOKEN, "a", "b")).rejects.toBeInstanceOf(
      TokenExpiredError,
    );
  });

  it("throws RateLimitError on 403 with rate-limit body", async () => {
    const stub = installFetchStub();
    stub.enqueue({
      status: 403,
      headers: { "retry-after": "30" },
      body: { message: "API rate limit exceeded for user ID 12345." },
    });
    try {
      await isStarred(TOKEN, "a", "b");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBe(30_000);
    }
  });

  it("throws ForbiddenError on 403 without rate-limit body", async () => {
    const stub = installFetchStub();
    stub.enqueue({
      status: 403,
      body: { message: "Resource not accessible by personal access token" },
    });
    await expect(isStarred(TOKEN, "a", "b")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("throws RateLimitError on 429 with null retry-after", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 429 });
    try {
      await isStarred(TOKEN, "a", "b");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBeNull();
    }
  });

  it("throws generic Error on unexpected status", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 500 });
    await expect(isStarred(TOKEN, "a", "b")).rejects.toThrow(/500/);
  });

  it("throws NetworkError when fetch rejects", async () => {
    const stub = installFetchStub();
    stub.enqueue(new TypeError("Network failure"));
    await expect(isStarred(TOKEN, "a", "b")).rejects.toBeInstanceOf(
      NetworkError,
    );
  });
});

describe("starRepo", () => {
  it("returns on 204", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 204 });
    await expect(starRepo(TOKEN, "ethereum", "solidity")).resolves.toBeUndefined();
    expect(stub.initAt(0)?.method).toBe("PUT");
    assertAuthHeaders(stub.initAt(0)?.headers);
  });

  it("throws TokenExpiredError on 401", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 401 });
    await expect(starRepo(TOKEN, "a", "b")).rejects.toBeInstanceOf(
      TokenExpiredError,
    );
  });

  it("throws RateLimitError on 429", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 429, headers: { "retry-after": "5" } });
    try {
      await starRepo(TOKEN, "a", "b");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBe(5_000);
    }
  });

  it("throws RateLimitError on 403 with abuse-detection body", async () => {
    const stub = installFetchStub();
    stub.enqueue({
      status: 403,
      headers: { "retry-after": "10" },
      body: { message: "You have triggered an abuse detection mechanism." },
    });
    try {
      await starRepo(TOKEN, "a", "b");
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBe(10_000);
    }
  });

  it("throws ForbiddenError on 403 permission denied", async () => {
    const stub = installFetchStub();
    stub.enqueue({
      status: 403,
      body: { message: "Resource not accessible by personal access token" },
    });
    await expect(starRepo(TOKEN, "a", "b")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("throws generic Error on 500", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 500 });
    await expect(starRepo(TOKEN, "a", "b")).rejects.toThrow(/500/);
  });

  it("throws NetworkError when fetch rejects", async () => {
    const stub = installFetchStub();
    stub.enqueue(new TypeError("Network failure"));
    await expect(starRepo(TOKEN, "a", "b")).rejects.toBeInstanceOf(
      NetworkError,
    );
  });
});

function makeRepos(count: number): Repository[] {
  return Array.from({ length: count }, (_, i) => ({
    owner: "owner",
    name: `repo${i}`,
    description: "",
    category: "Ethereum Core" as const,
    url: `https://github.com/owner/repo${i}`,
  }));
}

describe("checkAllStars", () => {
  it("enforces concurrency limit of 5", async () => {
    const repos = makeRepos(12);
    let inFlight = 0;
    let maxInFlight = 0;
    const resolvers: Array<() => void> = [];

    // Manual fetch spy (not installFetchStub) because we need to control
    // exactly when each in-flight request resolves to verify the concurrency
    // window never exceeds 5 simultaneous requests.
    vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      inFlight++;
      if (inFlight > maxInFlight) maxInFlight = inFlight;
      return new Promise<Response>((resolve) => {
        resolvers.push(() => {
          inFlight--;
          resolve(new Response(null, { status: 204 }));
        });
      });
    });

    const progressCalls: string[] = [];
    const promise = checkAllStars(TOKEN, repos, (r) => {
      progressCalls.push(r.repo.name);
    });

    // Let the initial batch launch.
    await Promise.resolve();
    await Promise.resolve();

    // Drain the resolver queue repeatedly, allowing workers to pick up more.
    while (resolvers.length > 0 || inFlight > 0) {
      const r = resolvers.shift();
      if (r) r();
      // Give microtasks a chance to advance (schedule next request).
      await Promise.resolve();
      await Promise.resolve();
    }

    const results = await promise;
    expect(results).toHaveLength(12);
    expect(progressCalls).toHaveLength(12);
    expect(maxInFlight).toBeLessThanOrEqual(5);
    expect(maxInFlight).toBeGreaterThan(0);
  });

  it("onProgress called per repo with status", async () => {
    const repos = makeRepos(3);
    const stub = installFetchStub();
    stub.enqueue({ status: 204 }, { status: 404 }, { status: 204 });

    const results: Array<{ name: string; status: string }> = [];
    const final = await checkAllStars(TOKEN, repos, (r) => {
      results.push({ name: r.repo.name, status: r.status });
    });

    expect(results).toHaveLength(3);
    expect(final).toHaveLength(3);
    const statusMap = Object.fromEntries(
      results.map((r) => [r.name, r.status]),
    );
    // Order across workers isn't guaranteed; just check all 3 are present.
    expect(Object.keys(statusMap).sort()).toEqual(["repo0", "repo1", "repo2"]);
    expect(Object.values(statusMap).sort()).toEqual([
      "starred",
      "starred",
      "unstarred",
    ]);
  });

  it("records failed status on non-auth errors", async () => {
    const repos = makeRepos(1);
    const stub = installFetchStub();
    stub.enqueue({ status: 500 });
    const results = await checkAllStars(TOKEN, repos);
    expect(results[0].status).toBe("failed");
  });

  it("propagates TokenExpiredError out of the worker pool", async () => {
    const repos = makeRepos(3);
    const stub = installFetchStub();
    stub.enqueue({ status: 401 }, { status: 401 }, { status: 401 });
    await expect(checkAllStars(TOKEN, repos)).rejects.toBeInstanceOf(
      TokenExpiredError,
    );
  });

  it("propagates NetworkError out of the worker pool", async () => {
    const repos = makeRepos(3);
    const stub = installFetchStub();
    stub.enqueue(
      new TypeError("fetch failed"),
      new TypeError("fetch failed"),
      new TypeError("fetch failed"),
    );
    await expect(checkAllStars(TOKEN, repos)).rejects.toBeInstanceOf(
      NetworkError,
    );
  });

  it("propagates signal so sibling workers can observe the abort", async () => {
    const repos = makeRepos(8);
    const seenSignals: AbortSignal[] = [];

    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal) seenSignals.push(signal);
        // First call throws network error, rest hang so we can observe state.
        if (seenSignals.length === 1) throw new TypeError("network down");
        await new Promise((_, reject) => {
          signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        });
        return new Response(null, { status: 204 });
      },
    );

    await expect(checkAllStars(TOKEN, repos)).rejects.toBeInstanceOf(
      NetworkError,
    );
    // Every fetch received an AbortSignal, and all should be aborted after
    // the NetworkError was raised.
    expect(seenSignals.length).toBeGreaterThan(1);
    expect(seenSignals.every((s) => s.aborted)).toBe(true);
  });
});

describe("fetchRepoMeta", () => {
  it("returns stargazers_count on 200", async () => {
    const stub = installFetchStub();
    stub.enqueue({
      status: 200,
      body: {
        stargazers_count: 47000,
        description: "Go Ethereum",
        full_name: "ethereum/go-ethereum",
      },
    });

    const meta = await fetchRepoMeta("ethereum", "go-ethereum", TOKEN);

    expect(meta).toEqual({ stargazers_count: 47000, description: "Go Ethereum" });
    stub.expectUrlStartsWith(
      0,
      "https://api.github.com/repos/ethereum/go-ethereum",
    );
    // Should pass auth headers when token is provided.
    const h = stub.initAt(0)?.headers as Record<string, string>;
    expect(h.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("returns stargazers_count and description without auth when no token", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 200, body: { stargazers_count: 1500, description: "Lighthouse" } });

    const meta = await fetchRepoMeta("sigp", "lighthouse", null);

    expect(meta).toEqual({ stargazers_count: 1500, description: "Lighthouse" });
    const h = stub.initAt(0)?.headers as Record<string, string> | undefined;
    expect(h?.Authorization).toBeUndefined();
  });

  it("returns null on non-rate-limit non-200 status", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 404 });

    const meta = await fetchRepoMeta("owner", "nonexistent", null);

    expect(meta).toBeNull();
  });

  it("throws RateLimitError on 403 with rate-limit body", async () => {
    const stub = installFetchStub();
    stub.enqueue({
      status: 403,
      headers: { "retry-after": "60" },
      body: { message: "API rate limit exceeded for user ID 12345." },
    });

    try {
      await fetchRepoMeta("owner", "repo", null);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBe(60_000);
    }
  });

  it("throws ForbiddenError on 403 permission denied", async () => {
    const stub = installFetchStub();
    stub.enqueue({
      status: 403,
      body: { message: "Forbidden" },
    });

    await expect(fetchRepoMeta("owner", "repo", null)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("throws RateLimitError on 429", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 429 });

    try {
      await fetchRepoMeta("owner", "repo", null);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBeNull();
    }
  });

  it("returns null on network error", async () => {
    const stub = installFetchStub();
    stub.enqueue(new TypeError("Failed to fetch"));

    const meta = await fetchRepoMeta("owner", "repo", null);

    expect(meta).toBeNull();
  });

  it("passes signal to fetch", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 200, body: { stargazers_count: 100, description: "d" } });
    const controller = new AbortController();

    await fetchRepoMeta("o", "r", null, controller.signal);

    expect(stub.initAt(0)?.signal).toBe(controller.signal);
  });

  it("re-throws AbortError when signal is aborted", async () => {
    // Use direct fetch spy to simulate abort behavior (stub doesn't check signal).
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init) => {
        if ((init?.signal as AbortSignal | undefined)?.aborted) {
          throw new DOMException("The operation was aborted.", "AbortError");
        }
        return new Response(null, { status: 200 });
      },
    );

    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchRepoMeta("o", "r", null, controller.signal),
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof DOMException && err.name === "AbortError",
    );
  });
});

describe("starAllUnstarred", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits at least 1s between PUTs (except after last)", async () => {
    const repos = makeRepos(3);
    const stub = installFetchStub();
    stub.enqueue({ status: 204 }, { status: 204 }, { status: 204 });

    const promise = starAllUnstarred(TOKEN, repos, () => {});

    // After initial microtasks, 1 PUT should have fired.
    await vi.advanceTimersByTimeAsync(0);
    expect(stub.callCount()).toBe(1);

    // Before 1s delay completes, still 1.
    await vi.advanceTimersByTimeAsync(500);
    expect(stub.callCount()).toBe(1);

    // After 1s, second fires.
    await vi.advanceTimersByTimeAsync(500);
    expect(stub.callCount()).toBe(2);

    // Advance to fire the third.
    await vi.advanceTimersByTimeAsync(1000);
    expect(stub.callCount()).toBe(3);

    const result = await promise;
    expect(result).toEqual({ starred: 3, failed: 0 });
  });

  it("reports starring then starred on success", async () => {
    const repos = makeRepos(1);
    installFetchStub().enqueue({ status: 204 });
    const events: Array<[string, string]> = [];
    const promise = starAllUnstarred(TOKEN, repos, (repo, status) => {
      events.push([repo.name, status]);
    });
    await vi.advanceTimersByTimeAsync(0);
    await promise;
    expect(events).toEqual([
      ["repo0", "starring"],
      ["repo0", "starred"],
    ]);
  });

  it("reports starring then failed on non-rate-limit error", async () => {
    const repos = makeRepos(1);
    installFetchStub().enqueue({ status: 500 });
    const events: Array<[string, string]> = [];
    const promise = starAllUnstarred(TOKEN, repos, (repo, status) => {
      events.push([repo.name, status]);
    });
    await vi.advanceTimersByTimeAsync(0);
    const result = await promise;
    expect(result).toEqual({ starred: 0, failed: 1 });
    expect(events).toEqual([
      ["repo0", "starring"],
      ["repo0", "failed"],
    ]);
  });

  it("retries on RateLimitError after waiting retryAfterMs", async () => {
    const repos = makeRepos(1);
    const stub = installFetchStub();
    stub.enqueue(
      { status: 429, headers: { "retry-after": "2" } },
      { status: 204 },
    );
    const events: Array<[string, string]> = [];
    const promise = starAllUnstarred(TOKEN, repos, (repo, status) => {
      events.push([repo.name, status]);
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(stub.callCount()).toBe(1);
    // Wait the retry-after window.
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;
    expect(result).toEqual({ starred: 1, failed: 0 });
    expect(stub.callCount()).toBe(2);
    expect(events).toEqual([
      ["repo0", "starring"],
      ["repo0", "starred"],
    ]);
  });

  it("reports failed if retry after rate-limit also fails", async () => {
    const repos = makeRepos(1);
    const stub = installFetchStub();
    stub.enqueue(
      { status: 429, headers: { "retry-after": "1" } },
      { status: 500 },
    );
    const events: Array<[string, string]> = [];
    const promise = starAllUnstarred(TOKEN, repos, (repo, status) => {
      events.push([repo.name, status]);
    });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;
    expect(result).toEqual({ starred: 0, failed: 1 });
    expect(stub.callCount()).toBe(2);
    expect(events[events.length - 1]).toEqual(["repo0", "failed"]);
  });

  it("propagates TokenExpiredError", async () => {
    const repos = makeRepos(1);
    installFetchStub().enqueue({ status: 401 });
    const promise = starAllUnstarred(TOKEN, repos, () => {});
    // Attach catch handler synchronously to avoid an unhandled-rejection blip.
    const assertion = expect(promise).rejects.toBeInstanceOf(TokenExpiredError);
    await vi.advanceTimersByTimeAsync(0);
    await assertion;
  });

  it("propagates NetworkError", async () => {
    const repos = makeRepos(1);
    installFetchStub().enqueue(new TypeError("fetch failed"));
    const promise = starAllUnstarred(TOKEN, repos, () => {});
    const assertion = expect(promise).rejects.toBeInstanceOf(NetworkError);
    await vi.advanceTimersByTimeAsync(0);
    await assertion;
  });

  it("propagates ForbiddenError (stops loop immediately)", async () => {
    const repos = makeRepos(3);
    installFetchStub().enqueue({
      status: 403,
      body: { message: "Resource not accessible by personal access token" },
    });
    const events: Array<[string, string]> = [];
    const promise = starAllUnstarred(TOKEN, repos, (repo, status) => {
      events.push([repo.name, status]);
    });
    const assertion = expect(promise).rejects.toBeInstanceOf(ForbiddenError);
    await vi.advanceTimersByTimeAsync(0);
    await assertion;
    // Only the first repo should have been attempted (starring status),
    // then the loop stops — no retries, no subsequent repos.
    expect(events).toEqual([["repo0", "starring"]]);
  });
});

describe("fetchAllRepoMetaGraphQL", () => {
  const repos = makeRepos(3);

  it("sends single POST to /graphql with aliased query", async () => {
    const stub = installFetchStub();
    stub.enqueue({
      status: 200,
      body: {
        data: {
          repo0: { stargazerCount: 1000, description: "Repo 0" },
          repo1: { stargazerCount: 2000, description: "Repo 1" },
          repo2: { stargazerCount: 3000, description: null },
        },
      },
    });

    await fetchAllRepoMetaGraphQL(repos, TOKEN);

    expect(stub.callCount()).toBe(1);
    stub.expectUrlStartsWith(0, "https://api.github.com/graphql");
    expect(stub.initAt(0)?.method).toBe("POST");
    const h = stub.initAt(0)?.headers as Record<string, string>;
    expect(h.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(h["Content-Type"]).toBe("application/json");

    const body = JSON.parse(stub.initAt(0)?.body as string);
    expect(body.query).toContain("repository(owner:");
    expect(body.query).toContain("stargazerCount");
  });

  it("maps GraphQL stargazerCount to stargazers_count in result", async () => {
    const stub = installFetchStub();
    stub.enqueue({
      status: 200,
      body: {
        data: {
          repo0: { stargazerCount: 1000, description: "Repo 0" },
          repo1: { stargazerCount: 2000, description: "Repo 1" },
          repo2: { stargazerCount: 3000, description: null },
        },
      },
    });

    const result = await fetchAllRepoMetaGraphQL(repos, TOKEN);

    expect(result["owner/repo0"]).toEqual({
      stargazers_count: 1000,
      description: "Repo 0",
    });
    expect(result["owner/repo1"]).toEqual({
      stargazers_count: 2000,
      description: "Repo 1",
    });
    expect(result["owner/repo2"]).toEqual({
      stargazers_count: 3000,
      description: null,
    });
  });

  it("passes signal to fetch", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 200, body: { data: {} } });
    const controller = new AbortController();

    await fetchAllRepoMetaGraphQL(repos, TOKEN, controller.signal);

    expect(stub.initAt(0)?.signal).toBe(controller.signal);
  });

  it("returns empty map on non-200 non-rate-limit status", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 401 });

    const result = await fetchAllRepoMetaGraphQL(repos, TOKEN);

    expect(result).toEqual({});
  });

  it("handles partial GraphQL data (null alias entries)", async () => {
    const stub = installFetchStub();
    stub.enqueue({
      status: 200,
      body: {
        data: {
          repo0: { stargazerCount: 1000, description: "Ok" },
          repo1: null, // this repo had an error
          repo2: { stargazerCount: 3000, description: "Also ok" },
        },
      },
    });

    const result = await fetchAllRepoMetaGraphQL(repos, TOKEN);

    expect(result["owner/repo0"]).toEqual({
      stargazers_count: 1000,
      description: "Ok",
    });
    expect(result["owner/repo1"]).toBeUndefined();
    expect(result["owner/repo2"]).toEqual({
      stargazers_count: 3000,
      description: "Also ok",
    });
  });

  it("throws RateLimitError on 403 with rate-limit body", async () => {
    const stub = installFetchStub();
    stub.enqueue({
      status: 403,
      headers: { "retry-after": "30" },
      body: { message: "API rate limit exceeded for user ID 12345." },
    });

    try {
      await fetchAllRepoMetaGraphQL(repos, TOKEN);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBe(30_000);
    }
  });

  it("throws ForbiddenError on 403 permission denied", async () => {
    const stub = installFetchStub();
    stub.enqueue({
      status: 403,
      body: { message: "Bad credentials" },
    });

    await expect(
      fetchAllRepoMetaGraphQL(repos, TOKEN),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws RateLimitError on 429", async () => {
    const stub = installFetchStub();
    stub.enqueue({ status: 429 });

    try {
      await fetchAllRepoMetaGraphQL(repos, TOKEN);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).retryAfterMs).toBeNull();
    }
  });

  it("returns empty map if owner/name contains invalid characters", async () => {
    const badRepos = [{
      owner: 'foo"} evil {',
      name: "bar",
      description: "",
      category: "Ethereum Core" as const,
      url: "https://github.com/foo/bar",
    }];
    const result = await fetchAllRepoMetaGraphQL(badRepos, TOKEN);
    expect(result).toEqual({});
  });
});
