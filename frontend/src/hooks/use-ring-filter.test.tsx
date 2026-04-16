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
import { RING_FILTER_STORAGE_KEY } from "@/lib/ring-filter";
import { REPOS_BY_CATEGORY } from "@/lib/repos";

beforeEach(() => {
  localStorage.clear();
});

describe("useRingFilter", () => {
  it("initialises with the default filter when localStorage is empty", () => {
    const { result } = renderHook(() => useRingFilter());
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
    const { result } = renderHook(() => useRingFilter());
    expect(result.current.isDefault).toBe(false);
    const categories = new Set(
      result.current.selectedRepos.map((r) => r.category),
    );
    expect(categories).toEqual(new Set(["Ethereum Core"]));
  });

  it("falls back to default when persisted JSON is corrupt", () => {
    localStorage.setItem(RING_FILTER_STORAGE_KEY, "{not json");
    const { result } = renderHook(() => useRingFilter());
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
    const { result } = renderHook(() => useRingFilter());
    expect(result.current.isDefault).toBe(true);
  });

  it("toggleSection updates the filter and persists to localStorage", () => {
    const { result } = renderHook(() => useRingFilter());
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
    const { result } = renderHook(() => useRingFilter());
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
    const { result } = renderHook(() => useRingFilter());
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
    const { result } = renderHook(() => useRingFilter());
    const coreRepos = REPOS_BY_CATEGORY["Ethereum Core"];
    const starStatuses = {
      [`${coreRepos[0].owner}/${coreRepos[0].name}`]: "starred" as const,
      [`${coreRepos[1].owner}/${coreRepos[1].name}`]: "starred" as const,
    };
    const counts = result.current.countProgress(starStatuses);
    expect(counts.starred).toBe(2);
    expect(counts.selected).toBe(coreRepos.length);
  });
});
