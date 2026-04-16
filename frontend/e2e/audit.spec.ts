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

// Regression coverage for Phase H — Audit & Polish. Locks in the
// micro-consistency fixes: no stray `<br /><br />` pairs anywhere, no legacy
// CTA verbs, and the `hover:eth-glow` utility resolves to a real box-shadow
// (it was previously a silent no-op). The axe-core sweep lives in
// `accessibility.spec.ts`; this file focuses on the textual + style polish
// items that aren't tool-enforceable today.

const ALL_ROUTES = ["/", "/privacy", "/cookies", "/this-route-does-not-exist"] as const;

test.beforeEach(async ({ page }) => {
  await seedConsent(page);
});

test.describe("Phase H — polish regressions", () => {
  for (const route of ALL_ROUTES) {
    test(`no empty paragraph pairs (<br><br>) on ${route}`, async ({ page }) => {
      await page.goto(route);
      // Double <br> is the tell of a paragraph that should be a real <p>;
      // Phase E's star-modal fix eliminated the last known occurrence. This
      // guard catches any regression at the DOM level.
      const brBrCount = await page.evaluate(() => {
        const brs = Array.from(document.querySelectorAll("br"));
        let pairs = 0;
        for (const br of brs) {
          // Whitespace-only text nodes between two <br>s still count as a pair.
          let sibling = br.nextSibling;
          while (
            sibling &&
            sibling.nodeType === Node.TEXT_NODE &&
            !(sibling.textContent ?? "").trim()
          ) {
            sibling = sibling.nextSibling;
          }
          if (sibling?.nodeName === "BR") pairs++;
        }
        return pairs;
      });
      expect(brBrCount).toBe(0);
    });
  }

  test("no legacy CTA verbs ('Get Started' | 'Connect via GitHub' | 'Proceed') on /", async ({
    page,
  }) => {
    await page.goto("/");
    const body = (await page.locator("body").textContent()) ?? "";
    // We match whole-word to avoid flagging "Proceed" in legal boilerplate —
    // and check the home route specifically because the polish target is the
    // primary call-to-action surface. Cookie/privacy prose is exempt from
    // this rule (it's copy, not a button).
    expect(body).not.toMatch(/\bGet Started\b/);
    expect(body).not.toMatch(/\bConnect via GitHub\b/);
    expect(body).not.toMatch(/\bProceed\b/);
  });

  test("hover:eth-glow resolves to a real CSS rule (no silent no-op)", async ({
    page,
  }) => {
    await page.goto("/");
    // Phase H regression: `hover:eth-glow` previously compiled to nothing
    // because `.eth-glow` lived inside `@layer utilities` as a plain class,
    // which Tailwind v4 doesn't wrap with variants. The `@utility eth-glow`
    // fix should produce a `.hover\:eth-glow:hover` rule with a box-shadow.
    const match = await page.evaluate(() => {
      const hits: string[] = [];
      const walk = (rules: CSSRuleList) => {
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSStyleRule) {
            const text = rule.cssText;
            if (
              text.includes("eth-glow") &&
              text.includes(":hover") &&
              text.includes("box-shadow")
            ) {
              hits.push(text);
            }
          } else if ("cssRules" in rule) {
            walk((rule as CSSGroupingRule).cssRules);
          }
        }
      };
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          walk(sheet.cssRules);
        } catch {
          /* cross-origin; skip */
        }
      }
      return hits[0] ?? null;
    });
    expect(match, "expected a `.hover\\:eth-glow:hover` rule with box-shadow").not.toBeNull();
  });

  // Tab order spot-check: Phase H flagged the `·` hero stat separators as
  // a possible dead-stop source. The current implementation renders them
  // as inline `<span>` inside the stats `<p>`, so they should never receive
  // focus. Kept as an explicit guard against reverting to a flex row of
  // `<div>` kids.
  test("hero stat separators are not keyboard focusable", async ({
    page,
  }: { page: Page }) => {
    await page.goto("/");
    const focusableSeparators = await page.evaluate(() => {
      const meta = document.querySelector('[data-testid="hero-meta"]');
      if (!meta) return -1;
      // Any element inside the stat paragraph with tabindex >= 0 or that
      // is natively focusable (we shouldn't have any — it's all spans).
      const all = meta.querySelectorAll(
        'a, button, [tabindex]:not([tabindex="-1"])',
      );
      return all.length;
    });
    expect(focusableSeparators).toBe(0);
  });
});
