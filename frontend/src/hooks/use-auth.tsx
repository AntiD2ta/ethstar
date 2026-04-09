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
import type { ReactNode } from "react";
import { getUser, TokenExpiredError } from "@/lib/github";
import type { GitHubUser } from "@/lib/types";
import { AuthContext } from "./auth-context";

const STORAGE_KEY = "ethstar_auth";

interface StoredAuth {
  access_token: string;
  expires_at: number;
  refresh_token: string;
  user: GitHubUser | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Track in-flight refresh to avoid concurrent refresh requests if both the
  // init effect and useStars hit 401 near-simultaneously.
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  // Restore or initialize auth state on mount.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // 1. Check URL fragment for returning OAuth flow.
        const hashAuth = parseHashParams();
        if (hashAuth) {
          // Clear hash from URL immediately.
          window.history.replaceState(null, "", window.location.pathname);

          const expiresAt = Date.now() + hashAuth.expires_in * 1000;
          const stored: StoredAuth = {
            access_token: hashAuth.access_token,
            expires_at: expiresAt,
            refresh_token: hashAuth.refresh_token,
            user: null,
          };

          // Persist BEFORE async work so StrictMode's second mount
          // recovers via loadAuth() even if this mount gets cancelled.
          saveAuth(stored);

          try {
            const profile = await getUser(hashAuth.access_token);
            if (cancelled) return;
            stored.user = profile;
            saveAuth(stored);
            setToken(hashAuth.access_token);
            setUser(profile);
          } catch {
            if (cancelled) return;
            // Token from OAuth was already invalid — clear everything.
            clearAuth();
            setToken(null);
          }
          return;
        }

        // 2. Check localStorage for existing session.
        const stored = loadAuth();
        if (!stored) return;

        if (stored.expires_at > Date.now()) {
          // Token still valid — use it. Refresh user profile in background.
          setToken(stored.access_token);
          setUser(stored.user);

          try {
            const profile = await getUser(stored.access_token);
            if (cancelled) return;
            stored.user = profile;
            saveAuth(stored);
            setUser(profile);
          } catch (err) {
            if (cancelled) return;
            if (err instanceof TokenExpiredError) {
              // Token was revoked server-side despite not being expired locally.
              await tryRefresh(stored);
            }
            // Other errors: keep using cached user, token might still work.
          }
        } else {
          // Token expired — try refresh.
          await tryRefresh(stored);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    async function tryRefresh(stored: StoredAuth) {
      if (!stored.refresh_token) {
        clearAuth();
        setToken(null);
        setUser(null);
        return;
      }

      try {
        const refreshed = await refreshAccessToken(stored.refresh_token);
        if (cancelled) return;

        const newStored: StoredAuth = {
          access_token: refreshed.access_token,
          expires_at: Date.now() + refreshed.expires_in * 1000,
          refresh_token: refreshed.refresh_token || stored.refresh_token,
          user: stored.user,
        };

        // Fetch fresh profile with new token.
        try {
          const profile = await getUser(refreshed.access_token);
          if (cancelled) return;
          newStored.user = profile;
        } catch {
          // Use cached user if profile fetch fails.
        }

        if (cancelled) return;
        saveAuth(newStored);
        setToken(newStored.access_token);
        setUser(newStored.user);
      } catch {
        if (cancelled) return;
        // Refresh failed — user must re-auth.
        clearAuth();
        setToken(null);
        setUser(null);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    window.location.href = "/api/auth/github";
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setToken(null);
    setUser(null);
  }, []);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const task = (async () => {
      const stored = loadAuth();
      if (!stored || !stored.refresh_token) {
        clearAuth();
        setToken(null);
        setUser(null);
        return null;
      }

      try {
        const refreshed = await refreshAccessToken(stored.refresh_token);
        const newStored: StoredAuth = {
          access_token: refreshed.access_token,
          expires_at: Date.now() + refreshed.expires_in * 1000,
          refresh_token: refreshed.refresh_token || stored.refresh_token,
          user: stored.user,
        };
        saveAuth(newStored);
        setToken(newStored.access_token);
        setUser(newStored.user);
        return newStored.access_token;
      } catch {
        clearAuth();
        setToken(null);
        setUser(null);
        return null;
      }
    })();

    refreshInFlight.current = task;
    try {
      return await task;
    } finally {
      refreshInFlight.current = null;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: token !== null,
      isLoading,
      login,
      logout,
      refreshToken,
    }),
    [user, token, isLoading, login, logout, refreshToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// --- Helpers ---

interface HashParams {
  access_token: string;
  expires_in: number;
  refresh_token: string;
}

function parseHashParams(): HashParams | null {
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return null;

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get("access_token");
  const expiresIn = params.get("expires_in");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !expiresIn) return null;

  return {
    access_token: accessToken,
    expires_in: parseInt(expiresIn, 10),
    refresh_token: refreshToken ?? "",
  };
}

function loadAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidStoredAuth(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isValidStoredAuth(v: unknown): v is StoredAuth {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.access_token === "string" &&
    typeof o.expires_at === "number" &&
    typeof o.refresh_token === "string"
  );
}

function saveAuth(auth: StoredAuth): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

function clearAuth(): void {
  localStorage.removeItem(STORAGE_KEY);
}

interface RefreshResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
}

async function refreshAccessToken(
  refreshToken: string,
): Promise<RefreshResponse> {
  const resp = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!resp.ok) {
    throw new Error(`Refresh failed: ${resp.status}`);
  }

  return resp.json() as Promise<RefreshResponse>;
}
