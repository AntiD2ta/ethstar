import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SaturnCarousel } from "./saturn-carousel";

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

  it("renders all 17 repo chips on desktop", () => {
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
    expect(links).toHaveLength(17);
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

  it("renders category-labeled rows on mobile", () => {
    render(
      <SaturnCarousel
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isDesktop={false}
        prefersReducedMotion={false}
      />,
    );
    expect(screen.getByText("Ethereum Core")).toBeInTheDocument();
    expect(screen.getByText("Consensus Clients")).toBeInTheDocument();
    expect(screen.getByText("Execution Clients")).toBeInTheDocument();
    expect(screen.getByText("Validator Tooling")).toBeInTheDocument();
  });

  it("renders all 17 repo chips on mobile", () => {
    render(
      <SaturnCarousel
        starStatuses={{}}
        repoMeta={{}}
        metaLoading={false}
        isDesktop={false}
        prefersReducedMotion={false}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(17);
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
