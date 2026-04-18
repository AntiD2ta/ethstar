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
import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByText("ethereum/go-ethereum")).toBeInTheDocument();
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

  it("places the StarIndicator in the top row and the star count in the bottom row", () => {
    const { container } = render(
      <RepoCard repo={repo} status="starred" starCount={47000} />,
    );
    const article = container.querySelector("article") as HTMLElement;
    const rows = article.querySelectorAll(":scope > div");
    // Top row contains the StarIndicator (aria-label "Starred").
    const starredIcon = screen.getByLabelText("Starred");
    expect(rows[0].contains(starredIcon)).toBe(true);
    // Bottom row contains the formatted star count.
    const countNode = screen.getByText("47k");
    const bottomRow = rows[rows.length - 1];
    expect(bottomRow.contains(countNode)).toBe(true);
  });

  it("shows skeleton for star count when loading and no count yet", () => {
    const { container } = render(
      <RepoCard repo={repo} status="unstarred" metaLoading />,
    );
    // Star count skeleton: h-4 w-10 in bottom-right
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

  describe("lazy avatar", () => {
    it("renders <img> with native lazy-loading attributes and a srcSet", () => {
      const { container } = render(<RepoCard repo={repo} status="unstarred" />);
      const img = container.querySelector("img[alt='ethereum']") as HTMLImageElement | null;
      expect(img).not.toBeNull();
      expect(img!.getAttribute("loading")).toBe("lazy");
      expect(img!.getAttribute("decoding")).toBe("async");
      expect(img!.getAttribute("width")).toBe("40");
      expect(img!.getAttribute("height")).toBe("40");
      const srcSet = img!.getAttribute("srcset") ?? "";
      expect(srcSet).toMatch(/size=40\s+1x/);
      expect(srcSet).toMatch(/size=80\s+2x/);
    });

    it("shows a skeleton placeholder while the avatar has not loaded", () => {
      const { container } = render(<RepoCard repo={repo} status="unstarred" />);
      const avatarSkeleton = container.querySelector(
        "[data-slot='avatar'] [data-slot='skeleton']",
      );
      expect(avatarSkeleton).not.toBeNull();
    });

    it("removes the avatar skeleton once the image's onLoad fires", () => {
      const { container } = render(<RepoCard repo={repo} status="unstarred" />);
      const img = container.querySelector("img[alt='ethereum']") as HTMLImageElement;
      fireEvent.load(img);
      const avatarSkeleton = container.querySelector(
        "[data-slot='avatar'] [data-slot='skeleton']",
      );
      expect(avatarSkeleton).toBeNull();
    });

    it("falls back to initials when the avatar image errors", () => {
      const { container } = render(<RepoCard repo={repo} status="unstarred" />);
      const img = container.querySelector("img[alt='ethereum']") as HTMLImageElement;
      fireEvent.error(img);
      // Image is removed; initials are shown inside the avatar.
      expect(container.querySelector("img[alt='ethereum']")).toBeNull();
      const avatar = container.querySelector("[data-slot='avatar']");
      expect(avatar?.textContent).toBe("ET");
    });
  });

  describe("stretched-link / whole-card click target", () => {
    it("title anchor exposes target, rel, aria-label, and the card href", () => {
      render(<RepoCard repo={repo} status="unstarred" />);
      const anchor = screen.getByRole("link", {
        name: /ethereum\/go-ethereum on GitHub, opens in new tab/i,
      });
      expect(anchor).toHaveAttribute("href", repo.url);
      expect(anchor).toHaveAttribute("target", "_blank");
      expect(anchor).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("card article has `relative` so the stretched ::after overlay is positioned to it", () => {
      const { container } = render(<RepoCard repo={repo} status="unstarred" />);
      const article = container.querySelector("article") as HTMLElement;
      expect(article.className).toMatch(/\brelative\b/);
    });

    it("title anchor applies the stretched-link overlay classes (after:absolute + after:inset-0)", () => {
      const { container } = render(<RepoCard repo={repo} status="unstarred" />);
      const anchor = container.querySelector("a[href='" + repo.url + "']") as HTMLElement;
      expect(anchor.className).toMatch(/after:absolute/);
      expect(anchor.className).toMatch(/after:inset-0/);
    });

    it("wraps the StarIndicator in a `relative z-10` container so the retry button escapes the overlay", () => {
      render(<RepoCard repo={repo} status="failed" onRetry={vi.fn()} />);
      const retryBtn = screen.getByRole("button", { name: /retry starring/i });
      const wrapper = retryBtn.closest("div") as HTMLElement;
      expect(wrapper.className).toMatch(/\brelative\b/);
      expect(wrapper.className).toMatch(/\bz-10\b/);
    });

    it("removes anchor and retry button from the Tab order when focusable={false}", () => {
      render(<RepoCard repo={repo} status="failed" onRetry={vi.fn()} focusable={false} />);
      const anchor = screen.getByRole("link", {
        name: /ethereum\/go-ethereum on GitHub, opens in new tab/i,
      });
      expect(anchor).toHaveAttribute("tabindex", "-1");
      const retryBtn = screen.getByRole("button", { name: /retry starring/i });
      expect(retryBtn).toHaveAttribute("tabindex", "-1");
    });

    it("keeps anchor and retry button tabbable by default (focusable omitted)", () => {
      render(<RepoCard repo={repo} status="failed" onRetry={vi.fn()} />);
      const anchor = screen.getByRole("link", {
        name: /ethereum\/go-ethereum on GitHub, opens in new tab/i,
      });
      expect(anchor).not.toHaveAttribute("tabindex");
      const retryBtn = screen.getByRole("button", { name: /retry starring/i });
      expect(retryBtn).not.toHaveAttribute("tabindex");
    });

    it("clicking the retry button calls onRetry and does NOT follow the card link", async () => {
      const onRetry = vi.fn();
      render(<RepoCard repo={repo} status="failed" onRetry={onRetry} />);
      const retryBtn = screen.getByRole("button", { name: /retry starring/i });

      // Stub window.open to catch accidental navigations.
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

      // Simulate a real click that also bubbles — mirrors user-event behaviour
      // but lets us assert the anchor's default action didn't fire.
      let anchorClicked = false;
      const anchor = screen.getByRole("link", {
        name: /ethereum\/go-ethereum on GitHub, opens in new tab/i,
      });
      anchor.addEventListener("click", (e) => {
        anchorClicked = true;
        e.preventDefault();
      });

      await userEvent.click(retryBtn);

      expect(onRetry).toHaveBeenCalledWith(repo);
      expect(anchorClicked).toBe(false);
      expect(openSpy).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });
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
    const img = container.querySelector("img[alt='ethereum']") as HTMLImageElement;
    fireEvent.load(img);
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBe(0);
  });
});
