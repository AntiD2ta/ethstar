## What does this PR do?

<!-- Brief description of the change. -->

---

## Checklist for Repo List Changes

If you're adding or removing repositories, complete this checklist (see [MAINTAINERS.md](../MAINTAINERS.md#repo-list-changes) for details):

- [ ] **Category is correct** — see [category descriptions](../MAINTAINERS.md#categories) to pick the right one
- [ ] **Repository exists** on GitHub and is actively maintained
- [ ] **`frontend/src/lib/repos.ts`** — added/removed entry in `REPOSITORIES` array
- [ ] **`api/og/index.tsx`** — updated `REPO_COUNT` to match `REPOSITORIES.length`
- [ ] **`frontend/index.html`** — meta description and JSON-LD repo count are accurate
- [ ] **`frontend/public/sitemap.xml`** — bumped `<lastmod>` to today's date
- [ ] **`README.md`** — updated the repo list tables
- [ ] **Tests pass** — `cd frontend && npx vitest run src/lib/repos.test.ts` (validates OG count sync)

## General Checklist

- [ ] `make check` passes (lint + typecheck + security)
- [ ] `make build` succeeds
