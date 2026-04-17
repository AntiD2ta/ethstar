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
import {
  formatStarCount,
  formatHeroStars,
  deriveHeroStarsDisplay,
} from "./utils";

describe("formatStarCount", () => {
  it.each([
    [0, "0"],
    [1, "1"],
    [999, "999"],
    [1000, "1k"],
    [1050, "1.1k"],
    [1500, "1.5k"],
    [1999, "2k"],
    [9999, "10k"],
    [10000, "10k"],
    [142000, "142k"],
  ])("formats %i as %s", (input, expected) => {
    expect(formatStarCount(input)).toBe(expected);
  });
});

describe("formatHeroStars", () => {
  // The floor-to-thousand invariant is load-bearing: the hero ribbon appends
  // a "+" suffix, so rounding up would make the label a lie for any count
  // whose fractional-thousand tail is non-zero. The cases at 127,999 and
  // 129,532 specifically guard against `Math.round`/`Math.ceil` regressions.
  it.each([
    [0, "0"],
    [999, "999"],
    [1000, "1,000+"],
    [125000, "125,000+"],
    [127999, "127,000+"],
    [129532, "129,000+"],
  ])("formats %i as %s", (input, expected) => {
    expect(formatHeroStars(input)).toBe(expected);
  });
});

describe("deriveHeroStarsDisplay", () => {
  it("returns the `~`-prefixed fallback when combinedStars is null", () => {
    // Pre-fetch / fetch-failure path: the label marks itself as approximate
    // so users don't mistake the conservative floor for a live measurement.
    expect(deriveHeroStarsDisplay(null, 125000)).toEqual({
      label: "~125,000+",
      isLive: false,
    });
  });

  it("returns the live formatted count (no prefix) when combinedStars is present", () => {
    expect(deriveHeroStarsDisplay(129532, 125000)).toEqual({
      label: "129,000+",
      isLive: true,
    });
  });

  it("treats zero as live, not as null (zero is a valid measurement)", () => {
    // Edge case: `null` means no data yet; `0` is a real (if unlikely) answer.
    // The derivation must not coerce `0` to the fallback path.
    expect(deriveHeroStarsDisplay(0, 125000)).toEqual({
      label: "0",
      isLive: true,
    });
  });
});
