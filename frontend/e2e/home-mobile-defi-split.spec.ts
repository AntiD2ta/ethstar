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
import { seedConsent } from "./helpers";

test.beforeEach(async ({ page }) => {
  await seedConsent(page);
});

test.describe("DeFi category mobile row split", () => {
  test("mobile viewport renders two DeFi rows with a grouping wrapper", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const defiRows = page.getByRole("region", {
      name: /^Scrolling list of DeFi & Smart Contracts repositories, row [12] of 2$/,
    });
    await expect(defiRows).toHaveCount(2);

    // The first row is labelled "row 1 of 2" and the second "row 2 of 2" —
    // ordered top-to-bottom.
    await expect(
      page.getByRole("region", {
        name: "Scrolling list of DeFi & Smart Contracts repositories, row 1 of 2",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", {
        name: "Scrolling list of DeFi & Smart Contracts repositories, row 2 of 2",
      }),
    ).toBeVisible();

    // Both rows sit inside a logical group so screen readers can still treat
    // DeFi as a single unit.
    const group = page.getByRole("group", {
      name: "DeFi & Smart Contracts repositories",
    });
    await expect(group).toBeVisible();
    await expect(group.getByRole("region")).toHaveCount(2);
  });

  test("desktop viewport keeps a single DeFi row", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    // Desktop path: no row-N-of-2 labels, just the unqualified label.
    await expect(
      page.getByRole("region", {
        name: "Scrolling list of DeFi & Smart Contracts repositories",
      }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("region", {
        name: /row 1 of 2/,
      }),
    ).toHaveCount(0);
  });
});
