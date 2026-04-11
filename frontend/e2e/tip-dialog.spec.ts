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

test.describe("Tip Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Scroll to the support section and click the ETH button
    const ethBtn = page.getByRole("button", { name: "Send ETH tip" });
    await ethBtn.scrollIntoViewIfNeeded();
    await ethBtn.click();
  });

  test("opens dialog with title and three sections", async ({ page }) => {
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Send an ETH Tip", exact: true }),
    ).toBeVisible();
    // Section 1: Thank you message
    await expect(dialog.getByText(/Your support will make me smile/)).toBeVisible();
    // Section 2: Why tips help
    await expect(dialog.getByText(/brain fuel/)).toBeVisible();
    // Section 3: Send instructions
    await expect(dialog.getByText(/Send ETH or ERC-20 on Mainnet/)).toBeVisible();
  });

  test("displays QR code SVG", async ({ page }) => {
    const qr = page.getByTestId("tip-qr-code");
    await expect(qr).toBeVisible();
    await expect(qr.locator("svg")).toBeVisible();
  });

  test("displays full checksummed address", async ({ page }) => {
    // Must match ETH_ADDRESS_CHECKSUMMED in src/lib/constants.ts
    await expect(
      page.getByText("0x03574B4BBB883A790234d200B6C3C74f1C4A8bfD"),
    ).toBeVisible();
  });

  test("has a copy address button", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /copy address/i }),
    ).toBeVisible();
  });

  test("closes when X button is clicked", async ({ page }) => {
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.getByRole("button", { name: /close/i }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("closes when Escape is pressed", async ({ page }) => {
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });
});
