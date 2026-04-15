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

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  unstarredCount: 5,
  progress: { total: 0, starred: 0, remaining: 0, current: null },
  onStartStarring: vi.fn<(token: string) => Promise<{ starred: number; failed: number }>>(),
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
});
