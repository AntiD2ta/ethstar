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

import { vi } from "vitest";
import type { GitHubUser, Repository, StarStatus } from "@/lib/types";
// Real error classes are re-used, not mocked.
import { RateLimitError, TokenExpiredError } from "@/lib/github";

export { RateLimitError, TokenExpiredError };

export interface StarCheckResult {
  repo: Repository;
  status: StarStatus;
}

export interface StarAllResult {
  starred: number;
  failed: number;
}

export interface GithubSpyOverrides {
  getUser?: (token: string) => Promise<GitHubUser>;
  isStarred?: (token: string, owner: string, name: string) => Promise<boolean>;
  starRepo?: (token: string, owner: string, name: string, signal?: AbortSignal) => Promise<void>;
  checkAllStars?: (
    token: string,
    repos: Repository[],
    onProgress?: (result: StarCheckResult) => void,
  ) => Promise<StarCheckResult[]>;
  starAllUnstarred?: (
    token: string,
    repos: Repository[],
    onProgress: (repo: Repository, status: StarStatus) => void,
    onRateLimit?: (waitMs: number) => void,
    signal?: AbortSignal,
  ) => Promise<StarAllResult>;
}

const defaultUser: GitHubUser = {
  login: "testuser",
  avatar_url: "https://example.com/avatar.png",
  name: "Test User",
};

/**
 * Build a mock module object that replaces @/lib/github. Each function has a
 * sensible happy-path default unless overridden. Real error classes are
 * re-exported from the actual module so `instanceof` checks still work.
 */
export function createGithubSpy(overrides: GithubSpyOverrides = {}) {
  const getUser = vi.fn(
    overrides.getUser ?? (async () => defaultUser),
  );
  const isStarred = vi.fn(
    overrides.isStarred ?? (async () => false),
  );
  const starRepo = vi.fn(
    overrides.starRepo ?? (async () => undefined),
  );
  const checkAllStars = vi.fn(
    overrides.checkAllStars ??
      (async (
        _token: string,
        repos: Repository[],
        onProgress?: (r: StarCheckResult) => void,
      ) => {
        const results: StarCheckResult[] = [];
        for (const repo of repos) {
          const result: StarCheckResult = { repo, status: "unstarred" };
          results.push(result);
          onProgress?.(result);
        }
        return results;
      }),
  );
  const starAllUnstarred = vi.fn(
    overrides.starAllUnstarred ??
      (async (
        _token: string,
        repos: Repository[],
        onProgress: (repo: Repository, status: StarStatus) => void,
        // The `onRateLimit` 4th param is accepted on the signature type but
        // not exercised by the default happy-path mock (no rate-limit here).
        // Tests that need to assert on rate-limit can pass a custom override.
      ) => {
        for (const repo of repos) {
          onProgress(repo, "starring");
          onProgress(repo, "starred");
        }
        return { starred: repos.length, failed: 0 };
      }),
  );

  return {
    getUser,
    isStarred,
    starRepo,
    checkAllStars,
    starAllUnstarred,
    TokenExpiredError,
    RateLimitError,
  };
}

export type GithubSpy = ReturnType<typeof createGithubSpy>;
