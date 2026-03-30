import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useStats, CACHE_KEY, PENDING_KEY } from "./use-stats";
import { installFetchStub } from "@/test/fetch-stub";
import type { FetchStub } from "@/test/fetch-stub";

describe("useStats — mount fetch", () => {
  let fetchStub: FetchStub;

  beforeEach(() => {
    fetchStub = installFetchStub();
  });
  afterEach(() => {
    fetchStub.reset();
  });

  it("fetches /api/stats on mount and populates state + cache", async () => {
    fetchStub.enqueue({
      status: 200,
      body: { total_stars: 100, total_users: 7 },
    });

    const { result } = renderHook(() => useStats());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stats).toEqual({
      totalStars: 100,
      totalUsers: 7,
    });
    expect(fetchStub.urlAt(0)).toContain("/api/stats");

    const cached = localStorage.getItem(CACHE_KEY);
    expect(cached).toBeTruthy();
    expect(JSON.parse(cached!)).toEqual({
      totalStars: 100,
      totalUsers: 7,
    });
  });

  it("falls back to cache on fetch failure", async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ totalStars: 50, totalUsers: 3 }),
    );
    fetchStub.enqueue({ status: 500 });

    const { result } = renderHook(() => useStats());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stats).toEqual({
      totalStars: 50,
      totalUsers: 3,
    });
  });

  it("stats stays null when fetch fails and no cache", async () => {
    fetchStub.enqueue({ status: 500 });

    const { result } = renderHook(() => useStats());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stats).toBeNull();
  });

  it("falls back to cache on network error", async () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ totalStars: 20, totalUsers: 1 }),
    );
    fetchStub.enqueue(new Error("offline"));

    const { result } = renderHook(() => useStats());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stats).toEqual({
      totalStars: 20,
      totalUsers: 1,
    });
  });
});

describe("useStats — reportStars", () => {
  let fetchStub: FetchStub;

  beforeEach(() => {
    fetchStub = installFetchStub();
  });
  afterEach(() => {
    fetchStub.reset();
  });

  it("fires POST /api/stats and updates local state + cache", async () => {
    fetchStub.enqueue({
      status: 200,
      body: { total_stars: 100, total_users: 7 },
    });
    fetchStub.enqueue({ status: 200, body: { ok: true } });

    const { result } = renderHook(() => useStats());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.reportStars(5, "test-token");
    });

    expect(result.current.stats).toEqual({
      totalStars: 105,
      totalUsers: 8,
    });

    // Wait for fire-and-forget POST to land.
    await waitFor(() => expect(fetchStub.callCount()).toBe(2));
    expect(fetchStub.urlAt(1)).toContain("/api/stats");
    expect(fetchStub.initAt(1)?.method).toBe("POST");
    const body = fetchStub.initAt(1)?.body;
    expect(typeof body).toBe("string");
    expect(JSON.parse(body as string)).toEqual({ stars: 5 });

    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    expect(cached).toEqual({ totalStars: 105, totalUsers: 8 });
  });

  it("reportStars silently ignores POST failures", async () => {
    fetchStub.enqueue({
      status: 200,
      body: { total_stars: 10, total_users: 1 },
    });
    fetchStub.enqueue(new Error("network down"));

    const { result } = renderHook(() => useStats());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.reportStars(3, "test-token");
    });

    // Local state still updated optimistically.
    expect(result.current.stats).toEqual({
      totalStars: 13,
      totalUsers: 2,
    });
  });

  it("queues pending stars in localStorage when POST fails", async () => {
    fetchStub.enqueue({
      status: 200,
      body: { total_stars: 10, total_users: 1 },
    });
    fetchStub.enqueue(new Error("network down"));

    const { result } = renderHook(() => useStats());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.reportStars(3, "test-token");
    });

    // Wait for the failed POST to settle.
    await waitFor(() => expect(fetchStub.callCount()).toBe(2));

    // Pending stars should be saved in localStorage.
    const pending = localStorage.getItem(PENDING_KEY);
    expect(pending).toBe("3");
  });

  it("flushes pending stars on next successful POST", async () => {
    // Seed pending stars from a previous failed POST.
    localStorage.setItem(PENDING_KEY, "3");

    fetchStub.enqueue({
      status: 200,
      body: { total_stars: 10, total_users: 1 },
    });
    fetchStub.enqueue({ status: 200, body: { ok: true } });

    const { result } = renderHook(() => useStats());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.reportStars(5, "test-token");
    });

    // Wait for POST to land.
    await waitFor(() => expect(fetchStub.callCount()).toBe(2));

    // POST should include both new (5) + pending (3) = 8.
    const body = fetchStub.initAt(1)?.body;
    expect(JSON.parse(body as string)).toEqual({ stars: 8 });

    // Pending should be cleared after success.
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it("sends Authorization header with the token in POST", async () => {
    fetchStub.enqueue({
      status: 200,
      body: { total_stars: 10, total_users: 1 },
    });
    fetchStub.enqueue({ status: 200, body: { ok: true } });

    const { result } = renderHook(() => useStats());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.reportStars(5, "ghu_abc123");
    });

    await waitFor(() => expect(fetchStub.callCount()).toBe(2));
    const headers = fetchStub.initAt(1)?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer ghu_abc123");
  });

  it("omits Authorization header when token is null", async () => {
    fetchStub.enqueue({
      status: 200,
      body: { total_stars: 10, total_users: 1 },
    });
    fetchStub.enqueue({ status: 200, body: { ok: true } });

    const { result } = renderHook(() => useStats());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.reportStars(5, null);
    });

    await waitFor(() => expect(fetchStub.callCount()).toBe(2));
    const headers = fetchStub.initAt(1)?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("reportStars is a no-op on state when stats is null", async () => {
    fetchStub.enqueue({ status: 500 });
    fetchStub.enqueue({ status: 200, body: { ok: true } });

    const { result } = renderHook(() => useStats());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stats).toBeNull();

    act(() => {
      result.current.reportStars(2, "test-token");
    });

    expect(result.current.stats).toBeNull();
  });
});
