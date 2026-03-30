# React + Go Application DNA

> The architectural blueprint for our React + Go applications.
> This document describes the repeatable patterns, conventions, and tooling shared across projects.

---

## Table of Contents

1. [Stack Overview](#stack-overview)
2. [Project Structure](#project-structure)
3. [Development Workflow](#development-workflow)
4. [Code Generation](#code-generation)
5. [Quality Gates](#quality-gates)

---

## Stack Overview

```
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND (frontend/)                                        │
│  ┌──────────────────────────────────────┐                    │
│  │  shadcn/ui  (pre-built components)   │                    │
│  ├──────────────────────────────────────┤                    │
│  │  Tailwind CSS v4  (styling system)   │                    │
│  ├──────────────────────────────────────┤                    │
│  │  React 19  (UI rendering library)    │                    │
│  ├──────────────────────────────────────┤                    │
│  │  React Router 7  (client routing)    │                    │
│  ├──────────────────────────────────────┤                    │
│  │  Vite  (build tool + dev server)     │                    │
│  ├──────────────────────────────────────┤                    │
│  │  Playwright  (E2E testing)           │                    │
│  └──────────────────────────────────────┘                    │
├──────────────────────────────────────────────────────────────┤
│  GO BACKEND (cmd/, internal/, web/)                          │
│  ┌──────────────────────────────────────┐                    │
│  │  net/http  (HTTP server + REST API)  │                    │
│  ├──────────────────────────────────────┤                    │
│  │  embed.FS  (embedded static files)   │                    │
│  └──────────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────────┘
```

> Add SQLite, WebSocket, TanStack Query as your project needs them.

**Architecture**: Go backend serves the REST API (`/api/*`) and the embedded frontend (`/*`).
Vite builds the frontend into `web/static/`, Go embeds it with `//go:embed`, and the final artifact is a **single binary** with zero external runtime dependencies.

---

## Project Structure

```
project-root/
├── cmd/
│   ├── server/                   ← Main entry point (wires deps, starts HTTP)
│   ├── typegen/                  ← TypeScript type generator (configure when models added)
│   └── e2eserver/                ← E2E test server (configure when needed)
├── internal/
│   ├── api/                      ← HTTP handlers (REST endpoints)
│   ├── domain/                   ← Data models, enums, interfaces
│   ├── store/                    ← Data access layer
│   ├── middleware/               ← HTTP middleware (logging, CORS, recovery)
│   ├── ws/                       ← WebSocket hub (configure when needed)
│   └── integration/              ← Integration tests (real DB, mock externals)
├── web/
│   ├── static/                   ← Vite build output (go:embed target)
│   ├── embed.go                  ← //go:embed static/*
│   └── handler.go                ← SPA-aware static file handler
├── frontend/
│   ├── e2e/                      ← Playwright E2E tests
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/           ← Layout components
│   │   │   └── ui/               ← shadcn/ui components (DO NOT edit)
│   │   ├── hooks/                ← Custom React hooks
│   │   ├── lib/                  ← Utilities (API clients, helpers)
│   │   ├── pages/                ← Page components (one per route)
│   │   ├── shared/               ← Generated types + JSON schemas (from Go)
│   │   ├── App.tsx               ← Route definitions
│   │   ├── main.tsx              ← Entry point (providers, router)
│   │   └── index.css             ← Tailwind + shadcn/ui theme variables
│   ├── package.json
│   ├── vite.config.ts            ← Build config (outputs to ../web/static)
│   └── playwright.config.ts
├── go.mod
├── Makefile                      ← Orchestrates Go + frontend
├── DNA.md                        ← This file
└── GUIDELINES.md                 ← Educational reference for developers
```

### Go Conventions

- `cmd/` — Binary entry points. Each subdirectory is a separate `main` package.
- `internal/` — Private packages. All business logic lives here.
- `web/` — Serves the embedded frontend. Exports an `http.Handler`.
- Domain models live in `internal/domain/` — the source of truth for data shapes.
- Stores live in `internal/store/` — one file per entity, pure SQL, no ORM.

### Frontend Conventions

- Pages go in `frontend/src/pages/` — one file per route.
- Reusable components go in `frontend/src/components/` (NOT in `ui/` — that's shadcn's territory).
- Custom hooks go in `frontend/src/hooks/` — named `use-*.ts` (or `.tsx` if they return JSX).
- Utilities go in `frontend/src/lib/` — pure functions, API clients, types.
- Generated types live in `frontend/src/shared/` — never edit manually.
- Use `@/` import alias everywhere: `import { Button } from "@/components/ui/button"`.

---

## Development Workflow

### Quick Commands

```bash
make help           # Show all available commands
make install        # Install Go + npm deps + Playwright browsers
make dev            # Instructions for running both dev servers
make dev-go         # Start Go API server on :8080
make dev-frontend   # Start Vite dev server on :5173 (proxies /api → :8080)
make build          # Build frontend + Go binary → bin/server
make run            # Build and run the production binary
make test           # Run all tests (Go + integration + E2E)
make check          # Run all quality gates (lint + typecheck + security)
```

### Daily Development

Two terminals:

```
Terminal 1:  make dev-go        → Go API on :8080
Terminal 2:  make dev-frontend  → Vite on :5173, proxies /api/* to Go
```

Visit **http://localhost:5173**. Vite provides instant HMR for frontend changes. Go server restarts manually (or use a file watcher).

### Production

The build pipeline produces a single self-contained binary:

1. `make build` runs the frontend build (`npm run build` in `frontend/`), outputting to `web/static/`.
2. Go's `//go:embed static/*` in `web/embed.go` bundles the frontend assets into the binary.
3. `go build -o bin/server ./cmd/server` compiles everything into one executable.

```bash
make build      # Frontend builds into web/static/, Go embeds it
./bin/server    # Single binary — no Node.js, no npm, no external files
```

---

## Code Generation

TypeScript types are **generated from Go structs**, not written manually. This ensures type safety across the full stack.

> Configure `tygo.yaml` and `cmd/typegen` when domain models are added.

### How It Works

1. Domain models are defined as Go structs in `internal/domain/`.
2. `cmd/typegen` uses [tygo](https://github.com/gzuidhof/tygo) to generate TypeScript interfaces.
3. Post-processing converts iota enums to TypeScript string literal unions.
4. Output goes to `frontend/src/shared/types.ts`.

```bash
make typegen    # Regenerate after changing Go structs
```

### Rules

- **Never manually edit** `frontend/src/shared/types.ts` or files in `shared/`.
- After changing a Go struct, run `make typegen` — the frontend types update immediately.
- The CI gate should verify generated types are up to date.

---

## Quality Gates

All gates must pass before merging. Run `make check` for static analysis, `make gate` for full validation.

| Gate | Command | What It Checks |
|------|---------|----------------|
| **Go lint** | `make lint-go` | golangci-lint (vet, staticcheck, errcheck, gosimple, etc.) |
| **Go tests** | `make test-go` | All Go unit tests |
| **Go race** | `make test-go-race` | Tests with `-race` detector |
| **Go security** | `make security` | gosec OWASP-style vulnerability scan |
| **Integration** | `make test-integration` | API tests with real DB, mock externals |
| **Frontend lint** | `make lint-frontend` | ESLint on all frontend code |
| **TypeScript** | `make typecheck` | `tsc --noEmit` — no type errors |
| **E2E tests** | `make test-e2e` | Playwright browser tests |
| **Build** | `make build` | Frontend builds + Go binary compiles |

**Quick check** (pre-commit): `make check` = lint + typecheck + security.
**Full gate** (pre-merge): `make gate` = checks + race detector + build.
