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

import { DISMISSED_STORAGE_KEY, DISMISSED_VERSION } from "./constants";

interface DismissedRecord {
  v: number;
  dismissedAt: number;
}

// Validate JSON.parse output per CLAUDE.md rules: `typeof` every field and
// return null on shape mismatch. Versioned: on version drift we behave as if
// no record exists so the star re-appears instead of silently staying hidden.
function parseRecord(raw: string): DismissedRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.v !== "number" || obj.v !== DISMISSED_VERSION) return null;
  if (typeof obj.dismissedAt !== "number") return null;
  return { v: obj.v, dismissedAt: obj.dismissedAt };
}

export function isDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return false;
    return parseRecord(raw) !== null;
  } catch {
    return false;
  }
}

export function markDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    const record: DismissedRecord = { v: DISMISSED_VERSION, dismissedAt: Date.now() };
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage quota or disabled — silently degrade. Worst case: star re-appears next load.
  }
}

export function clearDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DISMISSED_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

// Exported for unit tests only.
export const __testing__ = { parseRecord };
