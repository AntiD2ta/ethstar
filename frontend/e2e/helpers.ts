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
