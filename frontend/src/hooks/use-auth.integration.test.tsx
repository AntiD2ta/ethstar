import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { renderHookWithAuth, STORAGE_KEY } from "@/test/render";
import { useAuth } from "./auth-context";
import { installFetchStub } from "@/test/fetch-stub";
import type { FetchStub } from "@/test/fetch-stub";

const spy = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/github", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/github")>("@/lib/github");
  return {
    ...actual,
    getUser: spy.getUser,
  };
});

function storedAuth(): {
  access_token: string;
  expires_at: number;
  refresh_token: string;
  user: unknown;
} | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe("AuthProvider — URL hash flow", () => {
  let fetchStub: FetchStub;

  beforeEach(() => {
    fetchStub = installFetchStub();
    spy.getUser.mockReset();
  });
  afterEach(() => {
    fetchStub.reset();
  });

  it("parses hash, fetches profile, stores auth, clears hash", async () => {
    window.history.replaceState(
      null,
      "",
      "/#access_token=t1&expires_in=28800&refresh_token=r1",
    );
    spy.getUser.mockResolvedValue({
      login: "alice",
      avatar_url: "a",
      name: "Alice",
    });

    const { result } = renderHookWithAuth(() => useAuth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.token).toBe("t1");
    expect(result.current.user?.login).toBe("alice");
    expect(result.current.isAuthenticated).toBe(true);
    expect(window.location.hash).toBe("");
    expect(storedAuth()?.access_token).toBe("t1");
    expect(storedAuth()?.refresh_token).toBe("r1");
    expect(spy.getUser).toHaveBeenCalledWith("t1");
  });

  it("recovers token after StrictMode double-mount (hash cleared, localStorage persisted)", async () => {
    // Simulate the StrictMode race: first mount reads hash, clears it, starts
    // async getUser. StrictMode unmounts (cancelling the async). Second mount
    // finds hash gone but token saved in localStorage by the early saveAuth().
    window.history.replaceState(
      null,
      "",
      "/#access_token=t2&expires_in=28800&refresh_token=r2",
    );

    // Slow getUser — won't resolve before we unmount.
    let resolveGetUser: (user: { login: string; avatar_url: string; name: string }) => void;
    spy.getUser.mockImplementationOnce(
      () => new Promise((resolve) => { resolveGetUser = resolve; }),
    );

    // First mount — reads hash, clears it, calls saveAuth, starts getUser.
    const { unmount } = renderHookWithAuth(() => useAuth());

    // Hash should be cleared synchronously.
    expect(window.location.hash).toBe("");

    // Token should already be in localStorage (early saveAuth).
    expect(storedAuth()?.access_token).toBe("t2");

    // Unmount before getUser resolves (simulates StrictMode cleanup).
    unmount();

    // Resolve the dangling getUser — cancelled flag prevents state updates.
    resolveGetUser!({ login: "alice", avatar_url: "a", name: "Alice" });
    await new Promise((r) => setTimeout(r, 10));

    // Second mount — hash is gone, but loadAuth() finds the persisted token.
    spy.getUser.mockResolvedValue({ login: "alice", avatar_url: "a", name: "Alice" });
    const { result } = renderHookWithAuth(() => useAuth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.token).toBe("t2");
    expect(result.current.user?.login).toBe("alice");
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("clears auth if hash token is invalid (getUser throws)", async () => {
    window.history.replaceState(
      null,
      "",
      "/#access_token=bad&expires_in=28800&refresh_token=r1",
    );
    const { TokenExpiredError } = await import("@/lib/github");
    spy.getUser.mockRejectedValue(new TokenExpiredError());

    const { result } = renderHookWithAuth(() => useAuth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(storedAuth()).toBeNull();
  });
});

describe("AuthProvider — localStorage flows", () => {
  let fetchStub: FetchStub;

  beforeEach(() => {
    fetchStub = installFetchStub();
    spy.getUser.mockReset();
  });
  afterEach(() => {
    fetchStub.reset();
  });

  it("loads valid cached token and refreshes profile in background", async () => {
    spy.getUser.mockResolvedValue({
      login: "bob",
      avatar_url: "b",
      name: "Bob",
    });

    const { result } = renderHookWithAuth(() => useAuth(), {
      seed: {
        access_token: "cached",
        expires_at: Date.now() + 3600_000,
        user: { login: "stale", avatar_url: "", name: "Stale" },
      },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.token).toBe("cached");
    await waitFor(() => expect(result.current.user?.login).toBe("bob"));
  });

  it("calls /api/auth/refresh when cached token is expired", async () => {
    fetchStub.enqueue({
      status: 200,
      body: {
        access_token: "new",
        expires_in: 28800,
        refresh_token: "new_r",
      },
    });
    spy.getUser.mockResolvedValue({
      login: "cara",
      avatar_url: "c",
      name: "Cara",
    });

    const { result } = renderHookWithAuth(() => useAuth(), {
      seed: {
        access_token: "old",
        expires_at: Date.now() - 1000,
        refresh_token: "r1",
        user: null,
      },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.token).toBe("new");
    expect(fetchStub.urlAt(0)).toContain("/api/auth/refresh");
    expect(fetchStub.initAt(0)?.method).toBe("POST");
    expect(storedAuth()?.access_token).toBe("new");
    expect(storedAuth()?.refresh_token).toBe("new_r");
    await waitFor(() => expect(result.current.user?.login).toBe("cara"));
  });

  it("clears auth when refresh returns 401", async () => {
    fetchStub.enqueue({ status: 401 });

    const { result } = renderHookWithAuth(() => useAuth(), {
      seed: {
        access_token: "old",
        expires_at: Date.now() - 1000,
        refresh_token: "bad_r",
        user: null,
      },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(storedAuth()).toBeNull();
  });

  it("clears auth when cached token is expired and no refresh token", async () => {
    const { result } = renderHookWithAuth(() => useAuth(), {
      seed: {
        access_token: "old",
        expires_at: Date.now() - 1000,
        refresh_token: "",
        user: null,
      },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.token).toBeNull();
    expect(storedAuth()).toBeNull();
  });

  it("unmount during refresh cancels post-unmount state updates", async () => {
    // Slow refresh fetch that we resolve manually after unmount.
    let resolveRefresh: (r: Response) => void = () => {};
    fetchStub.spy.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result, unmount } = renderHookWithAuth(() => useAuth(), {
      seed: {
        access_token: "old",
        expires_at: Date.now() - 1000,
        refresh_token: "r1",
        user: null,
      },
    });

    // Unmount before the refresh resolves.
    unmount();

    // Now resolve the refresh — the hook's cancelled flag should prevent
    // any state updates or further getUser calls.
    resolveRefresh(
      new Response(
        JSON.stringify({
          access_token: "new",
          expires_in: 28800,
          refresh_token: "new_r",
        }),
        { status: 200 },
      ),
    );

    // Give microtasks a chance to run.
    await new Promise((r) => setTimeout(r, 10));

    // No "act(...)" warning should have been produced by the cancelled fetch.
    const actWarnings = consoleError.mock.calls.filter((args) =>
      args.some((a) => typeof a === "string" && a.includes("act(")),
    );
    expect(actWarnings).toHaveLength(0);

    // The stored auth remains the expired seed — cancellation means no save.
    const stored = storedAuth();
    expect(stored?.access_token).toBe("old");
    // Result is a snapshot from the last successful render — not re-read after unmount.
    expect(result.current).toBeDefined();

    consoleError.mockRestore();
  });

  it("no localStorage and no hash → unauthenticated, not loading", async () => {
    const { result } = renderHookWithAuth(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe("AuthProvider — login/logout", () => {
  let fetchStub: FetchStub;

  beforeEach(() => {
    fetchStub = installFetchStub();
    spy.getUser.mockReset();
  });
  afterEach(() => {
    fetchStub.reset();
  });

  it("login() navigates to /api/auth/github", async () => {
    const { result } = renderHookWithAuth(() => useAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const hrefSetter = vi.fn();
    const originalHref = window.location.href;
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      window.location,
      "href",
    );
    Object.defineProperty(window.location, "href", {
      configurable: true,
      get: () => originalHref,
      set: hrefSetter,
    });

    try {
      act(() => {
        result.current.login();
      });
      expect(hrefSetter).toHaveBeenCalledWith("/api/auth/github");
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(window.location, "href", originalDescriptor);
      } else {
        delete (window.location as unknown as Record<string, unknown>).href;
      }
    }
  });

  it("refreshToken() returns new access token on success", async () => {
    spy.getUser.mockResolvedValue({
      login: "eve",
      avatar_url: "e",
      name: "Eve",
    });

    const { result } = renderHookWithAuth(() => useAuth(), {
      seed: {
        access_token: "old",
        expires_at: Date.now() + 3600_000,
        refresh_token: "r1",
        user: { login: "eve", avatar_url: "e", name: "Eve" },
      },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Now enqueue a refresh response that will be fetched when refreshToken() is called.
    fetchStub.enqueue({
      status: 200,
      body: {
        access_token: "refreshed",
        expires_in: 28800,
        refresh_token: "r2",
      },
    });

    let returned: string | null = null;
    await act(async () => {
      returned = await result.current.refreshToken();
    });

    expect(returned).toBe("refreshed");
    expect(result.current.token).toBe("refreshed");
    expect(storedAuth()?.access_token).toBe("refreshed");
    expect(storedAuth()?.refresh_token).toBe("r2");
  });

  it("refreshToken() returns null and logs out on failure", async () => {
    spy.getUser.mockResolvedValue({
      login: "frank",
      avatar_url: "f",
      name: "Frank",
    });

    const { result } = renderHookWithAuth(() => useAuth(), {
      seed: {
        access_token: "old",
        expires_at: Date.now() + 3600_000,
        refresh_token: "r1",
        user: { login: "frank", avatar_url: "f", name: "Frank" },
      },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    fetchStub.enqueue({ status: 401 });

    let returned: string | null = "sentinel";
    await act(async () => {
      returned = await result.current.refreshToken();
    });

    expect(returned).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(storedAuth()).toBeNull();
  });

  it("refreshToken() returns null when no refresh_token stored", async () => {
    spy.getUser.mockResolvedValue({
      login: "gina",
      avatar_url: "g",
      name: "Gina",
    });

    const { result } = renderHookWithAuth(() => useAuth(), {
      seed: {
        access_token: "old",
        expires_at: Date.now() + 3600_000,
        refresh_token: "",
        user: { login: "gina", avatar_url: "g", name: "Gina" },
      },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let returned: string | null = "sentinel";
    await act(async () => {
      returned = await result.current.refreshToken();
    });

    expect(returned).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it("logout() clears localStorage and resets state", async () => {
    spy.getUser.mockResolvedValue({
      login: "dave",
      avatar_url: "d",
      name: "Dave",
    });

    const { result } = renderHookWithAuth(() => useAuth(), {
      seed: {
        access_token: "t",
        expires_at: Date.now() + 3600_000,
        user: { login: "dave", avatar_url: "d", name: "Dave" },
      },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(storedAuth()).toBeNull();
  });
});
