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

import { test, expect, type Page } from "@playwright/test";
import { seedConsent } from "./helpers";

// Stub window.open before any page script runs, and capture invocations on
// the window so the test can read them back via evaluate.
async function stubWindowOpen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as Window & {
      __openedUrls?: string[];
      open: typeof window.open;
    };
    w.__openedUrls = [];
    w.open = (url?: string | URL) => {
      w.__openedUrls!.push(typeof url === "string" ? url : String(url ?? ""));
      return null;
    };
  });
}

async function getOpenedUrls(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      (window as Window & { __openedUrls?: string[] }).__openedUrls ?? [],
  );
}

// Keyboard shortcuts only work once React has hydrated and the window-level
// ⌘K listener is attached — tests wait for this anchor before pressing keys.
async function waitForHome(page: Page): Promise<void> {
  await expect(page.getByTestId("command-palette-trigger")).toBeVisible();
}
async function waitForPrivacy(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { name: /privacy policy/i }),
  ).toBeVisible();
}

test.use({ reducedMotion: "reduce" });

test.describe("Command palette — global ⌘K trigger", () => {
  test.beforeEach(async ({ page }) => {
    await seedConsent(page);
    await stubWindowOpen(page);
  });

  test("⌘K opens the palette from the home page", async ({ page }) => {
    await page.goto("/");
    await waitForHome(page);
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const input = dialog.getByPlaceholder(
      /search routes, actions, or repositories/i,
    );
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test("Esc closes the palette", async ({ page }) => {
    await page.goto("/");
    await waitForHome(page);
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("clicking the header trigger opens the palette", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("command-palette-trigger").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
  });

  test("typing 'go-ethereum' narrows the results and Enter opens the repo URL", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForHome(page);
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.type("go-ethereum");
    await expect(
      dialog.getByRole("option", { name: /ethereum\/go-ethereum/i }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("option", { name: /ethereum\/solidity/i }),
    ).toHaveCount(0);
    // Enter activates the first match — assert window.open was stubbed with
    // the right URL, without actually opening a new tab.
    await page.keyboard.press("Enter");
    await expect(dialog).not.toBeVisible();
    const opened = await getOpenedUrls(page);
    expect(opened).toContain("https://github.com/ethereum/go-ethereum");
  });

  test("selecting 'Home' from /privacy navigates back to /", async ({
    page,
  }) => {
    await page.goto("/privacy");
    await expect(page).toHaveURL(/\/privacy$/);
    await waitForPrivacy(page);
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("option", { name: /^home$/i }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("⌘K opens the palette from the /privacy route too", async ({ page }) => {
    await page.goto("/privacy");
    await waitForPrivacy(page);
    await page.keyboard.press("ControlOrMeta+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
  });
});
