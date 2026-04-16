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

import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaturnChip } from "./saturn-chip";
import type { Repository, StarStatus } from "@/lib/types";

const repo: Repository = {
  owner: "ethereum",
  name: "go-ethereum",
  description: "Official Go implementation of the Ethereum protocol",
  category: "Ethereum Core",
  url: "https://github.com/ethereum/go-ethereum",
};

// The primary chip anchor: the visible link with href + saturn-chip class.
// The Popover menu also renders an anchor ("Open on GitHub") — filter it out
// so existing single-link assertions remain clear about what they're asserting.
function getPrimaryChipLink() {
  const links = screen.getAllByRole("link");
  const chip = links.find((el) => el.classList.contains("saturn-chip"));
  if (!chip) throw new Error("primary chip link not found");
  return chip;
}

describe("SaturnChip", () => {
  it("renders owner/name text", () => {
    render(<SaturnChip repo={repo} status="unknown" />);
    expect(screen.getByText("ethereum/go-ethereum")).toBeInTheDocument();
  });

  it("links to the repo URL in a new tab (right-click fallback)", () => {
    render(<SaturnChip repo={repo} status="unknown" />);
    const link = getPrimaryChipLink();
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

  it("starred status uses fill-current + star-gold tint", () => {
    render(<SaturnChip repo={repo} status="starred" />);
    const dot = screen.getByLabelText("Starred");
    expect(dot.className).toContain("fill-current");
    expect(dot.className).toContain("text-star-gold");
  });

  it("unstarred status uses primary tint and no fill", () => {
    render(<SaturnChip repo={repo} status="unstarred" />);
    const dot = screen.getByLabelText("Not starred");
    expect(dot.className).toContain("text-primary");
    expect(dot.className).not.toContain("fill-current");
  });

  it("announces owner/name + starred-or-not in aria-label", () => {
    render(<SaturnChip repo={repo} status="starred" />);
    expect(
      screen.getByLabelText("ethereum/go-ethereum, starred"),
    ).toBeInTheDocument();
  });

  it("is wrapped in React.memo", () => {
    expect(SaturnChip).toHaveProperty("$$typeof", Symbol.for("react.memo"));
  });

  it("click calls onJump instead of navigating", () => {
    const onJump = vi.fn();
    render(<SaturnChip repo={repo} status="unstarred" onJump={onJump} />);
    const chip = getPrimaryChipLink();
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    fireEvent(chip, clickEvent);
    expect(clickEvent.defaultPrevented).toBe(true);
    expect(onJump).toHaveBeenCalledWith(repo);
  });

  it("Enter key fires onJump", async () => {
    const user = userEvent.setup();
    const onJump = vi.fn();
    render(<SaturnChip repo={repo} status="unstarred" onJump={onJump} />);
    const chip = getPrimaryChipLink();
    await act(async () => {
      chip.focus();
    });
    await user.keyboard("{Enter}");
    expect(onJump).toHaveBeenCalledWith(repo);
  });

  it("Shift+click opens the action group with Star + Open on GitHub", () => {
    const onJump = vi.fn();
    const onStar = vi.fn();
    render(
      <SaturnChip
        repo={repo}
        status="unstarred"
        onJump={onJump}
        onStarTrigger={onStar}
      />,
    );
    const chip = getPrimaryChipLink();
    fireEvent.click(chip, { shiftKey: true });
    const group = screen.getByRole("group", {
      name: "ethereum/go-ethereum actions",
    });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Star" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open on GitHub" }),
    ).toBeInTheDocument();
    expect(onJump).not.toHaveBeenCalled();
  });

  it("Star action calls onStarTrigger", async () => {
    const user = userEvent.setup();
    const onStar = vi.fn();
    render(
      <SaturnChip repo={repo} status="unstarred" onStarTrigger={onStar} />,
    );
    const chip = getPrimaryChipLink();
    fireEvent.click(chip, { shiftKey: true });
    await user.click(screen.getByRole("button", { name: "Star" }));
    expect(onStar).toHaveBeenCalledWith(repo);
  });

  it("exposes rovingIndex via data-roving-index and tabIndex", () => {
    render(
      <SaturnChip
        repo={repo}
        status="unstarred"
        rovingIndex={3}
        tabIndex={0}
      />,
    );
    const chip = getPrimaryChipLink();
    expect(chip).toHaveAttribute("data-roving-index", "3");
    expect(chip).toHaveAttribute("tabindex", "0");
  });
});
