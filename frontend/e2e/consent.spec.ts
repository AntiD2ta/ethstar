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

import { test, expect, type Page } from "@playwright/test";

/** Matches any URL associated with Vercel Web Analytics or Speed Insights —
 * the actual beacon in production OR the lazily-loaded module chunk in dev. */
function isAnalyticsUrl(url: string): boolean {
  let isVercelAnalyticsHost = false;
  try {
    const parsed = new URL(url);
    isVercelAnalyticsHost = parsed.hostname === "va.vercel-scripts.com";
  } catch {
    // Ignore parsing errors and fall back to non-host indicators below.
  }

  return (
    isVercelAnalyticsHost ||
    url.includes("/_vercel/insights") ||
    url.includes("/_vercel/speed-insights") ||
    url.includes("@vercel/analytics") ||
    url.includes("@vercel_analytics") ||
    url.includes("@vercel/speed-insights") ||
    url.includes("@vercel_speed-insights")
  );
}

function trackAnalyticsRequests(page: Page): { urls: string[] } {
  const urls: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (isAnalyticsUrl(url)) urls.push(url);
  });
  return { urls };
}

test.describe("Cookie consent", () => {
  test("banner visible on first visit and no analytics traffic before choice", async ({
    page,
  }) => {
    const tracker = trackAnalyticsRequests(page);
    await page.goto("/");
    await expect(page.getByTestId("consent-banner")).toBeVisible();
    await expect(page.getByTestId("consent-accept")).toBeVisible();
    await expect(page.getByTestId("consent-reject")).toBeVisible();
    await expect(page.getByTestId("consent-preferences")).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(tracker.urls).toEqual([]);
  });

  test("rejecting keeps analytics off across navigation", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("consent-reject").click();
    await expect(page.getByTestId("consent-banner")).not.toBeVisible();

    const tracker = trackAnalyticsRequests(page);
    await page.goto("/privacy");
    // Use plain h1 locator so modal-driven aria-hidden (if any) doesn't hide the heading.
    await expect(page.locator("h1", { hasText: "Privacy Policy" })).toBeVisible();
    await page.goto("/cookies");
    await expect(page.locator("h1", { hasText: "Cookies Policy" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(tracker.urls).toEqual([]);
  });

  test("accepting stores consent and mounts analytics", async ({ page }) => {
    await page.goto("/");
    // Before Accept: window.va must be undefined.
    expect(
      await page.evaluate(
        () => (window as unknown as { va?: unknown }).va !== undefined,
      ),
    ).toBe(false);

    await page.getByTestId("consent-accept").click();
    await expect(page.getByTestId("consent-banner")).not.toBeVisible();

    const stored = await page.evaluate(() =>
      localStorage.getItem("ethstar_consent"),
    );
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string) as { statistics: boolean };
    expect(parsed.statistics).toBe(true);

    // After Accept: the lazy-loaded @vercel/analytics component mounts and
    // installs `window.va`. This signal is independent of dev/prod mode.
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window as unknown as { va?: unknown }).va !== undefined,
          ),
        { timeout: 5000 },
      )
      .toBe(true);
  });

  test("/privacy and /cookies routes render after dismissing banner", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("consent-reject").click();
    await expect(page.getByTestId("consent-banner")).not.toBeVisible();

    await page.goto("/privacy");
    await expect(page.locator("h1", { hasText: "Privacy Policy" })).toBeVisible();

    await page.goto("/cookies");
    await expect(page.locator("h1", { hasText: "Cookies Policy" })).toBeVisible();
    await expect(page.getByTestId("cookies-open-preferences")).toBeVisible();
  });

  test("footer Cookie preferences button reopens the banner", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("consent-reject").click();
    await expect(page.getByTestId("consent-banner")).not.toBeVisible();

    const footerBtn = page.getByTestId("footer-cookie-preferences");
    await footerBtn.scrollIntoViewIfNeeded();
    await footerBtn.click();
    await expect(page.getByTestId("consent-banner")).toBeVisible();
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
});
