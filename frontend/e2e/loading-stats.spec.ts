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
import { seedAuth } from "./helpers";

// --- Auth loading state ---

test("auth loading skeleton shows while resolving, then settles to signed-in", async ({
  page,
}) => {
  await seedAuth(page);

  // Delay the /user profile fetch so the loading state is clearly observable.
  await page.route("https://api.github.com/user", async (route) => {
    await new Promise((r) => setTimeout(r, 2000));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        login: "e2euser",
        avatar_url: "",
        name: "E2E User",
      }),
    });
  });

  // Mock star check endpoints so they don't interfere.
  await page.route("https://api.github.com/user/starred/**", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );

  // Use domcontentloaded to return before the delayed API call resolves.
  await page.goto("/", { waitUntil: "domcontentloaded" });

  // Loading skeleton should be visible while the profile fetch is pending.
  const loadingIndicator = page.getByLabel("Loading account");
  await expect(loadingIndicator).toBeVisible({ timeout: 3000 });

  // After the profile resolves, the signed-in avatar should appear.
  await expect(page.getByText("E2E User")).toBeVisible({ timeout: 10000 });

  // Loading skeleton should be gone.
  await expect(loadingIndicator).toHaveCount(0);
});

test("auth loading skeleton settles to Connect button for anonymous users", async ({
  page,
}) => {
  // No auth seeded — anonymous user.
  await page.goto("/");

  // The "Connect via GitHub" button should appear without prior loading flash.
  await expect(
    page.getByRole("button", { name: "Connect via GitHub" }).first(),
  ).toBeVisible({ timeout: 3000 });
});

// --- Star status skeleton ---

test("star-status skeleton appears during star checking", async ({ page }) => {
  await seedAuth(page);

  // Delay all star-check responses.
  await page.route("https://api.github.com/user/starred/**", async (route) => {
    await new Promise((r) => setTimeout(r, 1000));
    await route.fulfill({ status: 404, body: "" });
  });

  // Profile fetch succeeds immediately.
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

  await page.goto("/");

  // At least one "Checking" skeleton should be visible while star checks are in flight.
  const skeleton = page.getByLabel("Checking").first();
  await expect(skeleton).toBeVisible({ timeout: 5000 });
});

// --- Stats counter ---

test("stats counter displays when API returns data", async ({ page }) => {
  await page.route("**/api/stats", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ total_stars: 1234, total_users: 56 }),
      });
    }
    return route.fulfill({ status: 200, body: "" });
  });

  await page.goto("/");

  await expect(
    page.getByRole("group", { name: "Site statistics" }).getByText("1,234"),
  ).toBeVisible({ timeout: 5000 });
  await expect(
    page.getByText("Ethstar Stars"),
  ).toBeVisible({ timeout: 5000 });
});

test("stats counter hidden when API returns error", async ({ page }) => {
  await page.route("**/api/stats", (route) =>
    route.fulfill({ status: 500, body: "" }),
  );

  await page.goto("/");

  // Wait for the page to load, then confirm no stats ribbon.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByText("Ethstar Stars"),
  ).toHaveCount(0);
});

test("failed stats POST queues pending stars, next successful POST flushes them", async ({
  page,
}) => {
  // Seed auth and pre-existing pending stars from a prior failed POST.
  await seedAuth(page);
  await page.addInitScript(() => {
    localStorage.setItem("ethstar_pending_stats", "5");
  });

  // Profile fetch succeeds.
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

  // Star checks: most repos already starred (204), 2 repos unstarred (404).
  const unstarredRepos = ["go-ethereum", "lighthouse"];
  await page.route("https://api.github.com/user/starred/**", (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (method === "PUT") {
      return route.fulfill({ status: 204, body: "" });
    }

    // GET — check if this repo should be "unstarred".
    const isUnstarred = unstarredRepos.some((name) => url.endsWith(`/${name}`));
    return route.fulfill({ status: isUnstarred ? 404 : 204, body: "" });
  });

  // Capture the stats POST body.
  let capturedPostBody: string | null = null;
  await page.route("**/api/stats", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ total_stars: 100, total_users: 10 }),
      });
    }
    // POST — capture the body and return success.
    capturedPostBody = route.request().postData();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto("/");

  // Wait for star checks to complete, then click "Star All" (use first instance).
  const starAllBtn = page.getByRole("button", { name: /Star All/i }).first();
  await expect(starAllBtn).toBeVisible({ timeout: 15000 });
  await starAllBtn.click();

  // Wait for the success toast (all repos starred).
  await expect(
    page.getByText(/Starred 2 repos/),
  ).toBeVisible({ timeout: 30000 });

  // The POST should include new (2) + pending (5) = 7.
  await expect
    .poll(() => capturedPostBody, { timeout: 5000 })
    .toBeTruthy();
  const body = JSON.parse(capturedPostBody!);
  expect(body.stars).toBe(7);

  // Pending should be cleared from localStorage after the successful POST.
  const pending = await page.evaluate(() =>
    localStorage.getItem("ethstar_pending_stats"),
  );
  expect(pending).toBeNull();
});

test("stats counter hidden when total is zero", async ({ page }) => {
  await page.route("**/api/stats", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ total_stars: 0, total_users: 0 }),
      });
    }
    return route.fulfill({ status: 200, body: "" });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByText("Ethstar Stars"),
  ).toHaveCount(0);
});
