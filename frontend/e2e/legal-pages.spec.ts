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

test.describe("Legal pages", () => {
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
});
