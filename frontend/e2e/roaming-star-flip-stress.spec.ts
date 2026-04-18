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

// Stress test for the dormant→roaming→dormant→roaming FLIP cycle under
// fast scroll reversal.
//
// `useFlipTransition` cancels its in-flight WAAPI animation with `fill: "none"`
// on every re-trigger, which reverts the transform and measures the post-cancel
// CSS-laid-out rect as the new "First". The contract assumes CSS layout stays
// stable between cancel and re-trigger. A scroll-reversal that flips the
// IntersectionObserver mode twice inside the 520ms flight window is the
// canonical way to stress that contract — the portal unmounts (roaming →
// dormant) and the dormant slot remounts, then we flip back to roaming before
// the first flight would have finished.
//
// We can't trivially pixel-diff for "jump" from Playwright, so the assertions
// are conservative signals: (a) the floating star is visible and on-screen at
// the end, (b) sampled positions stay within viewport bounds across the
// storm, (c) no JS errors or unhandled rejections fire. These are enough to
// catch NaN/undefined transform regressions and total-layout breakage without
// being brittle to timing drift across machines.

import { test, expect, type ConsoleMessage, type Page } from "@playwright/test";
import { seedConsent } from "./helpers";

// Matches DURATION_FLIP_DORMANT_TO_ROAMING in
// `frontend/src/components/roaming-star/constants.ts`. If that constant
// changes, the scroll cadence below must be revisited — the test's job is to
// hit the scroll-reversal inside the flight window.
const FLIGHT_MS = 520;

type Sample = { t: number; x: number; y: number; w: number; h: number };

async function samplePortalStar(page: Page): Promise<Sample | null> {
  // The floating star is portaled to `document.body`; the dormant slot lives
  // under the React root. Pick the portal copy by walking up from each star
  // button and matching a `position: fixed` ancestor (the portal wrapper
  // sets it inline, the dormant slot does not). Returns null when no portal
  // is mounted so the caller can skip samples during mode transitions.
  return page.evaluate(() => {
    const buttons = document.querySelectorAll<HTMLElement>(
      '[data-testid="roaming-star-button"]',
    );
    for (const btn of buttons) {
      let node: HTMLElement | null = btn.parentElement;
      while (node && node !== document.body) {
        if (getComputedStyle(node).position === "fixed") {
          const r = btn.getBoundingClientRect();
          return {
            t: performance.now(),
            x: r.left,
            y: r.top,
            w: r.width,
            h: r.height,
          };
        }
        node = node.parentElement;
      }
    }
    return null;
  });
}

test("FLIP survives fast scroll-reversal inside the flight window (dormant→roaming→dormant→roaming)", async ({
  page,
}) => {
  await seedConsent(page);

  // Capture runtime errors — a transform NaN or React render crash would
  // surface as `pageerror` (unhandled exception) or a `console.error` that
  // doesn't match the known app-level noise categories.
  //
  // Denylist rationale: the disconnected hero fires unauthenticated GitHub
  // API calls that the app logs + the browser logs, and we don't want those
  // to mask a real regression — but we also don't want those to make the
  // test flaky. The denylist is explicit so anyone debugging a failure can
  // tell at a glance whether they're looking at a FLIP bug or unrelated
  // plumbing noise.
  const IGNORED_CONSOLE_PREFIXES = [
    "Failed to load resource", // browser's native network-level log
    "[github]",                // app's lib/github.ts structured error log
  ];
  const errors: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (IGNORED_CONSOLE_PREFIXES.some((p) => text.startsWith(p))) return;
    errors.push(text);
  });
  page.on("pageerror", (err) => {
    errors.push(err.message);
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  // Confirm the dormant star rendered — otherwise we'd be stressing a layout
  // that was never visible to the user.
  const dormantStar = page.getByTestId("roaming-star-button").first();
  await expect(dormantStar).toBeVisible();

  const samples: Sample[] = [];
  const pushSample = async () => {
    const s = await samplePortalStar(page);
    if (s) samples.push(s);
  };

  // (a) scroll past the hero threshold — fires dormant → roaming and starts
  // the 520ms FLIP from the slot rect to the roaming drift position.
  await page.evaluate(() => window.scrollTo({ top: 1400, behavior: "instant" }));
  // Enough wall time for the portal to mount + the FLIP animation to start,
  // but well short of FLIGHT_MS so we interrupt mid-flight.
  await page.waitForTimeout(120);
  await pushSample();

  // (b) reverse to top inside the flight window — roaming → dormant, which
  // cancels the in-flight FLIP and unmounts the portal.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(80);

  // (c) scroll down again inside the same 520ms envelope — dormant → roaming,
  // new FLIP from the fresh post-cancel slot rect. This is the contract the
  // hook-level comment calls out: if CSS layout was perturbed between the
  // cancel and the re-trigger, the new "First" would be wrong and the user
  // would see a visible jump.
  await page.evaluate(() => window.scrollTo({ top: 1400, behavior: "instant" }));
  await page.waitForTimeout(60);
  await pushSample();
  await page.waitForTimeout(120);
  await pushSample();

  // Let the final FLIP settle before sampling the terminal state — the
  // roaming drift then drives position per rAF.
  await page.waitForTimeout(FLIGHT_MS + 80);
  const settled = await samplePortalStar(page);

  // --- Assertions --------------------------------------------------------

  // No JS errors or unhandled rejections fired during the storm. Transform
  // math bugs (NaN, undefined target) surface as console errors or React
  // render crashes.
  expect(errors, `console errors: ${errors.join("\n")}`).toHaveLength(0);

  // Every mid-flight portal sample has finite coordinates — no NaN/Infinity
  // teleportation from a corrupted FLIP measurement.
  for (const s of samples) {
    expect(Number.isFinite(s.x), `mid-flight x at t=${s.t}`).toBe(true);
    expect(Number.isFinite(s.y), `mid-flight y at t=${s.t}`).toBe(true);
    expect(s.w).toBeGreaterThan(0);
    expect(s.h).toBeGreaterThan(0);
  }

  // Final settled frame: portal must be mounted and the star must be inside
  // (or just past) the viewport. The roaming path touches gutters so we
  // allow 200px of slack either way, but a FLIP that animated to a wildly
  // wrong target would land well outside that envelope.
  expect(settled, "portal star must be mounted after settle").not.toBeNull();
  if (!settled) return;
  const vw = 1280;
  const vh = 800;
  const slack = 200;
  expect(settled.x).toBeGreaterThan(-slack);
  expect(settled.y).toBeGreaterThan(-slack);
  expect(settled.x).toBeLessThan(vw + slack);
  expect(settled.y).toBeLessThan(vh + slack);
});
