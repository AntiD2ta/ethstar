import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "./progress-bar";

describe("ProgressBar", () => {
  it("has aria-live=polite on the current-repo text", () => {
    render(
      <ProgressBar progress={{ total: 10, starred: 3, remaining: 7, current: "repo" }} />,
    );
    const liveEl = screen.getByText(/Starring repo/);
    expect(liveEl).toHaveAttribute("aria-live", "polite");
  });

  it("renders correct progress bar ARIA values", () => {
    render(
      <ProgressBar progress={{ total: 17, starred: 5, remaining: 12, current: "go-ethereum" }} />,
    );
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "5");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "17");
    expect(bar).toHaveAttribute("aria-label", "Starring progress");
  });
});
