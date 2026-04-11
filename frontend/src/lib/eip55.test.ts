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
import { toChecksumAddress } from "@/lib/eip55";

describe("toChecksumAddress", () => {
  // Test vectors from the EIP-55 specification:
  // https://eips.ethereum.org/EIPS/eip-55
  const eip55Vectors = [
    // All caps
    "0x52908400098527886E0F7030069857D2E4169EE7",
    "0x8617E340B3D01FA5F11F306F4090FD50E238070D",
    // All lower
    "0xde709f2102306220921060314715629080e2fb77",
    "0x27b1fdb04752bbc536007a920d24acb045561c26",
    // Normal
    "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
    "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
    "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
    "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb",
  ];

  it.each(eip55Vectors)(
    "correctly checksums EIP-55 spec vector: %s",
    (expected) => {
      const lower = expected.toLowerCase();
      expect(toChecksumAddress(lower)).toBe(expected);
    },
  );

  it("checksums the ethstar donation address", () => {
    const result = toChecksumAddress(
      "0x03574b4bbb883a790234d200b6c3c74f1c4a8bfd",
    );
    expect(result).toBe("0x03574B4BBB883A790234d200B6C3C74f1C4A8bfD");
  });

  it("handles already-checksummed input", () => {
    const checksummed = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
    expect(toChecksumAddress(checksummed)).toBe(checksummed);
  });

  it("handles input without 0x prefix", () => {
    const result = toChecksumAddress(
      "5aaeb6053f3e94c9b9a09f33669435e7ef1beaed",
    );
    expect(result).toBe("0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed");
  });

  it("throws on invalid address length", () => {
    expect(() => toChecksumAddress("0x1234")).toThrow();
  });

  it("throws on non-hex characters", () => {
    expect(() =>
      toChecksumAddress("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG"),
    ).toThrow();
  });
});
