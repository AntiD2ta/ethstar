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
    expect(screen.getByText("ethereum/go-ethereum")).toBeInTheDocument();
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

  it("click calls onJump instead of navigating", () => {
    const onJump = vi.fn();
    render(<SaturnCard repo={repo} status="unstarred" onJump={onJump} />);
    const anchor = screen.getByRole("link");
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    fireEvent(anchor, clickEvent);
    expect(clickEvent.defaultPrevented).toBe(true);
    expect(onJump).toHaveBeenCalledWith(repo);
  });

  it("Enter key fires onJump", async () => {
    const user = userEvent.setup();
    const onJump = vi.fn();
    render(<SaturnCard repo={repo} status="unstarred" onJump={onJump} />);
    const anchor = screen.getByRole("link");
    await act(async () => {
      anchor.focus();
    });
    await user.keyboard("{Enter}");
    expect(onJump).toHaveBeenCalledWith(repo);
  });

  it("Shift+click opens the action menu", () => {
    const onJump = vi.fn();
    const onStar = vi.fn();
    render(
      <SaturnCard
        repo={repo}
        status="unstarred"
        onJump={onJump}
        onStarTrigger={onStar}
      />,
    );
    fireEvent.click(screen.getByRole("link"), { shiftKey: true });
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Star" })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Open on GitHub" }),
    ).toBeInTheDocument();
    expect(onJump).not.toHaveBeenCalled();
  });

  it("exposes rovingIndex + tabIndex on the anchor", () => {
    render(
      <SaturnCard
        repo={repo}
        status="unstarred"
        rovingIndex={5}
        tabIndex={-1}
      />,
    );
    const anchor = screen.getByRole("link");
    expect(anchor).toHaveAttribute("data-roving-index", "5");
    expect(anchor).toHaveAttribute("tabindex", "-1");
  });

  it("aria-label announces owner/name and starred status", () => {
    render(<SaturnCard repo={repo} status="starred" />);
    expect(
      screen.getByLabelText("ethereum/go-ethereum, starred"),
    ).toBeInTheDocument();
  });
});
