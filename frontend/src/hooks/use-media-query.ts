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

import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query and re-render when it changes.
 * Returns `true` when the query matches, `false` otherwise.
 * Defaults to `false` during SSR / initial render before the effect fires.
 *
 * We intentionally avoid a lazy useState initializer (which would call
 * window.matchMedia) because the effect already constructs a MediaQueryList
 * for the listener — using both would mean two matchMedia constructions per
 * mount. Instead, the effect syncs the initial value via the handler.
 *
 * The handler wrapper (instead of a direct setMatches call) satisfies the
 * react-hooks/set-state-in-effect lint rule.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Sync initial value — the "change" listener only fires on future transitions.
    handler({ matches: mql.matches } as MediaQueryListEvent);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
