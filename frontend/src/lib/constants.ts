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

import { toChecksumAddress } from "@/lib/eip55";

/** Raw lowercase ETH donation address. */
export const ETH_ADDRESS = "0x03574b4bbb883a790234d200b6c3c74f1c4a8bfd";

/** EIP-55 checksummed ETH donation address (computed once at module scope). */
export const ETH_ADDRESS_CHECKSUMMED = toChecksumAddress(ETH_ADDRESS);

/** Truncated address for button display (e.g. "0x0357…8bfD"). */
export const ETH_ADDRESS_DISPLAY = `${ETH_ADDRESS_CHECKSUMMED.slice(0, 6)}…${ETH_ADDRESS_CHECKSUMMED.slice(-4)}`;

/** Link to the MAINTAINERS.md repo-list-changes section. */
export const MAINTAINERS_URL =
  "https://github.com/AntiD2ta/ethstar/blob/main/MAINTAINERS.md#repo-list-changes";

/** GitHub Sponsors profile URL. */
export const GITHUB_SPONSORS_URL = "https://github.com/sponsors/AntiD2ta";

/** Ko-fi profile URL. */
export const KOFI_URL = "https://ko-fi.com/antid2ta";

/** GitHub repository URL. */
export const GITHUB_REPO_URL = "https://github.com/AntiD2ta/ethstar";

/** X (Twitter) profile URL. */
export const X_PROFILE_URL = "https://x.com/AntiD2ta";
