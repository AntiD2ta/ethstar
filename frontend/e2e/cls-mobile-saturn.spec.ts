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

// Regression for the mobile Cumulative Layout Shift budget. The Saturn
// carousel is lazy()-loaded; without a sized Suspense fallback its
// h-[540px] (mobile) / h-[80vh] (desktop) section pops in from 0 → full
// height when the chunk lands and pushes every section below it down,
// producing a ~0.69 CLS on Lighthouse's simulated Slow 4G + 4x CPU mobile
// profile (limit: 0.1). This spec delays the lazy chunk so it lands well
// after FCP — the same timing Lighthouse evaluates against — and asserts
// the accumulated layout-shift entries stay well under the gate.

import { test, expect } from "@playwright/test";

// Lighthouse mobile preset: 412 × 823, deviceScaleFactor 1.75. Matching the
// viewport so the displaced-area calculation lines up with what the gate
// scores in CI.
test.use({
  viewport: { width: 412, height: 823 },
  deviceScaleFactor: 1.75,
  isMobile: true,
  hasTouch: true,
});

// `saturn-carousel` appears in both the production chunk path
// (/assets/saturn-carousel-<hash>.js) and the Vite dev module path
// (/src/components/saturn-carousel/saturn-carousel.tsx). A substring regex
// matches both without coupling to either build mode.
const SATURN_CHUNK = /saturn-carousel/;

test.describe("mobile CLS budget", () => {
  test("Saturn lazy hydration stays under CLS budget", async ({ page }) => {
    // Route-based delay (2s) reproduces the Lighthouse timing where the
    // lazy chunk arrives after FCP, without slowing the rest of the page.
    await page.route(SATURN_CHUNK, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });

    await page.addInitScript(() => {
      type ShiftEntry = PerformanceEntry & {
        hadRecentInput?: boolean;
        value?: number;
      };
      (window as unknown as { __clsTotal: number }).__clsTotal = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as ShiftEntry[]) {
          if (entry.hadRecentInput) continue;
          (window as unknown as { __clsTotal: number }).__clsTotal +=
            entry.value ?? 0;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    await page.goto("/", { waitUntil: "load" });
    // Wait for the Saturn section to hydrate so any post-hydration shifts
    // are observed before the assertion.
    await page.waitForSelector(
      '[aria-label*="Saturn repository navigator"]',
      { timeout: 20_000 },
    );
    await page.waitForTimeout(600);

    const cls = await page.evaluate(
      () => (window as unknown as { __clsTotal: number }).__clsTotal,
    );

    // Lighthouse CI hard-fails at 0.1; assert well below so we catch
    // regressions before they bubble up to the PR gate. Local fixture
    // measures ~0.008.
    expect(cls, `CLS = ${cls}`).toBeLessThan(0.05);
  });
});
