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

import { describe, expect, it } from "vitest";
import { distributeRepos, sortReposForDistribution } from "./distribute-repos";
import type { Repository } from "@/lib/types";

const RADII = [240, 350, 460, 570] as const;

function ids(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

describe("distributeRepos", () => {
  const cases = [
    { n: 0, expectedCounts: [0, 0, 0, 0] },
    { n: 1, expectedCounts: [0, 0, 0, 1] },
    { n: 4, expectedCounts: [1, 1, 1, 1] },
    { n: 32, expectedCounts: [5, 7, 9, 11] },
    { n: 58, expectedCounts: [9, 13, 16, 20] },
    { n: 59, expectedCounts: [8, 13, 17, 21] },
    { n: 100, expectedCounts: [15, 22, 28, 35] },
  ];

  for (const { n, expectedCounts } of cases) {
    it(`partitions ${n} items into 4 rings with weighted counts [${expectedCounts.join(", ")}]`, () => {
      const input = ids(n);
      const rings = distributeRepos(input, RADII);
      expect(rings).toHaveLength(RADII.length);
      expect(rings.map((r) => r.length)).toEqual(expectedCounts);

      // Every input element appears exactly once
      const flat = rings.flat();
      expect(flat).toHaveLength(n);
      expect(new Set(flat).size).toBe(n);

      // Counts are monotone non-decreasing outward (larger radius → more chips)
      for (let i = 0; i < rings.length - 1; i++) {
        expect(rings[i].length).toBeLessThanOrEqual(rings[i + 1].length);
      }
    });
  }

  it("preserves input order across rings (contiguous slicing)", () => {
    const input = ids(58);
    const rings = distributeRepos(input, RADII);
    expect(rings.flat()).toEqual(input);
  });

  it("produces monotone counts even when rounding would otherwise starve the last ring", () => {
    // N=3 with equal radii is the minimal case where the naive
    // `round + remainder` pattern produces [1, 1, 1, 0] — the invariant
    // enforcement must redistribute so the outer ring is not smallest.
    const rings = distributeRepos(ids(3), [1, 1, 1, 1]);
    const counts = rings.map((r) => r.length);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(3);
    for (let i = 0; i < counts.length - 1; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i + 1]);
    }
  });

  it("maintains monotone counts across a range of N for the production radii", () => {
    for (let n = 0; n <= 120; n++) {
      const rings = distributeRepos(ids(n), RADII);
      const counts = rings.map((r) => r.length);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(n);
      for (let i = 0; i < counts.length - 1; i++) {
        expect(counts[i]).toBeLessThanOrEqual(counts[i + 1]);
      }
    }
  });

  it("never produces a negative count, even for pathological radii + small N", () => {
    // Regression: the previous Math.round + remainder algorithm emitted
    // counts[last] = -1 for N=2, radii=[1,1,1,1] (head rounded 0.5→1
    // three times, overshooting N). The Hamilton apportionment variant
    // floors first, then hands out the remainder, so overshoot is
    // impossible. Sweep small-N + flat/near-flat radii to lock it in.
    const radiiMatrix = [
      [1, 1, 1, 1],
      [1, 1, 1, 2],
      [1, 2, 3, 4],
      [2, 2, 3, 3],
    ];
    for (const radii of radiiMatrix) {
      for (let n = 0; n <= 10; n++) {
        const rings = distributeRepos(ids(n), radii);
        const counts = rings.map((r) => r.length);
        expect(counts.reduce((a, b) => a + b, 0)).toBe(n);
        for (const c of counts) expect(c).toBeGreaterThanOrEqual(0);
        for (let i = 0; i < counts.length - 1; i++) {
          expect(counts[i]).toBeLessThanOrEqual(counts[i + 1]);
        }
      }
    }
  });

  it("throws when radii are not non-decreasing", () => {
    expect(() => distributeRepos([1, 2, 3], [570, 240, 460, 350])).toThrow(
      /non-decreasing/,
    );
  });
});

describe("sortReposForDistribution", () => {
  const makeRepo = (
    owner: string,
    name: string,
    category: Repository["category"],
  ): Repository => ({
    owner,
    name,
    description: "x",
    category,
    url: `https://github.com/${owner}/${name}`,
  });

  it("sorts by category order, then owner, then name", () => {
    const input: Repository[] = [
      makeRepo("zeta", "z", "Validator Tooling"),
      makeRepo("alpha", "a", "DeFi & Smart Contracts"),
      makeRepo("alpha", "b", "Ethereum Core"),
      makeRepo("alpha", "a", "Ethereum Core"),
      makeRepo("beta", "a", "Execution Clients"),
    ];
    const categoryOrder = [
      "Ethereum Core",
      "Execution Clients",
      "Consensus Clients",
      "Validator Tooling",
      "DeFi & Smart Contracts",
    ] as const;

    const out = sortReposForDistribution(input, categoryOrder);

    expect(out.map((r) => `${r.category}|${r.owner}/${r.name}`)).toEqual([
      "Ethereum Core|alpha/a",
      "Ethereum Core|alpha/b",
      "Execution Clients|beta/a",
      "Validator Tooling|zeta/z",
      "DeFi & Smart Contracts|alpha/a",
    ]);
  });

  it("is deterministic across calls (stable output)", () => {
    const input: Repository[] = [
      makeRepo("b", "x", "Ethereum Core"),
      makeRepo("a", "y", "Ethereum Core"),
      makeRepo("a", "x", "Ethereum Core"),
    ];
    const order = ["Ethereum Core"] as const;
    const a = sortReposForDistribution(input, order).map(
      (r) => `${r.owner}/${r.name}`,
    );
    const b = sortReposForDistribution(input, order).map(
      (r) => `${r.owner}/${r.name}`,
    );
    expect(a).toEqual(b);
    expect(a).toEqual(["a/x", "a/y", "b/x"]);
  });

  it("does not mutate the input array", () => {
    const input: Repository[] = [
      makeRepo("b", "x", "Ethereum Core"),
      makeRepo("a", "y", "Ethereum Core"),
    ];
    const copy = input.slice();
    sortReposForDistribution(input, ["Ethereum Core"] as const);
    expect(input).toEqual(copy);
  });
});
