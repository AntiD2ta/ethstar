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

// Regression spec for the /impeccable:critique response fixes to the
// RoamingStar. Each test pins one behavioral change so future work can't
// silently regress the findings:
//
//   - dormant label reveals the GitHub action (Recognition)
//   - ready state shows a "remaining" sublabel (Help)
//   - rhombus silhouette's fillLevel=0.5 reads as half-ink (P1 optics)
//   - StarModal warning copy names the scope (Error Prevention)
//   - the takeover Cancel button (when triggered via the OAuth flow) would
//     be keyboard-reachable with a visible focus ring (Flexibility)
//
// Full takeover-progression tests require a stubbed OAuth popup which is
// painful in Playwright; that path is covered by the unit + integration
// layers. These tests stay on DOM-observable surface area.

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

test("dormant (disconnected): label names the action with a count and the auth provider", async ({ page }) => {
  await page.goto("/");
  // Phase E reframe: primary line is verb + count ("Star all 58 now"), paired
  // with the H1 "Support Ethereum's builders" — no semantic duplication.
  await expect(page.getByText(/^Star all \d+ now$/).first()).toBeVisible();
  await expect(page.getByText("Sign in with GitHub ↗").first()).toBeVisible();
  // The legacy slop strings must be gone.
  await expect(page.getByText("Light it up")).toHaveCount(0);
  await expect(page.getByText("Star every Ethereum repo")).toHaveCount(0);
});

test("dormant (ready): shows a 'repos to go' sublabel so Jordan knows the scope", async ({ page }) => {
  await seedAuth(page);
  await mockAuthedApis(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const star = page.getByTestId("roaming-star-button").first();
  await expect(star).toHaveAttribute("data-status", "ready", { timeout: 5_000 });
  await expect(page.getByText("Begin starring").first()).toBeVisible();
  // At least one repo is unstarred (our mock returns 404 on every check).
  await expect(page.getByText(/\d+ repos to go/).first()).toBeVisible();
});

test("ready state fill is calibrated for the authentic ETH diamond (0.42, not 0.5)", async ({ page }) => {
  await seedAuth(page);
  await mockAuthedApis(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const star = page.getByTestId("roaming-star-button").first();
  await expect(star).toHaveAttribute("data-status", "ready", { timeout: 5_000 });
  // The silhouette is the canonical Ethereum octahedron (asymmetric —
  // taller upper kite, shorter lower chevron). A naive fillLevel=0.5 would
  // over-cover the ink. We calibrate to 0.42 so the visual half-read lines
  // up with the lower chevron plus a narrow creep into the waist.
  const clipRect = star.locator("svg clipPath rect");
  await expect(clipRect).toHaveAttribute("y", "42");
  await expect(clipRect).toHaveAttribute("height", "58");
});

test("no '0 repos to go' flash while checkStars runs on refresh (all-starred)", async ({ page }) => {
  await seedAuth(page);
  // Mock all star-check responses as 204 (starred) but delay them so the
  // "checking" window is long enough to observe. The regression: the dormant
  // label used to transiently read "Begin starring — 0 REPOS TO GO" during
  // this window because `computeProgress` didn't count "checking" as remaining.
  await page.route("https://api.github.com/user", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ login: "e2e", avatar_url: "", name: "E2E" }),
    }),
  );
  // Per-route delay is tuned to keep the checking window observable without
  // letting the full check run long enough to collide with the success-
  // assertion timeout under parallel Playwright workers. With 58 repos and
  // concurrency=5 (the internal CONCURRENT_CHECK_LIMIT = 5 constant in
  // lib/github.ts), total check time is ~12 rounds × delay. 100ms yields
  // ~1.2s total clean, comfortably under the raised 10s timeout even with
  // 5× local CPU contention. CHECK_SAMPLE_WINDOW_MS must stay ≥ that ~1.2s
  // so the sampling loop covers the full checking phase.
  const MOCK_DELAY_MS = 100;
  const CHECK_SAMPLE_WINDOW_MS = 1_500;
  await page.route("https://api.github.com/user/starred/**", async (r) => {
    await new Promise((res) => setTimeout(res, MOCK_DELAY_MS));
    await r.fulfill({ status: 204, body: "" });
  });
  await page.route("https://api.github.com/graphql", (r) =>
    r.fulfill({ status: 401, body: "" }),
  );
  await page.route("**/api/stats", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ totalStars: 0, totalRepos: 0 }),
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  // While the check is still in-flight, the star must not render the ready
  // state with a bogus "0 repos to go" caption. Sample the DOM several times
  // across the check window to catch any transient flicker.
  const star = page.getByTestId("roaming-star-button").first();
  const deadline = Date.now() + CHECK_SAMPLE_WINDOW_MS;
  while (Date.now() < deadline) {
    const status = await star.getAttribute("data-status");
    if (status === "success") break;
    const zeroBug = await page.getByText("0 repos to go").count();
    expect(zeroBug).toBe(0);
    await page.waitForTimeout(40);
  }

  // And we do eventually resolve to the "All starred" success state.
  // Timeout is generous (10s) so the assertion tolerates parallel-worker CPU
  // contention on local runs.
  await expect(star).toHaveAttribute("data-status", "success", { timeout: 10_000 });
  await expect(page.getByText("All starred").first()).toBeVisible();
});

test("dormant (checking): renders a skeleton instead of a live-flickering count while checkStars runs", async ({ page }) => {
  await seedAuth(page);
  // Mock user profile + a delayed mix of starred/unstarred responses so the
  // check window is long enough for the skeleton to be observable. We don't
  // want the remaining count to settle immediately.
  await page.route("https://api.github.com/user", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ login: "e2e", avatar_url: "", name: "E2E" }),
    }),
  );
  let starredToggle = false;
  await page.route("https://api.github.com/user/starred/**", async (r) => {
    await new Promise((res) => setTimeout(res, 400));
    starredToggle = !starredToggle;
    await r.fulfill({ status: starredToggle ? 204 : 404, body: "" });
  });
  await page.route("https://api.github.com/graphql", (r) =>
    r.fulfill({ status: 401, body: "" }),
  );
  await page.route("**/api/stats", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ totalStars: 0, totalRepos: 0 }),
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  // Skeleton should appear during the checking window — proves we render the
  // placeholder instead of "N repos to go" while counts are still drifting.
  const skeleton = page.getByTestId("roaming-star-checking-skeleton");
  await expect(skeleton).toBeVisible({ timeout: 3_000 });
  // And a live-flickering count must NOT be visible during this window.
  await expect(page.locator("text=/\\d+ repos to go/")).toHaveCount(0);
});

test("clicking the All-starred diamond does not open StarModal and fires a celebratory supernova replay", async ({ page }) => {
  await seedAuth(page);
  await page.route("https://api.github.com/user", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ login: "e2e", avatar_url: "", name: "E2E" }),
    }),
  );
  // Every repo already starred.
  await page.route("https://api.github.com/user/starred/**", (r) =>
    r.fulfill({ status: 204, body: "" }),
  );
  await page.route("https://api.github.com/graphql", (r) =>
    r.fulfill({ status: 401, body: "" }),
  );
  await page.route("**/api/stats", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ totalStars: 0, totalRepos: 0 }),
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const star = page.getByTestId("roaming-star-button").first();
  await expect(star).toHaveAttribute("data-status", "success", { timeout: 5_000 });

  // Click + keyboard activation must both skip StarModal — the diamond is a
  // confirmation of completion, not a CTA, and opening StarModal here would
  // show the "star 0 repositories" warning (the bug we're locking out).
  // Instead it fires a celebratory supernova replay: the canvas mounts in
  // the body portal and the button gains a transient pulse class.
  await star.click();
  await page.waitForTimeout(150);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Trail canvas should mount in the body portal once success state is
  // reached — it's how the supernova replay paints.
  await expect(page.locator("body > canvas")).toHaveCount(1);

  await star.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Riley: sign-out restores the dormant CTA and clears the dismissal flag", async ({ page }) => {
  // Riley (Deliberate Stress Tester) completed a full session — every repo
  // starred, supernova played, dismissal persisted. Later they log out. The
  // regression locks in the "dismissal is a connected-session concept" rule:
  // a disconnected user must never see an empty hero with no primary CTA,
  // because on the disconnected page the CTA *is* the sign-in affordance.
  //
  // We seed both auth and the dismissal flag before navigation; the component
  // should, at the point of disconnection (whenever that lands — during auth
  // hydration or on explicit logout), clear the flag so the dormant CTA
  // reappears. The test asserts the terminal observable state after explicit
  // sign-out, not the intermediate loading races.
  await seedAuth(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      "ethstar_star_dismissed",
      JSON.stringify({ v: 1, dismissedAt: Date.now() }),
    );
  });
  await page.route("https://api.github.com/user", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ login: "riley", avatar_url: "", name: "Riley" }),
    }),
  );
  await page.route("https://api.github.com/user/starred/**", (r) =>
    r.fulfill({ status: 204, body: "" }),
  );
  await page.route("https://api.github.com/graphql", (r) =>
    r.fulfill({ status: 401, body: "" }),
  );
  await page.route("**/api/stats", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ totalStars: 0, totalRepos: 0 }),
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  // Wait for auth to hydrate — Sign-out button visible.
  await expect(page.getByLabel("Sign out")).toBeVisible({ timeout: 5_000 });

  // Sign out. On disconnect, the dormant CTA must be visible with the
  // "disconnected" status + sign-in-framed copy — otherwise a returning
  // visitor sees an empty hero.
  await page.getByLabel("Sign out").click();

  const star = page.getByTestId("roaming-star-button");
  await expect(star).toBeVisible({ timeout: 5_000 });
  await expect(star).toHaveAttribute("data-status", "disconnected");
  await expect(page.getByText(/^Star all \d+ now$/).first()).toBeVisible();

  // And the stale dismissal record must be gone so a subsequent re-connect
  // can run its supernova fresh without the flag short-circuiting mode
  // resolution back to "dismissed".
  const dismissedRaw = await page.evaluate(() =>
    localStorage.getItem("ethstar_star_dismissed"),
  );
  expect(dismissedRaw).toBeNull();
});

test("StarModal warning step names the write scope (Error Prevention)", async ({ page }) => {
  await seedAuth(page);
  await mockAuthedApis(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const star = page.getByTestId("roaming-star-button").first();
  await expect(star).toHaveAttribute("data-status", "ready", { timeout: 5_000 });
  await star.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Scope + surface must be named: "N public repositories" + "on your GitHub account".
  await expect(dialog.getByText(/public repositories/i)).toBeVisible();
  await expect(dialog.getByText(/on your GitHub account/i)).toBeVisible();
  // The CTA button still names the count for belt-and-suspenders clarity.
  await expect(
    dialog.getByRole("button", { name: /^Star all \d+/i }),
  ).toBeVisible();
});
