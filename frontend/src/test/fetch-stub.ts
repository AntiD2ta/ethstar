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

import { vi, expect, type MockInstance } from "vitest";

type FetchArgs = Parameters<typeof fetch>;
type FetchReturn = ReturnType<typeof fetch>;

/**
 * A single response to queue. Either a Response-like object or a function
 * computing one from the request arguments.
 */
export interface ResponseSpec {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

type ResponseFn = (input: FetchArgs[0], init: FetchArgs[1]) => ResponseSpec | Response;
type QueuedResponse = ResponseSpec | ResponseFn | Response | Error;

function makeResponse(spec: ResponseSpec): Response {
  const { status, body, headers } = spec;
  const bodyStr =
    body === undefined
      ? null
      : typeof body === "string"
        ? body
        : JSON.stringify(body);
  return new Response(bodyStr, { status, headers });
}

export interface FetchStub {
  spy: MockInstance<(input: FetchArgs[0], init?: FetchArgs[1]) => FetchReturn>;
  queue: QueuedResponse[];
  /** Append one or more responses to the queue. */
  enqueue: (...responses: QueuedResponse[]) => void;
  /** The fetch URL at the Nth call (0-indexed). */
  urlAt: (n: number) => string;
  /** The init object at the Nth call. */
  initAt: (n: number) => FetchArgs[1];
  /** Assert the Nth call hit a specific URL (startsWith match). */
  expectUrlStartsWith: (n: number, prefix: string) => void;
  /** Number of calls made. */
  callCount: () => number;
  /** Reset call history but keep the spy installed. */
  reset: () => void;
}

/**
 * Install a fetch spy that responds from a queue. Responses are consumed in
 * FIFO order. If the queue is empty, the spy throws a descriptive error.
 */
export function installFetchStub(): FetchStub {
  const queue: QueuedResponse[] = [];

  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(
    async (input: FetchArgs[0], init?: FetchArgs[1]) => {
      const next = queue.shift();
      if (next === undefined) {
        throw new Error(
          `fetch stub: no response queued for ${String(input)}`,
        );
      }
      if (next instanceof Error) throw next;
      if (next instanceof Response) return next;
      if (typeof next === "function") {
        const result = next(input, init);
        return result instanceof Response ? result : makeResponse(result);
      }
      return makeResponse(next);
    },
  );

  return {
    spy,
    queue,
    enqueue: (...responses: QueuedResponse[]) => {
      queue.push(...responses);
    },
    urlAt: (n: number) => {
      const call = spy.mock.calls[n];
      if (!call) throw new Error(`fetch stub: no call at index ${n}`);
      return String(call[0]);
    },
    initAt: (n: number) => {
      const call = spy.mock.calls[n];
      if (!call) throw new Error(`fetch stub: no call at index ${n}`);
      return call[1];
    },
    expectUrlStartsWith: (n: number, prefix: string) => {
      const call = spy.mock.calls[n];
      expect(call, `fetch call #${n}`).toBeDefined();
      expect(String(call[0])).toMatch(new RegExp("^" + escapeRegex(prefix)));
    },
    callCount: () => spy.mock.calls.length,
    reset: () => {
      // In-place truncation via `.length = 0` — mutates the existing array
      // instead of reassigning, so any external references stay in sync.
      spy.mock.calls.length = 0;
      queue.length = 0;
    },
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
