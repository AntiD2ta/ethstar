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

    // Click "Proceed" to trigger authorization
    await user.click(screen.getByRole("button", { name: /proceed/i }));

    // Error should appear with role="alert"
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/closed/i);
  });
});
