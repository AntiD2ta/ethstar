import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SaturnCard } from "./saturn-card";
import type { Repository, StarStatus } from "@/lib/types";

const repo: Repository = {
  owner: "ethereum",
  name: "go-ethereum",
  description: "Official Go implementation of the Ethereum protocol",
  category: "Ethereum Core",
  url: "https://github.com/ethereum/go-ethereum",
};

describe("SaturnCard", () => {
  it("renders owner and repo name", () => {
    render(<SaturnCard repo={repo} status="unknown" />);
    expect(screen.getByText("ethereum/")).toBeInTheDocument();
    expect(screen.getByText("go-ethereum")).toBeInTheDocument();
  });

  it("renders the description", () => {
    render(<SaturnCard repo={repo} status="unknown" />);
    expect(screen.getByText(repo.description)).toBeInTheDocument();
  });

  it("links to the repo URL in a new tab", () => {
    render(<SaturnCard repo={repo} status="unknown" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", repo.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the owner avatar", () => {
    render(<SaturnCard repo={repo} status="unknown" />);
    const img = screen.getByAltText("ethereum");
    expect(img).toHaveAttribute(
      "src",
      "https://github.com/ethereum.png?size=32",
    );
  });

  it.each<[StarStatus, string]>([
    ["starred", "Starred"],
    ["unstarred", "Not starred"],
    ["checking", "Checking"],
    ["starring", "Starring"],
    ["failed", "Failed"],
    ["unknown", "Unknown"],
  ])("shows correct aria-label for status %s", (status, expectedLabel) => {
    render(<SaturnCard repo={repo} status={status} />);
    expect(screen.getByLabelText(expectedLabel)).toBeInTheDocument();
  });

  it("is wrapped in React.memo", () => {
    expect(SaturnCard).toHaveProperty("$$typeof", Symbol.for("react.memo"));
  });

  it("displays formatted star count when provided", () => {
    render(<SaturnCard repo={repo} status="unknown" starCount={3747} />);
    expect(screen.getByText("3.7k")).toBeInTheDocument();
  });

  it("shows skeleton for star count when loading", () => {
    const { container } = render(
      <SaturnCard repo={repo} status="unknown" metaLoading />,
    );
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows skeleton for description when loading", () => {
    const { container } = render(
      <SaturnCard repo={repo} status="unknown" metaLoading />,
    );
    expect(screen.queryByText(repo.description)).not.toBeInTheDocument();
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows live description when provided", () => {
    render(
      <SaturnCard
        repo={repo}
        status="unknown"
        liveDescription="Live GitHub desc"
      />,
    );
    expect(screen.getByText("Live GitHub desc")).toBeInTheDocument();
    expect(screen.queryByText(repo.description)).not.toBeInTheDocument();
  });
});
