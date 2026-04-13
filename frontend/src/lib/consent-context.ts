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

export const CONSENT_VERSION = 1 as const;

export type ConsentCategory = "statistics";

export interface Consent {
  version: typeof CONSENT_VERSION;
  necessary: true;
  statistics: boolean;
  updatedAt: string;
}

export interface ConsentContextValue {
  /** `null` means the user has not made a choice yet — show the banner. */
  consent: Consent | null;
  /** `true` while hydrating from localStorage (first render only). */
  isHydrated: boolean;
  /** `true` when the banner (or preferences dialog) is visible. */
  bannerOpen: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  setCategory: (category: ConsentCategory, allowed: boolean) => void;
  /** Reopen the banner (e.g. from a footer "Cookie preferences" button). */
  openBanner: () => void;
  closeBanner: () => void;
}

export const ConsentContext = createContext<ConsentContextValue | null>(null);

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error("useConsent must be used within a ConsentProvider");
  }
  return ctx;
}
