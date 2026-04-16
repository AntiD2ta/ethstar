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

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useRingFilter } from "./use-ring-filter";
import {
  DEFAULT_RING_FILTER,
  RING_FILTER_STORAGE_KEY,
  applyFilter,
} from "@/lib/ring-filter";
import { REPOS_BY_CATEGORY, REPOSITORIES } from "@/lib/repos";

beforeEach(() => {
  localStorage.clear();
});

describe("useRingFilter", () => {
  it("initialises with the default filter when localStorage is empty", () => {
    const { result } = renderHook(() => useRingFilter(true));
    expect(result.current.isDefault).toBe(true);
    expect(result.current.selectedRepos.length).toBe(
      REPOS_BY_CATEGORY["Ethereum Core"].length +
        REPOS_BY_CATEGORY["Execution Clients"].length +
        REPOS_BY_CATEGORY["Consensus Clients"].length,
    );
    expect(result.current.N).toBe(result.current.selectedRepos.length);
  });

  it("restores a persisted filter from localStorage on mount", () => {
    localStorage.setItem(
      RING_FILTER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        sections: ["Ethereum Core"],
        excludedRepos: [],
        includedExtras: [],
      }),
    );
    const { result } = renderHook(() => useRingFilter(true));
    expect(result.current.isDefault).toBe(false);
    const categories = new Set(
      result.current.selectedRepos.map((r) => r.category),
    );
    expect(categories).toEqual(new Set(["Ethereum Core"]));
  });

  it("falls back to default when persisted JSON is corrupt", () => {
    localStorage.setItem(RING_FILTER_STORAGE_KEY, "{not json");
    const { result } = renderHook(() => useRingFilter(true));
    expect(result.current.isDefault).toBe(true);
  });

  it("falls back to default when persisted version is wrong", () => {
    localStorage.setItem(
      RING_FILTER_STORAGE_KEY,
      JSON.stringify({
        version: 999,
        sections: ["Ethereum Core"],
        excludedRepos: [],
        includedExtras: [],
      }),
    );
    const { result } = renderHook(() => useRingFilter(true));
    expect(result.current.isDefault).toBe(true);
  });

  it("toggleSection updates the filter and persists to localStorage", () => {
    const { result } = renderHook(() => useRingFilter(true));
    act(() => {
      result.current.toggleSection("Validator Tooling");
    });
    expect(result.current.isDefault).toBe(false);
    expect(
      result.current.selectedRepos.some(
        (r) => r.category === "Validator Tooling",
      ),
    ).toBe(true);
    const raw = localStorage.getItem(RING_FILTER_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).sections).toContain("Validator Tooling");
  });

  it("toggleRepo on an out-of-section repo pulls it into the selection", () => {
    const { result } = renderHook(() => useRingFilter(true));
    const defiRepo = REPOS_BY_CATEGORY["DeFi & Smart Contracts"][0];
    act(() => {
      result.current.toggleRepo(defiRepo);
    });
    const keys = result.current.selectedRepos.map(
      (r) => `${r.owner}/${r.name}`,
    );
    expect(keys).toContain(`${defiRepo.owner}/${defiRepo.name}`);
  });

  it("reset() restores the default filter and wipes the persisted entry", () => {
    const { result } = renderHook(() => useRingFilter(true));
    act(() => {
      result.current.toggleSection("Validator Tooling");
    });
    expect(result.current.isDefault).toBe(false);
    act(() => {
      result.current.reset();
    });
    expect(result.current.isDefault).toBe(true);
    expect(localStorage.getItem(RING_FILTER_STORAGE_KEY)).toBeNull();
  });

  it("exposes a progress counter computed from starStatuses across selection", () => {
    localStorage.setItem(
      RING_FILTER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        sections: ["Ethereum Core"],
        excludedRepos: [],
        includedExtras: [],
      }),
    );
    const { result } = renderHook(() => useRingFilter(true));
    const coreRepos = REPOS_BY_CATEGORY["Ethereum Core"];
    const starStatuses = {
      [`${coreRepos[0].owner}/${coreRepos[0].name}`]: "starred" as const,
      [`${coreRepos[1].owner}/${coreRepos[1].name}`]: "starred" as const,
    };
    const counts = result.current.countProgress(starStatuses);
    expect(counts.starred).toBe(2);
    expect(counts.selected).toBe(coreRepos.length);
  });

  describe("effectiveFilter (signed-out override)", () => {
    it("returns DEFAULT_RING_FILTER when signed out, ignoring stored non-default", () => {
      // Seed a non-default filter (sections dropped + extras added).
      const stored = {
        version: 1 as const,
        sections: ["Ethereum Core"],
        excludedRepos: [],
        includedExtras: [
          `${REPOS_BY_CATEGORY["DeFi & Smart Contracts"][0].owner}/${REPOS_BY_CATEGORY["DeFi & Smart Contracts"][0].name}`,
        ],
      };
      localStorage.setItem(
        RING_FILTER_STORAGE_KEY,
        JSON.stringify(stored),
      );

      const { result } = renderHook(() => useRingFilter(false));

      // Rendered/effective filter must be DEFAULT when signed out.
      expect(result.current.effectiveFilter).toEqual(DEFAULT_RING_FILTER);
      const expectedRepos = applyFilter(DEFAULT_RING_FILTER, REPOSITORIES);
      expect(result.current.effectiveRepos).toEqual(expectedRepos);
      expect(result.current.effectiveN).toBe(expectedRepos.length);

      // Raw `filter` still holds the stored non-default (so `sign in` restores it).
      expect(result.current.filter.sections).toEqual(["Ethereum Core"]);
      expect(result.current.filter.includedExtras.length).toBe(1);
      expect(result.current.isDefault).toBe(false);

      // localStorage is preserved across signed-out renders — we do not clear it.
      const raw = localStorage.getItem(RING_FILTER_STORAGE_KEY);
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw!).sections).toEqual(["Ethereum Core"]);
    });

    it("returns the stored filter as effectiveFilter when signed in", () => {
      const stored = {
        version: 1 as const,
        sections: ["Ethereum Core"],
        excludedRepos: [],
        includedExtras: [],
      };
      localStorage.setItem(
        RING_FILTER_STORAGE_KEY,
        JSON.stringify(stored),
      );

      const { result } = renderHook(() => useRingFilter(true));

      expect(result.current.effectiveFilter.sections).toEqual([
        "Ethereum Core",
      ]);
      expect(result.current.effectiveFilter).toBe(result.current.filter);
      expect(result.current.effectiveRepos).toBe(result.current.selectedRepos);
      expect(result.current.effectiveN).toBe(result.current.N);
    });

    it("countProgress reflects effectiveRepos (signed-out uses DEFAULT slice)", () => {
      // Seed a narrow single-section filter.
      localStorage.setItem(
        RING_FILTER_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          sections: ["Ethereum Core"],
          excludedRepos: [],
          includedExtras: [],
        }),
      );

      const { result } = renderHook(() => useRingFilter(false));

      // While signed-out, `selected` should be the DEFAULT count, not 1 section.
      const defaultRepos = applyFilter(DEFAULT_RING_FILTER, REPOSITORIES);
      const counts = result.current.countProgress({});
      expect(counts.selected).toBe(defaultRepos.length);
    });
  });
});
