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
import { REPOSITORIES } from "../src/lib/repos";
import { seedConsent } from "./helpers";

test.beforeEach(async ({ page }) => {
  await seedConsent(page);
});

test.describe("Saturn Carousel", () => {
  test("renders the carousel section on desktop", async ({ page }) => {
    await page.goto("/");
    const carousel = page.getByRole("region", {
      name: /ethereum ecosystem/i,
    });
    await expect(carousel).toBeVisible();
  });

  test("renders one link per repository", async ({ page }) => {
    await page.goto("/");
    const carousel = page.getByRole("region", {
      name: /ethereum ecosystem/i,
    });
    const links = carousel.getByRole("link");
    await expect(links).toHaveCount(REPOSITORIES.length);
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
    await expect(unknownStars).toHaveCount(REPOSITORIES.length);
  });
});

test.describe("Saturn Carousel — Mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("mobile renders the 3D ring (no flat category labels)", async ({ page }) => {
    await page.goto("/");
    const carousel = page.getByRole("region", {
      name: /ethereum ecosystem/i,
    });
    // Category headings from the old flat grid should not appear on mobile.
    await expect(
      carousel.getByRole("heading", { name: "Ethereum Core" }),
    ).toHaveCount(0);
    // Saturn chips rendered inside the ring use the `.saturn-chip` class.
    await expect(carousel.locator(".saturn-chip").first()).toBeVisible();
  });

  test("renders one link per repository on mobile", async ({ page }) => {
    await page.goto("/");
    const carousel = page.getByRole("region", {
      name: /ethereum ecosystem/i,
    });
    const links = carousel.getByRole("link");
    await expect(links).toHaveCount(REPOSITORIES.length);
  });

  test("mobile shows the pinch-to-zoom hint initially", async ({ page }) => {
    await page.goto("/");
    const hint = page.getByText(/pinch to explore/i);
    await expect(hint).toBeVisible();
  });

  test("mobile ring is tall (portrait) — outer ellipse height > width", async ({
    page,
  }) => {
    await page.goto("/");
    const carousel = page.getByRole("region", {
      name: /ethereum ecosystem/i,
    });
    // Wait for chips to be positioned by the rAF loop.
    await page.waitForTimeout(500);
    // The outer orbital path is the largest of the four .border ring elements.
    const ringPaths = carousel.locator("div.rounded-full.border");
    const dims = await ringPaths.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      }),
    );
    // Largest ring (by area) should be taller than wide.
    const outer = dims.reduce((a, b) => (a.w * a.h > b.w * b.h ? a : b));
    expect(outer.h).toBeGreaterThan(outer.w);
    // And it should be noticeably elongated, not a near-circle. At
    // `tiltX: 55` the observed aspect is ~1.7×; 1.3× is a conservative
    // floor — if ring tilt is tuned, this floor may need to follow.
    expect(outer.h).toBeGreaterThan(outer.w * 1.3);
  });

  test("mobile Saturn section is compact (no 100dvh empty space)", async ({
    page,
  }) => {
    await page.goto("/");
    const section = page
      .getByRole("region", { name: /ethereum ecosystem/i })
      .first();
    const box = await section.boundingBox();
    expect(box).not.toBeNull();
    // Previously the section was `min-h-dvh` (100% of the 812px viewport).
    // After removing centering + min-height, it should fit its ring
    // container (~540px) plus modest padding — well under the viewport.
    expect(box!.height).toBeLessThan(700);
  });

  test("mobile chips render GitHub-style star icons (not dots)", async ({
    page,
  }) => {
    await page.goto("/");
    const carousel = page.getByRole("region", {
      name: /ethereum ecosystem/i,
    });
    // Each chip's status glyph is now a lucide Star SVG, not a colored dot.
    const stars = carousel.locator("a.saturn-chip svg.lucide-star");
    await expect(stars).toHaveCount(REPOSITORIES.length);
    // aria-label is preserved for accessibility.
    await expect(
      carousel.locator("a.saturn-chip svg[aria-label='Unknown']").first(),
    ).toBeVisible();
  });
});
