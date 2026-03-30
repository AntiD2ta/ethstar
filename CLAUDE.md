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

- **golangci-lint v2 breaking changes**: Requires `version: "2"` in `.golangci.yml`. `gosimple` and `typecheck` are no longer separate linters (merged into `staticcheck` and built-in respectively). Use `./...` syntax, not `$(go list ./...)`.
- **gosec G706 (log injection)**: Fires on `slog.Info/Error` calls with HTTP request data. Use `#nosec G706` for structured logging — slog uses key-value pairs, not string interpolation.
- **SQLite connection pool**: Set `SetMaxOpenConns(1)` and `SetMaxIdleConns(1)` — SQLite serializes writes at file level; multiple connections waste FDs without throughput gain.
- **Always run `go mod tidy` after adding imports**: After adding any new Go import, always run `go mod tidy` and verify with `go build ./cmd/...`.
- **nhooyr.io/websocket is deprecated**: Use `github.com/coder/websocket` instead (same API, maintained fork).
- **Vercel Go serverless: directory-per-endpoint**: Multiple serverless functions in the same directory can't each export `Handler()` (Go package rule). Use one directory per endpoint: `api/auth/github/index.go`, `api/auth/callback/index.go`, etc. Each directory is its own package.
- **Makefile must exclude `api/` from Go commands**: The `api/` directory contains Vercel-only serverless functions. Add `grep -v '/api/'` alongside the existing `grep -v frontend` in `go list` pipelines. Also add `-exclude-dir=api` to `gosec`.
- **gosec G704 (SSRF)**: `#nosec G704` must be on the `http.DefaultClient.Do(req)` line, not the function signature. gosec only reads annotations on the flagged line.
- **gosec G101/G117 false positives**: `G101` fires on URL constants containing "Token" (e.g., GitHub OAuth endpoint). `G117` fires on struct fields with `json:"access_token"` or `json:"refresh_token"`. Use `#nosec G101` / `#nosec G117` with a comment explaining why.
- **GitHub OAuth 200-for-errors**: GitHub returns HTTP 200 even for OAuth errors, with `error` and `error_description` in JSON body. Decode into a combined struct that captures both token and error fields in one pass.
- **Vercel KV REST API**: Maps Redis commands to URL paths: `GET /get/{key}`, `GET /exists/{key}`, `GET /incrby/{key}/{amount}`. Single commands via `POST /` with `["SET", key, value, "EX", ttl]`. Returns JSON with `result` field (string, int, or null). No Redis client library needed.
- **Vercel KV `url.PathEscape` on keys**: Always wrap KV keys with `url.PathEscape` when interpolating into URL paths. Keys like `tok:hash` contain colons (safe) but future keys could contain `/`, `?`, or `#` that corrupt the URL. Defense-in-depth for general helpers.
- **Parallel KV operations in serverless (reads)**: Use `sync.WaitGroup` for concurrent KV reads to halve latency. Each goroutine writes to its own variable pair — no shared mutable state needed.
- **Vercel KV pipeline for atomic multi-key writes**: `POST /pipeline` accepts `[["INCRBY","key1",5],["INCRBY","key2",1]]` — one round-trip, atomic. Prefer over parallel goroutines for writes. Response is a JSON array of per-command results.
- **Vercel serverless functions can't use constructor injection**: Use a package-level `var` (e.g., `var gitHubUserURL = "https://..."`) that tests reassign with `defer` restore. This mirrors the `TokenURL` override pattern in `api.Config` but without requiring a Config struct.
- **Startup-validated config doesn't need per-request re-validation in long-running servers**: If `main()` calls `auth.ValidateBaseURL(baseURL)` and exits on failure, the handler closure captures the validated value. Re-validating per-request is pure waste — only do it in serverless functions where there's no persistent startup.
- **HTTP response body draining for connection reuse**: After JSON-decoding a response body, add `_, _ = io.Copy(io.Discard, resp.Body)` before close to enable HTTP/1.1 connection reuse. Without draining, each request opens a new TCP+TLS connection.
- **`io.LimitReader` on external API responses**: Wrap response bodies from external APIs with `io.LimitReader(resp.Body, 1<<20)` before JSON decoding to prevent OOM from malicious/large responses.
- **OAuth state cookie `Secure` flag must be per-env**: `Secure: true` cookies are rejected by browsers on plaintext `http://localhost`. Pass a `secure bool` through to `SetStateCookie`/`ClearStateCookie` — `true` for production HTTPS, `false` for HTTP dev. Driven by an env flag (e.g. `ETHSTAR_COOKIE_SECURE=1`) in the server entry point.

### Type Generation

- **tygo type_mappings don't affect type definitions**: `type_mappings` in tygo.yaml only affect how types are rendered when used as struct fields, NOT the `type X = ...` definitions themselves. iota enums still generate as `number`. Solution: post-process the output with regex in `cmd/typegen`.
- **Enum count auto-detection**: Instead of hardcoding enum value counts (fragile), iterate until the `String()` method returns "unknown" for two consecutive values.

### Frontend / TypeScript

- **shadcn/ui sidebar cookie not read on mount (Vite)**: `SidebarProvider` writes `sidebar_state` cookie but initializes from `defaultOpen`. In Vite client-only apps you must read it yourself and pass `defaultOpen={getSidebarDefault()}`. Evaluate once at module scope.
- **TypeScript `erasableSyntaxOnly`**: This project's tsconfig enables it, so parameter properties (`public x: number` in constructor) are not allowed.
- **eslint `.claude/` directory**: Must be added to `globalIgnores` in `eslint.config.js` — skills installed there contain TS files that trigger lint errors.
- **Controlled dialogs for mutation-backed forms**: When a dialog triggers an async mutation, use controlled `open`/`onOpenChange` props so the parent closes the dialog only in the mutation's `onSuccess`.
- **React.ReactNode requires explicit import**: Under the new JSX transform, `React` is not auto-imported. Use `import type { ReactNode } from "react"`.
- **CSS specificity: data-attribute selectors override plain class selectors**: `data-[orientation=horizontal]:w-full` has higher specificity than plain `w-auto`. `tailwind-merge` doesn't treat them as conflicting since they have different variants.
- **`useMutation` returns unstable object on each render**: TanStack Query's `useMutation` returns a new object every render. Destructure `.mutate` (which IS stable) for use in `useCallback` deps.

### Frontend Testing (Vitest)

- **Mocking philosophy**: No MSW — use `vi.spyOn(globalThis, "fetch")` at the HTTP boundary (`lib/github.ts` tests, hooks that call `/api/*`). For everything above the `lib/github.ts` layer, use `vi.mock("@/lib/github")` via a hoisted spy object that re-exports real error classes (`TokenExpiredError`, `RateLimitError`) from the actual module so `instanceof` checks still work.
- **Test file naming**: `*.test.ts` for pure unit, `*.integration.test.tsx` for hook+context integration. Co-located next to source (mirrors Go's `foo_test.go`). Vitest `include` glob is `src/**/*.{test,integration.test}.{ts,tsx}`.
- **Node 25's native `localStorage` shadows happy-dom**: Node 25+ exposes a stub `localStorage` global (controlled by `--localstorage-file`) that wins over happy-dom's implementation and lacks `setItem`/`clear`. Install a Map-backed polyfill in `src/test/setup.ts` via `Object.defineProperty(globalThis, "localStorage", {...})` in a `beforeAll` hook.
- **Fake timers + fetch spy**: use `vi.advanceTimersByTimeAsync(ms)` (NOT sync `advanceTimersByTime`) so fetch-spy promises settle inside timer ticks. Also attach the `expect(...).rejects` assertion BEFORE calling `advanceTimersByTimeAsync` to avoid an unhandled-rejection blip.
- **`window.location.href` setter spying**: happy-dom's `Location` uses private class members and cannot be proxied. Patch just the `href` descriptor via `Object.defineProperty(window.location, "href", { set: spy, get: () => orig })` — do NOT replace the whole `window.location` object (breaks react-router's `BrowserRouter`).
- **`restoreMocks: true`** in vitest config auto-resets all spies between tests — don't manually reset unless you need finer control.
- **`starStatusesRef` is load-bearing**: `use-stars.integration.test.tsx` asserts `starAll` identity stability after status updates. The ref pattern keeps `starAll` out of the `starStatuses` dependency chain; removing it would cause `starAll` to be recreated every status update during `checkStars`.
- **Test files excluded from `tsconfig.app.json`**: The app config excludes `**/*.test.*` and `src/test/**` so production `tsc -b` doesn't see Vitest globals. A separate `tsconfig.test.json` (referenced from root) compiles test files with `vitest/globals` + `@testing-library/jest-dom` types.
- **ESLint `react-refresh/only-export-components`** fires on `src/test/render.tsx` because it mixes helper functions with a `<Wrapper>` component. Disable the rule at the top of the file with `/* eslint-disable react-refresh/only-export-components */` — it's a test helper, not a Fast Refresh file.
- **`React.memo` pre-duplicated marquee children**: `RepoMarquee` renders its children twice (original + `aria-hidden` clone). Without memoization, every `starStatuses` update re-renders ~34 card nodes. Wrapping `RepoCard` in `memo()` is essential — props (`repo` object from module-level constant, `status` primitive) are reference-stable, so the default shallow-compare is correct.
- **Pre-compute static grouped constants at module scope, not in `useMemo`**: If a `useMemo` has an empty dependency array and its inputs are module-level constants (like `REPOSITORIES` + `CATEGORIES`), move it to module scope (`export const REPOS_BY_CATEGORY = ...`). `useMemo` with `[]` still registers hook slots and allocates closures — a module constant is cheaper and clearer.
- **Tailwind v4 `animate-*` utilities collide on the shorthand `animation` property**: applying both `animate-rotate-3d` and `animate-glow-pulse` to the same element only runs whichever class serializes last — each utility re-assigns `animation:` wholesale. Either compose into a single custom utility (e.g. `.animate-hero-logo { animation: a, b; }` under `@layer utilities`) or use an inline `style={{ animation: "..." }}`. If choosing the inline-style route, remember to also extend `@media (prefers-reduced-motion: reduce)` to clear inline animations via `!important` with a matching class.
- **Tailwind `focus:` compound variants can silently no-op on programmatic `.focus()`**: `sr-only focus:not-sr-only focus:absolute focus:left-4 …` relies on the `:focus` pseudo matching. Chrome browser-automation tabs often aren't OS-focused, so `:focus` never matches and positional utilities stay unset. For skip-to-content links, prefer a hand-written `.skip-link` CSS rule (positioned off-screen, revealed on `:focus, :focus-visible`) so the behavior is explicit and easier to E2E-test via `focus()` + `boundingBox()`.
- **`perspective()` inside a `transform` keyframe forces per-frame main-thread work**: the rotating hero logo animation should put `perspective` on the parent wrapper (`style={{ perspective: "800px" }}`) and keep the keyframe to `rotateY()` only, so the animated transform stays on the compositor thread. Pair with `will-change: filter, transform` on the animated child to promote it to its own layer for drop-shadow pulses.
- **Chrome browser-automation screenshot quirks**: the `mcp__claude-in-chrome__computer` screenshot tool returns stale/blank captures when the page has `position: sticky` combined with multiple long-running CSS animations (marquees, 3D transforms, drop-shadow pulses). Validate via `javascript_tool` DOM inspection (`getBoundingClientRect`, `elementFromPoint`) as the source of truth — the actual page renders correctly in a real browser.
- **Playwright clicks inside animated marquees need `force: true`**: elements duplicated inside `RepoMarquee` are inside a continuously-translating container, so Playwright's auto-wait for "element is stable" never resolves. Use `.click({ force: true })` when targeting buttons inside marquee children (e.g. retry-star buttons) in e2e tests.
- **`refreshInFlight` ref prevents concurrent token-refresh calls**: when `useStars` and the init effect both see 401 simultaneously, both would call `/api/auth/refresh` with the same refresh_token — the second call fails because refresh tokens are single-use. Storing the in-flight refresh promise in a ref and returning it for any concurrent caller ensures at most one refresh per token rotation.
- **Reset `starStatuses` to "unknown" when `token` becomes `null`**: otherwise cards stay stuck on "checking" after a logout caused by session expiry. Add a `useEffect` dependent on `token` that resets the status map and sets `abortRef.current = true` to prevent in-flight `onProgress` callbacks from writing stale statuses.
- **Playwright `page.goto` default `waitUntil: "load"` can miss loading states**: when testing brief loading states (e.g., auth skeleton), use `waitUntil: "domcontentloaded"` and increase the API mock delay to 2+ seconds so the loading UI is observable before the delayed response settles.
- **localStorage shape validation after `JSON.parse`**: `as T` casts provide no runtime guarantee. Always validate `typeof` on each field after parsing localStorage data, returning `null` on shape mismatch — defends against corrupted or tampered values.
- **Pending-stats accumulation pattern**: when a fire-and-forget POST fails, store the delta in localStorage and piggyback it onto the next successful POST. Read + clear the pending key inside the same `reportStars` call to avoid accumulating stale deltas.
- **Marquee responsive: conditional rendering via `useMediaQuery`**: the duplicate clone for infinite-scroll marquee is conditionally rendered via `useMediaQuery("(min-width: 768px)")` called once in `home.tsx` and passed as `isDesktop` prop to `RepoMarquee`. This eliminates ~68 hidden RepoCard nodes on mobile and allows `memo()` to fully bail out during `starStatuses` ticks (all props are reference-stable primitives/constants). Important: call `useMediaQuery` in the parent, not inside the `memo()`-wrapped child — hooks inside memo'd components still execute on every render tick, defeating the bail-out.
- **ESLint `react-hooks/set-state-in-effect` and `useMediaQuery`**: calling `setMatches(mql.matches)` directly in a `useEffect` body triggers this lint rule. Workaround: define the handler as `const handler = (e) => setMatches(e.matches)` and invoke it immediately as `handler({ matches: mql.matches } as MediaQueryListEvent)`. Also avoid a lazy `useState` initializer that calls `window.matchMedia()` when the effect already creates one — that's two `MediaQueryList` constructions per mount.
- **`toBeCloseTo` precision in Playwright is too tight under parallel load**: `toBeCloseTo(500, -1)` means tolerance ±5px. Under Playwright's parallel workers, browser layout can produce sub-pixel deviations (e.g. 485.6px for expected 500px). Use range assertions (`toBeGreaterThan`/`toBeLessThan`) with ±20px tolerance for dimension checks on WebGL canvases (compositor timing varies), ±10px for standard DOM elements.
- **Chrome `resize_window` cannot reach mobile viewport sizes**: Chrome browser-automation's `resize_window` tool sets the outer window dimensions (including chrome), and Chrome enforces a minimum window width (~500px). For proper mobile viewport testing, use Playwright's `test.use({ viewport: { width, height } })` which controls the content area directly.
- **Chrome browser-automation tabs don't fire `requestAnimationFrame`**: The controlled tab isn't "visible" to Chrome's rendering pipeline, so rAF callbacks never execute. Animation code using rAF will work in real browsers and Playwright but cannot be validated via `mcp__claude-in-chrome__*` tools. Use Playwright E2E tests for animation validation, and `javascript_tool` DOM inspection for layout verification.
- **CSS `preserve-3d` + counter-rotation for readable text on tilted rings**: When a parent ring has `rotateX(tilt)`, all child chips inherit the tilt and appear as thin slivers. Add `rotateX(-tilt)` to each chip's transform to "pop up" and face the camera. Transform chain: `rotateZ(theta) translateX(radius) rotateZ(-theta) rotateX(-tilt) scale(s)`.
- **`useMediaQuery` initial `false` breaks effects that depend on derived values**: `useMediaQuery` returns `false` on first render (before the effect syncs). If you derive `prefersReducedMotion || !isDesktop` and pass it to a hook, the hook sees `true` on mount (because `!false = true`). The hook's effect dependency on the boolean correctly re-runs when the value flips, but be aware of the initial flash.
- **Multiple R3F Canvas instances on one page**: Each Canvas creates its own WebGL context. Use a stripped-down mini scene (no postprocessing, no globe) for secondary Canvases to minimize GPU memory. Lazy-load via `React.lazy()` with Suspense fallback.
- **React StrictMode + `useRef` as fetch-once guard is fragile**: StrictMode double-mounts effects (mount → unmount → remount). A ref set to `true` in the effect body persists across unmount/remount. If cleanup resets it to `false`, the remount re-fetches (duplicating work). If cleanup does NOT reset it, the remount skips the fetch — but the first mount's work was already cancelled by cleanup, so NO fetch ever completes. **Prefer relying on the `cancelled` closure variable alone** (fresh per effect invocation) and the dependency array for re-execution. Remove `fetchedRef` guards entirely when the effect's cleanup already prevents stale writes.
- **StrictMode + one-shot URL data (hash fragments, query params)**: If an effect reads one-shot data from the URL and clears it synchronously, the first mount's async work gets cancelled by StrictMode while the data is already gone for the second mount. **Persist to localStorage before any async work** so the second mount recovers via the storage fallback path. This was the root cause of OAuth tokens being silently dropped after the GitHub callback redirect.
- **`Date.now()` in render body violates React purity**: `react-hooks/purity` lint rule flags `Date.now()` during render because it's impure (non-idempotent). Move time checks into `useEffect` bodies or utility functions called from effects.
- **Extract `BASE_HEADERS` for optional-auth GitHub API calls**: When a function optionally sends auth (token can be null), extract shared headers (`Accept`, `X-GitHub-Api-Version`) as a module-level `const BASE_HEADERS` and have `authHeaders(token)` spread from it. Avoids header duplication and keeps all header construction in one place.
- **localStorage cache key naming convention**: Use `ethstar_` prefix with underscores (e.g., `ethstar_repo_meta`, `ethstar_stats_cache`), not colons or hyphens. Consistent naming makes grepping for all storage keys reliable.
- **`vi.fn<FnType>()` single-generic for typed spies**: Vitest v4+ uses a single generic argument with the function type: `vi.fn<(arg: string) => Promise<T>>()`, NOT the old 2-arg form `vi.fn<[string], T>()`. The 2-arg form causes `TS2558: Expected 0-1 type arguments`.
- **`vi.mock` with `importOriginal` to preserve real error classes**: When mocking a module but needing real classes (e.g., `RateLimitError`) for `instanceof` checks in tested code, use `vi.mock("@/lib/github", async (importOriginal) => { const actual = await importOriginal<typeof import("@/lib/github")>(); return { ...actual, fetchFn: spy }; })`.
- **GraphQL query injection prevention**: When building GraphQL queries via string interpolation with dynamic values (e.g., repo owner/name), validate inputs against `VALID_GH_NAME = /^[a-zA-Z0-9._-]+$/` before interpolation. Even if current callers use static data, exported functions are public API and could be called with user input in the future.
- **`AbortController.abort(reason)` is fragile for discrimination**: Prefer a simple `let hitRateLimit = false` flag over `controller.abort("rate-limit")` + `controller.signal.reason` comparison. The flag is type-safe and typo-proof; abort reasons are untyped strings.
- **Share `loadCache()` between `useState` initializers**: When two lazy `useState` initializers depend on the same expensive computation, compute once via a single `useState` that returns both values: `const [{ meta, fresh }] = useState(() => { const c = loadCache(); return { meta: c?.data ?? {}, fresh: isCacheFresh(c) }; })`.
- **`combinedStars === null` as hasData proxy**: Instead of `Object.keys(repoMeta).length > 0` on every render, reuse the already-memoized `combinedStars` — it's `null` when `repoMeta` is empty (see `computeCombinedStars`). Avoids per-render `Object.keys()` allocation.
- **GitHub GraphQL API requires auth**: Unlike REST (`GET /repos/{owner}/{name}` works anonymously), `POST /graphql` always requires `Authorization: Bearer` header. Use GraphQL for authenticated users, REST fallback for anonymous.
- **GraphQL `stargazerCount` vs REST `stargazers_count`**: GitHub GraphQL uses camelCase (`stargazerCount`), REST uses snake_case (`stargazers_count`). Map at the boundary in `fetchAllRepoMetaGraphQL` to keep `RepoMeta` interface consistent.
- **Custom memo comparator to scope re-renders**: When a parent's state (like `starStatuses`) is a single object shared across multiple memoized children, a default shallow compare on `children` prop always fails (new JSX = new reference). Change the child to accept data props and use a custom `arePropsEqual` that compares only the relevant slice (e.g., only statuses for repos in this category). This prevents cross-category re-renders.
- **`React.lazy` requires default export**: `React.lazy(() => import(...))` expects the module to have a `default` export. When a component already has a named export (used by tests), add `export default ComponentName` at the bottom — both exports coexist.
- **Hoist `supportsWebGL()` to module scope**: WebGL capability doesn't change between renders. Calling it inside a component body allocates a canvas and checks the GL context on every re-render. Evaluate once at module scope.
- **Static `filter` on CSS-animated element blocks compositor**: A non-animated `filter: drop-shadow()` on an element with `animation: rotateY()` prevents the browser from promoting the element to a GPU layer. Move the static filter to a parent wrapper element and keep only `will-change: transform` on the animated child. This is different from the hero logo case where `filter` is animated.
- **`transform-style: preserve-3d` has no effect with `clip-path` children**: CSS spec mandates `clip-path` forces a 2D stacking context, flattening any 3D transforms on that element's children. Don't add `preserve-3d` when children use `clip-path`; it adds compositing overhead with no visual effect.
- **SVG data-URI background on `body` vs fixed div**: A `background-image` on `body` tiles across the full scrollable document height (expensive on long pages). Moving to a `position: fixed; inset: 0; z-index: -1` div tiles exactly one viewport and gets its own compositor layer (no repaint on scroll).
- **WeakMap for per-element animation state caching**: When a rAF loop writes non-compositor properties (like `zIndex`) per frame, use a `WeakMap<Element, value>` to cache previous values and skip writes when unchanged. WeakMap entries are GC'd when the DOM element is removed, so no manual cleanup needed.
- **`ALLOWED_HOSTS` env var must trim whitespace**: `strings.Split(h, ",")` on `"a, b"` produces `[" b"]` with a leading space. Always `strings.TrimSpace` each entry after splitting.
- **`animation-play-state` is NOT inherited in CSS**: Setting `animation-play-state: paused` on a parent div does NOT pause animations on child elements. Use a descendant selector (`.parent .animated-child`) to target the element carrying the animation. This was caught during review when an IntersectionObserver optimization was a no-op.
- **Vercel serverless cookie `Secure` flag must use package-level init**: Parsing `BASE_URL` per-request wastes work since env vars don't change between warm invocations. Use `var secureCookie = func() bool { ... }()` at package scope. Both OAuth handlers must use the same default (`false`, safe for dev) to avoid mismatched Set/Clear cookies.
- **Marquee duplication factor for small categories**: Categories with few repos (e.g. Ethereum Core with 2) need content wider than the viewport for seamless looping. Formula: `dupFactor = max(1, ceil(MIN_LOOP_PX / (repos.length * CARD_SLOT_PX)))`. Hoist `MIN_LOOP_PX` and `CARD_SLOT_PX` to module scope — they are invariant constants.
- **`overflow-x-hidden` on the page root for marquee containment**: Without it, `w-max` content inside `overflow-x-auto` marquee containers can expand the page's scrollable width on mobile. Adding `overflow-x-hidden` to the root flex column ensures only the marquee container scrolls horizontally.
- **Playwright `{ exact: true }` for heading selectors**: When a page has headings like "Support" and "Support Ethereum", `getByRole("heading", { name: "Support" })` matches both. Use `{ exact: true }` to disambiguate. Also use `data-testid` + scoped locators (e.g. `container.getByRole(...)`) when duplicate interactive elements exist.
- **GitHub starring endpoint requires classic OAuth scopes, not GitHub App permissions**: Despite GitHub's docs claiming the starring endpoint supports GitHub App user-to-server tokens with "Starring" permission, the actual API returns `X-Accepted-OAuth-Scopes: public_repo, repo` and "Resource not accessible by integration" for GitHub App tokens. Must use a **classic OAuth App** with `scope=public_repo`. Classic OAuth tokens don't expire (`expires_in=0`, no `refresh_token`) — the callback handler normalizes this to a 10-year TTL so the frontend's existing expiry logic works unchanged.
- **GitHub 403 is NOT always a rate limit**: GitHub returns HTTP 403 for both secondary rate limits AND permission errors. Rate-limit 403 bodies contain "rate limit" or "abuse detection" in the `message` field. Permission-denied 403 bodies say "Resource not accessible" or "Forbidden". Always read the response body to classify a 403 — treating all 403s as rate limits causes silent 60s retries on permission errors, which is terrible UX. Use `classify403()` helper to inspect the body, and throw `ForbiddenError` (not `RateLimitError`) for permission issues. `ForbiddenError` should propagate out of starring loops immediately (not retry per-repo).

- **Vercel serverless star-callback path uses `star-callback` not `star/callback`**: Nesting `callback/` inside `star/` would create ambiguity — `star/index.go` handles `/api/auth/star` while `star/callback/index.go` would try to handle `/api/auth/star/callback`. Use flat `star-callback/` directory instead. The local dev handler must also register `/api/auth/star-callback` for consistency with the Vercel route.
- **Popup OAuth postMessage flow**: The star OAuth callback returns HTML (not a redirect) because the flow runs in a popup. The HTML page uses `window.opener.postMessage({type: 'ethstar-star-token', access_token: '...'}, '*')` to deliver the token to the opener, then calls `window.close()`. The opener listens for the message, validates the type, and resolves a promise.
- **Parameterize cookie functions for multiple OAuth flows**: When an app needs multiple OAuth flows (GitHub App + classic OAuth), use `SetNamedStateCookie(w, name, state, secure)` instead of duplicating the hardcoded-name versions. The original `SetStateCookie`/`ClearStateCookie`/`ValidateState` delegate to the parameterized versions for backward compatibility.
- **Ephemeral token pattern for privilege escalation**: When a broad-scope token is needed temporarily (e.g. `public_repo` for starring), obtain it in a popup, pass it via `postMessage`, use it immediately, and discard it — never persist to localStorage. The `starAll` hook accepts an optional `token` field in options; when provided, it skips token refresh on 401 (ephemeral tokens can't be refreshed).

### Store / SQLite

- **`defer rows.Close()` triggers errcheck**: golangci-lint's errcheck flags unchecked `rows.Close()`. Use `defer func() { _ = rows.Close() }()`.
- **SQLite `RETURNING` clause works**: Use `INSERT ... ON CONFLICT DO UPDATE ... RETURNING id` with `QueryRowContext` + `.Scan(&id)` to eliminate fallback SELECTs.
- **Settings key allowlist**: Always validate setting keys against an explicit allowlist in the API handler.
- **`modernc.org/sqlite` cannot Scan TEXT into `time.Time`**: `datetime('now')` produces TEXT. Scan into a `string` variable and parse with `time.Parse`.
- **SQLite `datetime('now')` has second precision**: Messages within the same second get identical timestamps. Use `ORDER BY created_at DESC, id DESC` as tiebreaker.
- **Integration tests must set `PRAGMA foreign_keys=ON`**: SQLite disables FK enforcement by default. Set it explicitly in test helpers.

### Security

- **Bind to localhost by default**: Use `127.0.0.1:8080` not `:8080` — the latter binds to all interfaces.
- **CORS must not be `*`**: Restrict to specific origins (`localhost:5173`, `localhost:8080`).
- **`MaxBytesReader` on JSON bodies**: Wrap `r.Body` with `http.MaxBytesReader(nil, r.Body, 1<<20)` before decoding.
- **Middleware `responseWriter` must implement `http.Hijacker`**: Wrapping `http.ResponseWriter` strips the `http.Hijacker` interface required by WebSocket upgrades. Add a `Hijack()` method that delegates.
- **WebSocket origin validation**: Use `OriginPatterns` instead of `InsecureSkipVerify: true`.
- **`JSONContentType` middleware must exclude `/api/ws*` prefix**: Use `!strings.HasPrefix(r.URL.Path, "/api/ws")`.

### API / Pagination

- **SQLite enum sorting requires CASE expressions**: Priority stored as string gives alphabetical order, not severity.
- **Skip COUNT when pagination not requested**: When `Page == 0`, total equals `len(results)`.
- **ListResponse omitempty trap**: `json:",omitempty"` on integer fields silently drops them when zero.
- **Clamp per_page**: Always enforce a maximum (e.g., 100).
- **TrimSpace on comma-separated filter values**: `?author=alice, bob` creates `" bob"` which won't match.

### Interface Evolution

- **Adding methods to shared interfaces breaks all mock implementations**: Update mocks in EVERY package. Run `go build ./...` to catch all.
- **Mock consistency pattern**: All mock methods should delegate through function fields unconditionally (no nil-guards). A nil field panic means the test forgot to set up the mock.
- **Constructor parameter order cascades across 4+ call sites**: Adding a new store to constructors requires updating main.go, e2eserver, integration test helpers, and all unit tests.

## Hallucination Log

> Track patterns where the AI generated incorrect code so the same mistakes aren't repeated.
> Format: date, pattern type, location, what happened, prevention.

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
