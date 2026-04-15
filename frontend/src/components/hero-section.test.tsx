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

import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HeroSection } from "./hero-section";

const renderHero = (overrides: Partial<ComponentProps<typeof HeroSection>> = {}) =>
  render(
    <HeroSection
      repoCount={58}
      formattedStars="125K"
      categoryCount={5}
      onViewRepositories={() => {}}
      primaryCta={<button type="button">Star all 58 now</button>}
      primaryCtaPresent
      {...overrides}
    />,
  );

describe("HeroSection — Phase E reframe", () => {
  it("renders an H1 framing statement (≤6 words, no CTA verb)", () => {
    renderHero();
    const h1 = screen.getByTestId("hero-h1");
    const text = h1.textContent?.trim() ?? "";
    expect(text.length).toBeGreaterThan(0);
    const words = text.split(/\s+/);
    expect(words.length).toBeLessThanOrEqual(6);
    // The H1 must NOT be a CTA verb. "Star Every", "Star all", "Click",
    // "Sign in" would be slop-tier carryover.
    expect(text).not.toMatch(/^Star /i);
    expect(text).not.toMatch(/^Sign /i);
    expect(text).not.toMatch(/^Click /i);
    // Locked direction: "Support" framing.
    expect(text).toMatch(/Support/);
  });

  it("renders the locked subhead with star + GitHub + repo tokens, ≤2 sentences", () => {
    renderHero();
    const sub = screen.getByTestId("hero-subhead").textContent?.trim() ?? "";
    expect(sub.length).toBeGreaterThan(0);
    expect(sub).toMatch(/star/i);
    expect(sub).toMatch(/GitHub/);
    expect(sub).toMatch(/repo/i);
    // Sentence count via period/!/? terminators outside ellipses.
    const sentences = sub.replace(/\.\.\./g, "").split(/[.!?]+/).filter(Boolean);
    expect(sentences.length).toBeLessThanOrEqual(2);
  });

  it("three-tier non-duplication: H1 / subhead / dormant-label are pairwise distinct", () => {
    renderHero();
    const h1 = screen.getByTestId("hero-h1").textContent?.trim() ?? "";
    const sub = screen.getByTestId("hero-subhead").textContent?.trim() ?? "";
    // The dormant label is owned by RoamingStar, but the canonical disconnected
    // string is `Star all ${remaining} now`. Test the static template here so
    // copy drift in either tier surfaces as a unit-level failure.
    const dormant = "Star all 58 now";

    const lower = (s: string) => s.toLowerCase();
    const pairs: Array<[string, string]> = [
      [h1, sub],
      [h1, dormant],
      [sub, dormant],
    ];
    for (const [a, b] of pairs) {
      expect(lower(b).includes(lower(a))).toBe(false);
      expect(lower(a).includes(lower(b))).toBe(false);
    }
  });

  it("renders the chalk-mark SVG exactly once in the hero", () => {
    const { container } = renderHero();
    const chalkMarks = container.querySelectorAll("svg path[stroke^='oklch']");
    expect(chalkMarks.length).toBe(1);
  });

  it("does not contain the legacy slop strings", () => {
    const { container } = renderHero();
    const html = container.innerHTML;
    expect(html).not.toContain("Star Every");
    // "Star every Ethereum repo" was the duplicated dormant slop string.
    expect(html).not.toContain("Star every Ethereum repo");
  });

  it("uses CSS Grid for asymmetric layout, not centered-everything", () => {
    const { container } = renderHero();
    // Either the hero-h1 or its parent should sit inside a grid container.
    // We check the grid container has the md:grid-cols-12 class so the
    // asymmetric ≥md layout is preserved through any future restyle.
    const grid = container.querySelector(".md\\:grid-cols-12");
    expect(grid).not.toBeNull();
  });
});
