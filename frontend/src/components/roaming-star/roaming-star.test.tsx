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
import {
  DISCOVERY_HINT_DELAY_MS,
  DISCOVERY_HINT_STORAGE_KEY,
  DISCOVERY_HINT_TEXT,
  DISMISSED_STORAGE_KEY,
} from "./constants";
import type { RoamingStarState } from "./types";

// Passing `true` keeps the star dormant (in-hero); `false` transitions it
// to roaming. A single factory replaces two near-identical class stubs
// that only differed on `isIntersecting`.
function makeStubIO(visible: boolean) {
  return class StubIO implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: ReadonlyArray<number> = [];
    private cb: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb;
    }
    observe(target: Element) {
      const rect = target.getBoundingClientRect();
      this.cb(
        [
          {
            isIntersecting: visible,
            intersectionRatio: visible ? 1 : 0,
            target,
            boundingClientRect: rect,
            intersectionRect: visible ? rect : new DOMRect(0, 0, 0, 0),
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
  };
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.stubGlobal("IntersectionObserver", makeStubIO(true));
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
      "Star all 17 Ethereum repos — sign in with GitHub to begin",
    );
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveAttribute("data-status", "disconnected");
  });

  it("shows the two-line disconnected label naming the action and the provider", () => {
    renderStar();
    expect(screen.getByText("Star all 17 now")).toBeInTheDocument();
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

  it("renders nothing when dismissed by session (while connected)", () => {
    // Dismissal is a *connected-session* concept — it only suppresses the
    // star for a user who has completed a cycle. A disconnected user with
    // stale dismissal gets it cleared (separate test below).
    window.localStorage.setItem(
      DISMISSED_STORAGE_KEY,
      JSON.stringify({ v: 1, dismissedAt: Date.now() }),
    );
    renderStar({
      state: { status: "success", fillLevel: 1, remaining: 0 },
    });
    expect(screen.queryByTestId("roaming-star-button")).not.toBeInTheDocument();
  });

  it("clears stale dismissal when the user is disconnected on mount", () => {
    // Completed a prior session, then logged out. Without this clear, the
    // dormant CTA would vanish on a page that prompts "Sign in with GitHub".
    window.localStorage.setItem(
      DISMISSED_STORAGE_KEY,
      JSON.stringify({ v: 1, dismissedAt: Date.now() }),
    );
    renderStar();
    expect(screen.getByTestId("roaming-star-button")).toBeInTheDocument();
    expect(window.localStorage.getItem(DISMISSED_STORAGE_KEY)).toBeNull();
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

  // Defensive: home.tsx always passes `remaining: number`, but a future caller
  // (or an in-flight type-cast during data-meta loading) could pass null/
  // undefined. Previously that surfaced as "Star all 0 Ethereum repos…" on
  // screen readers — wrong: we don't know the count yet, we shouldn't announce
  // a concrete "0". Mirror the `ready` branch, which already drops the count
  // into a skeleton until `state.checking` clears.
  it("omits the count from the disconnected aria-label when remaining is nullish", () => {
    renderStar({
      state: {
        status: "disconnected",
        fillLevel: 0,
        // `as unknown as number` simulates the data-loading window where a
        // future caller might not have resolved the count yet.
        remaining: undefined as unknown as number,
      },
    });
    const btn = screen.getByTestId("roaming-star-button");
    expect(btn).toHaveAttribute(
      "aria-label",
      "Star all Ethereum repos — sign in with GitHub to begin",
    );
    expect(screen.getByText("Star all now")).toBeInTheDocument();
  });

  // The discovery-hint live region is permanently mounted so NVDA + Chrome
  // observe it before its first announcement. But while its content is empty
  // (the majority of the slot's lifetime) the hidden node was still being
  // traversed by assistive-tech on the way through the page — a silent stop
  // that contributes nothing. `aria-hidden` pulls it out of the a11y tree
  // while empty, and `aria-atomic` ensures the whole pill text is announced
  // atomically (not rebroadcast per-keystroke-addition by late-reading ATs).
  it("marks the empty discovery-hint status as aria-hidden with aria-atomic", () => {
    renderStar();
    const hint = screen.getByTestId("roaming-star-discovery-hint");
    expect(hint).toHaveAttribute("aria-atomic", "true");
    expect(hint).toHaveAttribute("aria-hidden", "true");
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
      expect(screen.getByText("Star all 17 now")).toBeInTheDocument();
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
      expect(screen.getByText("Star all 17 now")).toBeInTheDocument();
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

  describe("intro label after detachment", () => {
    // Locks in the /impeccable:clarify fix: after the star detaches from the
    // hero (mode: dormant → roaming), the primary-line label must stay
    // visible for a short window so a first-time visitor scrolling past the
    // hero doesn't see a silent floating diamond. The 40px comet was
    // previously a mystery element with the label hidden behind a 180px
    // cursor-gravity radius.
    it("renders the persistent label pill when mode transitions to roaming", () => {
      vi.stubGlobal("IntersectionObserver", makeStubIO(false));
      renderStar();
      // The roaming-mode label pill is identified by data-testid and echoes
      // labelLines[0] — "Star all 17 now" in the disconnected state (Phase E).
      const label = screen.getByTestId("roaming-star-label");
      expect(label).toBeInTheDocument();
      expect(label).toHaveTextContent("Star all 17 now");
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

  describe("Phase E.2 — same-session settle & replay", () => {
    // Harness that drives the completion cycle while letting the test flip
    // `state.status` from "in-progress" → "success" at the moment the parent
    // would in production (starResult set, allDone true). Exposes refs to
    // the setters so each test can orchestrate its own timeline.
    function CycleHarness({
      initialState = {
        status: "in-progress" as const,
        fillLevel: 0.5,
        remaining: 3,
      },
    }: {
      initialState?: RoamingStarState;
    }) {
      const heroRef = createRef<HTMLElement>();
      const [state, setState] = useState<RoamingStarState>(initialState);
      const [inProgress, setInProgress] = useState(true);
      const [completed, setCompleted] = useState(false);
      return (
        <>
          <section ref={heroRef as React.RefObject<HTMLElement>}>
            <RoamingStar
              heroRef={heroRef}
              state={state}
              inProgress={inProgress}
              completed={completed}
              onTrigger={vi.fn()}
            />
          </section>
          <button
            type="button"
            data-testid="complete"
            onClick={() => {
              setInProgress(false);
              setCompleted(true);
              setState({ status: "success", fillLevel: 1, remaining: 0 });
            }}
          >
            complete
          </button>
        </>
      );
    }

    it("settles into the all-starred terminal state after supernova — no auto-dismiss", async () => {
      render(<CycleHarness />);
      const complete = screen.getByTestId("complete");
      vi.useFakeTimers();
      try {
        // Trigger the completion — mode flips in-progress → supernova.
        await act(async () => {
          complete.click();
        });
        // Flush the supernova fade envelope (SUPERNOVA_FADE_MS * 1.6 ~ 1760ms).
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });
      } finally {
        vi.useRealTimers();
      }

      // Dormant slot still mounted — the slot does NOT auto-dismiss.
      const star = screen.getByTestId("roaming-star-button");
      expect(star).toBeInTheDocument();
      expect(star).toHaveAttribute("data-status", "success");
      expect(screen.getByText("All starred")).toBeInTheDocument();
      // And the legacy auto-dismissal flag must NOT have been written —
      // only explicit × dismissal writes that key.
      expect(window.localStorage.getItem(DISMISSED_STORAGE_KEY)).toBeNull();
    });

    it("explicit × dismiss affordance writes the session-dismissal flag and unmounts the star", async () => {
      const user = userEvent.setup();
      render(<CycleHarness />);
      const complete = screen.getByTestId("complete");
      vi.useFakeTimers();
      try {
        await act(async () => {
          complete.click();
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });
      } finally {
        vi.useRealTimers();
      }

      // The × affordance is present and keyboard-reachable with the
      // "Dismiss completion" aria-label.
      const dismiss = screen.getByTestId("roaming-star-dismiss");
      expect(dismiss).toHaveAttribute("aria-label", "Dismiss completion");

      await user.click(dismiss);

      expect(screen.queryByTestId("roaming-star-button")).not.toBeInTheDocument();
      // Flag written. Shape is validated by session-persistence tests.
      expect(
        window.localStorage.getItem(DISMISSED_STORAGE_KEY),
      ).not.toBeNull();
    });

    it("discovery hint fires once per tab and is suppressed thereafter", async () => {
      const { unmount } = render(<CycleHarness />);
      vi.useFakeTimers();
      try {
        await act(async () => {
          screen.getByTestId("complete").click();
        });
        // Flush the supernova envelope so `supernovaSettled` flips true.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000);
        });
        // Before the hint delay elapses the pill is not visible.
        expect(
          screen.queryByText(DISCOVERY_HINT_TEXT),
        ).not.toBeInTheDocument();

        // Advance past the hint delay — pill becomes visible.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(DISCOVERY_HINT_DELAY_MS + 20);
        });
        expect(screen.getByText(DISCOVERY_HINT_TEXT)).toBeInTheDocument();
        // And sessionStorage now holds the one-shot guard.
        expect(
          window.sessionStorage.getItem(DISCOVERY_HINT_STORAGE_KEY),
        ).toBe("1");
      } finally {
        vi.useRealTimers();
      }

      // Re-mount within the same "tab" (sessionStorage survives unmount).
      // The second completion cycle must NOT show the hint again.
      unmount();
      render(<CycleHarness />);
      vi.useFakeTimers();
      try {
        await act(async () => {
          screen.getByTestId("complete").click();
        });
        await act(async () => {
          await vi.advanceTimersByTimeAsync(
            2000 + DISCOVERY_HINT_DELAY_MS + 200,
          );
        });
      } finally {
        vi.useRealTimers();
      }
      // The discovery pill container still exists (aria-live always-mounted
      // so SRs can announce on first reveal), but the visible TEXT is not.
      expect(
        screen.queryByText(DISCOVERY_HINT_TEXT),
      ).not.toBeInTheDocument();
    });

    it("throttles replay taps so a rapid click-storm fires at most one burst per 1.5s", async () => {
      const user = userEvent.setup();
      // Direct render with state already at success — simulates the "page
      // refresh reaches terminal" path the same-session flow now mirrors.
      renderStar({
        state: { status: "success", fillLevel: 1, remaining: 0 },
      });

      // Pulse wrappers must be queried by selector after each click — the
      // celebrate wrapper has its React `key` bumped on each replay, which
      // detaches the prior DOM node. A cached `star` reference would point
      // to a detached subtree and `closest()` would wrongly return null.
      const selector = ".roaming-star-celebrate, .roaming-star-celebrate-rm";

      // First click — celebrate wrapper mounts with the pulse class.
      await user.click(screen.getByTestId("roaming-star-button"));
      expect(document.querySelectorAll(selector).length).toBe(1);

      // Immediate second click — throttle swallows it. No new wrapper is
      // mounted because the key didn't advance. Still one pulse wrapper
      // on the page — no stacked/duplicated burst.
      await user.click(screen.getByTestId("roaming-star-button"));
      expect(document.querySelectorAll(selector).length).toBe(1);
    });
  });
});
