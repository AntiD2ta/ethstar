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

test("home page renders reframed hero headline", async ({ page }) => {
  await page.goto("/");
  const heading = page.getByRole("heading", { level: 1 });
  // H1 is the framing statement, not a CTA verb.
  await expect(heading).toContainText("Support");
  await expect(heading).toContainText("Ethereum");
  await expect(heading).toContainText("builders");
  // ≤6 words (≤5 preferred). "Support Ethereum's builders" = 3.
  const text = (await heading.textContent())?.trim() ?? "";
  expect(text.split(/\s+/).length).toBeLessThanOrEqual(6);
});

test("hero copy tiers have distinct text", async ({ page }) => {
  await page.goto("/");
  const h1 = (await page.getByTestId("hero-h1").textContent())?.trim() ?? "";
  const subhead =
    (await page.getByTestId("hero-subhead").textContent())?.trim() ?? "";
  // Dormant-star primary line is the visible label rendered alongside the
  // star button (sibling, not button text). Match the verb+count template.
  const dormantLabel =
    (await page.getByText(/^Star all \d+ now$/).first().textContent())?.trim() ??
    "";

  const lower = (s: string) => s.toLowerCase();
  const pairs: Array<[string, string]> = [
    [h1, subhead],
    [h1, dormantLabel],
    [subhead, dormantLabel],
  ];
  for (const [a, b] of pairs) {
    expect(a.length, `tier should be non-empty`).toBeGreaterThan(0);
    expect(b.length, `tier should be non-empty`).toBeGreaterThan(0);
    expect(
      lower(b).includes(lower(a)),
      `tier "${a}" should not be a substring of "${b}"`,
    ).toBe(false);
    expect(
      lower(a).includes(lower(b)),
      `tier "${b}" should not be a substring of "${a}"`,
    ).toBe(false);
  }
});

test("hero stacks vertically with the star CTA below the subhead and above the browse link", async ({ page }) => {
  // Scene-centric hero: single centered column, vertical reading order
  // H1 → subhead → star CTA → browse link → stats. Guard against a
  // regression to the 12-col asymmetric grid (star in the right column).
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const h1Box = await page.getByTestId("hero-h1").boundingBox();
  const subheadBox = await page.getByTestId("hero-subhead").boundingBox();
  const starBox = await page
    .getByTestId("roaming-star-button")
    .first()
    .boundingBox();
  const browseBox = await page
    .getByRole("button", { name: /browse the repositories/i })
    .boundingBox();
  const metaBox = await page.getByTestId("hero-meta").boundingBox();
  expect(h1Box, "H1 should render").not.toBeNull();
  expect(subheadBox, "subhead should render").not.toBeNull();
  expect(starBox, "roaming star should render").not.toBeNull();
  expect(browseBox, "browse-repositories link should render").not.toBeNull();
  expect(metaBox, "stats meta line should render").not.toBeNull();
  // Vertical order: each element's top is below the previous one's top.
  expect(subheadBox!.y).toBeGreaterThan(h1Box!.y);
  expect(starBox!.y).toBeGreaterThan(subheadBox!.y);
  expect(browseBox!.y).toBeGreaterThan(starBox!.y);
  expect(metaBox!.y).toBeGreaterThan(browseBox!.y);
  // Centered axis: the star's horizontal center sits near the H1's center
  // (±24px tolerance covers subpixel rounding and the roaming-star button's
  // internal padding).
  const h1Center = h1Box!.x + h1Box!.width / 2;
  const starCenter = starBox!.x + starBox!.width / 2;
  expect(Math.abs(starCenter - h1Center)).toBeLessThan(24);
});

test("home page shows unauthenticated CTAs", async ({ page }) => {
  await page.goto("/");
  // Header CTA is now "Sign in with GitHub" (or "Sign in" on <sm).
  await expect(
    page.getByRole("button", { name: /sign in/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /browse the repositories/i }),
  ).toBeVisible();
});

test("header CTAs render the full-length label at ≥sm (not accessible-name-only)", async ({
  page,
}) => {
  // Guard against the `hidden sm:inline` bug: accessible name would still pass
  // `getByRole` matchers even when both spans compute to display:none, leaving
  // a visually empty pill. Use `innerText` to assert what sighted users see.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const header = page.locator("header").first();

  const signIn = header.getByRole("button", { name: /sign in/i });
  await expect(signIn).toBeVisible();
  const signInText = (await signIn.evaluate((el) => (el as HTMLElement).innerText)).trim();
  expect(signInText).toBe("Sign in with GitHub");

  const propose = header.getByRole("link", { name: /Propose more repos/i });
  await expect(propose).toBeVisible();
  const proposeText = (await propose.evaluate((el) => (el as HTMLElement).innerText)).trim();
  expect(proposeText).toBe("Propose more repos");
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

test("unauthenticated: RoamingStar dormant CTA names the action and provider", async ({ page }) => {
  await page.goto("/");
  // Dormant slot is present with the disconnected-state button/label.
  await expect(page.getByTestId("roaming-star-dormant-slot")).toBeVisible();
  const star = page.getByTestId("roaming-star-button").first();
  await expect(star).toBeVisible();
  await expect(star).toHaveAttribute("data-status", "disconnected");
  // Primary line is verb + count; secondary names the provider + direction.
  await expect(page.getByText(/^Star all \d+ now$/).first()).toBeVisible();
  await expect(page.getByText("Sign in with GitHub ↗").first()).toBeVisible();
  // The legacy "Star All N Remaining" button should no longer exist.
  await expect(page.getByRole("button", { name: /Star All \d+ Remaining/i })).toHaveCount(0);
});

test("exactly one RoamingStar exists at any scroll position", async ({ page }) => {
  // Regression guard against mounting both a dormant and floating star. The
  // component renders one or the other based on hero visibility.
  await page.goto("/");
  await expect(page.getByTestId("roaming-star-button")).toHaveCount(1);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByTestId("roaming-star-button")).toHaveCount(1);
});

test("authenticated: RoamingStar shows 'Begin starring' when hero is visible", async ({
  page,
}) => {
  await seedAuth(page);
  await mockAuthedApis(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("roaming-star-dormant-slot")).toBeVisible();
  const star = page.getByTestId("roaming-star-button").first();
  await expect(star).toBeVisible();
  // Once the checkStars loop resolves, status moves from disconnected to ready.
  await expect(star).toHaveAttribute("data-status", "ready", { timeout: 5_000 });
});

test("authenticated: RoamingStar still renders after scrolling past hero", async ({
  page,
}) => {
  await seedAuth(page);
  await mockAuthedApis(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("roaming-star-button")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2));
  // Still exactly one star, now in the portal (roaming mode).
  await expect(page.getByTestId("roaming-star-button")).toHaveCount(1);
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

  test("hero stats meta line is visible on mobile", async ({ page }) => {
    await page.goto("/");
    // Scene-centric hero keeps a single inline stats line always rendered.
    // toBeHidden() silently passes when a locator matches zero elements, so
    // assert presence + visibility to guard against a regression that drops
    // the line on narrow viewports.
    const meta = page.getByTestId("hero-meta");
    await expect(meta).toBeVisible();
    await expect(meta).toHaveText(/repos/i);
    await expect(meta).toHaveText(/combined stars/i);
    await expect(meta).toHaveText(/categor/i);
  });
});

test.describe("hero — consent banner visible", () => {
  // These tests exercise behaviours that require the consent banner to render
  // (the test bodies click `consent-reject`). Override the file-level
  // `seedConsent` beforeEach by clearing the seeded key before each navigation.
  // `addInitScript` runs in registration order on every document load, so this
  // runs after the outer seed script and leaves localStorage empty.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("ethstar_consent");
    });
  });

  test("hero renders the 'what is starring?' explainer above the fold", async ({
    page,
  }) => {
    await page.goto("/");
    // Dismiss consent banner so it doesn't push layout on small viewports.
    await page.getByTestId("consent-reject").click();
    const explainer = page.getByTestId("starring-explainer");
    await expect(explainer).toBeVisible();
    await expect(explainer).toHaveText(/a github star is a free public signal/i);
  });

  test("cold-start renders the fallback star count with ~ prefix and opacity-60 while live data loads", async ({
    page,
  }) => {
    // Delay the GraphQL meta endpoint so the fallback remains visible long
    // enough to assert the placeholder treatment.
    await page.route("**/api.github.com/graphql", async (route) => {
      await new Promise((r) => setTimeout(r, 3_000));
      await route.continue();
    });

    await page.goto("/");
    // Dismiss consent banner so it doesn't layer over the hero stats.
    await page.getByTestId("consent-reject").click();

    const stars = page.getByTestId("combined-stars");
    await expect(stars).toBeVisible();
    // While live data has not arrived, the span reports data-live="false",
    // renders a "~" prefix, and carries the opacity-60 class.
    await expect(stars).toHaveAttribute("data-live", "false");
    await expect(stars).toHaveText(/^~/);
    await expect(stars).toHaveClass(/opacity-60/);
  });
});
