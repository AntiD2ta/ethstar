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

import type { GitHubUser, Repository, StarStatus } from "./types";
import { repoKey } from "./repo-key";

const GITHUB_API = "https://api.github.com";
const CONCURRENT_CHECK_LIMIT = 5;
const STAR_DELAY_MS = 1000;

/**
 * Classify a 403 response by reading its body. GitHub returns 403 for both
 * secondary rate limits (body contains "rate limit") and permission errors
 * (body says "Resource not accessible" or just "Forbidden").
 * Returns "rate-limit" or "forbidden".
 */
async function classify403(resp: Response): Promise<"rate-limit" | "forbidden"> {
  try {
    const body = await resp.json() as { message?: string };
    const msg = typeof body.message === "string" ? body.message.toLowerCase() : "";
    if (msg.includes("rate limit") || msg.includes("abuse detection")) {
      return "rate-limit";
    }
  } catch {
    // Body parse failed — treat as forbidden.
  }
  return "forbidden";
}

/**
 * Handle a 403 or 429 response: 429 is always a rate limit; 403 requires
 * body inspection. Logs a diagnostic message and throws the appropriate error.
 */
async function handleForbiddenOrRateLimit(
  resp: Response,
  context: string,
): Promise<never> {
  if (resp.status === 429) {
    console.warn(`[github] ${context}: 429 rate limited`);
    throw new RateLimitError(resp.headers.get("retry-after"));
  }
  // 403 — inspect body to distinguish rate limit from permission error.
  const kind = await classify403(resp);
  if (kind === "rate-limit") {
    console.warn(`[github] ${context}: 403 secondary rate limit`);
    throw new RateLimitError(resp.headers.get("retry-after"));
  }
  console.error(`[github] ${context}: 403 permission denied (token may lack required scope)`);
  throw new ForbiddenError(context);
}

interface StarCheckResult {
  repo: Repository;
  status: StarStatus;
}

interface StarAllResult {
  starred: number;
  failed: number;
}

const BASE_HEADERS: HeadersInit = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2026-03-10",
};

function authHeaders(token: string): HeadersInit {
  return {
    ...BASE_HEADERS,
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Wrap fetch so connection failures surface as NetworkError. Browsers reject
 * fetch with a TypeError when DNS/TLS/connectivity fails — everything else
 * (HTTP status codes) resolves normally. An `AbortError` from a cancelled
 * signal is NOT a NetworkError; it's re-thrown as-is so callers can ignore it.
 */
async function networkFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new NetworkError(err);
  }
}

/** Fetch the authenticated user's profile. */
export async function getUser(token: string): Promise<GitHubUser> {
  const resp = await networkFetch(`${GITHUB_API}/user`, {
    headers: authHeaders(token),
  });

  if (resp.status === 401) {
    throw new TokenExpiredError();
  }
  if (!resp.ok) {
    throw new Error(`GitHub API error: ${resp.status}`);
  }

  return resp.json() as Promise<GitHubUser>;
}

/** Check if the authenticated user has starred a specific repo. */
export async function isStarred(
  token: string,
  owner: string,
  repo: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const resp = await networkFetch(
    `${GITHUB_API}/user/starred/${owner}/${repo}`,
    { headers: authHeaders(token), signal },
  );

  if (resp.status === 204) return true;
  if (resp.status === 404) return false;
  if (resp.status === 401) throw new TokenExpiredError();
  if (resp.status === 403 || resp.status === 429) {
    await handleForbiddenOrRateLimit(resp, `isStarred ${owner}/${repo}`);
  }
  throw new Error(`GitHub API error: ${resp.status}`);
}

/** Star a repo for the authenticated user. */
export async function starRepo(
  token: string,
  owner: string,
  repo: string,
  signal?: AbortSignal,
): Promise<void> {
  const resp = await networkFetch(
    `${GITHUB_API}/user/starred/${owner}/${repo}`,
    { method: "PUT", headers: authHeaders(token), signal },
  );

  if (resp.status === 204) return;
  if (resp.status === 401) throw new TokenExpiredError();
  if (resp.status === 403 || resp.status === 429) {
    await handleForbiddenOrRateLimit(resp, `starRepo ${owner}/${repo}`);
  }
  throw new Error(`GitHub API error: ${resp.status}`);
}

/**
 * Check star status for all repos, with concurrency limited to CONCURRENT_CHECK_LIMIT.
 * Calls onProgress after each repo is checked.
 */
export async function checkAllStars(
  token: string,
  repos: Repository[],
  onProgress?: (result: StarCheckResult) => void,
): Promise<StarCheckResult[]> {
  const results: StarCheckResult[] = [];
  const queue = [...repos];
  // AbortController cancels in-flight and pending fetches in sibling workers
  // as soon as one throws an unrecoverable error (TokenExpired/Network).
  const controller = new AbortController();

  async function processNext(): Promise<void> {
    if (controller.signal.aborted) return;
    const repo = queue.shift();
    if (!repo) return;

    let status: StarStatus;
    try {
      const starred = await isStarred(
        token,
        repo.owner,
        repo.name,
        controller.signal,
      );
      status = starred ? "starred" : "unstarred";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof TokenExpiredError || err instanceof NetworkError) {
        controller.abort();
        throw err;
      }
      status = "failed";
    }

    const result = { repo, status };
    results.push(result);
    onProgress?.(result);

    await processNext();
  }

  // Launch CONCURRENT_CHECK_LIMIT workers that pull from the shared queue.
  const workers = Array.from(
    { length: Math.min(CONCURRENT_CHECK_LIMIT, repos.length) },
    () => processNext(),
  );
  await Promise.all(workers);

  return results;
}

/**
 * Star all unstarred repos sequentially with a 1s delay between each.
 * Calls onProgress after each attempt. onRateLimit is invoked if a
 * secondary-rate-limit pause occurs, with the number of milliseconds waited.
 */
export async function starAllUnstarred(
  token: string,
  repos: Repository[],
  onProgress: (repo: Repository, status: StarStatus) => void,
  onRateLimit?: (waitMs: number) => void,
  signal?: AbortSignal,
): Promise<StarAllResult> {
  let starred = 0;
  let failed = 0;

  const isAborted = () => signal?.aborted === true;
  // Abort during an inter-repo sleep should not be treated as a real error.
  // sleepInterruptible resolves early on abort and the loop short-circuits.
  const sleepInterruptible = async (ms: number) => {
    if (isAborted()) return;
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, ms);
      const onAbort = () => {
        clearTimeout(t);
        resolve();
      };
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  };

  for (let i = 0; i < repos.length; i++) {
    if (isAborted()) break;
    const repo = repos[i];
    onProgress(repo, "starring");

    try {
      await starRepo(token, repo.owner, repo.name, signal);
      starred++;
      onProgress(repo, "starred");
    } catch (err) {
      // AbortError from the in-flight fetch — surface the "starring" state
      // back to "unstarred" so the card stops flashing, then bail out.
      if (err instanceof DOMException && err.name === "AbortError") {
        onProgress(repo, "unstarred");
        break;
      }
      if (err instanceof TokenExpiredError) throw err;
      if (err instanceof NetworkError) throw err;
      if (err instanceof ForbiddenError) throw err;
      if (err instanceof RateLimitError) {
        // Wait for retry-after then retry this repo.
        const waitMs = err.retryAfterMs ?? 60_000;
        onRateLimit?.(waitMs);
        await sleepInterruptible(waitMs);
        if (isAborted()) {
          onProgress(repo, "unstarred");
          break;
        }
        try {
          await starRepo(token, repo.owner, repo.name, signal);
          starred++;
          onProgress(repo, "starred");
        } catch (retryErr) {
          if (retryErr instanceof DOMException && retryErr.name === "AbortError") {
            onProgress(repo, "unstarred");
            break;
          }
          failed++;
          onProgress(repo, "failed");
        }
      } else {
        failed++;
        onProgress(repo, "failed");
      }
    }

    // Delay between stars to avoid abuse detection (except after the last one).
    if (i < repos.length - 1) {
      await sleepInterruptible(STAR_DELAY_MS);
    }
  }

  return { starred, failed };
}

export interface RepoMeta {
  stargazers_count: number;
  description: string | null;
}

export type RepoMetaMap = Record<string, RepoMeta>;

/**
 * Fetch public metadata for a single repository. Returns null on any error
 * (non-200, network failure) so callers can use `Promise.allSettled`-style
 * patterns without try/catch.
 */
export async function fetchRepoMeta(
  owner: string,
  name: string,
  token: string | null,
  signal?: AbortSignal,
): Promise<RepoMeta | null> {
  try {
    const headers = token ? authHeaders(token) : BASE_HEADERS;
    const resp = await networkFetch(
      `${GITHUB_API}/repos/${owner}/${name}`,
      { headers, signal },
    );

    if (resp.status === 403 || resp.status === 429) {
      await handleForbiddenOrRateLimit(resp, `fetchRepoMeta ${owner}/${name}`);
    }
    if (!resp.ok) return null;

    const data = (await resp.json()) as {
      stargazers_count?: unknown;
      description?: unknown;
    };
    if (typeof data.stargazers_count !== "number") return null;

    return {
      stargazers_count: data.stargazers_count,
      description: typeof data.description === "string" ? data.description : null,
    };
  } catch (err) {
    // AbortError is caller-initiated cancellation; RateLimitError and
    // ForbiddenError signal all remaining requests will also fail.
    // Re-throw so callers can react.
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    if (err instanceof RateLimitError) throw err;
    if (err instanceof ForbiddenError) throw err;
    return null;
  }
}

const VALID_GH_NAME = /^[a-zA-Z0-9._-]+$/;

/**
 * Fetch metadata for all repos in a single GraphQL request.
 * Requires authentication (GitHub GraphQL API does not support anonymous access).
 * Returns a map of "owner/name" → RepoMeta. Throws RateLimitError or ForbiddenError on 403/429.
 */
export async function fetchAllRepoMetaGraphQL(
  repos: Repository[],
  token: string,
  signal?: AbortSignal,
): Promise<RepoMetaMap> {
  for (const repo of repos) {
    if (!VALID_GH_NAME.test(repo.owner) || !VALID_GH_NAME.test(repo.name)) {
      return {};
    }
  }

  const fragments = repos.map((repo, i) =>
    `repo${i}: repository(owner: "${repo.owner}", name: "${repo.name}") { stargazerCount description }`,
  );
  const query = `query { ${fragments.join(" ")} }`;

  const resp = await networkFetch(`${GITHUB_API}/graphql`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
    signal,
  });

  if (resp.status === 403 || resp.status === 429) {
    await handleForbiddenOrRateLimit(resp, "fetchAllRepoMetaGraphQL");
  }
  if (!resp.ok) return {};

  const json = (await resp.json()) as {
    data?: Record<
      string,
      { stargazerCount: number; description: string | null } | null
    >;
  };

  const result: RepoMetaMap = {};
  if (json.data) {
    repos.forEach((repo, i) => {
      const entry = json.data?.[`repo${i}`];
      if (entry && typeof entry.stargazerCount === "number") {
        result[repoKey(repo)] = {
          stargazers_count: entry.stargazerCount,
          description:
            typeof entry.description === "string" ? entry.description : null,
        };
      }
    });
  }

  return result;
}

/** Thrown when the token is expired or revoked (HTTP 401). */
export class TokenExpiredError extends Error {
  constructor() {
    super("Token expired");
    this.name = "TokenExpiredError";
  }
}

/** Thrown when the network is unreachable (DNS, TLS, connectivity failures). */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super("Network error", { cause });
    this.name = "NetworkError";
  }
}

/** Thrown when GitHub's secondary rate limit is hit (HTTP 429 or 403 with rate-limit body). */
export class RateLimitError extends Error {
  retryAfterMs: number | null;

  constructor(retryAfter: string | null) {
    super("Rate limited");
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : null;
  }
}

/**
 * Thrown when GitHub returns 403 for permission reasons (not rate limiting).
 * Typically means the token lacks the required scope (e.g., Starring: Read
 * instead of Read & Write on the GitHub App).
 */
export class ForbiddenError extends Error {
  constructor(context: string) {
    super(`Permission denied: ${context}`);
    this.name = "ForbiddenError";
  }
}
