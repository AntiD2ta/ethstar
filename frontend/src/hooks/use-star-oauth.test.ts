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
import { act, renderHook } from "@testing-library/react";
import { useStarOAuth } from "./use-star-oauth";

describe("useStarOAuth", () => {
  let openSpy: ReturnType<typeof vi.fn<typeof window.open>>;
  let addEventSpy: ReturnType<typeof vi.fn>;
  let removeEventSpy: ReturnType<typeof vi.fn>;
  let originalOpen: typeof window.open;

  beforeEach(() => {
    vi.useFakeTimers();
    openSpy = vi.fn<typeof window.open>();
    originalOpen = window.open;
    window.open = openSpy;
    addEventSpy = vi.spyOn(window, "addEventListener");
    removeEventSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    vi.useRealTimers();
    window.open = originalOpen;
  });

  it("returns isWaiting=false initially", () => {
    const { result } = renderHook(() => useStarOAuth());
    expect(result.current.isWaiting).toBe(false);
  });

  it("opens popup and resolves with token on postMessage", async () => {
    const fakePopup = { closed: false, close: vi.fn() } as unknown as Window & { closed: boolean; close: ReturnType<typeof vi.fn> };
    openSpy.mockReturnValue(fakePopup);

    const { result } = renderHook(() => useStarOAuth());

    let tokenPromise: Promise<string>;
    act(() => {
      tokenPromise = result.current.requestToken();
    });

    expect(result.current.isWaiting).toBe(true);
    expect(openSpy).toHaveBeenCalledWith(
      "/api/auth/star",
      "ethstar-star-auth",
      expect.any(String),
    );

    // Simulate postMessage from popup
    const messageHandler = addEventSpy.mock.calls.find(
      (c) => c[0] === "message",
    )?.[1];
    expect(messageHandler).toBeDefined();

    act(() => {
      messageHandler({
        origin: window.location.origin,
        data: { type: "ethstar-star-token", access_token: "gho_test123" },
      } as MessageEvent);
    });

    const token = await tokenPromise!;
    expect(token).toBe("gho_test123");
    expect(result.current.isWaiting).toBe(false);
  });

  it("rejects when popup is blocked", async () => {
    openSpy.mockReturnValue(null);

    const { result } = renderHook(() => useStarOAuth());

    await expect(
      act(() => result.current.requestToken()),
    ).rejects.toThrow("popup_blocked");
    expect(result.current.isWaiting).toBe(false);
  });

  it("rejects when user closes popup", async () => {
    const fakePopup = { closed: false, close: vi.fn() } as unknown as Window & { closed: boolean; close: ReturnType<typeof vi.fn> };
    openSpy.mockReturnValue(fakePopup);

    const { result } = renderHook(() => useStarOAuth());

    let tokenPromise: Promise<string>;
    act(() => {
      tokenPromise = result.current.requestToken();
    });

    // Simulate user closing popup
    fakePopup.closed = true;

    // Attach rejects assertion BEFORE advancing timers to avoid unhandled-rejection blip
    const rejectsPromise = expect(tokenPromise!).rejects.toThrow("popup_closed");

    // Advance past the poll interval (500ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    await rejectsPromise;
    expect(result.current.isWaiting).toBe(false);
  });

  it("rejects on 5-minute timeout", async () => {
    const fakePopup = { closed: false, close: vi.fn() } as unknown as Window & { closed: boolean; close: ReturnType<typeof vi.fn> };
    openSpy.mockReturnValue(fakePopup);

    const { result } = renderHook(() => useStarOAuth());

    let tokenPromise: Promise<string>;
    act(() => {
      tokenPromise = result.current.requestToken();
    });

    // Attach rejects assertion BEFORE advancing timers
    const rejectsPromise = expect(tokenPromise!).rejects.toThrow("timeout");

    // Advance past 5 minutes
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);
    });

    await rejectsPromise;
    expect(fakePopup.close).toHaveBeenCalled();
    expect(result.current.isWaiting).toBe(false);
  });

  it("cancel() closes popup and rejects promise", async () => {
    const fakePopup = { closed: false, close: vi.fn() } as unknown as Window & { closed: boolean; close: ReturnType<typeof vi.fn> };
    openSpy.mockReturnValue(fakePopup);

    const { result } = renderHook(() => useStarOAuth());

    let tokenPromise: Promise<string>;
    act(() => {
      tokenPromise = result.current.requestToken();
    });

    act(() => {
      result.current.cancel();
    });

    await expect(tokenPromise!).rejects.toThrow("cancelled");
    expect(fakePopup.close).toHaveBeenCalled();
    expect(result.current.isWaiting).toBe(false);
  });

  it("ignores postMessage from a different origin", async () => {
    const fakePopup = { closed: false, close: vi.fn() } as unknown as Window & { closed: boolean; close: ReturnType<typeof vi.fn> };
    openSpy.mockReturnValue(fakePopup);

    const { result } = renderHook(() => useStarOAuth());

    let tokenPromise: Promise<string>;
    act(() => {
      tokenPromise = result.current.requestToken();
    });

    // Send correct message type but from a different origin
    const messageHandler = addEventSpy.mock.calls.find(
      (c) => c[0] === "message",
    )?.[1];
    expect(messageHandler).toBeDefined();

    act(() => {
      messageHandler({
        origin: "https://evil.example.com",
        data: { type: "ethstar-star-token", access_token: "gho_stolen" },
      } as MessageEvent);
    });

    // Should still be waiting — the message was ignored
    expect(result.current.isWaiting).toBe(true);

    // Now send from correct origin
    act(() => {
      messageHandler({
        origin: window.location.origin,
        data: { type: "ethstar-star-token", access_token: "gho_legit" },
      } as MessageEvent);
    });

    const token = await tokenPromise!;
    expect(token).toBe("gho_legit");
  });

  it("ignores postMessage with wrong type", async () => {
    const fakePopup = { closed: false, close: vi.fn() } as unknown as Window & { closed: boolean; close: ReturnType<typeof vi.fn> };
    openSpy.mockReturnValue(fakePopup);

    const { result } = renderHook(() => useStarOAuth());

    let tokenPromise: Promise<string>;
    act(() => {
      tokenPromise = result.current.requestToken();
    });

    // Send wrong message type
    const messageHandler = addEventSpy.mock.calls.find(
      (c) => c[0] === "message",
    )?.[1];

    act(() => {
      messageHandler({
        origin: window.location.origin,
        data: { type: "some-other-message" },
      } as MessageEvent);
    });

    // Should still be waiting
    expect(result.current.isWaiting).toBe(true);

    // Now send correct message
    act(() => {
      messageHandler({
        origin: window.location.origin,
        data: { type: "ethstar-star-token", access_token: "gho_correct" },
      } as MessageEvent);
    });

    const token = await tokenPromise!;
    expect(token).toBe("gho_correct");
  });

  it("cleans up event listener on unmount", () => {
    const fakePopup = { closed: false, close: vi.fn() } as unknown as Window & { closed: boolean; close: ReturnType<typeof vi.fn> };
    openSpy.mockReturnValue(fakePopup);

    const { result, unmount } = renderHook(() => useStarOAuth());

    act(() => {
      result.current.requestToken();
    });

    unmount();

    expect(removeEventSpy).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );
  });
});
