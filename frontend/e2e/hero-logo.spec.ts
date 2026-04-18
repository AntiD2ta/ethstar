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

/**
 * Regression guard for the deferred-3D-import refactor in hero-logo.tsx.
 *
 * Before the refactor, LCP was blocked 8s+ behind the 254 KB three.js chunk:
 * the <p> subheading was the LCP element, and the hero canvas only appeared
 * once the WebGL context + shader compile finished. The fix defers the 3D
 * import() until idle and makes FallbackLogo (the cached PNG) paint from
 * the first frame as the LCP candidate.
 *
 * This test fails fast if anyone hides [data-testid="hero-logo"] until the
 * 3D chunk resolves — the exact regression the plan warns against.
 */
test("hero logo element is visible within 1500ms of first paint", async ({ page }) => {
  await page.goto("/");
  // Visibility is asserted against the same selector used by both the WebGL
  // and the fallback branches, so the test passes on either path (low-end
  // heuristic short-circuit or normal 3D deferral).
  await expect(page.getByTestId("hero-logo")).toBeVisible({ timeout: 1500 });
});
