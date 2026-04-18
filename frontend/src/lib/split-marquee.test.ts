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
  MOBILE_SPLIT_THRESHOLD,
  shouldSplit,
  splitInHalf,
} from "./split-marquee";

describe("splitInHalf", () => {
  it("splits an even-length array into two equal halves", () => {
    const input = Array.from({ length: 24 }, (_, i) => i + 1);
    const [a, b] = splitInHalf(input);
    expect(a).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(b).toEqual(Array.from({ length: 12 }, (_, i) => i + 13));
  });

  it("gives the extra item to the first row on odd-length input", () => {
    const input = Array.from({ length: 25 }, (_, i) => i + 1);
    const [a, b] = splitInHalf(input);
    expect(a).toHaveLength(13);
    expect(b).toHaveLength(12);
    expect(a[0]).toBe(1);
    expect(a[12]).toBe(13);
    expect(b[0]).toBe(14);
    expect(b[11]).toBe(25);
  });

  it("returns a single-item array and an empty second half for length=1", () => {
    expect(splitInHalf([42])).toEqual([[42], []]);
  });

  it("returns two empty arrays for an empty input", () => {
    expect(splitInHalf<number>([])).toEqual([[], []]);
  });

  it("preserves definition order (no interleave)", () => {
    const input = ["a", "b", "c", "d"];
    const [a, b] = splitInHalf(input);
    expect(a).toEqual(["a", "b"]);
    expect(b).toEqual(["c", "d"]);
  });
});

describe("shouldSplit", () => {
  it("exposes the threshold as 20", () => {
    expect(MOBILE_SPLIT_THRESHOLD).toBe(20);
  });

  it("returns true on mobile when repo count is over the threshold", () => {
    expect(shouldSplit(24, false)).toBe(true);
  });

  it("returns false on desktop regardless of repo count", () => {
    expect(shouldSplit(24, true)).toBe(false);
    expect(shouldSplit(100, true)).toBe(false);
  });

  it("is strictly greater than — 20 itself does not split", () => {
    expect(shouldSplit(20, false)).toBe(false);
  });

  it("splits at 21 on mobile (just over the threshold)", () => {
    expect(shouldSplit(21, false)).toBe(true);
  });

  it("returns false for small categories on mobile", () => {
    expect(shouldSplit(5, false)).toBe(false);
    expect(shouldSplit(0, false)).toBe(false);
  });
});
