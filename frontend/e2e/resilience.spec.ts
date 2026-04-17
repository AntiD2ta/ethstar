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

test("session-expired toast fires when refresh fails after 401", async ({
  page,
}) => {
  await seedAuth(page);
  // GitHub API returns 401 for every call.
  await page.route("https://api.github.com/**", (route) =>
    route.fulfill({ status: 401, body: "" }),
  );
  // Refresh endpoint also fails.
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({ status: 401, body: "" }),
  );

  await page.goto("/");

  const toast = page.getByText("Session expired. Sign in again.");
  await expect(toast).toBeVisible({ timeout: 5000 });

  // User is logged out — Connect button reappears.
  await expect(
    page.getByRole("button", { name: /sign in/i }).first(),
  ).toBeVisible();
});

test("network-error toast fires when GitHub is unreachable", async ({
  page,
}) => {
  await seedAuth(page);
  await page.route("https://api.github.com/**", (route) => route.abort("failed"));

  await page.goto("/");

  const toast = page.getByText(/Couldn't reach GitHub/i);
  await expect(toast).toBeVisible({ timeout: 5000 });

  // Network errors do NOT log out the user.
  await expect(
    page.getByRole("button", { name: /sign in/i }).first(),
  ).toHaveCount(0);
});

test("failed repo shows retry button that re-attempts starring", async ({
  page,
}) => {
  await seedAuth(page);

  // First: all isStarred checks return 500 so repos land in "failed" state.
  // Then for the first retried PUT, return 204 (success).
  let retryCount = 0;
  await page.route("https://api.github.com/user/starred/**", (route) => {
    const method = route.request().method();
    if (method === "GET") {
      return route.fulfill({ status: 500, body: "" });
    }
    if (method === "PUT") {
      retryCount++;
      return route.fulfill({ status: 204, body: "" });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  // Profile fetch succeeds so we stay authenticated.
  await page.route("https://api.github.com/user", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ login: "e2euser", avatar_url: "", name: "E2E User" }),
    }),
  );

  await page.goto("/");

  // Wait for at least one retry button to appear.
  const retryBtn = page.getByRole("button", { name: "Retry starring" }).first();
  await expect(retryBtn).toBeVisible({ timeout: 10000 });

  // Button is inside a continuously-scrolling marquee. A plain click — even
  // with `force: true` — can still fail with "outside of the viewport" when
  // the element drifts horizontally off-screen between resolution and click.
  // Dispatch the click directly on the DOM node to sidestep Playwright's
  // viewport actionability check entirely.
  await retryBtn.evaluate((el) => (el as HTMLButtonElement).click());

  // After click, the PUT should have been called at least once.
  await expect.poll(() => retryCount, { timeout: 5000 }).toBeGreaterThan(0);
});
