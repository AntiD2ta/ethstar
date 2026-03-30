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
