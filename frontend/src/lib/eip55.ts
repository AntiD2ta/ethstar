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

import { keccak256 } from "js-sha3";

const HEX_RE = /^[0-9a-fA-F]{40}$/;

/**
 * Converts an Ethereum address to its EIP-55 mixed-case checksum encoding.
 * @see https://eips.ethereum.org/EIPS/eip-55
 */
export function toChecksumAddress(address: string): string {
  // Strip optional 0x prefix
  const bare = address.startsWith("0x") ? address.slice(2) : address;

  if (bare.length !== 40) {
    throw new Error(`Invalid address length: expected 40 hex chars, got ${bare.length}`);
  }
  if (!HEX_RE.test(bare)) {
    throw new Error("Invalid address: contains non-hex characters");
  }

  const lower = bare.toLowerCase();
  const hash = keccak256(lower);

  let checksummed = "0x";
  for (let i = 0; i < 40; i++) {
    // Each hex digit of the hash determines case of the corresponding address char.
    // parseInt(hash[i], 16) >= 8 → uppercase
    const hashNibble = parseInt(hash[i], 16);
    checksummed += hashNibble >= 8 ? lower[i].toUpperCase() : lower[i];
  }

  return checksummed;
}
