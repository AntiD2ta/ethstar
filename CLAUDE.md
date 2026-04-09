# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture

Go + React monorepo producing a single binary. The Go backend serves both the API (`/api/*`) and the embedded frontend (`/*`).

- **`cmd/server/`** — Entry point. Wires `internal/api.Handler()` and `web.Handler()` onto `http.ServeMux`.
- **`internal/api/`** — API HTTP handlers. Each handler function registered on a sub-mux returned by `api.Handler()`.
- **`web/`** — Embeds the frontend build output via `//go:embed static/*` and serves it with SPA fallback (unmatched paths return `index.html`).
- **`internal/domain/`** — Data models and interfaces (scaffold, add as needed).
- **`internal/store/`** — Data access layer (scaffold, add as needed).
- **`internal/middleware/`** — HTTP middleware (recovery, logging, CORS, content-type).
- **`internal/ws/`** — WebSocket hub (scaffold, add as needed).
- **`internal/integration/`** — Integration tests with real DB and mock externals.
- **`frontend/`** — Vite + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui. Builds into `../web/static/` so Go can embed it.
- **`frontend/src/shared/`** — Generated TypeScript types from Go structs (never edit manually).

### Data Flow

```
Browser → Go http.Server (:8080)
            ├── /api/*  → internal/api.Handler()
            └── /*      → web.Handler() → embedded static files (SPA fallback)
```

In development, Vite (:5173) proxies `/api/*` to Go (:8080). In production, it's a single binary.

### Frontend Architecture

- Routes defined in `frontend/src/App.tsx` using React Router 7
- Providers (BrowserRouter, TooltipProvider, Toaster) wrapped in `frontend/src/main.tsx`
- Layouts in `frontend/src/components/layout/` — `RootLayout` uses `<Outlet />` for nested routes
- Pages in `frontend/src/pages/` — one file per route
- `@/` import alias maps to `frontend/src/`
- shadcn/ui components in `frontend/src/components/ui/` — do not edit these directly; add new ones with `make add-component NAME=<name>`
- Styling via Tailwind CSS v4 with theme variables in `frontend/src/index.css`
- Toasts via Sonner: `import { toast } from "sonner"`

## Commands

All operations use `make`. Run `make help` for the full list.

```bash
# Setup
make install            # Go deps + npm install + Playwright browsers

# Development (two terminals)
make dev-go             # Go API server on :8080
make dev-frontend       # Vite dev server on :5173 (proxies /api → :8080)

# Build & Run
make build              # Build frontend → web/static/, then Go binary → bin/server
make run                # Build + run production binary

# Testing
make test               # All tests (Go + Playwright E2E)
make test-go            # Go tests only
make test-e2e           # Playwright E2E headless
cd frontend && npx playwright test e2e/home.spec.ts  # Single test file

# Quality Gates
make check              # lint + typecheck + gosec (run before committing)
make security           # gosec only
make gofix              # go fix to modernize code
make kill-server        # Kill any process on :8080
make test-go-race       # Go tests with -race detector
make test-integration   # API integration tests (real DB, mock externals)
make typegen            # Generate TypeScript types from Go structs
make gate               # Full pre-merge gate (check + race + build)

# shadcn/ui
make add-component NAME=accordion  # Add a component
```

## Important Patterns

### Go targets must exclude `frontend/`

`frontend/node_modules/` contains a Go file (`flatted` package). All Go tool invocations filter it:

```makefile
go test $$(go list ./... | grep -v frontend)
gosec -exclude-dir=frontend ./...
```

### Frontend build output goes to `web/static/`

Configured in `frontend/vite.config.ts` (`outDir: "../web/static"`). The `web/embed.go` directive `//go:embed static/*` picks it up. A `web/static/.gitkeep` placeholder ensures the Go build works before the frontend is built.

### SPA routing in Go

`web/handler.go` uses `fs.Stat` to check if a requested path exists as a static file. If not, it serves `index.html` so React Router handles client-side routing.

### ESLint ignores

- `.agents/` (third-party skills), `.claude/` (installed skills), and `src/components/ui/` (`react-refresh/only-export-components` disabled for shadcn) are configured in `frontend/eslint.config.js`.

## Learnings & Pitfalls

> Accumulated knowledge from implementation sessions. Read before starting work to avoid repeating mistakes.

### Go / Backend

- **gosec G706 (log injection)**: Fires on `slog.Info/Error` calls with HTTP request data. Use `#nosec G706` for structured logging — slog uses key-value pairs, not string interpolation.
- **Always run `go mod tidy` after adding imports**: After adding any new Go import, always run `go mod tidy` and verify with `go build ./cmd/...`.
- **Vercel Go serverless: directory-per-endpoint**: Multiple serverless functions in the same directory can't each export `Handler()` (Go package rule). Use one directory per endpoint: `api/auth/github/index.go`, `api/auth/callback/index.go`, etc. Each directory is its own package.
- **Makefile must exclude `api/` from Go commands**: The `api/` directory contains Vercel-only serverless functions. Add `grep -v '/api/'` alongside the existing `grep -v frontend` in `go list` pipelines. Also add `-exclude-dir=api` to `gosec`.
- **gosec G704 (SSRF)**: `#nosec G704` must be on the `http.DefaultClient.Do(req)` line, not the function signature. gosec only reads annotations on the flagged line.
- **gosec G101/G117 false positives**: `G101` fires on URL constants containing "Token" (e.g., GitHub OAuth endpoint). `G117` fires on struct fields with `json:"access_token"` or `json:"refresh_token"`. Use `#nosec G101` / `#nosec G117` with a comment explaining why.
- **GitHub OAuth 200-for-errors**: GitHub returns HTTP 200 even for OAuth errors, with `error` and `error_description` in JSON body. Decode into a combined struct that captures both token and error fields in one pass.
- **Vercel KV REST API**: Maps Redis commands to URL paths: `GET /get/{key}`, `GET /exists/{key}`, `GET /incrby/{key}/{amount}`. Single commands via `POST /` with `["SET", key, value, "EX", ttl]`. Returns JSON with `result` field (string, int, or null). No Redis client library needed.
- **Vercel KV `url.PathEscape` on keys**: Always wrap KV keys with `url.PathEscape` when interpolating into URL paths. Keys like `tok:hash` contain colons (safe) but future keys could contain `/`, `?`, or `#` that corrupt the URL. Defense-in-depth for general helpers.
- **Parallel KV operations in serverless (reads)**: Use `sync.WaitGroup` for concurrent KV reads to halve latency. Each goroutine writes to its own variable pair — no shared mutable state needed.
- **Vercel KV pipeline for atomic multi-key writes**: `POST /pipeline` accepts `[["INCRBY","key1",5],["INCRBY","key2",1]]` — one round-trip, atomic. Prefer over parallel goroutines for writes. Response is a JSON array of per-command results.
- **Vercel serverless functions can't use constructor injection**: Use a package-level `var` that tests reassign with `defer` restore.
- **Startup-validated config doesn't need per-request re-validation**: Handler closures capture validated values from `main()`. Only re-validate in serverless functions (no persistent startup).
- **HTTP response body draining for connection reuse**: Add `_, _ = io.Copy(io.Discard, resp.Body)` before close to enable HTTP/1.1 connection reuse.
- **`io.LimitReader` on external API responses**: Wrap response bodies from external APIs with `io.LimitReader(resp.Body, 1<<20)` before JSON decoding to prevent OOM from malicious/large responses.
- **OAuth state cookie `Secure` flag must be per-env**: `Secure: true` is rejected on `http://localhost`. Pass `secure bool` to cookie functions — driven by `ETHSTAR_COOKIE_SECURE=1` env flag.

### Type Generation

- **tygo type_mappings don't affect type definitions**: `type_mappings` in tygo.yaml only affect how types are rendered when used as struct fields, NOT the `type X = ...` definitions themselves. iota enums still generate as `number`. Solution: post-process the output with regex in `cmd/typegen`.
- **Enum count auto-detection**: Instead of hardcoding enum value counts (fragile), iterate until the `String()` method returns "unknown" for two consecutive values.

### Frontend / TypeScript

- **TypeScript `erasableSyntaxOnly`**: This project's tsconfig enables it, so parameter properties (`public x: number` in constructor) are not allowed.
- **eslint `.claude/` directory**: Must be added to `globalIgnores` in `eslint.config.js` — skills installed there contain TS files that trigger lint errors.
- **Controlled dialogs for mutation-backed forms**: When a dialog triggers an async mutation, use controlled `open`/`onOpenChange` props so the parent closes the dialog only in the mutation's `onSuccess`.
- **React.ReactNode requires explicit import**: Under the new JSX transform, `React` is not auto-imported. Use `import type { ReactNode } from "react"`.
- **CSS specificity: data-attribute selectors override plain class selectors**: `data-[orientation=horizontal]:w-full` has higher specificity than plain `w-auto`. `tailwind-merge` doesn't treat them as conflicting since they have different variants.

### Frontend Testing (Vitest)

- **Mocking philosophy**: No MSW. Use `vi.spyOn(globalThis, "fetch")` at HTTP boundary; above that, `vi.mock("@/lib/github")` with `importOriginal` to re-export real error classes so `instanceof` works.
- **Test file naming**: `*.test.ts` for pure unit, `*.integration.test.tsx` for hook+context integration. Co-located next to source (mirrors Go's `foo_test.go`). Vitest `include` glob is `src/**/*.{test,integration.test}.{ts,tsx}`.
- **Node 25's native `localStorage` shadows happy-dom**: Install a Map-backed polyfill in `src/test/setup.ts` via `Object.defineProperty(globalThis, "localStorage", {...})` since Node 25+ stub lacks `setItem`/`clear`.
- **Fake timers + fetch spy**: use `vi.advanceTimersByTimeAsync(ms)` (NOT sync `advanceTimersByTime`) so fetch-spy promises settle inside timer ticks. Also attach the `expect(...).rejects` assertion BEFORE calling `advanceTimersByTimeAsync` to avoid an unhandled-rejection blip.
- **`window.location.href` setter spying**: happy-dom's `Location` uses private class members and cannot be proxied. Patch just the `href` descriptor via `Object.defineProperty(window.location, "href", { set: spy, get: () => orig })` — do NOT replace the whole `window.location` object (breaks react-router's `BrowserRouter`).
- **`restoreMocks: true`** in vitest config auto-resets all spies between tests — don't manually reset unless you need finer control.
- **`starStatusesRef` is load-bearing**: The ref keeps `starAll` out of the `starStatuses` dependency chain. Removing it would recreate `starAll` on every status update.
- **Test files excluded from `tsconfig.app.json`**: `**/*.test.*` and `src/test/**` excluded from app config. Separate `tsconfig.test.json` adds `vitest/globals` + `@testing-library/jest-dom` types.
- **ESLint `react-refresh/only-export-components`**: Fires on `src/test/render.tsx`. Disable with `/* eslint-disable */` at top — it's a test helper, not a Fast Refresh file.
- **`React.memo` pre-duplicated marquee children**: `RepoMarquee` renders children twice (original + clone). Wrap `RepoCard` in `memo()` — props are reference-stable, so default shallow-compare prevents ~34 unnecessary re-renders per `starStatuses` tick.
- **Pre-compute static grouped constants at module scope**: If `useMemo` has `[]` deps and uses only module-level constants, move it to module scope instead.
- **Tailwind v4 `animate-*` utilities collide on `animation` shorthand**: Multiple animate utilities on one element only apply the last one. Compose into a single custom utility or use inline `style={{ animation: "a, b" }}` (also handle `prefers-reduced-motion`).
- **Tailwind `focus:` compound variants can no-op on programmatic `.focus()`**: For skip-to-content links, prefer a hand-written `.skip-link` CSS rule (off-screen, revealed on `:focus, :focus-visible`) instead of `sr-only focus:not-sr-only` utilities.
- **`perspective()` inside a `transform` keyframe forces main-thread work**: Put `perspective` on the parent wrapper, keep keyframe to `rotateY()` only. Pair with `will-change: filter, transform` on the animated child for GPU promotion.
- **Playwright clicks inside animated marquees need `force: true`**: Continuously-translating containers never satisfy Playwright's "element is stable" check.
- **`refreshInFlight` ref prevents concurrent token-refresh calls**: Store the in-flight refresh promise in a ref; concurrent 401 handlers return the same promise instead of issuing duplicate single-use refresh requests.
- **Reset `starStatuses` to "unknown" when `token` becomes `null`**: Add a `useEffect` on `token` that resets status map and aborts in-flight callbacks, otherwise cards stay stuck on "checking" after logout.
- **Playwright `page.goto` default `waitUntil: "load"` can miss loading states**: Use `waitUntil: "domcontentloaded"` and increase API mock delay to 2+ seconds to observe brief loading UIs.
- **localStorage shape validation after `JSON.parse`**: `as T` casts have no runtime guarantee. Always validate `typeof` on each field, returning `null` on shape mismatch.
- **Pending-stats accumulation pattern**: On failed POST, store delta in localStorage; piggyback onto next successful POST (read + clear pending key in same call).
- **Marquee responsive: conditional rendering via `useMediaQuery`**: Call `useMediaQuery` in the parent and pass `isDesktop` as prop to `RepoMarquee`. Eliminates ~68 hidden nodes on mobile. Never call hooks inside `memo()`-wrapped children — they still execute on every render tick.
- **ESLint `react-hooks/set-state-in-effect` and `useMediaQuery`**: Wrap state update in a handler function and invoke it immediately instead of calling `setMatches(mql.matches)` directly in the effect body.
- **`toBeCloseTo` precision in Playwright is too tight**: Use range assertions (`toBeGreaterThan`/`toBeLessThan`) with ±20px for WebGL canvases, ±10px for DOM elements.
- **CSS `preserve-3d` + counter-rotation for tilted rings**: Add `rotateX(-tilt)` to child chips to cancel parent's tilt. Chain: `rotateZ(theta) translateX(radius) rotateZ(-theta) rotateX(-tilt) scale(s)`.
- **`useMediaQuery` initial `false` breaks derived values**: Returns `false` on first render; `!false = true` can flip derived booleans. Effects re-run when the value corrects, but beware the initial flash.
- **React StrictMode + `useRef` as fetch-once guard is fragile**: StrictMode double-mounts effects. A ref guard either duplicates work (if cleanup resets it) or prevents all fetches (if cleanup doesn't). **Prefer the `cancelled` closure variable alone** — fresh per effect invocation, no ref needed.
- **StrictMode + one-shot URL data (hash fragments, query params)**: First mount clears URL data, StrictMode cancels its async work, second mount finds data gone. **Persist to localStorage before any async work** so the second mount recovers. Root cause of OAuth tokens being dropped after callback.
- **`Date.now()` in render body violates React purity**: `react-hooks/purity` lint rule flags `Date.now()` during render because it's impure (non-idempotent). Move time checks into `useEffect` bodies or utility functions called from effects.
- **Extract `BASE_HEADERS` for optional-auth GitHub API calls**: Module-level `BASE_HEADERS` with shared headers; `authHeaders(token)` spreads from it to avoid duplication.
- **localStorage cache key naming convention**: Use `ethstar_` prefix with underscores (e.g., `ethstar_repo_meta`, `ethstar_stats_cache`), not colons or hyphens. Consistent naming makes grepping for all storage keys reliable.
- **`vi.fn<FnType>()` single-generic for typed spies**: Vitest v4+ uses a single generic argument with the function type: `vi.fn<(arg: string) => Promise<T>>()`, NOT the old 2-arg form `vi.fn<[string], T>()`. The 2-arg form causes `TS2558: Expected 0-1 type arguments`.
- **`vi.mock` with `importOriginal` to preserve real error classes**: `vi.mock("@/lib/github", async (importOriginal) => { const actual = await importOriginal<...>(); return { ...actual, fetchFn: spy }; })` keeps `instanceof` checks working.
- **GraphQL query injection prevention**: Validate dynamic values against `VALID_GH_NAME = /^[a-zA-Z0-9._-]+$/` before string interpolation into queries.
- **`AbortController.abort(reason)` is fragile for discrimination**: Prefer a simple `let hitRateLimit = false` flag over `controller.abort("rate-limit")` + `controller.signal.reason` comparison. The flag is type-safe and typo-proof; abort reasons are untyped strings.
- **Share `loadCache()` between `useState` initializers**: Compute once via a single `useState` returning both values instead of calling the same expensive function in two initializers.
- **`combinedStars === null` as hasData proxy**: Reuse memoized `combinedStars` (null when empty) instead of `Object.keys(repoMeta).length > 0` on every render.
- **GitHub GraphQL API requires auth**: Unlike REST (`GET /repos/{owner}/{name}` works anonymously), `POST /graphql` always requires `Authorization: Bearer` header. Use GraphQL for authenticated users, REST fallback for anonymous.
- **GraphQL `stargazerCount` vs REST `stargazers_count`**: GitHub GraphQL uses camelCase (`stargazerCount`), REST uses snake_case (`stargazers_count`). Map at the boundary in `fetchAllRepoMetaGraphQL` to keep `RepoMeta` interface consistent.
- **Custom memo comparator to scope re-renders**: When parent state is shared across memoized children, use a custom `arePropsEqual` comparing only the relevant slice (e.g., statuses for this category only) to prevent cross-category re-renders.
- **`React.lazy` requires default export**: Add `export default ComponentName` at the bottom if only named exports exist — both coexist.
- **Hoist `supportsWebGL()` to module scope**: WebGL capability doesn't change between renders. Calling it inside a component body allocates a canvas and checks the GL context on every re-render. Evaluate once at module scope.
- **Static `filter` on CSS-animated element blocks compositor**: Move non-animated `filter: drop-shadow()` to a parent wrapper; keep only `will-change: transform` on the animated child for GPU promotion.
- **`transform-style: preserve-3d` has no effect with `clip-path` children**: `clip-path` forces a 2D stacking context, flattening 3D transforms. Don't add `preserve-3d` with `clip-path`.
- **Chrome suppresses rAF without user interaction**: Chrome can suppress rAF in visible tabs without interaction, hanging R3F's render loop. Fix: `useEffect(() => { const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 0); return () => clearTimeout(t); }, [])` — the synthetic resize kicks Chrome's rendering pipeline.
- **SVG data-URI background on `body` vs fixed div**: Use a `position: fixed; inset: 0; z-index: -1` div instead of `body` background to tile one viewport with its own compositor layer.
- **WeakMap for per-element animation state caching**: Use `WeakMap<Element, value>` in rAF loops to cache non-compositor properties and skip unchanged writes. Auto-GC'd when element is removed.
- **`ALLOWED_HOSTS` env var must trim whitespace**: `strings.Split(h, ",")` on `"a, b"` produces `[" b"]` with a leading space. Always `strings.TrimSpace` each entry after splitting.
- **`animation-play-state` is NOT inherited in CSS**: Must target the element carrying the animation directly with a descendant selector, not a parent.
- **Vercel serverless cookie `Secure` flag must use package-level init**: Use `var secureCookie = func() bool { ... }()` at package scope. Both OAuth handlers must use the same default (`false` for dev).
- **Marquee duplication factor for small categories**: Categories with few repos need duplication for seamless looping. Formula: `dupFactor = max(1, ceil(MIN_LOOP_PX / (repos.length * CARD_SLOT_PX)))`. Hoist constants to module scope.
- **`overflow-x-hidden` on the page root for marquee containment**: Prevents `w-max` marquee content from expanding page scrollable width on mobile.
- **Playwright `{ exact: true }` for heading selectors**: Use `{ exact: true }` to disambiguate headings like "Support" vs "Support Ethereum". Use `data-testid` + scoped locators for duplicate elements.
- **GitHub starring endpoint requires classic OAuth scopes, not GitHub App permissions**: GitHub App tokens get "Resource not accessible by integration" despite docs. Must use a **classic OAuth App** with `scope=public_repo`. Classic tokens don't expire — callback normalizes to 10-year TTL.
- **GitHub 403 is NOT always a rate limit**: Always read the 403 body — "rate limit"/"abuse detection" = `RateLimitError` (retry), "Resource not accessible"/"Forbidden" = `ForbiddenError` (propagate immediately). Use `classify403()` helper.

- **Vercel serverless star-callback path uses `star-callback` not `star/callback`**: Use flat directory to avoid ambiguity with `star/index.go`. Local dev handler must also register `/api/auth/star-callback`.
- **Popup OAuth postMessage flow**: Star OAuth callback returns HTML (not redirect) that posts token to opener via `postMessage({type: 'ethstar-star-token', access_token})`, then closes. Opener listens, validates type, resolves promise.
- **Parameterize cookie functions for multiple OAuth flows**: Use `SetNamedStateCookie(w, name, state, secure)` for multiple flows; original functions delegate to parameterized versions.
- **Ephemeral token pattern for privilege escalation**: Obtain broad-scope token in popup, pass via `postMessage`, use immediately, discard — never persist. `starAll` accepts optional `token`; skips refresh on 401 for ephemeral tokens.
- **CLS prevention with `invisible` breaks centered flex rows**: `invisible` placeholders take layout space, pushing `justify-center` content off-center. Accept minor CLS when data arrives instead.
- **Font loading: CSS `@import` vs HTML `<link>`**: Use `<link>` in `index.html` instead of CSS `@import` for Google Fonts to eliminate a waterfall hop. Add `<link rel="preconnect">` for both font domains.
- **Use correctly-sized image assets**: Reference sized variants (`logo-128.png` for header, `logo-512.png` for hero). Always add explicit `width`/`height` attributes to prevent layout shift.
- **Suspense placeholder paradox**: Visible loading placeholders make fast-loading lazy components feel *slower*. Prefer `fallback={null}` for chunks that load in under a second.
- **`rollup-plugin-visualizer` for bundle analysis**: Add as devDependency and conditionally include in Vite config via `process.env.ANALYZE === "true"`. Run with `npm run analyze` to generate an interactive treemap HTML report showing gzip sizes.
- **`aria-live` on rapidly-updating containers causes screen-reader spam**: Don't put `aria-live` + `aria-atomic="true"` on a container that re-renders per-repo during `starAll`. Place `aria-live="polite"` only on the leaf `<p>` showing the current action. For step-transition announcements, use a static string (not dynamic counts) so `aria-live="assertive"` fires once per step change.
- **`inert` attribute on marquee clone for a11y**: `aria-hidden="true"` alone doesn't prevent keyboard focus on child `<a>` elements. Add `inert={true}` to make the duplicate container fully non-interactive. Use explicit `inert={true}` (not bare `inert`) for React prop consistency.
- **Heading hierarchy requires sr-only h2 for Saturn carousel**: The Saturn carousel section contains h3 repo cards but sits between the hero h1 and later h2 sections. Add `<h2 className="sr-only">` in both mobile and desktop branches to prevent axe-core "heading-order" violations.
- **`eslint-plugin-jsx-a11y` flat config**: Import as `jsxA11y` and add `jsxA11y.flatConfigs.recommended` to the extends array. Runs cleanly with existing shadcn/ui components (shadcn files are already in globalIgnores).
- **`aria-label` on bare `<div>` is ignored**: Without a semantic role, `aria-label` has no effect. Add `role="status"` (or another appropriate role) to make the label visible to assistive tech. `role="status"` implicitly includes `aria-live="polite"`.
- **Module-level singletons (`logoPromise`) break Vitest mocks**: `restoreMocks: true` restores mocks between tests, but module-level `let` variables persist. If a singleton captures a mocked dependency, subsequent tests may use stale references. For canvas/Image-heavy components, test dialog behavior (open/close, button states) and validate rendering in browser sessions instead.
- **E2E popup OAuth mock via `addInitScript`**: Mock `window.open` to intercept `/api/auth/star` requests and immediately `postMessage` a fake token back. Return `{ closed: false, close: () => {} }` as the fake popup to prevent the closed-popup poller from rejecting prematurely.
- **WebGL canvas sizing in Playwright is highly variable**: Compositor timing causes canvas dimensions to vary ±80px+ from expected values. Use proportional tolerances (e.g., 50%-200% of expected) instead of absolute ±N px ranges.

### Security

- **Bind to localhost by default**: Use `127.0.0.1:8080` not `:8080` — the latter binds to all interfaces.
- **CORS must not be `*`**: Restrict to specific origins (`localhost:5173`, `localhost:8080`).
- **`MaxBytesReader` on JSON bodies**: Wrap `r.Body` with `http.MaxBytesReader(nil, r.Body, 1<<20)` before decoding.
- **Middleware `responseWriter` must implement `http.Hijacker`**: Wrapping `http.ResponseWriter` strips the `http.Hijacker` interface required by WebSocket upgrades. Add a `Hijack()` method that delegates.
- **WebSocket origin validation**: Use `OriginPatterns` instead of `InsecureSkipVerify: true`.
- **`JSONContentType` middleware must exclude `/api/ws*` prefix**: Use `!strings.HasPrefix(r.URL.Path, "/api/ws")`.

## Browser Validation (Frontend Changes)

You have access to Chrome browser automation via `mcp__claude-in-chrome__*` tools.
**Do NOT skip browser validation for frontend changes.**

How to validate:
1. Start dev servers in background terminals:
   ```bash
   make dev-go &          # Go API on :8080 (use make kill-server first if port is busy)
   cd frontend && npm run dev &   # Vite on :5173
   ```
2. Use Chrome tools to navigate and inspect:
   ```bash
   mcp__claude-in-chrome__tabs_context_mcp    # See current tabs
   mcp__claude-in-chrome__tabs_create_mcp     # Open new tab
   mcp__claude-in-chrome__navigate            # Go to http://localhost:5173
   mcp__claude-in-chrome__read_page           # Read page content
   mcp__claude-in-chrome__computer            # Click, type, screenshot
   ```
3. Walk through acceptance criteria visually
4. Write Playwright regression tests for what you validated
