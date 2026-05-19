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

import { createContext, useContext } from "react";

export interface CommandPaletteContextValue {
  /** Open the global command palette. Safe no-op when the provider is absent. */
  open: () => void;
}

// Default to a no-op so components rendered outside a provider (e.g. in unit
// tests that don't mount RootLayout) don't have to special-case the absence
// of the context. RootLayout provides the real opener.
export const CommandPaletteContext = createContext<CommandPaletteContextValue>({
  open: () => {},
});

export function useCommandPalette(): CommandPaletteContextValue {
  return useContext(CommandPaletteContext);
}
