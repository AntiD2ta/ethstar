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

import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  CONSENT_VERSION,
  ConsentContext,
  type Consent,
  type ConsentCategory,
  type ConsentContextValue,
} from "./consent-context";

export const CONSENT_STORAGE_KEY = "ethstar_consent";

/** Shape-validate parsed JSON. Returns null on any mismatch so the banner re-prompts. */
function parseConsent(raw: string | null): Consent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    if (obj.version !== CONSENT_VERSION) return null;
    if (obj.necessary !== true) return null;
    if (typeof obj.statistics !== "boolean") return null;
    if (typeof obj.updatedAt !== "string") return null;
    return {
      version: CONSENT_VERSION,
      necessary: true,
      statistics: obj.statistics,
      updatedAt: obj.updatedAt,
    };
  } catch {
    return null;
  }
}

function loadConsent(): Consent | null {
  try {
    return parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

function saveConsent(consent: Consent): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Quota or disabled storage — silently drop. User stays in "no choice" state
    // and will be re-prompted next visit. Non-blocking by design.
  }
}

function buildConsent(statistics: boolean): Consent {
  return {
    version: CONSENT_VERSION,
    necessary: true,
    statistics,
    updatedAt: new Date().toISOString(),
  };
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  // Hydrate synchronously from localStorage so the banner visibility is
  // correct on first paint — avoids a flash where the banner mounts late.
  // One initializer feeds both state slots to avoid reading storage twice.
  const [state, setState] = useState<{ consent: Consent | null; bannerOpen: boolean }>(
    () => {
      const loaded = loadConsent();
      return { consent: loaded, bannerOpen: loaded === null };
    },
  );
  const { consent, bannerOpen } = state;
  const isHydrated = true;

  const persist = useCallback((next: Consent) => {
    saveConsent(next);
    setState({ consent: next, bannerOpen: false });
  }, []);

  const acceptAll = useCallback(() => persist(buildConsent(true)), [persist]);
  const rejectAll = useCallback(() => persist(buildConsent(false)), [persist]);

  const setCategory = useCallback(
    (category: ConsentCategory, allowed: boolean) => {
      persist({
        ...(consent ?? buildConsent(false)),
        [category]: allowed,
        updatedAt: new Date().toISOString(),
      });
    },
    [consent, persist],
  );

  const openBanner = useCallback(
    () => setState((s) => ({ ...s, bannerOpen: true })),
    [],
  );
  const closeBanner = useCallback(
    () =>
      setState((s) =>
        // Only close if a choice has been made; otherwise keep the banner visible.
        s.consent !== null ? { ...s, bannerOpen: false } : s,
      ),
    [],
  );

  const value = useMemo<ConsentContextValue>(
    () => ({
      consent,
      isHydrated,
      bannerOpen,
      acceptAll,
      rejectAll,
      setCategory,
      openBanner,
      closeBanner,
    }),
    [consent, isHydrated, bannerOpen, acceptAll, rejectAll, setCategory, openBanner, closeBanner],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}
