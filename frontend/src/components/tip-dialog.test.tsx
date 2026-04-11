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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TipDialog } from "@/components/tip-dialog";
import { ETH_ADDRESS_CHECKSUMMED } from "@/lib/constants";

describe("TipDialog", () => {
  // Ensure each test starts from a known baseline — no wallet injected.
  beforeEach(() => {
    Object.defineProperty(window, "ethereum", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  it("renders nothing when closed", () => {
    render(<TipDialog open={false} onOpenChange={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog with title when open", () => {
    render(<TipDialog open={true} onOpenChange={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Send an ETH Tip")).toBeInTheDocument();
  });

  it("displays QR code SVG", () => {
    render(<TipDialog open={true} onOpenChange={() => {}} />);
    const qrContainer = screen.getByTestId("tip-qr-code");
    expect(qrContainer.querySelector("svg")).toBeInTheDocument();
  });

  it("displays full checksummed address", () => {
    render(<TipDialog open={true} onOpenChange={() => {}} />);
    expect(screen.getByText(ETH_ADDRESS_CHECKSUMMED)).toBeInTheDocument();
  });

  it("copies address to clipboard on copy button click", async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);

    render(<TipDialog open={true} onOpenChange={() => {}} />);

    const copyBtn = screen.getByRole("button", { name: /copy address/i });
    await user.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith(ETH_ADDRESS_CHECKSUMMED);
  });

  it("hides wallet button when no wallet detected", () => {
    render(<TipDialog open={true} onOpenChange={() => {}} />);
    expect(
      screen.queryByRole("button", { name: /send with wallet/i }),
    ).not.toBeInTheDocument();
  });

  it("shows wallet button when window.ethereum is available", () => {
    Object.defineProperty(window, "ethereum", {
      value: { request: vi.fn() },
      configurable: true,
      writable: true,
    });
    render(<TipDialog open={true} onOpenChange={() => {}} />);
    expect(
      screen.getByRole("button", { name: /send with wallet/i }),
    ).toBeInTheDocument();
  });

  it("calls eth_requestAccounts then eth_sendTransaction on wallet send", async () => {
    const user = userEvent.setup();
    const request = vi
      .fn<(args: { method: string; params?: unknown[] }) => Promise<unknown>>()
      .mockImplementation(({ method }) => {
        if (method === "eth_requestAccounts")
          return Promise.resolve(["0xSenderAddr"]);
        if (method === "eth_sendTransaction")
          return Promise.resolve("0xTxHash");
        return Promise.resolve(null);
      });

    Object.defineProperty(window, "ethereum", {
      value: { request },
      configurable: true,
      writable: true,
    });

    render(<TipDialog open={true} onOpenChange={() => {}} />);

    const sendBtn = screen.getByRole("button", { name: /send with wallet/i });
    await user.click(sendBtn);

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        method: "eth_requestAccounts",
      });
      expect(request).toHaveBeenCalledWith({
        method: "eth_sendTransaction",
        params: [
          expect.objectContaining({
            from: "0xSenderAddr",
            to: ETH_ADDRESS_CHECKSUMMED,
          }),
        ],
      });
    });
  });

  it("handles user wallet rejection gracefully", async () => {
    const user = userEvent.setup();
    const request = vi
      .fn<(args: { method: string; params?: unknown[] }) => Promise<unknown>>()
      .mockRejectedValue({ code: 4001, message: "User rejected" });

    Object.defineProperty(window, "ethereum", {
      value: { request },
      configurable: true,
      writable: true,
    });

    render(<TipDialog open={true} onOpenChange={() => {}} />);

    const sendBtn = screen.getByRole("button", { name: /send with wallet/i });
    await user.click(sendBtn);

    // Should not throw — rejection is handled internally
    await waitFor(() => {
      expect(sendBtn).toBeEnabled();
    });
  });

  it("calls onOpenChange(false) when close button is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<TipDialog open={true} onOpenChange={onOpenChange} />);

    // The DialogContent has a built-in close button (X)
    const closeBtn = screen.getByRole("button", { name: /close/i });
    await user.click(closeBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
