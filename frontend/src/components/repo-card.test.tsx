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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RepoCard } from "./repo-card";
import type { Repository } from "@/lib/types";

const repo: Repository = {
  owner: "ethereum",
  name: "go-ethereum",
  description: "Official Go implementation of the Ethereum protocol",
  category: "Ethereum Core",
  url: "https://github.com/ethereum/go-ethereum",
};

describe("RepoCard", () => {
  it("renders owner, name, and description", () => {
    render(<RepoCard repo={repo} status="unstarred" />);
    expect(screen.getByText("go-ethereum")).toBeInTheDocument();
    expect(screen.getByText(/Official Go implementation/)).toBeInTheDocument();
  });

  it("shows retry button on failed status when onRetry is provided", async () => {
    const onRetry = vi.fn();
    render(<RepoCard repo={repo} status="failed" onRetry={onRetry} />);
    const retryBtn = screen.getByRole("button", { name: /retry starring/i });
    expect(retryBtn).toBeInTheDocument();
    await userEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledWith(repo);
  });

  it("does not render retry button when status is failed but no onRetry given", () => {
    render(<RepoCard repo={repo} status="failed" />);
    expect(
      screen.queryByRole("button", { name: /retry starring/i }),
    ).not.toBeInTheDocument();
    // Fallback indicator remains.
    expect(screen.getByLabelText("Failed to star")).toBeInTheDocument();
  });

  it("does not render retry button for non-failed statuses even when onRetry provided", () => {
    const onRetry = vi.fn();
    render(<RepoCard repo={repo} status="starred" onRetry={onRetry} />);
    expect(
      screen.queryByRole("button", { name: /retry starring/i }),
    ).not.toBeInTheDocument();
  });

  it("displays formatted star count when provided", () => {
    render(<RepoCard repo={repo} status="unstarred" starCount={47000} />);
    expect(screen.getByText("47k")).toBeInTheDocument();
  });

  it("shows skeleton for star count when loading and no count yet", () => {
    const { container } = render(
      <RepoCard repo={repo} status="unstarred" metaLoading />,
    );
    // Star count skeleton: h-4 w-10 in top-right
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows skeletons for description when loading and no live description", () => {
    const { container } = render(
      <RepoCard repo={repo} status="unstarred" metaLoading />,
    );
    // Description skeletons replace the <p> tag
    const descP = screen.queryByText(repo.description);
    expect(descP).not.toBeInTheDocument();
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    // At least 2 description skeletons + 1 star count skeleton
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it("shows live description instead of static when provided", () => {
    render(
      <RepoCard
        repo={repo}
        status="unstarred"
        liveDescription="Live from GitHub"
      />,
    );
    expect(screen.getByText("Live from GitHub")).toBeInTheDocument();
    expect(screen.queryByText(repo.description)).not.toBeInTheDocument();
  });

  it("falls back to static description when live description is null", () => {
    render(
      <RepoCard
        repo={repo}
        status="unstarred"
        liveDescription={null}
      />,
    );
    expect(screen.getByText(repo.description)).toBeInTheDocument();
  });

  it("shows no skeletons when data is loaded", () => {
    const { container } = render(
      <RepoCard
        repo={repo}
        status="unstarred"
        starCount={47000}
        liveDescription="Live desc"
        metaLoading={false}
      />,
    );
    // Only look for skeleton slots in the card header/description area
    const skeletons = container.querySelectorAll(
      "article > div:first-child [data-slot='skeleton'], article > div:nth-child(2)[data-slot='skeleton']",
    );
    expect(skeletons.length).toBe(0);
  });
});
