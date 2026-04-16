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

import { describe, expect, it } from "vitest";
import {
  DEFAULT_RING_FILTER,
  RING_FILTER_STORAGE_KEY,
  applyFilter,
  deserializeFilter,
  isDefaultFilter,
  serializeFilter,
  toggleRepo,
  toggleSection,
} from "./ring-filter";
import { CATEGORIES, REPOSITORIES, REPOS_BY_CATEGORY } from "./repos";

describe("ring-filter defaults", () => {
  it("default includes the three spine sections only", () => {
    expect(DEFAULT_RING_FILTER.sections).toEqual([
      "Ethereum Core",
      "Execution Clients",
      "Consensus Clients",
    ]);
    expect(DEFAULT_RING_FILTER.excludedRepos).toEqual([]);
    expect(DEFAULT_RING_FILTER.includedExtras).toEqual([]);
    expect(DEFAULT_RING_FILTER.version).toBe(1);
  });

  it("uses the ethstar_ prefix per repo convention", () => {
    expect(RING_FILTER_STORAGE_KEY).toBe("ethstar_ring_filter");
  });

  it("isDefaultFilter recognises the default shape", () => {
    expect(isDefaultFilter(DEFAULT_RING_FILTER)).toBe(true);
  });

  it("isDefaultFilter rejects a customised filter", () => {
    const f = toggleSection(DEFAULT_RING_FILTER, "Validator Tooling");
    expect(isDefaultFilter(f)).toBe(false);
  });
});

describe("applyFilter", () => {
  it("default filter yields only core + EL + CL repos", () => {
    const selected = applyFilter(DEFAULT_RING_FILTER, REPOSITORIES);
    const categories = new Set(selected.map((r) => r.category));
    expect(categories).toEqual(
      new Set(["Ethereum Core", "Execution Clients", "Consensus Clients"]),
    );
    const expectedSize =
      REPOS_BY_CATEGORY["Ethereum Core"].length +
      REPOS_BY_CATEGORY["Execution Clients"].length +
      REPOS_BY_CATEGORY["Consensus Clients"].length;
    expect(selected).toHaveLength(expectedSize);
  });

  it("section toggle adds Validator Tooling to the set", () => {
    const f = toggleSection(DEFAULT_RING_FILTER, "Validator Tooling");
    const selected = applyFilter(f, REPOSITORIES);
    expect(selected.some((r) => r.category === "Validator Tooling")).toBe(true);
  });

  it("section toggle removes a default section", () => {
    const f = toggleSection(DEFAULT_RING_FILTER, "Execution Clients");
    const selected = applyFilter(f, REPOSITORIES);
    expect(selected.every((r) => r.category !== "Execution Clients")).toBe(true);
  });

  it("excludedRepos removes a single repo from an included section", () => {
    const victim = REPOS_BY_CATEGORY["Ethereum Core"][0];
    const f = toggleRepo(DEFAULT_RING_FILTER, victim);
    const selected = applyFilter(f, REPOSITORIES);
    const keys = selected.map((r) => `${r.owner}/${r.name}`);
    expect(keys).not.toContain(`${victim.owner}/${victim.name}`);
  });

  it("includedExtras adds a single repo from an excluded section", () => {
    const defiRepo = REPOS_BY_CATEGORY["DeFi & Smart Contracts"][0];
    const f = toggleRepo(DEFAULT_RING_FILTER, defiRepo);
    const selected = applyFilter(f, REPOSITORIES);
    const keys = selected.map((r) => `${r.owner}/${r.name}`);
    expect(keys).toContain(`${defiRepo.owner}/${defiRepo.name}`);
  });

  it("toggleRepo twice on an excluded repo returns to the original set", () => {
    const defiRepo = REPOS_BY_CATEGORY["DeFi & Smart Contracts"][0];
    const once = toggleRepo(DEFAULT_RING_FILTER, defiRepo);
    const twice = toggleRepo(once, defiRepo);
    const baseline = applyFilter(DEFAULT_RING_FILTER, REPOSITORIES).map(
      (r) => `${r.owner}/${r.name}`,
    );
    const after = applyFilter(twice, REPOSITORIES).map(
      (r) => `${r.owner}/${r.name}`,
    );
    expect(after).toEqual(baseline);
  });

  it("result respects categories ordering", () => {
    const everything = {
      ...DEFAULT_RING_FILTER,
      sections: CATEGORIES.map((c) => c.name),
    };
    const selected = applyFilter(everything, REPOSITORIES);
    expect(selected).toHaveLength(REPOSITORIES.length);
  });
});

describe("ring-filter serialization", () => {
  it("round trips through serialize → deserialize", () => {
    const f = toggleSection(DEFAULT_RING_FILTER, "Validator Tooling");
    const payload = serializeFilter(f);
    expect(typeof payload).toBe("string");
    expect(deserializeFilter(payload)).toEqual(f);
  });

  it("returns null on malformed JSON", () => {
    expect(deserializeFilter("{not json")).toBeNull();
  });

  it("returns null when version field is missing", () => {
    const payload = JSON.stringify({
      sections: ["Ethereum Core"],
      excludedRepos: [],
      includedExtras: [],
    });
    expect(deserializeFilter(payload)).toBeNull();
  });

  it("returns null when version does not match", () => {
    const payload = JSON.stringify({
      version: 99,
      sections: ["Ethereum Core"],
      excludedRepos: [],
      includedExtras: [],
    });
    expect(deserializeFilter(payload)).toBeNull();
  });

  it("returns null when sections has non-string entries", () => {
    const payload = JSON.stringify({
      version: 1,
      sections: ["Ethereum Core", 42],
      excludedRepos: [],
      includedExtras: [],
    });
    expect(deserializeFilter(payload)).toBeNull();
  });

  it("returns null when sections contains an unknown category", () => {
    const payload = JSON.stringify({
      version: 1,
      sections: ["Definitely Not A Category"],
      excludedRepos: [],
      includedExtras: [],
    });
    expect(deserializeFilter(payload)).toBeNull();
  });

  it("returns null when excludedRepos has non-string entries", () => {
    const payload = JSON.stringify({
      version: 1,
      sections: ["Ethereum Core"],
      excludedRepos: [42],
      includedExtras: [],
    });
    expect(deserializeFilter(payload)).toBeNull();
  });

  it("drops unknown repo keys silently (forward compat on repo removal)", () => {
    const payload = JSON.stringify({
      version: 1,
      sections: ["Ethereum Core"],
      excludedRepos: ["ethereum/removed-repo"],
      includedExtras: ["foo/bar"],
    });
    const parsed = deserializeFilter(payload);
    expect(parsed).not.toBeNull();
    expect(parsed!.excludedRepos).toEqual([]);
    expect(parsed!.includedExtras).toEqual([]);
  });
});
