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
import { seedAuth, seedConsent } from "./helpers";

test.beforeEach(async ({ page }) => {
  await seedConsent(page);
});

/**
 * Helper: seed auth, mock GitHub APIs so some repos are starred and some aren't,
 * then navigate to the home page.
 */
async function setupWithStarStatuses(
  page: import("@playwright/test").Page,
  unstarredRepos: string[],
) {
  await seedAuth(page);

  // Profile fetch.
  await page.route("https://api.github.com/user", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        login: "e2euser",
        avatar_url: "",
        name: "E2E User",
      }),
    }),
  );

  // Star checks: unstarred repos return 404, rest return 204 (starred).
  await page.route("https://api.github.com/user/starred/**", (route) => {
    const url = route.request().url();
    const isUnstarred = unstarredRepos.some((name) => url.endsWith(`/${name}`));
    return route.fulfill({ status: isUnstarred ? 404 : 204, body: "" });
  });

  // Stats API — return zeros so the counter doesn't interfere.
  await page.route("**/api/stats", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ total_stars: 0, total_users: 0 }),
    }),
  );

  // GraphQL — return empty (not auth'd for GraphQL in test).
  await page.route("https://api.github.com/graphql", (route) =>
    route.fulfill({ status: 401, body: "" }),
  );

  await page.goto("/");
}

/**
 * Opens the star modal ("Star All N Remaining" button) then clicks
 * "Star manually instead" to open the manual star modal.
 */
async function openManualModal(page: import("@playwright/test").Page) {
  // Wait for star checks to finish — the "Star All" button appears.
  const starAllBtn = page.getByRole("button", { name: /Star All/i }).first();
  await expect(starAllBtn).toBeVisible({ timeout: 15000 });
  await starAllBtn.click();

  // The star modal (authorization warning) should appear.
  await expect(
    page.getByRole("heading", { name: "Authorization Required" }),
  ).toBeVisible();

  // Click "Star manually instead".
  await page.getByRole("button", { name: "Star manually instead" }).click();

  // The manual star modal should open.
  const modalTitle = page.getByRole("heading", { name: "Star Repos Manually" });
  await expect(modalTitle).toBeVisible();
}

test("Star manually instead opens the manual star modal", async ({ page }) => {
  await setupWithStarStatuses(page, ["go-ethereum", "solidity"]);
  await openManualModal(page);

  // Scope assertions to the modal dialog to avoid matching marquee cards.
  const modal = page.getByRole("dialog");
  await expect(modal.getByText("ethereum/go-ethereum")).toBeVisible();
  await expect(modal.getByText("ethereum/solidity")).toBeVisible();
});

test("manual modal shows filled star for starred repos and outline star for unstarred", async ({
  page,
}) => {
  await setupWithStarStatuses(page, ["solidity"]);
  await openManualModal(page);

  // go-ethereum is starred — should have a filled star (aria-label says "is starred").
  await expect(
    page.getByLabel("ethereum/go-ethereum is starred"),
  ).toBeVisible();

  // solidity is unstarred — should have a link star pointing to GitHub.
  const solLink = page.getByLabel("Star ethereum/solidity on GitHub");
  await expect(solLink).toBeVisible();
  await expect(solLink).toHaveAttribute("href", /github\.com\/ethereum\/solidity/);
  await expect(solLink).toHaveAttribute("target", "_blank");
});

test("unstarred star links open in new tab (href check)", async ({ page }) => {
  await setupWithStarStatuses(page, ["prysm", "lighthouse"]);
  await openManualModal(page);

  // Both unstarred repos should have clickable star links pointing to GitHub.
  for (const repo of ["prysmaticlabs/prysm", "sigp/lighthouse"]) {
    const link = page.getByLabel(`Star ${repo} on GitHub`);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("href", new RegExp(`github\\.com/${repo}`));
  }
});

test("mostly starred shows filled stars for starred and one outline star for unstarred", async ({
  page,
}) => {
  // Only one repo unstarred — the rest are starred.
  await setupWithStarStatuses(page, ["solidity"]);
  await openManualModal(page);

  const modal = page.getByRole("dialog");

  // Only 1 unstarred star link should exist.
  const starLinks = modal.getByRole("link", { name: /Star .+ on GitHub/ });
  await expect(starLinks).toHaveCount(1);
  await expect(
    modal.getByLabel("Star ethereum/solidity on GitHub"),
  ).toBeVisible();

  // Starred icons should exist for the rest.
  await expect(
    modal.getByLabel("ethereum/go-ethereum is starred"),
  ).toBeVisible();
});

test("Done button closes the manual modal", async ({ page }) => {
  await setupWithStarStatuses(page, ["go-ethereum"]);
  await openManualModal(page);

  await page.getByRole("button", { name: "Done" }).click();

  // Modal should be gone.
  await expect(
    page.getByRole("heading", { name: "Star Repos Manually" }),
  ).not.toBeVisible();
});

test("stars are vertically aligned between starred and unstarred rows", async ({
  page,
}) => {
  // Mix of starred and unstarred so both types are visible.
  await setupWithStarStatuses(page, ["solidity"]);
  await openManualModal(page);

  // Get bounding box of starred icon and unstarred link.
  const starredIcon = page.getByLabel("ethereum/go-ethereum is starred");
  const unstarredLink = page.getByLabel("Star ethereum/solidity on GitHub");

  const starredBox = await starredIcon.boundingBox();
  const unstarredBox = await unstarredLink.boundingBox();

  expect(starredBox).not.toBeNull();
  expect(unstarredBox).not.toBeNull();

  // Both should be right-aligned at roughly the same x position (within 8px).
  const starredRight = starredBox!.x + starredBox!.width;
  const unstarredRight = unstarredBox!.x + unstarredBox!.width;
  expect(Math.abs(starredRight - unstarredRight)).toBeLessThan(8);
});
