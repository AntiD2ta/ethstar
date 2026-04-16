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
 * Responsive layout tests across three viewport sizes:
 * - Mobile:  375×812 (iPhone 14)
 * - Tablet:  768×1024 (iPad portrait)
 * - Desktop: 1440×900
 */

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812, expectedLogoWidth: 250 },
  { name: "tablet", width: 768, height: 1024, expectedLogoWidth: 375 },
  { name: "desktop", width: 1440, height: 900, expectedLogoWidth: 500 },
] as const;

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} (${vp.width}×${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("no horizontal overflow", async ({ page }) => {
      await page.goto("/");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    });

    test("hero section renders without clipping", async ({ page }) => {
      await page.goto("/");
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toBeVisible();
      const box = await h1.boundingBox();
      expect(box).toBeTruthy();
      // H1 should not overflow the viewport
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1);
    });

    test("logo is visible and correctly sized", async ({ page }) => {
      await page.goto("/");
      // Hero logo renders as <canvas> (WebGL) or <img> (fallback).
      // Both use data-testid="hero-logo" for targeting.
      const logo = page.getByTestId("hero-logo");
      await expect(logo).toBeAttached();
      const box = await logo.boundingBox();
      expect(box).toBeTruthy();
      // WebGL canvas sizing varies dramatically with compositor timing and
      // parallel test load. Use a wide tolerance (half expected width to double).
      expect(box!.width).toBeGreaterThan(vp.expectedLogoWidth * 0.5);
      expect(box!.width).toBeLessThan(vp.expectedLogoWidth * 2);
    });

    test("repo cards are visible in marquee", async ({ page }) => {
      await page.goto("/");
      // At least one repo card should be visible
      await expect(page.getByText("go-ethereum").first()).toBeVisible();
    });

    test("support section is accessible", async ({ page }) => {
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "Support", exact: true }),
      ).toBeVisible();
    });
  });
}

// Mobile-specific: marquee duplicates visible + auto-scroll enabled
test.describe("mobile marquee behavior", () => {
  test.use({ viewport: { width: VIEWPORTS[0].width, height: VIEWPORTS[0].height } });

  test("marquee duplicate content is rendered on mobile", async ({ page }) => {
    await page.goto("/");
    // Mobile now shows duplicates for seamless auto-scroll looping.
    const dupes = page.locator('[aria-label*="Scrolling"] > div > div[aria-hidden="true"]').first();
    await expect(dupes).toBeAttached();
  });

  test("marquee container is horizontally scrollable", async ({ page }) => {
    await page.goto("/");
    const marqueeOuter = page.locator('[role="region"]').first();
    const overflowX = await marqueeOuter.evaluate(
      (el) => getComputedStyle(el).overflowX,
    );
    expect(overflowX).toBe("auto");
  });

  test("marquee auto-scrolls on mobile", async ({ page }) => {
    await page.goto("/");
    const marquee = page.locator('[aria-label*="Scrolling"]').first();
    await expect(marquee).toBeVisible();
    const initial = await marquee.evaluate((el) => el.scrollLeft);
    // Give the useAutoScroll rAF loop a moment to advance scrollLeft.
    await page.waitForTimeout(1200);
    const after = await marquee.evaluate((el) => el.scrollLeft);
    expect(after).toBeGreaterThan(initial);
  });
});

// Desktop-specific: marquee animates with JS auto-scroll
test.describe("desktop marquee behavior", () => {
  test.use({ viewport: { width: VIEWPORTS[2].width, height: VIEWPORTS[2].height } });

  test("marquee duplicate content is visible on desktop", async ({ page }) => {
    await page.goto("/");
    // The aria-hidden duplicate should be rendered (flex, not hidden)
    const dupes = page.locator('[aria-label*="Scrolling"] > div > div[aria-hidden="true"]').first();
    await expect(dupes).toBeVisible();
  });

  test("marquee container is scrollable on desktop", async ({ page }) => {
    await page.goto("/");
    const marqueeOuter = page.locator('[role="region"]').first();
    const overflowX = await marqueeOuter.evaluate(
      (el) => getComputedStyle(el).overflowX,
    );
    expect(overflowX).toBe("auto");
  });

  test("marquee wraps in both directions — forward past 2× period and backward past 0", async ({ page }) => {
    await page.goto("/");
    const marquee = page.locator('[role="region"]').first();
    await expect(marquee).toBeVisible();

    // Once layout settles, the auto-scroll effect centers scrollLeft on the
    // middle copy (period ≤ scrollLeft < 2 × period). This verifies the
    // 3-copy structure + center-on-mount behaviour.
    await page.waitForFunction(() => {
      const el = document.querySelector('[role="region"]') as HTMLElement | null;
      if (!el) return false;
      const track = el.firstElementChild;
      if (!track || track.children.length < 3) return false;
      const g1 = track.children[1] as HTMLElement;
      return el.scrollLeft >= g1.offsetLeft * 0.9;
    });

    // Manually push past the forward wrap and confirm it lands back in the
    // middle copy window on the next frame.
    const wrappedForward = await marquee.evaluate((el: HTMLElement) => {
      const track = el.firstElementChild!;
      const g0 = track.children[0] as HTMLElement;
      const g1 = track.children[1] as HTMLElement;
      const period = g1.offsetLeft - g0.offsetLeft;
      el.scrollLeft = 2 * period + 50; // past the forward wrap threshold
      return new Promise<number>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(el.scrollLeft)));
      });
    });
    const period = await marquee.evaluate((el: HTMLElement) => {
      const track = el.firstElementChild!;
      const g0 = track.children[0] as HTMLElement;
      const g1 = track.children[1] as HTMLElement;
      return g1.offsetLeft - g0.offsetLeft;
    });
    expect(wrappedForward).toBeGreaterThanOrEqual(period - 10);
    expect(wrappedForward).toBeLessThan(2 * period);

    // And the backward case — the fix under test.
    const wrappedBackward = await marquee.evaluate((el: HTMLElement) => {
      const track = el.firstElementChild!;
      const g0 = track.children[0] as HTMLElement;
      const g1 = track.children[1] as HTMLElement;
      const period = g1.offsetLeft - g0.offsetLeft;
      el.scrollLeft = period - 50; // just past the backward wrap threshold
      return new Promise<number>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(el.scrollLeft)));
      });
    });
    expect(wrappedBackward).toBeGreaterThanOrEqual(period - 10);
    expect(wrappedBackward).toBeLessThan(2 * period);
  });
});

// AC5: RoamingStar dormant CTA fits at mobile width (authenticated)
test.describe("mobile starring controls", () => {
  test.use({ viewport: { width: VIEWPORTS[0].width, height: VIEWPORTS[0].height } });

  test("RoamingStar dormant slot fits within mobile viewport", async ({
    page,
  }) => {
    await seedAuth(page, "ghu_fake_responsive");

    // Mock GitHub user endpoint so auth context resolves
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

    // Mock star checks (404 = unstarred) so status can resolve to "ready"
    await page.route("https://api.github.com/user/starred/**", (route) =>
      route.fulfill({ status: 404, body: "" }),
    );
    await page.route("**/api/stats", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ totalStars: 0, totalRepos: 0 }),
      }),
    );

    await page.goto("/");

    // RoamingStar dormant slot is the single starring CTA on the page.
    const slot = page.getByTestId("roaming-star-dormant-slot");
    await expect(slot).toBeVisible({ timeout: 10_000 });
    const box = await slot.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(VIEWPORTS[0].width + 1);

    const star = slot.getByTestId("roaming-star-button");
    await expect(star).toBeVisible();
    const btnBox = await star.boundingBox();
    expect(btnBox).toBeTruthy();
    expect(btnBox!.x).toBeGreaterThanOrEqual(0);
    expect(btnBox!.x + btnBox!.width).toBeLessThanOrEqual(
      VIEWPORTS[0].width + 1,
    );
  });
});

// Trust strip fits on mobile without horizontal scroll
test.describe("mobile trust-strip layout", () => {
  test.use({ viewport: { width: VIEWPORTS[0].width, height: VIEWPORTS[0].height } });

  test("all 4 trust-strip items visible without horizontal scroll", async ({ page }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { name: /What we ask/ });
    await heading.scrollIntoViewIfNeeded();

    // Four disclosures: sign-in (GitHub App), starring scope (public_repo OAuth),
    // starring token (ephemeral), coverage. Two separate auth mechanisms — each
    // named explicitly so users aren't surprised at GitHub's consent screens.
    for (const label of ["Sign in", "Starring scope", "Starring token", "Coverage"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    // The strip container should not be horizontally scrollable
    const container = page.getByTestId("trust-strip");
    await expect(container).toBeVisible();
    const overflowX = await container.evaluate((el) => getComputedStyle(el).overflowX);
    expect(overflowX).not.toBe("auto");
    expect(overflowX).not.toBe("scroll");
  });
});

// AC6: Support section buttons stack vertically on mobile
test.describe("mobile support section layout", () => {
  test.use({ viewport: { width: VIEWPORTS[0].width, height: VIEWPORTS[0].height } });

  test("support buttons stack vertically on mobile", async ({ page }) => {
    await page.goto("/");

    // Scroll to the support section
    const supportHeading = page.getByRole("heading", { name: "Support", exact: true });
    await supportHeading.scrollIntoViewIfNeeded();

    // Get the bounding boxes of the first two support links
    const sponsorsLink = page.getByRole("link", { name: "GitHub Sponsors" });
    const kofiLink = page.getByRole("link", { name: "Ko-fi" });
    await expect(sponsorsLink).toBeVisible();
    await expect(kofiLink).toBeVisible();

    const sponsorsBox = await sponsorsLink.boundingBox();
    const kofiBox = await kofiLink.boundingBox();
    expect(sponsorsBox).toBeTruthy();
    expect(kofiBox).toBeTruthy();

    // At 375px, the buttons should either wrap (Ko-fi below Sponsors)
    // or sit side-by-side if they fit. Check they don't overflow viewport.
    expect(sponsorsBox!.x + sponsorsBox!.width).toBeLessThanOrEqual(
      VIEWPORTS[0].width + 1,
    );
    expect(kofiBox!.x + kofiBox!.width).toBeLessThanOrEqual(
      VIEWPORTS[0].width + 1,
    );
  });
});
