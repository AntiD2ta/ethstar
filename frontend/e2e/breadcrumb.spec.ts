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

test.describe("BackBreadcrumb", () => {
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
});
