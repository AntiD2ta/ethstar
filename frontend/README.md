# Ethstar Frontend

React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev           # Vite dev server on :5173 (proxies /api -> Go :8080)
```

Run the Go backend in a separate terminal (`make dev-go` from the repo root) so API calls work.

## Build

```bash
npm run build         # Outputs to ../web/static/ (embedded by Go)
```

## Quality

```bash
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npx vitest run        # Unit tests
npx playwright test   # E2E tests (headless)
```

## Project Structure

```
src/
  components/
    layout/           Layout shells (RootLayout)
    ui/               shadcn/ui components (do not edit)
    saturn-carousel/  3D Saturn ring + mobile fallback
    ...               Feature components
  hooks/              Custom React hooks
  lib/                Utilities, API clients, repo list
  pages/              One file per route
  shared/             Generated TypeScript types from Go (do not edit)
  test/               Test helpers and setup
e2e/                  Playwright E2E tests
public/               Static assets (logo, favicon, sitemap)
scripts/              Logo capture and OG image generation tools
```

## Adding shadcn/ui Components

From the repo root:

```bash
make add-component NAME=accordion
```
