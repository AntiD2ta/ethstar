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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { RoamingStar } from "./roaming-star";
import { DISMISSED_STORAGE_KEY } from "./constants";
import type { RoamingStarState } from "./types";

// Stub IntersectionObserver: default to "visible" so the star stays dormant
// (in-hero) during tests unless we explicitly unhide it.
class StubIO implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  private cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
  }
  observe(target: Element) {
    // Report fully visible so mode resolves to "dormant".
    this.cb(
      [
        {
          isIntersecting: true,
          intersectionRatio: 1,
          target,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRect: target.getBoundingClientRect(),
          rootBounds: null,
          time: 0,
        } as IntersectionObserverEntry,
      ],
      this,
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("IntersectionObserver", StubIO);
});

const baseState: RoamingStarState = {
  status: "disconnected",
  fillLevel: 0,
  remaining: 17,
};

function renderStar(overrides: Partial<React.ComponentProps<typeof RoamingStar>> = {}) {
  const heroRef = createRef<HTMLElement>();
  // Mount a stand-in hero element so IntersectionObserver has something to observe.
  const Hero = () => (
    <section ref={heroRef as React.RefObject<HTMLElement>} data-testid="hero">
      <RoamingStar
        heroRef={heroRef}
        state={baseState}
        inProgress={false}
        completed={false}
        onTrigger={vi.fn()}
        {...overrides}
      />
    </section>
  );
  return { heroRef, ...render(<Hero />) };
}

describe("RoamingStar", () => {
  it("renders a focusable button with the disconnected aria-label", () => {
    renderStar();
    const btn = screen.getByTestId("roaming-star-button");
    expect(btn).toHaveAttribute(
      "aria-label",
      "Star every Ethereum repo — sign in with GitHub to begin",
    );
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveAttribute("data-status", "disconnected");
  });

  it("shows the two-line disconnected label naming the action and the provider", () => {
    renderStar();
    expect(screen.getByText("Star every Ethereum repo")).toBeInTheDocument();
    expect(screen.getByText("Sign in with GitHub ↗")).toBeInTheDocument();
  });

  it("switches to the 'Begin starring' label with a repos-remaining caption when ready", () => {
    renderStar({
      state: { status: "ready", fillLevel: 0.5, remaining: 5 },
    });
    expect(screen.getByText("Begin starring")).toBeInTheDocument();
    expect(screen.getByText("5 repos to go")).toBeInTheDocument();
    expect(screen.queryByText("Sign in with GitHub ↗")).not.toBeInTheDocument();
  });

  it("calls onTrigger when clicked in dormant mode", async () => {
    const user = userEvent.setup();
    const onTrigger = vi.fn();
    renderStar({ onTrigger });
    await user.click(screen.getByTestId("roaming-star-button"));
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it("responds to Enter/Space keys", async () => {
    const user = userEvent.setup();
    const onTrigger = vi.fn();
    renderStar({ onTrigger });
    const btn = screen.getByTestId("roaming-star-button");
    btn.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onTrigger).toHaveBeenCalledTimes(2);
  });

  it("renders nothing when dismissed by session", () => {
    window.localStorage.setItem(
      DISMISSED_STORAGE_KEY,
      JSON.stringify({ v: 1, dismissedAt: Date.now() }),
    );
    renderStar();
    expect(screen.queryByTestId("roaming-star-button")).not.toBeInTheDocument();
  });

  it("renders nothing when `hidden` prop is set", () => {
    renderStar({ hidden: true });
    expect(screen.queryByTestId("roaming-star-button")).not.toBeInTheDocument();
  });

  it("in-progress state exposes a counter-shaped aria-label", () => {
    renderStar({
      state: {
        status: "in-progress",
        fillLevel: 0.35,
        counterLabel: "Starring 6 / 17",
        remaining: 11,
      },
      inProgress: true,
    });
    const btn = screen.getByTestId("roaming-star-button");
    expect(btn).toHaveAttribute("data-status", "in-progress");
    // The counter-shaped aria-label mentions percent.
    expect(btn.getAttribute("aria-label")).toMatch(/percent/);
  });

  it("partial-failure state renders a concrete retry label with the failed count", () => {
    renderStar({
      state: {
        status: "partial-failure",
        fillLevel: 0.5,
        failedCount: 3,
        remaining: 3,
      },
    });
    expect(screen.getByText(/3 failed — retry/)).toBeInTheDocument();
  });

  describe("OAuth popup label states (spec brief §Labels)", () => {
    it("shows 'Waiting for GitHub…' secondary line while OAuth popup is pending", () => {
      renderStar({
        state: {
          status: "disconnected",
          fillLevel: 0,
          remaining: 17,
          oauthStatus: "pending",
        },
      });
      expect(screen.getByText("Star every Ethereum repo")).toBeInTheDocument();
      expect(screen.getByText("Waiting for GitHub…")).toBeInTheDocument();
      expect(
        screen.queryByText("Sign in with GitHub ↗"),
      ).not.toBeInTheDocument();
    });

    it("shows 'Popup blocked — click to retry' when the popup was blocked", () => {
      renderStar({
        state: {
          status: "disconnected",
          fillLevel: 0,
          remaining: 17,
          oauthStatus: "blocked",
        },
      });
      expect(screen.getByText("Star every Ethereum repo")).toBeInTheDocument();
      expect(
        screen.getByText("Popup blocked — click to retry"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Sign in with GitHub ↗"),
      ).not.toBeInTheDocument();
    });

    it("falls back to the static secondary line when oauthStatus is idle/undefined", () => {
      renderStar({
        state: {
          status: "disconnected",
          fillLevel: 0,
          remaining: 17,
          oauthStatus: "idle",
        },
      });
      expect(screen.getByText("Sign in with GitHub ↗")).toBeInTheDocument();
    });
  });

  describe("focus return after supernova (spec brief §Accessibility)", () => {
    it("restores focus to the element that held it before takeover", async () => {
      // Harness: a sibling button, plus controlled state for inProgress/completed
      // so the test can drive the takeover → supernova → dismiss transition.
      const heroRef = createRef<HTMLElement>();

      function Harness() {
        const [inProgress, setInProgress] = useState(false);
        const [completed, setCompleted] = useState(false);
        return (
          <>
            <button type="button" data-testid="adjacent">
              adjacent
            </button>
            <section ref={heroRef as React.RefObject<HTMLElement>}>
              <RoamingStar
                heroRef={heroRef}
                state={{ status: "ready", fillLevel: 0.5, remaining: 3 }}
                inProgress={inProgress}
                completed={completed}
                onTrigger={() => setInProgress(true)}
              />
            </section>
            <button
              type="button"
              data-testid="complete"
              onClick={() => {
                setInProgress(false);
                setCompleted(true);
              }}
            >
              complete
            </button>
          </>
        );
      }

      render(<Harness />);

      // Step 1: focus adjacent — establishes the "prior focused element".
      const adjacent = screen.getByTestId("adjacent");
      adjacent.focus();
      expect(document.activeElement).toBe(adjacent);

      // Step 2: trigger the star via keyboard. handleKey's preventDefault keeps
      // focus on `adjacent` at the time triggerWithFocusCapture reads
      // document.activeElement, so the prior element is captured.
      //
      // But handleKey is on the star button's onKeyDown — the star must be
      // focused for Enter to fire handleKey. So instead, we invoke the
      // star's click handler while `adjacent` still holds focus by dispatching
      // a click event with button=0 without the default focus-shift; in jsdom
      // HTMLButtonElement.click() does not shift focus, so it's safe.
      const star = screen.getByTestId("roaming-star-button");
      await act(async () => {
        star.click();
      });

      // Step 3: shift focus elsewhere (simulating Radix Dialog focus-trap
      // during takeover). We focus the "complete" button to mimic the
      // takeover substrate stealing focus away from `adjacent`.
      const complete = screen.getByTestId("complete");
      complete.focus();
      expect(document.activeElement).toBe(complete);

      // Step 4: drive completion → supernova → dismiss. The supernova's
      // async burst resolves via a setTimeout safety net (~960ms) in jsdom
      // where there's no real paint loop, so we pump fake timers.
      vi.useFakeTimers();
      try {
        await act(async () => {
          complete.click();
        });

        // Flush the supernova safety-net timeout + microtasks.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });
      } finally {
        vi.useRealTimers();
      }

      expect(document.activeElement).toBe(adjacent);
    });
  });
});
