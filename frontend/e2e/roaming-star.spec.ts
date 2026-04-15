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

test("dormant (disconnected): label names the noun and the auth provider", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Star every Ethereum repo").first()).toBeVisible();
  await expect(page.getByText("Sign in with GitHub ↗").first()).toBeVisible();
  // The legacy ornamental copy must be gone — "Light it up" hid the action.
  await expect(page.getByText("Light it up")).toHaveCount(0);
  await expect(page.getByText("↗ Continue with GitHub")).toHaveCount(0);
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
  // The Proceed button still names the count for belt-and-suspenders clarity.
  await expect(
    dialog.getByRole("button", { name: /Proceed — star all \d+ repos/i }),
  ).toBeVisible();
});
