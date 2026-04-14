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

function mockAuthedApis(page: import("@playwright/test").Page) {
  return Promise.all([
    page.route("https://api.github.com/user", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ login: "e2e", avatar_url: "", name: "E2E" }),
      }),
    ),
    page.route("https://api.github.com/user/starred/**", (r) =>
      r.fulfill({ status: 404, body: "" }),
    ),
    // Force REST fallback so we don't issue an un-mocked GraphQL request.
    page.route("https://api.github.com/graphql", (r) =>
      r.fulfill({ status: 401, body: "" }),
    ),
    page.route("**/api/stats", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ totalStars: 0, totalRepos: 0 }),
      }),
    ),
  ]);
}

test.beforeEach(async ({ page }) => {
  await seedConsent(page);
});

test("home page renders hero headline", async ({ page }) => {
  await page.goto("/");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toContainText("Star Every");
  await expect(heading).toContainText("Ethereum");
  await expect(heading).toContainText("Repo");
});

test("home page shows unauthenticated CTAs", async ({ page }) => {
  await page.goto("/");
  // There are multiple "Connect via GitHub" buttons (header + hero); both should exist.
  await expect(
    page.getByRole("button", { name: "Connect via GitHub" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "View Repositories" }),
  ).toBeVisible();
});

test("home page shows all five repo category sections", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Ethereum Core" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Consensus Clients" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Execution Clients" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Validator Tooling" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "DeFi & Smart Contracts" }),
  ).toBeVisible();
});

test("DeFi marquee shows core DeFi repos", async ({ page }) => {
  await page.goto("/");
  const defiMarquee = page.getByRole("region", {
    name: "Scrolling list of DeFi & Smart Contracts repositories",
  });
  await expect(defiMarquee).toBeVisible();
  // Known cards in the DeFi section — first() disambiguates marquee duplicates.
  await expect(defiMarquee.getByText("v4-core").first()).toBeVisible();
  await expect(defiMarquee.getByText("morpho-blue").first()).toBeVisible();
  await expect(defiMarquee.getByText("aave-v4").first()).toBeVisible();
});

test("home page shows a sample of tracked repos", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("go-ethereum").first()).toBeVisible();
  await expect(page.getByText("lighthouse").first()).toBeVisible();
  await expect(page.getByText("reth").first()).toBeVisible();
  await expect(page.getByText("vouch").first()).toBeVisible();
});

test("home page shows support section", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Support", exact: true }),
  ).toBeVisible();
});

test("skip link targets the repos region and becomes visible on focus", async ({
  page,
}) => {
  await page.goto("/");
  const skip = page.getByRole("link", { name: "Skip to repositories" });
  await expect(skip).toHaveAttribute("href", "#repos");
  // Off-screen until focused.
  const offBox = await skip.boundingBox();
  expect(offBox?.x).toBeLessThan(-1000);
  await skip.focus();
  const onBox = await skip.boundingBox();
  expect(onBox).not.toBeNull();
  expect(onBox!.x).toBeGreaterThanOrEqual(0);
  expect(onBox!.x).toBeLessThan(100);
});

test("marquees expose per-category accessible labels", async ({ page }) => {
  await page.goto("/");
  for (const cat of [
    "Ethereum Core",
    "Consensus Clients",
    "Execution Clients",
    "Validator Tooling",
    "DeFi & Smart Contracts",
  ]) {
    await expect(
      page.getByRole("region", {
        name: `Scrolling list of ${cat} repositories`,
      }),
    ).toBeVisible();
  }
});

test("progress bar and star-all button are hidden when unauthenticated", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Starring progress")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Star All/i })).toHaveCount(0);
});

test("only one StarringControls instance exists at any scroll position", async ({
  page,
}) => {
  // Unauthenticated: zero controls at the top AND bottom. This also guards
  // against the Phase D regression where three duplicate StarringControls
  // instances previously rendered on the home page.
  await page.goto("/");
  await expect(page.getByLabel("Starring controls")).toHaveCount(0);
  // Scroll to the very bottom; still zero for unauthenticated users.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByLabel("Starring controls")).toHaveCount(0);
});

test("sticky floating CTA is absent for unauthenticated users", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("sticky-star-controls")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByTestId("sticky-star-controls")).toHaveCount(0);
});

test("authenticated users: sticky CTA stays hidden while hero is visible", async ({
  page,
}) => {
  // Regression: a sentinel placed below the hero used to report
  // isIntersecting=false on short viewports, causing the sticky CTA to mount
  // alongside the hero's StarringControls and produce two "Star All" buttons
  // in the hero view. The fix observes the hero section itself.
  await seedAuth(page);
  await mockAuthedApis(page);
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto("/");
  await expect(page.getByTestId("starring-controls-hero")).toBeVisible();
  await expect(page.getByTestId("sticky-star-controls")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Star All \d+ Remaining/i })).toHaveCount(1);
});

test("authenticated users: sticky CTA appears after scrolling past hero", async ({
  page,
}) => {
  await seedAuth(page);
  await mockAuthedApis(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("starring-controls-hero")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2));
  await expect(page.getByTestId("sticky-star-controls")).toBeVisible();
});

test.describe("mobile hero viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("hero fits within a single viewport on mobile", async ({ page }) => {
    await page.goto("/");
    const hero = page.getByTestId("hero-section");
    const box = await hero.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThanOrEqual(844);
  });

  test("hero stats row is hidden on mobile (compact inline summary only)", async ({
    page,
  }) => {
    await page.goto("/");
    // role="group" on the 3-stat row should be absent from the a11y tree on <md.
    const statGroup = page.getByRole("group", { name: "Site statistics" });
    await expect(statGroup).toBeHidden();
  });
});
