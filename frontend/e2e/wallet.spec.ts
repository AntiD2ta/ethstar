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

import { test, expect } from "@playwright/test";

test.describe("Wallet copy button", () => {
  test("wallet address has an accessible Copy button that writes to the clipboard", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.getByTestId("consent-reject").click();
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const copyBtn = page.getByTestId("wallet-copy");
    await copyBtn.scrollIntoViewIfNeeded();
    await expect(copyBtn).toBeVisible();
    await expect(copyBtn).toHaveAttribute("aria-label", "Copy wallet address");
    await copyBtn.click();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});
