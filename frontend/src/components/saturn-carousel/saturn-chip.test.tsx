import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SaturnChip } from "./saturn-chip";
import type { Repository, StarStatus } from "@/lib/types";

const repo: Repository = {
  owner: "ethereum",
  name: "go-ethereum",
  description: "Official Go implementation of the Ethereum protocol",
  category: "Ethereum Core",
  url: "https://github.com/ethereum/go-ethereum",
};

describe("SaturnChip", () => {
  it("renders owner/name text", () => {
    render(<SaturnChip repo={repo} status="unknown" />);
    expect(screen.getByText("ethereum/go-ethereum")).toBeInTheDocument();
  });

  it("links to the repo URL in a new tab", () => {
    render(<SaturnChip repo={repo} status="unknown" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", repo.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it.each<[StarStatus, string]>([
    ["starred", "Starred"],
    ["unstarred", "Not starred"],
    ["checking", "Checking"],
    ["starring", "Starring"],
    ["failed", "Failed"],
    ["unknown", "Unknown"],
  ])("shows correct aria-label for status %s", (status, expectedLabel) => {
    render(<SaturnChip repo={repo} status={status} />);
    expect(screen.getByLabelText(expectedLabel)).toBeInTheDocument();
  });

  it("applies pulse class for checking status", () => {
    render(<SaturnChip repo={repo} status="checking" />);
    const dot = screen.getByLabelText("Checking");
    expect(dot.className).toContain("animate-saturn-pulse");
  });

  it("applies pulse class for starring status", () => {
    render(<SaturnChip repo={repo} status="starring" />);
    const dot = screen.getByLabelText("Starring");
    expect(dot.className).toContain("animate-saturn-pulse");
  });

  it("does not apply pulse class for starred status", () => {
    render(<SaturnChip repo={repo} status="starred" />);
    const dot = screen.getByLabelText("Starred");
    expect(dot.className).not.toContain("animate-saturn-pulse");
  });

  it("is wrapped in React.memo", () => {
    // React.memo wraps the component — the displayName or $$typeof confirms it
    expect(SaturnChip).toHaveProperty("$$typeof", Symbol.for("react.memo"));
  });
});
