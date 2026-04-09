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

test.describe("Saturn Carousel", () => {
  test("renders the carousel section on desktop", async ({ page }) => {
    await page.goto("/");
    const carousel = page.getByRole("region", {
      name: /ethereum ecosystem/i,
    });
    await expect(carousel).toBeVisible();
  });

  test("renders all 32 repo cards as links", async ({ page }) => {
    await page.goto("/");
    const carousel = page.getByRole("region", {
      name: /ethereum ecosystem/i,
    });
    const links = carousel.getByRole("link");
    await expect(links).toHaveCount(32);
  });

  test("cards link to GitHub repos", async ({ page }) => {
    await page.goto("/");
    const carousel = page.getByRole("region", {
      name: /ethereum ecosystem/i,
    });
    const firstLink = carousel.getByRole("link").first();
    const href = await firstLink.getAttribute("href");
    expect(href).toContain("github.com");
  });

  test("animation positions cards (transforms are applied)", async ({
    page,
  }) => {
    await page.goto("/");
    // Wait for the animation to start and position cards
    await page.waitForTimeout(1000);

    const cards = page.locator(".saturn-card");
    const firstParent = cards.first().locator("..");
    const transform = await firstParent.getAttribute("style");
    expect(transform).toContain("rotateZ");
    expect(transform).toContain("translateX");
  });

  test("cards show star status indicators", async ({ page }) => {
    await page.goto("/");
    const carousel = page.getByRole("region", {
      name: /ethereum ecosystem/i,
    });
    // All cards should have an "Unknown" star indicator (not authenticated)
    const unknownStars = carousel.getByLabel("Unknown");
    await expect(unknownStars).toHaveCount(32);
  });
});

test.describe("Saturn Carousel — Mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("shows mobile layout with category labels", async ({ page }) => {
    await page.goto("/");
    const carousel = page.getByRole("region", {
      name: /ethereum ecosystem/i,
    });
    await expect(
      carousel.getByRole("heading", { name: "Ethereum Core" }),
    ).toBeVisible();
    await expect(
      carousel.getByRole("heading", { name: "Consensus Clients" }),
    ).toBeVisible();
    await expect(
      carousel.getByRole("heading", { name: "Execution Clients" }),
    ).toBeVisible();
    await expect(
      carousel.getByRole("heading", { name: "Validator Tooling" }),
    ).toBeVisible();
  });

  test("renders all 32 repo chips on mobile", async ({ page }) => {
    await page.goto("/");
    const carousel = page.getByRole("region", {
      name: /ethereum ecosystem/i,
    });
    const links = carousel.getByRole("link");
    await expect(links).toHaveCount(32);
  });
});
