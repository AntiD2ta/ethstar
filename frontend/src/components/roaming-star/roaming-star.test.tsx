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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
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
      "Light it up — continue with GitHub to start starring repositories",
    );
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveAttribute("data-status", "disconnected");
  });

  it("shows the two-line disconnected label", () => {
    renderStar();
    expect(screen.getByText("Light it up")).toBeInTheDocument();
    expect(screen.getByText("↗ Continue with GitHub")).toBeInTheDocument();
  });

  it("switches to the 'Begin starring' single-line label when ready", () => {
    renderStar({
      state: { status: "ready", fillLevel: 0.5, remaining: 5 },
    });
    expect(screen.getByText("Begin starring")).toBeInTheDocument();
    expect(screen.queryByText("↗ Continue with GitHub")).not.toBeInTheDocument();
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

  it("partial-failure state renders the retry label with the failed count", () => {
    renderStar({
      state: {
        status: "partial-failure",
        fillLevel: 0.5,
        failedCount: 3,
        remaining: 3,
      },
    });
    expect(screen.getByText(/Retry · 3 couldn't be starred/)).toBeInTheDocument();
  });
});
