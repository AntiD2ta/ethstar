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
import { BrowserRouter } from "react-router";
import type { ReactNode } from "react";
import { SupportSection } from "./support-section";
import { ConsentProvider } from "@/lib/consent";
import { ETH_ADDRESS_CHECKSUMMED } from "@/lib/constants";

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <ConsentProvider>{children}</ConsentProvider>
    </BrowserRouter>
  );
}

describe("SupportSection — footer row alignment", () => {
  it("ETH-tip + copy pill matches the outline-button row height (h-9)", () => {
    render(<SupportSection />, { wrapper: Wrapper });
    // The ETH tip/copy pill is a two-button rounded-full cluster that sits on
    // the same flex row as `<Button variant="outline">` triggers. The outline
    // buttons ship with shadcn's default `h-9`; the custom pill previously
    // had no explicit height, producing a visually noticeable ~6px under-hang
    // on the row. The `h-9` token aligns them on one height.
    const copyBtn = screen.getByTestId("wallet-copy");
    const pill = copyBtn.parentElement;
    expect(pill).not.toBeNull();
    // className assertion is the only feasible check in jsdom — layout
    // properties are not computed there, so we can't measure actual height.
    expect(pill!.className).toMatch(/\bh-9\b/);
  });
});

describe("SupportSection — wallet copy button", () => {
  it("writes the checksummed ETH address to the clipboard when Copy is clicked", async () => {
    // `userEvent.setup()` installs its own clipboard mock, so spy on the
    // resulting navigator.clipboard.writeText after setup to intercept the
    // actual call from the component.
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);

    render(<SupportSection />, { wrapper: Wrapper });
    const copyBtn = screen.getByTestId("wallet-copy");
    expect(copyBtn).toHaveAttribute("aria-label", "Copy wallet address");

    await user.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith(ETH_ADDRESS_CHECKSUMMED);
    // After a successful copy, the aria-label flips so screen-reader users
    // get feedback. Visible label also toggles.
    expect(copyBtn).toHaveAttribute("aria-label", "Wallet address copied");

    writeText.mockRestore();
  });

  it("shows Copy by default and flips to Copied after click", async () => {
    const user = userEvent.setup();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);

    render(<SupportSection />, { wrapper: Wrapper });
    const copyBtn = screen.getByTestId("wallet-copy");
    expect(copyBtn).toHaveTextContent(/^copy$/i);

    await user.click(copyBtn);

    expect(copyBtn).toHaveTextContent(/copied/i);

    writeText.mockRestore();
  });
});
