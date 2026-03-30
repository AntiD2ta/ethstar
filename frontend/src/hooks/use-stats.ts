import { useCallback, useEffect, useState } from "react";

export const CACHE_KEY = "ethstar_stats_cache";
export const PENDING_KEY = "ethstar_pending_stats";

interface Stats {
  totalStars: number;
  totalUsers: number;
}

interface UseStatsReturn {
  stats: Stats | null;
  isLoading: boolean;
  reportStars: (count: number, token: string | null) => void;
}

export function useStats(): UseStatsReturn {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const resp = await fetch("/api/stats");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const data = (await resp.json()) as {
          total_stars: number;
          total_users: number;
        };
        if (cancelled) return;

        const result: Stats = {
          totalStars: data.total_stars,
          totalUsers: data.total_users,
        };
        setStats(result);
        // Cache for offline/fallback use.
        localStorage.setItem(CACHE_KEY, JSON.stringify(result));
      } catch {
        if (cancelled) return;
        // Fall back to cached stats.
        const cached = loadCachedStats();
        if (cached) setStats(cached);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const reportStars = useCallback((count: number, token: string | null) => {
    // Include any previously pending (failed) stars in this POST.
    const pending = loadPendingStars();
    const totalToReport = count + pending;

    // Build headers — include auth token so the server can verify the caller.
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Fire-and-forget POST to increment the counter.
    fetch("/api/stats", {
      method: "POST",
      headers,
      body: JSON.stringify({ stars: totalToReport }),
    })
      .then((resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        // Flush succeeded — clear any pending delta.
        localStorage.removeItem(PENDING_KEY);
      })
      .catch(() => {
        // POST failed — queue delta so it's flushed on next success.
        savePendingStars(totalToReport);
      });

    // Optimistically update local state.
    setStats((prev) => {
      if (!prev) return prev;
      return {
        totalStars: prev.totalStars + count,
        totalUsers: prev.totalUsers + 1,
      };
    });

    // Persist to cache for offline fallback.
    const current = loadCachedStats();
    if (current) {
      const updated = {
        totalStars: current.totalStars + count,
        totalUsers: current.totalUsers + 1,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
    }
  }, []);

  return { stats, isLoading, reportStars };
}

function loadCachedStats(): Stats | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof parsed.totalStars !== "number" ||
      typeof parsed.totalUsers !== "number"
    ) {
      return null;
    }
    return { totalStars: parsed.totalStars, totalUsers: parsed.totalUsers };
  } catch {
    return null;
  }
}

function loadPendingStars(): number {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return 0;
    const val = parseInt(raw, 10);
    return Number.isFinite(val) ? val : 0;
  } catch {
    return 0;
  }
}

function savePendingStars(count: number): void {
  try {
    localStorage.setItem(PENDING_KEY, count.toString());
  } catch {
    // localStorage full or unavailable — silently drop.
  }
}
