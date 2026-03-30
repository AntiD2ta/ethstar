# React + Go Template

A production-ready monorepo template for building web applications with a Go backend and React frontend, shipped as a single binary.

## What's Included

**Backend (Go 1.25)**
- `net/http` server with graceful shutdown
- HTTP middleware stack (recovery, logging, CORS, content-type)
- Localhost-only binding by default
- SPA-aware static file handler with `embed.FS`

**Frontend (React 19 + TypeScript)**
- Vite 7 with HMR and API proxy
- Tailwind CSS v4 with warm stone/amber design system (OKLCH)
- 25 pre-installed shadcn/ui components
- Inter + JetBrains Mono typography
- Dark mode support via `next-themes`
- Playwright E2E testing

**Tooling**
- Single `Makefile` with 20+ targets
- golangci-lint, gosec, ESLint, TypeScript strict mode
- `make gate` — full pre-merge quality gate
- gosilent support for compact test output
- Scaffold directories for domain models, stores, WebSocket, integration tests, and type generation

## Quick Start

```bash
# Install dependencies
make install

# Start development (two terminals)
make dev-go          # Go API on :8080
make dev-frontend    # Vite on :5173 (proxies /api -> :8080)

# Open http://localhost:5173
```

## Build & Run

```bash
make build    # Build frontend + Go binary
make run      # Build and run as single binary
```

The production binary embeds the frontend — no separate web server needed.

## Quality Gates

```bash
make check    # lint + typecheck + security (pre-commit)
make gate     # check + race detector + build (pre-merge)
make test     # Go + integration + E2E tests
```

## Project Structure

```
├── cmd/server/          Go entry point
├── internal/
│   ├── api/             HTTP handlers
│   ├── middleware/       Recovery, Logging, CORS, JSONContentType
│   ├── domain/          Data models (scaffold)
│   ├── store/           Data access layer (scaffold)
│   ├── ws/              WebSocket hub (scaffold)
│   └── integration/     Integration tests (scaffold)
├── web/                 Embedded frontend (SPA handler)
├── frontend/
│   ├── src/
│   │   ├── components/  Layout + shadcn/ui
│   │   ├── pages/       One file per route
│   │   ├── hooks/       Custom React hooks
│   │   └── shared/      Generated types from Go (scaffold)
│   └── e2e/             Playwright tests
├── DNA.md               Architecture & conventions
├── GUIDELINES.md        Educational reference for developers
└── CLAUDE.md            AI assistant context & learnings
```

Directories marked *(scaffold)* contain `.gitkeep` placeholders — add code as your project needs it.

## Documentation

| Document | Purpose |
|----------|---------|
| [SETUP.md](SETUP.md) | Local development setup: GitHub App creation + `.env` configuration |
| [DNA.md](DNA.md) | Architecture, conventions, development workflow, quality gates |
| [GUIDELINES.md](GUIDELINES.md) | Educational reference for frontend development patterns |
| [CLAUDE.md](CLAUDE.md) | AI assistant instructions, 47 learnings & pitfalls |
| [prompt_build.md](prompt_build.md) | Build prompt for Claude Code sessions |
| [docs/design-guidelines.md](docs/design-guidelines.md) | Practical design rules (spacing, typography, color) |
| [docs/exercises.md](docs/exercises.md) | 8 progressive React exercises |
| [docs/prompt-templates.md](docs/prompt-templates.md) | Reusable prompt templates for building features |

## Adding Components

```bash
make add-component NAME=dialog    # Add any shadcn/ui component
```

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
