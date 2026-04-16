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
import AxeBuilder from "@axe-core/playwright";
import {
  REPOSITORIES,
  REPOS_BY_CATEGORY,
  DEFAULT_RING_FILTER_SECTIONS,
} from "../src/lib/repos";
import { seedAuth, seedConsent } from "./helpers";

// Default filter size (Core + EL + CL) — derived so spec stays stable as
// repos are added.
const DEFAULT_FILTER_COUNT = DEFAULT_RING_FILTER_SECTIONS.reduce(
  (sum, s) => sum + REPOS_BY_CATEGORY[s].length,
  0,
);

/**
 * Quiet the network surface so an authed run doesn't time out on real
 * GitHub round-trips. Mirrors the helper inside roaming-star.spec.ts.
 */
function mockAuthedApis(page: Page) {
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

// Freeze the rAF-driven Saturn animation under reduced-motion so chip
// positions/opacity stay stable enough for Playwright's stability checks.
test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await seedConsent(page);
});

test.describe("Saturn ring navigation — signed out", () => {
  test("renders the default Core+EL+CL selection", async ({ page }) => {
    await page.goto("/");
    const ring = page.getByRole("region", {
      name: /saturn repository navigator/i,
    });
    await expect(ring).toBeVisible();
    await expect(ring.getByRole("link")).toHaveCount(DEFAULT_FILTER_COUNT);
    await expect(ring).toHaveAccessibleName(
      new RegExp(`${DEFAULT_FILTER_COUNT} of ${REPOSITORIES.length}`),
    );
  });

  test("progress counter shows {starred}/{selected}", async ({ page }) => {
    await page.goto("/");
    const progress = page.getByTestId("ring-progress");
    await expect(progress).toHaveText(
      new RegExp(`0/${DEFAULT_FILTER_COUNT} starred`),
    );
  });

  test("signed-out: Customize is hidden; 'Connect to customize' shows", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText(/connect to customize/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /customize/i }),
    ).toHaveCount(0);
  });
});

test.describe("Saturn ring navigation — interactions", () => {
  test("clicking a chip scrolls to the matching marquee card and highlights it", async ({
    page,
  }) => {
    await page.goto("/");
    const ring = page.getByRole("region", {
      name: /saturn repository navigator/i,
    });
    await expect(ring).toBeVisible();
    // The chip floats inside an absolutely-positioned 3D-transformed parent;
    // dispatch the click directly so positioning races and Playwright's
    // stability check can't miss it.
    await page.evaluate(() => {
      const chip = document.querySelector<HTMLAnchorElement>(
        'a[aria-label="ethereum/go-ethereum, not starred"]',
      );
      if (!chip) throw new Error("chip not found");
      chip.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    });

    const card = page.locator(
      'article[data-repo-key="ethereum/go-ethereum"]',
    ).first();
    await expect(card).toHaveClass(/repo-card-highlight/, { timeout: 1500 });
  });

  test("Shift+click opens the per-repo action group", async ({ page }) => {
    await page.goto("/");
    const ring = page.getByRole("region", {
      name: /saturn repository navigator/i,
    });
    await expect(ring).toBeVisible();
    await page.evaluate(() => {
      const chip = document.querySelector<HTMLAnchorElement>(
        'a[aria-label="ethereum/go-ethereum, not starred"]',
      );
      if (!chip) throw new Error("chip not found");
      chip.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          shiftKey: true,
          view: window,
        }),
      );
    });
    const group = page.getByRole("group", {
      name: /ethereum\/go-ethereum actions/i,
    });
    await expect(group).toBeVisible();
    await expect(group.getByRole("button", { name: "Star" })).toBeVisible();
    await expect(
      group.getByRole("link", { name: "Open on GitHub" }),
    ).toBeVisible();
  });

  test("arrow keys walk chips — exactly one chip is tabbable at a time", async ({
    page,
  }) => {
    await page.goto("/");
    const ring = page.getByRole("region", {
      name: /saturn repository navigator/i,
    });
    const tabable = ring.locator('a[tabindex="0"]');
    await expect(tabable).toHaveCount(1);
    await tabable.focus();
    const firstLabel = await tabable.getAttribute("aria-label");
    await page.keyboard.press("ArrowRight");
    const tabableAfter = ring.locator('a[tabindex="0"]');
    await expect(tabableAfter).toHaveCount(1);
    const nextLabel = await tabableAfter.getAttribute("aria-label");
    expect(nextLabel).not.toBe(firstLabel);
  });

  test("right-click / middle-click fallback: chip still carries href", async ({
    page,
  }) => {
    await page.goto("/");
    const ring = page.getByRole("region", {
      name: /saturn repository navigator/i,
    });
    const chip = ring.getByLabel("ethereum/go-ethereum, not starred");
    await expect(chip).toHaveAttribute(
      "href",
      "https://github.com/ethereum/go-ethereum",
    );
    await expect(chip).toHaveAttribute("target", "_blank");
    await expect(chip).toHaveAttribute("rel", /noopener/);
  });
});

test.describe("Saturn ring filter — authenticated", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await mockAuthedApis(page);
  });

  test("Customize button opens sheet with section toggles", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /customize/i }).click();
    const sheetHeading = page.getByRole("heading", {
      name: /customize your ring/i,
    });
    await expect(sheetHeading).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: /^ethereum core$/i }),
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: /^validator tooling$/i }),
    ).not.toBeChecked();
  });

  test("toggling a section adds its repos to the ring", async ({ page }) => {
    await page.goto("/");
    const ring = page.getByRole("region", {
      name: /saturn repository navigator/i,
    });
    await expect(ring.getByRole("link")).toHaveCount(DEFAULT_FILTER_COUNT);

    await page.getByRole("button", { name: /customize/i }).click();
    await page
      .getByRole("checkbox", { name: /^validator tooling$/i })
      .click();
    await page.keyboard.press("Escape");

    const expected =
      DEFAULT_FILTER_COUNT + REPOS_BY_CATEGORY["Validator Tooling"].length;
    await expect(ring.getByRole("link")).toHaveCount(expected);
  });

  test("filter selection persists across reloads", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /customize/i }).click();
    await page
      .getByRole("checkbox", { name: /^validator tooling$/i })
      .click();
    await page.keyboard.press("Escape");

    const expected =
      DEFAULT_FILTER_COUNT + REPOS_BY_CATEGORY["Validator Tooling"].length;
    const ring = page.getByRole("region", {
      name: /saturn repository navigator/i,
    });
    await expect(ring.getByRole("link")).toHaveCount(expected);

    await page.reload();
    const ring2 = page.getByRole("region", {
      name: /saturn repository navigator/i,
    });
    await expect(ring2.getByRole("link")).toHaveCount(expected);
  });

  test("Reset to default wipes the customisation", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /customize/i }).click();
    await page
      .getByRole("checkbox", { name: /^validator tooling$/i })
      .click();
    await page.getByRole("button", { name: /reset to default/i }).click();
    await page.keyboard.press("Escape");

    const ring = page.getByRole("region", {
      name: /saturn repository navigator/i,
    });
    await expect(ring.getByRole("link")).toHaveCount(DEFAULT_FILTER_COUNT);
  });

  test("floating filter control stays visible with all 58 repos in the filter", async ({
    page,
  }) => {
    await page.goto("/");
    const ring = page.getByRole("region", {
      name: /saturn repository navigator/i,
    });

    // Enable every non-default section so the ring renders all 58 repos —
    // the configuration most likely to occlude the control with bottom-arc
    // chips from the outermost rings.
    await page.getByRole("button", { name: /customize/i }).click();
    await page
      .getByRole("checkbox", { name: /^validator tooling$/i })
      .click();
    await page
      .getByRole("checkbox", { name: /^defi & smart contracts$/i })
      .click();
    await page.keyboard.press("Escape");

    await expect(ring.getByRole("link")).toHaveCount(REPOSITORIES.length);

    // The floating pill holds both the progress counter and the Customize
    // trigger — both must remain visible and the trigger must be clickable.
    const progress = page.getByTestId("ring-progress");
    await expect(progress).toBeVisible();
    const customize = page.getByRole("button", { name: /customize/i });
    await expect(customize).toBeVisible();

    // Assert the control sits inside the ring section (same stacking
    // context as the rings) and in the bottom-right half of it — this is
    // what makes it robust against bottom-arc chip overlap.
    const controlBox = await customize.boundingBox();
    const ringBox = await ring.boundingBox();
    if (!controlBox || !ringBox) {
      throw new Error("expected bounding boxes for control and ring section");
    }
    expect(controlBox.x).toBeGreaterThan(ringBox.x + ringBox.width / 2);
    expect(controlBox.y).toBeGreaterThan(ringBox.y + ringBox.height / 2);

    // Keyboard focus still reaches the trigger.
    await customize.focus();
    await expect(customize).toBeFocused();
  });
});

test.describe("Saturn ring — axe-core audit", () => {
  test("ring container has no critical axe violations", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("region", { name: /saturn repository navigator/i })
      .waitFor();
    const results = await new AxeBuilder({ page })
      .include('[aria-label*="Saturn repository navigator"]')
      // Pre-existing 10px owner labels on saturn-card hit a contrast warning;
      // tracked in TASKS.md backlog. This phase ships without regressing
      // anything beyond that pre-existing rule.
      .disableRules(["color-contrast"])
      .analyze();
    expect(
      results.violations,
      JSON.stringify(results.violations, null, 2),
    ).toEqual([]);
  });
});
