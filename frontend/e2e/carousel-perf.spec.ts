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

test.describe("carousel avatar performance", () => {
  test("every repo-card avatar img is configured for native lazy loading", async ({
    page,
  }) => {
    await page.goto("/");

    // Avatar imgs are inside the Radix Avatar wrapper. Filter to GitHub-avatar URLs
    // so we don't accidentally pick up the ETH logo or other site imagery.
    const avatarAttrs = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"))
        .filter((img) => img.src.includes("github.com/") && img.src.includes(".png"));
      return imgs.map((img) => ({
        loading: img.getAttribute("loading"),
        decoding: img.getAttribute("decoding"),
        width: img.getAttribute("width"),
        height: img.getAttribute("height"),
        srcSet: img.getAttribute("srcset") ?? "",
      }));
    });

    expect(avatarAttrs.length).toBeGreaterThan(20);
    for (const attrs of avatarAttrs) {
      expect(attrs.loading).toBe("lazy");
      expect(attrs.decoding).toBe("async");
      expect(attrs.width).toBe("40");
      expect(attrs.height).toBe("40");
      expect(attrs.srcSet).toMatch(/size=40\s+1x/);
      expect(attrs.srcSet).toMatch(/size=80\s+2x/);
    }
  });

  test("below-the-fold avatars are deferred on first paint", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Snapshot complete state immediately (don't wait for "load" to settle).
    const completeStates = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img")).filter((img) =>
        img.src.includes("github.com/") && img.src.includes(".png"),
      );
      // Pair each image with its vertical position to distinguish above/below the fold.
      return imgs.map((img) => ({
        top: img.getBoundingClientRect().top,
        complete: img.complete,
        viewportHeight: window.innerHeight,
      }));
    });

    expect(completeStates.length).toBeGreaterThan(0);
    const viewportH = completeStates[0].viewportHeight;
    const belowFold = completeStates.filter((s) => s.top > viewportH * 1.5);
    // Nothing to assert if the page is unexpectedly short — fail loudly.
    expect(belowFold.length).toBeGreaterThan(0);
    // At least some far-below-fold avatars must NOT have completed loading on first paint.
    const deferred = belowFold.filter((s) => !s.complete);
    expect(deferred.length).toBeGreaterThan(0);
  });
});
