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

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Phase H polish — lock the primary CTA verb ("Star all") across every
// surface that renders it. The critique baseline flagged CTA verb drift
// (e.g. "Proceed" / "Get started" / "Connect via GitHub" creeping in), and
// a cross-component snapshot is the simplest way to ensure the single verb
// chosen in Phase E stays the single verb across refactors.
//
// Surfaces covered:
//   - hero / sticky: `roaming-star.tsx` (primary-cta slot, also detaches to
//     a free-floating layer when hero scrolls out of view — so one component
//     owns both the hero and sticky surfaces).
//   - modal: `star-modal.tsx` (the confirm-authorization dialog button).
//
// The spec's `Tests` section listed four surfaces (hero, header, sticky,
// how-it-works) but the current architecture consolidates hero + sticky
// into one component and drops the how-it-works section — so two surfaces
// is the faithful mapping.

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

describe("CTA verb lock (Phase H)", () => {
  it("roaming-star dormant label starts with 'Star all '", () => {
    const src = read("components/roaming-star/roaming-star.tsx");
    // The disconnected primary line has two branches: the string literal
    // fallback when the count hasn't resolved, and the template literal
    // when it has. Both must preserve the canonical verb — lock each
    // independently so verb drift in either path still trips the guard.
    expect(src).toMatch(/"Star all now"/);
    expect(src).toMatch(/`Star all \$\{state\.remaining\} now`/);
  });

  it("star-modal confirm button uses the 'Star all ' verb in bulk mode", () => {
    const src = read("components/star-modal.tsx");
    // The bulk-mode label lives in the derived `ctaLabel` template literal.
    // Lock the canonical verb + count interpolation; the per-repo Star
    // action takes the singular branch (`Star ${repoLabel}` /
    // "Star repository") which is intentionally separate.
    expect(src).toMatch(/`Star all \$\{targetCount\}`/);
  });

  it("no legacy CTA verbs leak into rendered components", () => {
    // Scope: exclude the cta-verb test itself (where these strings are
    // listed as the forbidden set) and exclude ui/ (shadcn primitives).
    const sources = [
      read("components/roaming-star/roaming-star.tsx"),
      read("components/star-modal.tsx"),
      read("components/hero-section.tsx"),
      read("components/auth-header.tsx"),
    ];
    for (const src of sources) {
      // Strip comments so doc examples don't false-positive.
      const noComments = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(noComments, "stale 'Get Started' verb").not.toMatch(/\bGet Started\b/);
      expect(noComments, "stale 'Connect via GitHub' verb").not.toMatch(
        /\bConnect via GitHub\b/,
      );
      // `Proceed` is OK as a function identifier (`handleProceed`), so we
      // can't use `\b` here — it would false-positive on camelCase. The
      // regex requires a space/quote/angle-bracket or `&quot;` on both
      // sides of the word, i.e. it only fires when `Proceed` appears as
      // user-visible prose or a rendered button label.
      expect(noComments, "stale 'Proceed' verb in prose").not.toMatch(
        /(?:[\s">]|&quot;)Proceed(?:[\s.",<!]|&quot;)/,
      );
    }
    // Smoke check: at least one of the rendered sources contains the
    // canonical verb — catches accidental deletion of the whole CTA.
    const anyHit = sources.some((s) => /Star all /.test(s));
    expect(anyHit, "no source file renders the canonical 'Star all ' verb").toBe(true);
  });
});
