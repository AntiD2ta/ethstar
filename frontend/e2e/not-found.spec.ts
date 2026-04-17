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

test.describe("404 page", () => {
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
});
