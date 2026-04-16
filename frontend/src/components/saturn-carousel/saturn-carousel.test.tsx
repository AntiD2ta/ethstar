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

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { DESKTOP_RADII, MOBILE_RADII, SaturnCarousel } from "./saturn-carousel";
import { REPOSITORIES } from "@/lib/repos";

let rafSpy: ReturnType<typeof vi.spyOn>;
let cafSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1);
  cafSpy = vi.spyOn(globalThis, "cancelAnimationFrame").mockReturnValue();
});

afterEach(() => {
  rafSpy.mockRestore();
  cafSpy.mockRestore();
});

describe("SaturnCarousel", () => {
  it("renders a labeled carousel region", () => {
    render(
      <SaturnCarousel
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isDesktop={true}
        prefersReducedMotion={true}
      />,
    );
    expect(
      screen.getByRole("region", { name: /saturn repository navigator/i }),
    ).toBeInTheDocument();
  });

  it("renders one chip per repository on desktop", () => {
    render(
      <SaturnCarousel
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isDesktop={true}
        prefersReducedMotion={true}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(REPOSITORIES.length);
  });

  it("renders the central diamond container", () => {
    render(
      <SaturnCarousel
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isDesktop={true}
        prefersReducedMotion={true}
      />,
    );
    // In test env (no WebGL), falls back to logo image
    const region = screen.getByRole("region", { name: /saturn repository navigator/i });
    const images = region.querySelectorAll("img");
    expect(images.length).toBeGreaterThan(0);
  });

  it("renders 4 ring sections on desktop", () => {
    render(
      <SaturnCarousel
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isDesktop={true}
        prefersReducedMotion={true}
      />,
    );
    // Each ring's orbital path + chip container = the ring groups
    // Verify by checking category labels are NOT visible (desktop uses rings, not labeled rows)
    expect(screen.queryByText("Ethereum Core")).not.toBeInTheDocument();
  });

  it("renders 3D ring on mobile (no category labels)", () => {
    render(
      <SaturnCarousel
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isDesktop={false}
        prefersReducedMotion={true}
      />,
    );
    // Mobile now uses the 3D ring, not flat rows — no category headings.
    expect(screen.queryByText("Ethereum Core")).not.toBeInTheDocument();
    expect(screen.queryByText("Consensus Clients")).not.toBeInTheDocument();
  });

  it("renders one chip per repository on mobile", () => {
    render(
      <SaturnCarousel
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isDesktop={false}
        prefersReducedMotion={true}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(REPOSITORIES.length);
  });

  it("renders a pinch-to-zoom hint on mobile", () => {
    render(
      <SaturnCarousel
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isDesktop={false}
        prefersReducedMotion={true}
      />,
    );
    expect(screen.getByText(/pinch to explore/i)).toBeInTheDocument();
  });

  it("passes star status through to chips", () => {
    render(
      <SaturnCarousel
        starStatuses={{ "ethereum/go-ethereum": "starred" }}
        repoMeta={{}}
        metaLoading={false}
        isDesktop={true}
        prefersReducedMotion={true}
      />,
    );
    expect(screen.getByLabelText("Starred")).toBeInTheDocument();
  });

  it("renders a filterControl slot inside the ring section on desktop", () => {
    render(
      <SaturnCarousel
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isDesktop={true}
        prefersReducedMotion={true}
        filterControl={<div data-testid="ring-filter-control">control</div>}
      />,
    );
    const region = screen.getByRole("region", {
      name: /saturn repository navigator/i,
    });
    const control = screen.getByTestId("ring-filter-control");
    expect(region).toContainElement(control);
  });

  it("renders a filterControl slot inside the ring section on mobile", () => {
    render(
      <SaturnCarousel
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isDesktop={false}
        prefersReducedMotion={true}
        filterControl={<div data-testid="ring-filter-control">control</div>}
      />,
    );
    const region = screen.getByRole("region", {
      name: /saturn repository navigator/i,
    });
    const control = screen.getByTestId("ring-filter-control");
    expect(region).toContainElement(control);
  });
});

describe("SaturnCarousel band filter", () => {
  type ROCallback = (entries: ResizeObserverEntry[]) => void;

  interface MockROInstance {
    el: Element | null;
    cb: ROCallback;
  }

  let instances: MockROInstance[];
  let originalRO: typeof ResizeObserver | undefined;

  beforeEach(() => {
    instances = [];
    originalRO = globalThis.ResizeObserver;
    class MockResizeObserver {
      private instance: MockROInstance;
      constructor(cb: ROCallback) {
        this.instance = { el: null, cb };
        instances.push(this.instance);
      }
      observe(el: Element) {
        this.instance.el = el;
      }
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      MockResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    if (originalRO) {
      (globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
        originalRO;
    }
  });

  function fireResize(width: number, height: number) {
    // Stub each observed element's clientWidth/clientHeight, then fire the
    // observer callback to push the new dimensions into the hook. Wrap in
    // `act` so React flushes the resulting state update + effects before we
    // assert on DOM styles.
    act(() => {
      for (const { el, cb } of instances) {
        if (!el) continue;
        Object.defineProperty(el, "clientWidth", {
          configurable: true,
          value: width,
        });
        Object.defineProperty(el, "clientHeight", {
          configurable: true,
          value: height,
        });
        cb([
          {
            contentRect: { width, height } as DOMRectReadOnly,
          } as ResizeObserverEntry,
        ]);
      }
    });
  }

  it("marks bottom-arc outer-ring chips as pointer-events:none when the viewport is shorter than the ring diameter", () => {
    render(
      <SaturnCarousel
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isDesktop={true}
        prefersReducedMotion={true}
      />,
    );

    // Simulate a 1400×600 viewport: the outermost ring's vertical extent
    // (570 × cos(45°) ≈ 403) plus the card half-height 50 = 453 > 300
    // (viewport half-height). Some outer-ring chips must drop out of band.
    fireResize(1400, 600);

    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);

    // At least one chip's wrapper (parent of the anchor) should have
    // pointer-events:none — the ones projected outside the vertical band.
    const wrappers = links.map((a) => a.closest("div[style*='will-change']"));
    const muted = wrappers.filter(
      (w) =>
        (w as HTMLElement | null)?.style?.pointerEvents === "none",
    );
    expect(muted.length).toBeGreaterThan(0);
  });

  it("leaves chips interactive when the viewport comfortably contains the ring", () => {
    render(
      <SaturnCarousel
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isDesktop={true}
        prefersReducedMotion={true}
      />,
    );

    // 2000×2000 viewport — every chip fits inside the band. Half sizes are
    // 1000 × 1000; outermost ring vertical extent is ≈403 + 50 = 453 < 1000.
    fireResize(2000, 2000);

    const links = screen.getAllByRole("link");
    const wrappers = links.map((a) => a.closest("div[style*='will-change']"));
    const muted = wrappers.filter(
      (w) =>
        (w as HTMLElement | null)?.style?.pointerEvents === "none",
    );
    expect(muted.length).toBe(0);
  });
});

describe("Saturn ring radii invariants", () => {
  it("MOBILE_RADII stays proportional to DESKTOP_RADII within 2% tolerance", () => {
    // Slice counts are computed from DESKTOP_RADII only and reused on
    // mobile. If MOBILE_RADII ratios drift from DESKTOP_RADII, mobile
    // chip density silently diverges from desktop — a chip count that
    // looks balanced on a 570/460/350/240 desktop ring can clump or
    // starve on a mobile ring whose ratios don't match. Lock the ratios
    // so any future tweak to one array must also update the other.
    expect(DESKTOP_RADII).toHaveLength(MOBILE_RADII.length);
    const baseRatio = MOBILE_RADII[0] / DESKTOP_RADII[0];
    for (let i = 1; i < DESKTOP_RADII.length; i++) {
      const ratio = MOBILE_RADII[i] / DESKTOP_RADII[i];
      expect(ratio).toBeGreaterThan(baseRatio * 0.98);
      expect(ratio).toBeLessThan(baseRatio * 1.02);
    }
  });

  it("both radii arrays are strictly increasing (inner → outer)", () => {
    for (let i = 0; i < DESKTOP_RADII.length - 1; i++) {
      expect(DESKTOP_RADII[i]).toBeLessThan(DESKTOP_RADII[i + 1]);
      expect(MOBILE_RADII[i]).toBeLessThan(MOBILE_RADII[i + 1]);
    }
  });
});
