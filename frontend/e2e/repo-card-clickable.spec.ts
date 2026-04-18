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
import { seedConsent } from "./helpers";

test.beforeEach(async ({ page }) => {
  await seedConsent(page);
});

test.describe("RepoCard: whole-card is a clickable link", () => {
  test("clicking the description dead-zone still opens the repo on GitHub", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    // Pause marquee auto-scroll while we click — otherwise the description
    // moves under the pointer mid-click and the test flakes. Reducing motion
    // disables auto-scroll in RepoMarquee.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();

    // Pick a known DeFi repo; wait for at least one copy to be in the DOM.
    const firstGoEth = page
      .locator('article[data-repo-key="ethereum/go-ethereum"]')
      .first();
    await expect(firstGoEth).toBeVisible();

    // Click the description paragraph — not the title text. Before this fix
    // clicking here was a dead zone.
    const descParagraph = firstGoEth.locator("p").first();
    await expect(descParagraph).toBeVisible();

    // The stretched-link ::after overlay intercepts pointer events on the
    // description paragraph — exactly the behaviour we're verifying. That
    // trips Playwright's actionability check for the paragraph, so bypass it
    // with `force: true`; the click still lands at the paragraph's centre,
    // which is what a real user would do. Whatever element sits on top (the
    // stretched anchor) receives the event.
    const [newPage] = await Promise.all([
      context.waitForEvent("page"),
      descParagraph.click({ force: true }),
    ]);
    await newPage.waitForLoadState("domcontentloaded").catch(() => {});
    expect(newPage.url()).toContain("github.com/ethereum/go-ethereum");
    await newPage.close();
  });

  test("anchor has aria-label naming the destination repo and opens in new tab", async ({
    page,
  }) => {
    await page.goto("/");
    const firstGoEth = page
      .locator('article[data-repo-key="ethereum/go-ethereum"]')
      .first();
    const link = firstGoEth.getByRole("link", {
      name: /ethereum\/go-ethereum on GitHub, opens in new tab/i,
    });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
