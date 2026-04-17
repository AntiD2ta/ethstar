# CLAUDE.md

Guidance for Claude Code working in this repo.

## Architecture

Go + React monorepo producing a single binary. The Go backend serves both the API (`/api/*`) and the embedded frontend (`/*`).

- **`cmd/server/`** — Entry point. Wires `internal/api.Handler()` and `web.Handler()` onto `http.ServeMux`.
- **`internal/api/`** — API HTTP handlers.
- **`web/`** — Embeds the frontend build via `//go:embed static/*`; SPA fallback returns `index.html` for unknown paths.
- **`internal/domain/`**, **`internal/store/`**, **`internal/middleware/`**, **`internal/ws/`** — Data models, data access, HTTP middleware, WebSocket hub.
- **`internal/integration/`** — Integration tests (real DB, mock externals).
- **`pkg/auth/`** — Shared OAuth logic. Lives in `pkg/` (not `internal/`) so Vercel serverless `api/` functions can import it.
- **`api/`** — Vercel-only Go serverless functions. One directory per endpoint, each its own `package` exporting `Handler()`.
- **`frontend/`** — Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui. Builds into `../web/static/`.
- **`frontend/src/shared/`** — Generated TypeScript types from Go structs (never edit manually; run `make typegen`).

### Data flow

```
Browser → Go http.Server (:8080)
            ├── /api/*  → internal/api.Handler()
            └── /*      → web.Handler() → embedded static files (SPA fallback)
```

Dev: Vite (:5173) proxies `/api/*` to Go (:8080). Prod: single binary.

### Frontend

- Routes in `frontend/src/App.tsx` (React Router 7). Providers in `frontend/src/main.tsx`. Pages in `frontend/src/pages/`.
- `@/` → `frontend/src/`.
- shadcn components in `src/components/ui/` — do not edit; add via `make add-component NAME=<name>`.
- Tailwind v4 theme vars in `src/index.css`. Toasts via Sonner: `import { toast } from "sonner"`.

## Commands

All operations use `make`. Run `make help` for the full list.

```bash
make install            # deps + Playwright browsers
make dev-go             # Go API on :8080
make dev-frontend       # Vite on :5173 (proxies /api → :8080)
make build              # frontend → web/static/, then Go binary → bin/server
make test               # Go + Playwright E2E
make check              # lint + typecheck + gosec (pre-commit)
make gate               # check + race + build (pre-merge)
make typegen            # TypeScript types from Go structs
make kill-server        # free :8080
```

Single Playwright file: `cd frontend && npx playwright test e2e/home.spec.ts` (CWD must be `frontend/`).

## Architectural invariants

These rules shape the codebase in ways not obvious from any single file.

- **Vercel serverless functions can't import `internal/` packages.** Vercel builds each `api/` function as an isolated Go binary with a generated `main` outside the module tree; Go's `internal` visibility rule blocks it. Shared code used by both `cmd/server/` and `api/` must live in `pkg/`.
- **Vercel serverless functions can't use constructor injection.** No persistent startup. Use a package-level `var` that tests reassign with `defer` restore. Startup-validated config from `main()` does not apply here — serverless handlers must re-validate per request (or read from package-level init).
- **GitHub starring requires a classic OAuth App, not the GitHub App.** GitHub App tokens return "Resource not accessible by integration" on `PUT /user/starred/*` despite the docs. Use the classic OAuth popup flow with `scope=public_repo`. Classic tokens don't expire — the callback normalizes to 10-year TTL.
- **Repo list changes touch many assets.** Editing `frontend/src/lib/repos.ts` requires parallel updates listed in `MAINTAINERS.md` (api/og REPO_COUNT, index.html meta, sitemap, README tables, og-image.png regeneration). A Vitest test enforces `REPO_COUNT === REPOSITORIES.length` but cannot catch the other assets.

## Key rules (non-obvious, not tool-enforced)

### Backend
- **Validate every `ALLOWED_HOSTS`-style comma-separated env var with `strings.TrimSpace`.** `strings.Split("a, b", ",")` yields `[" b"]`.
- **Wrap external HTTP response bodies with `io.LimitReader(resp.Body, 1<<20)` before JSON-decoding.** Prevents OOM from malicious responses.
- **Drain response bodies before `Close()`**: `_, _ = io.Copy(io.Discard, resp.Body)` enables HTTP/1.1 connection reuse.
- **GitHub OAuth returns HTTP 200 even for errors** (with `error` + `error_description` in JSON). Decode into a struct that captures both token and error fields in one pass.
- **GitHub 403 is not always rate-limit.** Read the body: "rate limit"/"abuse detection" → retry; "Resource not accessible"/"Forbidden" → propagate. Use the existing `classify403()` helper in `frontend/src/lib/github.ts`.

### Frontend
- **localStorage cache keys use `ethstar_` prefix with underscores** (e.g., `ethstar_repo_meta`). Consistent naming makes `grep ethstar_` the source of truth.
- **Validate `JSON.parse` output with `typeof` checks on each field; return `null` on shape mismatch.** `as T` is a compiler fiction. Versioned shapes (e.g., consent) return `null` on version drift to force re-prompt.
- **Validate any user-provided string before interpolating into a GraphQL query.** Use `VALID_GH_NAME = /^[a-zA-Z0-9._-]+$/` for repo names/owners.
- **StrictMode + one-shot URL data (hash fragments, OAuth callback params): persist to localStorage before any async work.** Otherwise the first mount clears the URL, StrictMode cancels, and the second mount finds nothing.
- **StrictMode + fetch-once guards: use a `cancelled` closure variable, not a `useRef` flag.** A ref guard either duplicates work or prevents all fetches depending on cleanup.
- **Controlled dialogs for mutation-backed forms.** Close in the mutation's `onSuccess`, not on click — prevents closing mid-submit.
- **Always give `<img>` explicit `width`/`height` attributes** to prevent CLS. Use sized asset variants (`logo-128.png`, `logo-512.png`) instead of scaling a large master.
- **Gate `@vercel/analytics` + `@vercel/speed-insights` on `consent.statistics === true` via `React.lazy`.** GDPR/PECR requirement. Merely not rendering isn't enough — wrap in `lazy()` so the module isn't shipped until consent.

## Security (agents must verify before writing server code)

- **Bind to `127.0.0.1:8080`, never `:8080`** (the latter binds all interfaces).
- **CORS must never be `*`.** Restrict to specific origins.
- **Wrap `r.Body` with `http.MaxBytesReader(nil, r.Body, 1<<20)` before decoding JSON.**
- **WebSocket origin validation uses `OriginPatterns`, never `InsecureSkipVerify: true`.**
- **Any middleware wrapping `http.ResponseWriter` must also implement `http.Hijacker`** (required for WebSocket upgrades). Delegate via a `Hijack()` method.
- **`JSONContentType` middleware must skip `/api/ws*`** with `!strings.HasPrefix(r.URL.Path, "/api/ws")`.
- **Cookie `Secure` flag must be per-environment.** Browsers reject `Secure` cookies over `http://localhost`. Drive from `ETHSTAR_COOKIE_SECURE=1`. Always keep `HttpOnly` + `SameSite`.

## Browser validation (frontend changes)

You have Chrome browser automation via `mcp__claude-in-chrome__*`. **Do not skip browser validation for frontend changes.**

1. Start dev servers (`make dev-go &` and `cd frontend && npm run dev &`; `make kill-server` first if `:8080` is busy).
2. Navigate to `http://localhost:5173` and walk through the acceptance criteria. Take screenshots at key steps. Verify visual correctness (no overflow, layout breakage, dead links, blank pages) and interactive behavior (clicks, forms, dialogs, scroll).
3. Write a Playwright regression in `frontend/e2e/` for every bug fix or behavioral change. Use `page.route()` to mock API responses when testing UI independently. Run `make test-e2e` to verify all E2E tests pass.
4. If you discover additional bugs during validation, fix them and add regression tests before moving on.

Chrome MCP caveats and fallbacks live in `docs/learnings/browser-automation.md`.

## API validation (backend/contract changes)

When a task changes API surface (new endpoint, modified request/response shape, new filter):

1. Run integration tests: `gosilent test -tags=integration ./internal/integration/...`. These use `httptest.NewServer` with in-memory SQLite and a mock external client — real HTTP through the full middleware stack.
2. Add integration tests for new endpoints in `internal/integration/`.
3. For contract changes (new fields, changed status codes, error shape), update integration tests + E2E tests that depend on the shape, then run `make test`.

## Test runner: `gosilent`

Use `gosilent` instead of `go test` for all Go test runs. It wraps `go test -json`, collapses passing packages to one summary line, and expands only failures — ~358x less output for clean context.

```bash
gosilent test ./...                      # instead of: go test ./...
gosilent test -race -count=1 ./...
gosilent test --detail ./...             # expand all
gosilent test --verbose ./...            # raw
```

The Makefile `test-go` target already uses `gosilent`. Fall back to `go test` only if `gosilent` is missing.

## Quality gates

All gates must pass before merging. `make check` runs static checks; `make gate` adds race + build.

| Gate              | Command                 | Checks                                         |
| ----------------- | ----------------------- | ---------------------------------------------- |
| Go lint           | `make lint-go`          | golangci-lint (vet, staticcheck, errcheck, …)  |
| Go tests          | `make test-go`          | unit tests via gosilent                        |
| Go race           | `make test-go-race`     | race detector                                  |
| Go security       | `make security`         | gosec OWASP scan                               |
| Integration       | `make test-integration` | API integration tests with real DB             |
| Frontend lint     | `make lint-frontend`    | ESLint                                         |
| TypeScript        | `make typecheck`        | `tsc --noEmit`                                 |
| E2E               | `make test-e2e`         | Playwright                                     |
| Build             | `make build`            | frontend build + Go binary compile             |

Pre-commit: `make check` (lint + typecheck + security). Pre-merge: `make gate` (check + race + build).

## Topic learnings (read when relevant)

Narrower rules and incident post-mortems are organized by topic. Skim the index first and load only what applies.

- `docs/learnings/README.md` — index of topic files
- `docs/learnings/gosec.md` — `#nosec` annotation catalog (G101, G117, G124, G704, G706)
- `docs/learnings/oauth.md` — GitHub OAuth flows, popup postMessage, cookie handling
- `docs/learnings/vercel-kv.md` — REST API mapping, pipeline writes, PathEscape
- `docs/learnings/frontend-testing.md` — Vitest + Playwright patterns, mocking, setup quirks
- `docs/learnings/frontend-performance.md` — React memoization, CSS/compositor, rAF, animations
- `docs/learnings/css-tailwind.md` — Tailwind v4 gotchas, animations, specificity, 3D transforms
- `docs/learnings/a11y.md` — aria-live, inert, heading order, Radix Dialog side effects
- `docs/learnings/saturn-carousel.md` — ring distribution, tilt axis, mobile sizing
- `docs/learnings/browser-automation.md` — Chrome MCP pitfalls, Playwright fallbacks
- `docs/learnings/consent-analytics.md` — GDPR consent shape, Vercel Analytics gating
- `docs/tooling-candidates.md` — rules that could be mechanically enforced (instead of being documented)
