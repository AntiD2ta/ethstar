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
import { StarModal } from "./star-modal";
import { STAR_OAUTH_ERROR } from "@/hooks/use-star-oauth";

type StarResult = { starred: number; failed: number; aborted: boolean };

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  unstarredCount: 5,
  progress: { total: 0, starred: 0, remaining: 0, current: null },
  onStartStarring: vi.fn<(token: string) => Promise<StarResult>>(),
  requestToken: vi.fn<() => Promise<string>>(),
  cancelOAuth: vi.fn(),
  starResult: null,
  onOpenManualModal: vi.fn(),
  onCancelStarring: vi.fn(),
};

describe("StarModal", () => {
  it("renders a visually-hidden step announcer with aria-live=assertive", () => {
    render(<StarModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    const announcer = within(dialog).getByText("Authorization required");
    expect(announcer.closest("[aria-live]")).toHaveAttribute(
      "aria-live",
      "assertive",
    );
  });

  it("announcer container has sr-only class for visual hiding", () => {
    render(<StarModal {...defaultProps} />);
    const dialog = screen.getByRole("dialog");
    const announcer = within(dialog).getByText("Authorization required");
    expect(announcer).toHaveClass("sr-only");
  });

  it("shows error with role=alert when auth fails", async () => {
    const requestToken = vi.fn<() => Promise<string>>().mockRejectedValue(
      new Error(STAR_OAUTH_ERROR.POPUP_CLOSED),
    );
    render(<StarModal {...defaultProps} requestToken={requestToken} />);
    const user = userEvent.setup();

    // Click "Star all N" to trigger authorization
    await user.click(screen.getByRole("button", { name: /^star all/i }));

    // Error should appear with role="alert"
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/closed/i);
  });

  it("renders popup-blocked help with accessible link when popupBlocked prop is true", () => {
    render(<StarModal {...defaultProps} popupBlocked={true} />);
    const help = screen.getByTestId("popup-blocked-help");
    expect(help).toHaveTextContent(/popup blocked/i);
    const link = within(help).getByRole("link", { name: /enable popups/i });
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("transitions to stopped state with 'Stopped at X of Y' when onStartStarring returns aborted=true", async () => {
    const requestToken = vi.fn<() => Promise<string>>().mockResolvedValue("tok");
    const onStartStarring = vi
      .fn<(token: string) => Promise<StarResult>>()
      .mockResolvedValue({ starred: 3, failed: 0, aborted: true });

    const { rerender } = render(
      <StarModal
        {...defaultProps}
        progress={{ total: 5, starred: 3, remaining: 2, current: null }}
        requestToken={requestToken}
        onStartStarring={onStartStarring}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^star all/i }));

    // onStartStarring resolved aborted=true → step should be "stopped".
    // Rerender with starResult populated (as the parent would).
    rerender(
      <StarModal
        {...defaultProps}
        progress={{ total: 5, starred: 3, remaining: 2, current: null }}
        requestToken={requestToken}
        onStartStarring={onStartStarring}
        starResult={{ starred: 3, failed: 0, aborted: true }}
      />,
    );

    expect(await screen.findByTestId("star-modal-stopped")).toBeInTheDocument();
    expect(screen.getByText(/stopped at 3 of 5/i)).toBeInTheDocument();
  });

  it("renames the progress-step abort button to 'Stop after current'", async () => {
    const requestToken = vi.fn<() => Promise<string>>().mockResolvedValue("tok");
    // Promise that never resolves so the modal stays in "progress" step.
    const onStartStarring = vi
      .fn<(token: string) => Promise<StarResult>>()
      .mockImplementation(() => new Promise(() => {}));

    render(
      <StarModal
        {...defaultProps}
        progress={{ total: 3, starred: 1, remaining: 2, current: null }}
        requestToken={requestToken}
        onStartStarring={onStartStarring}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /^star all/i }));

    const stopBtn = await screen.findByTestId("takeover-cancel");
    expect(stopBtn).toHaveTextContent(/stop after current/i);
  });
});
