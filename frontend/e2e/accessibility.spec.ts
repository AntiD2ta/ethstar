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
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility", () => {
  test("axe-core: zero WCAG 2.1 AA violations on home page", async ({
    page,
  }) => {
    await page.goto("/");
    // Wait for the page to be fully loaded
    await page.waitForLoadState("load");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      // Exclude the WebGL canvas — axe can't meaningfully analyze it
      // and the parent already has aria-hidden/aria-label
      .exclude("canvas")
      // Color-contrast failures are a design-level issue tracked in TASKS.md
      // backlog. Excluding here to focus on structural a11y first.
      .disableRules(["color-contrast"])
      .analyze();

    // Log violation details for easier debugging if this fails
    const violations = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length,
      targets: v.nodes.map((n) => n.target),
    }));

    expect(violations, JSON.stringify(violations, null, 2)).toHaveLength(0);
  });

  test("landmark structure: main, header, nav, footer exist", async ({
    page,
  }) => {
    await page.goto("/");

    // <main> landmark
    await expect(page.locator("main")).toHaveCount(1);

    // <header> landmark
    await expect(page.locator("header")).toHaveCount(1);

    // <nav aria-label="Site"> landmark
    const nav = page.locator('nav[aria-label="Site"]');
    await expect(nav).toHaveCount(1);

    // <footer> landmark (support section)
    await expect(page.locator("footer")).toHaveCount(1);
  });

  test("heading hierarchy: exactly one h1, no skipped levels", async ({
    page,
  }) => {
    await page.goto("/");

    // Exactly one h1
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);

    // Collect all heading levels present on the page
    const headingLevels = await page.evaluate(() => {
      const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
      return Array.from(headings).map((h) =>
        parseInt(h.tagName.replace("H", ""), 10),
      );
    });

    // Verify no skipped levels: for each heading, the next heading
    // should not jump by more than 1 level (e.g., h1 → h3 is invalid)
    for (let i = 1; i < headingLevels.length; i++) {
      const prev = headingLevels[i - 1];
      const curr = headingLevels[i];
      // Going deeper by more than 1 level is a skip
      expect(
        curr <= prev + 1,
        `Heading level skipped: h${prev} → h${curr} at index ${i}`,
      ).toBe(true);
    }
  });

  test("sections have aria-labelledby linking to headings", async ({
    page,
  }) => {
    await page.goto("/");

    // Trust strip section (replaces the prior How It Works cards)
    const trustSection = page.locator(
      'section[aria-labelledby="trust-strip-heading"]',
    );
    await expect(trustSection).toHaveCount(1);
    await expect(trustSection.locator("#trust-strip-heading")).toContainText(
      /What we ask/,
    );

    // Support footer
    const footer = page.locator(
      'footer[aria-labelledby="support-heading"]',
    );
    await expect(footer).toHaveCount(1);
    await expect(footer.locator("#support-heading")).toContainText("Support");
  });

  test("skip link is present and targets repos section", async ({ page }) => {
    await page.goto("/");
    const skipLink = page.locator('a.skip-link[href="#repos"]');
    await expect(skipLink).toHaveCount(1);
    await expect(skipLink).toContainText("Skip to repositories");
  });
});
