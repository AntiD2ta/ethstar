import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { CATEGORIES, REPOSITORIES } from "./repos";
import type { RepoCategory } from "./types";

describe("REPOSITORIES", () => {
  it("has at least one repo", () => {
    expect(REPOSITORIES.length).toBeGreaterThan(0);
  });

  it("every url matches https://github.com/{owner}/{name}", () => {
    for (const repo of REPOSITORIES) {
      expect(repo.url).toBe(
        `https://github.com/${repo.owner}/${repo.name}`,
      );
    }
  });

  it("every category is a valid RepoCategory", () => {
    const valid = new Set<RepoCategory>(CATEGORIES.map((c) => c.name));
    for (const repo of REPOSITORIES) {
      expect(valid.has(repo.category)).toBe(true);
    }
  });

  it("every category has at least one repo", () => {
    for (const category of CATEGORIES) {
      const count = REPOSITORIES.filter(
        (r) => r.category === category.name,
      ).length;
      expect(count, `category "${category.name}" has no repos`).toBeGreaterThan(0);
    }
  });

  it("every repo has non-empty owner, name, description", () => {
    for (const repo of REPOSITORIES) {
      expect(repo.owner.length).toBeGreaterThan(0);
      expect(repo.name.length).toBeGreaterThan(0);
      expect(repo.description.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate repos", () => {
    const keys = REPOSITORIES.map((r) => `${r.owner}/${r.name}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("REPO_COUNT in api/og matches REPOSITORIES.length", () => {
    const ogSource = readFileSync("../api/og/index.tsx", "utf-8");
    const match = ogSource.match(/REPO_COUNT\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(REPOSITORIES.length);
  });
});

describe("CATEGORIES", () => {
  it("has four categories", () => {
    expect(CATEGORIES).toHaveLength(4);
  });

  it("every category has a name and icon", () => {
    for (const cat of CATEGORIES) {
      expect(cat.name.length).toBeGreaterThan(0);
      expect(cat.icon.length).toBeGreaterThan(0);
    }
  });
});
