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

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RingFilterSheet } from "./ring-filter-sheet";
import { DEFAULT_RING_FILTER, toggleSection } from "@/lib/ring-filter";

describe("RingFilterSheet", () => {
  it("renders the customize trigger with the showing-k-of-N label", () => {
    render(
      <RingFilterSheet
        filter={DEFAULT_RING_FILTER}
        selectedCount={14}
        totalCount={58}
        isAuthenticated={true}
        onToggleSection={() => {}}
        onToggleRepo={() => {}}
        onReset={() => {}}
      />,
    );
    expect(screen.getByText(/showing 14 of 58/i)).toBeInTheDocument();
  });

  it("renders the connect prompt when signed-out", () => {
    render(
      <RingFilterSheet
        filter={DEFAULT_RING_FILTER}
        selectedCount={14}
        totalCount={58}
        isAuthenticated={false}
        onToggleSection={() => {}}
        onToggleRepo={() => {}}
        onReset={() => {}}
      />,
    );
    expect(screen.getByText(/connect to customize/i)).toBeInTheDocument();
    // The customize button/link should not be present while signed-out.
    expect(
      screen.queryByRole("button", { name: /customize/i }),
    ).not.toBeInTheDocument();
  });

  it("opens the sheet on Customize click (authed) and renders section toggles", async () => {
    const user = userEvent.setup();
    render(
      <RingFilterSheet
        filter={DEFAULT_RING_FILTER}
        selectedCount={14}
        totalCount={58}
        isAuthenticated={true}
        onToggleSection={() => {}}
        onToggleRepo={() => {}}
        onReset={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: /customize/i }));
    // Section checkboxes — all 5 categories appear
    expect(await screen.findByRole("checkbox", { name: /ethereum core/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /validator tooling/i })).not.toBeChecked();
  });

  it("calls onToggleSection when a section checkbox is clicked", async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(
      <RingFilterSheet
        filter={DEFAULT_RING_FILTER}
        selectedCount={14}
        totalCount={58}
        isAuthenticated={true}
        onToggleSection={handler}
        onToggleRepo={() => {}}
        onReset={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: /customize/i }));
    await user.click(
      await screen.findByRole("checkbox", { name: /validator tooling/i }),
    );
    expect(handler).toHaveBeenCalledWith("Validator Tooling");
  });

  it("Reset button is hidden on the default filter", async () => {
    const user = userEvent.setup();
    render(
      <RingFilterSheet
        filter={DEFAULT_RING_FILTER}
        selectedCount={14}
        totalCount={58}
        isAuthenticated={true}
        onToggleSection={() => {}}
        onToggleRepo={() => {}}
        onReset={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: /customize/i }));
    expect(
      screen.queryByRole("button", { name: /reset to default/i }),
    ).not.toBeInTheDocument();
  });

  it("Reset button appears on a customised filter and fires onReset", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    const custom = toggleSection(DEFAULT_RING_FILTER, "Validator Tooling");
    render(
      <RingFilterSheet
        filter={custom}
        selectedCount={48}
        totalCount={58}
        isAuthenticated={true}
        onToggleSection={() => {}}
        onToggleRepo={() => {}}
        onReset={onReset}
      />,
    );
    await user.click(screen.getByRole("button", { name: /customize/i }));
    await user.click(
      await screen.findByRole("button", { name: /reset to default/i }),
    );
    expect(onReset).toHaveBeenCalled();
  });
});
