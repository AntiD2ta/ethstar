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
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "@/components/command-palette";
import type { Repository } from "@/lib/types";

const SAMPLE_REPOS: Repository[] = [
  {
    owner: "ethereum",
    name: "go-ethereum",
    description: "Go implementation of the Ethereum protocol",
    category: "Ethereum Core",
    url: "https://github.com/ethereum/go-ethereum",
  },
  {
    owner: "ethereum",
    name: "solidity",
    description: "Solidity, the Smart Contract Programming Language",
    category: "Ethereum Core",
    url: "https://github.com/ethereum/solidity",
  },
  {
    owner: "Uniswap",
    name: "v4-core",
    description: "Uniswap v4 core contracts",
    category: "DeFi & Smart Contracts",
    url: "https://github.com/Uniswap/v4-core",
  },
];

function renderPalette(overrides: Partial<Parameters<typeof CommandPalette>[0]> = {}) {
  const onNavigate = vi.fn();
  const onOpenExternal = vi.fn();
  const onLogin = vi.fn();
  const onLogout = vi.fn();
  const onClose = vi.fn();
  const props: Parameters<typeof CommandPalette>[0] = {
    onClose,
    isAuthenticated: false,
    repositories: SAMPLE_REPOS,
    onNavigate,
    onOpenExternal,
    onLogin,
    onLogout,
    ...overrides,
  };
  render(<CommandPalette {...props} />);
  return { onNavigate, onOpenExternal, onLogin, onLogout, onClose };
}

describe("CommandPalette", () => {
  it("renders the search input with the expected placeholder", () => {
    renderPalette();
    expect(
      screen.getByPlaceholderText(/search routes, actions, or repositories/i),
    ).toBeInTheDocument();
  });

  it("shows Navigate, Account, Actions, and Repositories groups when open", () => {
    renderPalette();
    expect(screen.getByText(/^navigate$/i)).toBeInTheDocument();
    expect(screen.getByText(/^account$/i)).toBeInTheDocument();
    expect(screen.getByText(/^actions$/i)).toBeInTheDocument();
    expect(screen.getByText(/^repositories$/i)).toBeInTheDocument();
  });

  it("renders all three nav routes (Home, Privacy, Cookies)", () => {
    renderPalette();
    expect(screen.getByRole("option", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /privacy/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /cookies/i })).toBeInTheDocument();
  });

  it("invokes onNavigate with '/' when Home is selected", async () => {
    const user = userEvent.setup();
    const { onNavigate, onClose } = renderPalette();
    await user.click(screen.getByRole("option", { name: /home/i }));
    expect(onNavigate).toHaveBeenCalledWith("/");
    expect(onClose).toHaveBeenCalled();
  });

  it("invokes onNavigate with '/privacy' when Privacy is selected", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderPalette();
    await user.click(screen.getByRole("option", { name: /privacy/i }));
    expect(onNavigate).toHaveBeenCalledWith("/privacy");
  });

  it("invokes onNavigate with '/cookies' when Cookies is selected", async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderPalette();
    await user.click(screen.getByRole("option", { name: /cookies/i }));
    expect(onNavigate).toHaveBeenCalledWith("/cookies");
  });

  it("renders Sign in when unauthenticated and invokes onLogin", async () => {
    const user = userEvent.setup();
    const { onLogin, onLogout, onClose } = renderPalette({
      isAuthenticated: false,
    });
    const item = screen.getByRole("option", { name: /sign in with github/i });
    await user.click(item);
    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(onLogout).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("renders Sign out when authenticated and invokes onLogout", async () => {
    const user = userEvent.setup();
    const { onLogin, onLogout, onClose } = renderPalette({
      isAuthenticated: true,
    });
    expect(
      screen.queryByRole("option", { name: /sign in with github/i }),
    ).not.toBeInTheDocument();
    const item = screen.getByRole("option", { name: /sign out/i });
    await user.click(item);
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(onLogin).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("renders 'Propose more repos' and invokes onOpenExternal with the MAINTAINERS URL", async () => {
    const user = userEvent.setup();
    const { onOpenExternal, onClose } = renderPalette();
    const item = screen.getByRole("option", { name: /propose more repos/i });
    await user.click(item);
    expect(onOpenExternal).toHaveBeenCalledTimes(1);
    const urlArg = onOpenExternal.mock.calls[0][0];
    expect(urlArg).toMatch(/MAINTAINERS\.md/);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders one command item per repository", () => {
    renderPalette();
    const reposHeading = screen.getByText(/^repositories$/i);
    const reposGroup = reposHeading.closest("[cmdk-group]") as HTMLElement;
    expect(reposGroup).not.toBeNull();
    const items = within(reposGroup).getAllByRole("option");
    expect(items).toHaveLength(SAMPLE_REPOS.length);
  });

  it("filters the Repositories group to a matching repo when typing", async () => {
    const user = userEvent.setup();
    renderPalette();
    const input = screen.getByPlaceholderText(
      /search routes, actions, or repositories/i,
    );
    await user.type(input, "go-ethereum");
    // Only go-ethereum should remain visible in the repositories group.
    expect(
      screen.getByRole("option", { name: /ethereum\/go-ethereum/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /ethereum\/solidity/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /uniswap\/v4-core/i }),
    ).not.toBeInTheDocument();
  });

  it("ranks exact owner/name matches first (no description noise)", async () => {
    const user = userEvent.setup();
    renderPalette();
    const input = screen.getByPlaceholderText(
      /search routes, actions, or repositories/i,
    );
    await user.type(input, "go-ethereum");
    // Only ethereum/go-ethereum should remain — owner/name is the only search
    // surface for repos; descriptions don't fuzzy-score against the query.
    const visible = screen
      .getAllByRole("option")
      .map((el) => el.textContent ?? "");
    const repoVisible = visible.filter((t) => t.includes("/"));
    expect(repoVisible).toHaveLength(1);
    expect(repoVisible[0]).toMatch(/ethereum\/go-ethereum/);
  });

  it("invokes onOpenExternal with the repo URL when a repo item is selected", async () => {
    const user = userEvent.setup();
    const { onOpenExternal, onClose } = renderPalette();
    await user.click(
      screen.getByRole("option", { name: /ethereum\/go-ethereum/i }),
    );
    expect(onOpenExternal).toHaveBeenCalledWith(
      "https://github.com/ethereum/go-ethereum",
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("renders the empty state when no results match", async () => {
    const user = userEvent.setup();
    renderPalette();
    const input = screen.getByPlaceholderText(
      /search routes, actions, or repositories/i,
    );
    await user.type(input, "zzzzznomatch");
    expect(screen.getByText(/no results found/i)).toBeInTheDocument();
  });

  it("starts with an empty input on each mount", async () => {
    // RootLayout unmounts CommandPalette when closed and remounts on next
    // open — this asserts the invariant that each mount begins fresh, so the
    // search input can never leak between sessions.
    const user = userEvent.setup();
    const props = {
      open: true,
      onClose: vi.fn(),
      isAuthenticated: false,
      repositories: SAMPLE_REPOS,
      onNavigate: vi.fn(),
      onOpenExternal: vi.fn(),
      onLogin: vi.fn(),
      onLogout: vi.fn(),
    };
    const { unmount } = render(<CommandPalette {...props} />);
    const input = screen.getByPlaceholderText(
      /search routes, actions, or repositories/i,
    );
    await user.type(input, "solidity");
    expect(input).toHaveValue("solidity");
    unmount();
    render(<CommandPalette {...props} />);
    const inputAfter = screen.getByPlaceholderText(
      /search routes, actions, or repositories/i,
    );
    expect(inputAfter).toHaveValue("");
  });

  it("does not expose a Star action for repositories", () => {
    renderPalette();
    const reposHeading = screen.getByText(/^repositories$/i);
    const reposGroup = reposHeading.closest("[cmdk-group]") as HTMLElement;
    // Repositories group must not contain a "Star" option — the palette is
    // nav-only for repos per the spec.
    expect(
      within(reposGroup).queryByRole("option", { name: /^star$/i }),
    ).not.toBeInTheDocument();
  });
});
