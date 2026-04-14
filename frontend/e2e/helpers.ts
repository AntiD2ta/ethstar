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

import type { Page } from "@playwright/test";

/**
 * Seed the cookie-consent localStorage entry so the Phase-C consent banner
 * doesn't render as a Radix Dialog on top of the page. The dialog sets
 * `aria-hidden` on sibling content, which makes `getByRole` queries fail even
 * when the element is visually present. Use in `beforeEach` when testing the
 * home page or any route that would otherwise show the consent banner.
 *
 * Keep in sync with `CONSENT_STORAGE_KEY` / `CONSENT_VERSION` in
 * `src/lib/consent-context.ts`.
 */
export async function seedConsent(
  page: Page,
  statistics: boolean = false,
): Promise<void> {
  await page.addInitScript((opts) => {
    localStorage.setItem(
      "ethstar_consent",
      JSON.stringify({
        version: 1,
        necessary: true,
        statistics: opts.statistics,
        updatedAt: new Date().toISOString(),
      }),
    );
  }, { statistics });
}

export async function seedAuth(page: Page, accessToken = "ghu_fake_e2e_token") {
  await page.addInitScript((token) => {
    // Keep in sync with STORAGE_KEY in src/test/render.tsx
    localStorage.setItem(
      "ethstar_auth",
      JSON.stringify({
        access_token: token,
        expires_at: Date.now() + 3600_000,
        refresh_token: "ghr_fake_e2e",
        user: { login: "e2euser", avatar_url: "", name: "E2E User" },
      }),
    );
  }, accessToken);
}
