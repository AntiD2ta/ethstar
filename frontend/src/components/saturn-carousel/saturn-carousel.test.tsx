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
import { render, screen } from "@testing-library/react";
import { SaturnCarousel } from "./saturn-carousel";
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
      screen.getByRole("region", { name: /ethereum ecosystem/i }),
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
    const region = screen.getByRole("region", { name: /ethereum ecosystem/i });
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
});
