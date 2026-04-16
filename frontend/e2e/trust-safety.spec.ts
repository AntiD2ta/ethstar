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

// Regression coverage for Phase F — Trust & Safety Gaps. Covers items that
// are UI-observable end-to-end: the "what is starring?" explainer, the
// non-blocking consent banner, the unified BackBreadcrumb, and the 404
// page renaissance. Abort flow + popup-blocked recovery are exercised at
// unit level in star-modal.test.tsx (they require OAuth popup mocking that
// is impractical to stub through Playwright).

test.describe("Trust & Safety — Phase F", () => {
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

  test("consent banner is a non-blocking bottom sheet that doesn't obscure the hero CTA", async ({
    page,
  }) => {
    await page.goto("/");
    const banner = page.getByTestId("consent-banner");
    await expect(banner).toBeVisible();

    const heroBox = await page.getByTestId("hero-section").boundingBox();
    const bannerBox = await banner.boundingBox();
    const viewport = page.viewportSize();
    if (!heroBox || !bannerBox || !viewport) throw new Error("missing box data");

    // Banner pinned to the bottom of the viewport.
    expect(bannerBox.y + bannerBox.height).toBeLessThanOrEqual(viewport.height);
    expect(viewport.height - (bannerBox.y + bannerBox.height)).toBeLessThan(40);

    // Banner occupies at most 25% of viewport (the plan targets ≤20% on mobile;
    // desktop widths give us more horizontal room so content fits in one row).
    expect(bannerBox.height / viewport.height).toBeLessThan(0.25);

    // The banner does not cover the top of the hero — the hero CTA is
    // positioned well above the banner's top edge.
    expect(heroBox.y).toBeLessThan(bannerBox.y);
  });

  test("cookies banner has Essential only and Accept all actions plus a cookies link", async ({
    page,
  }) => {
    await page.goto("/");
    const banner = page.getByTestId("consent-banner");
    await expect(banner.getByTestId("consent-reject")).toHaveText(/essential only/i);
    await expect(banner.getByTestId("consent-accept")).toHaveText(/accept all/i);
    await expect(banner.getByTestId("consent-cookies-link")).toBeVisible();
  });

  test("BackBreadcrumb renders once on /privacy, /cookies, and /404", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("consent-reject").click();

    for (const route of ["/privacy", "/cookies", "/this-route-does-not-exist"]) {
      await page.goto(route);
      const crumbs = page.getByTestId("back-breadcrumb");
      await expect(crumbs).toHaveCount(1);
      await expect(crumbs).toHaveText(/back to ethstar/i);
    }
  });

  test("404 page renders AuthHeader + footer + 'Browse repos' primary CTA", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("consent-reject").click();
    await page.goto("/definitely-missing");

    // Header "Propose more repos" link is part of AuthHeader.
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByTestId("not-found-title")).toHaveText("404");
    const cta = page.getByTestId("not-found-cta");
    await expect(cta).toBeVisible();
    await expect(cta).toHaveText(/browse repos/i);
    // Footer "Support" section renders.
    await expect(page.getByRole("heading", { name: "Support", level: 2 })).toBeVisible();
  });

  test("privacy and cookies prose is constrained to ~65ch reading width", async ({
    page,
  }) => {
    // Approximate pixel equivalent of 65ch at 16px base ~= 650-700px. We assert
    // the prose container's rendered width is no wider than 720px, which is
    // generous while still catching the prior max-w-none regression.
    for (const route of ["/privacy", "/cookies"]) {
      await page.goto(route);
      const prose = page.locator("article.prose").first();
      const box = await prose.boundingBox();
      if (!box) throw new Error(`missing prose bounding box on ${route}`);
      expect(box.width).toBeLessThanOrEqual(720);
    }
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

    const stars = page.getByTestId("combined-stars-desktop");
    await expect(stars).toBeVisible();
    // While live data has not arrived, the span reports data-live="false",
    // renders a "~" prefix, and carries the opacity-60 class.
    await expect(stars).toHaveAttribute("data-live", "false");
    await expect(stars).toHaveText(/^~/);
    await expect(stars).toHaveClass(/opacity-60/);
  });

  test("wallet address has an accessible Copy button that writes to the clipboard", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await page.getByTestId("consent-reject").click();
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const copyBtn = page.getByTestId("wallet-copy");
    await copyBtn.scrollIntoViewIfNeeded();
    await expect(copyBtn).toBeVisible();
    await expect(copyBtn).toHaveAttribute("aria-label", "Copy wallet address");
    await copyBtn.click();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});
