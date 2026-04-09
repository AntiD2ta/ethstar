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
