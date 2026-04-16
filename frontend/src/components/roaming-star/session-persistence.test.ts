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

import { beforeEach, describe, expect, it } from "vitest";
import { DISCOVERY_HINT_STORAGE_KEY, DISMISSED_STORAGE_KEY } from "./constants";
import {
  __testing__,
  clearDiscoveryHintSeen,
  clearDismissed,
  hasSeenDiscoveryHint,
  isDismissed,
  markDiscoveryHintSeen,
  markDismissed,
} from "./session-persistence";

describe("session-persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("returns false when no record exists", () => {
    expect(isDismissed()).toBe(false);
  });

  it("persists and reads back a dismissal", () => {
    markDismissed();
    expect(isDismissed()).toBe(true);
  });

  it("clearDismissed removes the record", () => {
    markDismissed();
    clearDismissed();
    expect(isDismissed()).toBe(false);
  });

  it("rejects records with wrong version (forces re-prompt)", () => {
    window.localStorage.setItem(
      DISMISSED_STORAGE_KEY,
      JSON.stringify({ v: 999, dismissedAt: Date.now() }),
    );
    expect(isDismissed()).toBe(false);
  });

  it("rejects records missing required fields", () => {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify({ foo: "bar" }));
    expect(isDismissed()).toBe(false);
  });

  it("rejects malformed JSON", () => {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, "{not valid json");
    expect(isDismissed()).toBe(false);
  });

  it("parseRecord returns null on null input shape", () => {
    expect(__testing__.parseRecord("null")).toBeNull();
    expect(__testing__.parseRecord('"string"')).toBeNull();
    expect(__testing__.parseRecord("42")).toBeNull();
  });

  it("parseRecord returns null when dismissedAt is not a number", () => {
    expect(__testing__.parseRecord(JSON.stringify({ v: 1, dismissedAt: "today" }))).toBeNull();
  });

  describe("discovery-hint one-shot guard (tab-scoped)", () => {
    it("returns false when no record exists", () => {
      expect(hasSeenDiscoveryHint()).toBe(false);
    });

    it("persists and reads back a sighting", () => {
      markDiscoveryHintSeen();
      expect(hasSeenDiscoveryHint()).toBe(true);
    });

    it("writes to sessionStorage (not localStorage) so new tabs get a fresh hint", () => {
      markDiscoveryHintSeen();
      expect(window.sessionStorage.getItem(DISCOVERY_HINT_STORAGE_KEY)).toBe("1");
      expect(window.localStorage.getItem(DISCOVERY_HINT_STORAGE_KEY)).toBeNull();
    });

    it("clearDiscoveryHintSeen removes the record", () => {
      markDiscoveryHintSeen();
      clearDiscoveryHintSeen();
      expect(hasSeenDiscoveryHint()).toBe(false);
    });
  });
});
