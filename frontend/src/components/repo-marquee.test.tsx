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
import { act, render } from "@testing-library/react";
import { RepoMarquee } from "./repo-marquee";
import type { Repository } from "@/lib/types";

const repos: Repository[] = [
  {
    owner: "ethereum",
    name: "go-ethereum",
    description: "Official Go implementation",
    category: "Ethereum Core",
    url: "https://github.com/ethereum/go-ethereum",
  },
  {
    owner: "ethereum",
    name: "solidity",
    description: "Solidity, the smart-contract language",
    category: "Ethereum Core",
    url: "https://github.com/ethereum/solidity",
  },
];

/** Patch layout reads on each rendered card so the centering math has
 *  deterministic numbers. happy-dom returns 0 for client/scroll dimensions
 *  and stub bounding rects otherwise. The container sits at viewport x=0;
 *  each card's on-screen left = its content-relative position minus the
 *  current scrollLeft. */
function patchLayout(container: HTMLElement) {
  const scroller = container.querySelector<HTMLDivElement>(
    'div[role="region"]',
  );
  if (!scroller) throw new Error("marquee scroller not found");
  Object.defineProperty(scroller, "clientWidth", {
    configurable: true,
    value: 400,
  });
  Object.defineProperty(scroller, "scrollWidth", {
    configurable: true,
    value: 4000,
  });
  scroller.getBoundingClientRect = () =>
    ({
      left: 0,
      right: 400,
      top: 0,
      bottom: 0,
      width: 400,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  const cards = scroller.querySelectorAll<HTMLElement>("[data-repo-key]");
  cards.forEach((card, i) => {
    const contentLeft = 200 + i * 400;
    const width = 320;
    Object.defineProperty(card, "clientWidth", {
      configurable: true,
      value: width,
    });
    card.getBoundingClientRect = () => {
      const left = contentLeft - scroller.scrollLeft;
      return {
        left,
        right: left + width,
        top: 0,
        bottom: 0,
        width,
        height: 0,
        x: left,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    };
  });
  return scroller;
}

describe("RepoMarquee — chip-jump highlight", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("animates scrollLeft to centre the highlighted card", async () => {
    const { container, rerender } = render(
      <RepoMarquee
        repos={repos}
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isAuthenticated={false}
        isDesktop={true}
        prefersReducedMotion={false}
        highlightKey={null}
        highlightToken={0}
      />,
    );
    const scroller = patchLayout(container);

    rerender(
      <RepoMarquee
        repos={repos}
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isAuthenticated={false}
        isDesktop={true}
        prefersReducedMotion={false}
        highlightKey="ethereum/solidity"
        highlightToken={1}
      />,
    );

    // Run rAF until the tween settles.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    // Card 1 ("ethereum/solidity"): offsetLeft 600, width 320 →
    // raw 600 - (400 - 320)/2 = 600 - 40 = 560 → clamped to [0, 3600].
    expect(scroller.scrollLeft).toBe(560);
  });

  it("jumps instantly under reduced motion", () => {
    const { container, rerender } = render(
      <RepoMarquee
        repos={repos}
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isAuthenticated={false}
        isDesktop={true}
        prefersReducedMotion={true}
        highlightKey={null}
        highlightToken={0}
      />,
    );
    const scroller = patchLayout(container);

    rerender(
      <RepoMarquee
        repos={repos}
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isAuthenticated={false}
        isDesktop={true}
        prefersReducedMotion={true}
        highlightKey="ethereum/solidity"
        highlightToken={1}
      />,
    );

    // No rAF advance — scrollLeft must already be at the centre target.
    expect(scroller.scrollLeft).toBe(560);
  });

  it("rapid back-to-back jumps land on the final target", async () => {
    const { container, rerender } = render(
      <RepoMarquee
        repos={repos}
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isAuthenticated={false}
        isDesktop={true}
        prefersReducedMotion={false}
        highlightKey={null}
        highlightToken={0}
      />,
    );
    const scroller = patchLayout(container);

    // First jump → solidity.
    rerender(
      <RepoMarquee
        repos={repos}
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isAuthenticated={false}
        isDesktop={true}
        prefersReducedMotion={false}
        highlightKey="ethereum/solidity"
        highlightToken={1}
      />,
    );
    // Tick the first tween partway.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    // Second jump back to go-ethereum before the first finishes.
    rerender(
      <RepoMarquee
        repos={repos}
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isAuthenticated={false}
        isDesktop={true}
        prefersReducedMotion={false}
        highlightKey="ethereum/go-ethereum"
        highlightToken={2}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    // Card 0 ("ethereum/go-ethereum"): offsetLeft 200, width 320 →
    // raw 200 - (400 - 320)/2 = 200 - 40 = 160 → clamped to [0, 3600].
    expect(scroller.scrollLeft).toBe(160);
  });
});
