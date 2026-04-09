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
import { formatStarCount } from "./utils";

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
