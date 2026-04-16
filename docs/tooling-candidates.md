# Tooling candidates

Rules currently documented or implied by past incidents that **could be mechanically enforced** instead of relying on docs + reviewer memory. Each entry lists the invariant, the violation symptom, and a concrete enforcement idea.

Graduation criterion: once a rule here has automated enforcement in CI (failing the build on violation), remove it from this file and delete any corresponding bullet in CLAUDE.md or `docs/learnings/`.

---

## Go / backend

### 1. `io.LimitReader` on external HTTP response bodies
- **Invariant**: Any `resp.Body` from an outbound `http.Client` call must be wrapped in `io.LimitReader(resp.Body, N)` before decoding.
- **Violation symptom**: OOM on malicious/oversized upstream responses.
- **Enforcement**: `semgrep` rule flagging `json.NewDecoder(resp.Body)` or `io.ReadAll(resp.Body)` without an intervening `io.LimitReader`. Requires taint-ish matching but expressible as a single pattern-either rule for common shapes.

### 2. Response body drained before `Close()`
- **Invariant**: `_, _ = io.Copy(io.Discard, resp.Body)` before `resp.Body.Close()` on paths that don't fully decode the body. Enables HTTP/1.1 connection reuse.
- **Violation symptom**: Silent connection churn; no functional error.
- **Enforcement**: `golangci-lint` has `bodyclose` (checks close) but not drain. Custom `ruleguard` or `semgrep` rule. Lower priority than #1.

### 3. `http.MaxBytesReader` on `r.Body` for JSON endpoints
- **Invariant**: Every JSON-decoding handler wraps `r.Body` in `http.MaxBytesReader(nil, r.Body, 1<<20)`.
- **Violation symptom**: Memory DoS on large request bodies.
- **Enforcement**: `semgrep` — `json.NewDecoder(r.Body)` without a preceding `MaxBytesReader` call in the same function.

### 4. CORS origin never `*`
- **Invariant**: Never set `Access-Control-Allow-Origin: *`.
- **Enforcement**: Trivial `semgrep` rule matching the literal string, or `grep -r "Access-Control-Allow-Origin.*\\*"` in CI.

### 5. Listeners bind to `127.0.0.1`, not `:PORT`
- **Invariant**: `http.ListenAndServe(":8080", …)` binds all interfaces and is wrong for this app. Use `127.0.0.1:8080`.
- **Enforcement**: `semgrep` matching `ListenAndServe(":` and `net.Listen("tcp", ":`.

### 6. WebSocket `InsecureSkipVerify: true` forbidden
- **Invariant**: Never accept all origins. Use `OriginPatterns`.
- **Enforcement**: Trivial `semgrep` or `grep` rule.

### 7. `url.PathEscape` on Vercel KV keys
- **Invariant**: All KV keys must be `url.PathEscape`'d before URL interpolation.
- **Enforcement**: `semgrep` scoped to `pkg/vercelkv/`: any string concatenation forming a URL path from a variable must flow through `url.PathEscape`.

### 8. `go mod tidy` drift
- **Invariant**: `go.mod`/`go.sum` always in `tidy` state.
- **Enforcement**: CI step `go mod tidy && git diff --exit-code go.mod go.sum`. Cheap, high-value.

### 9. Comma-separated env vars: `strings.TrimSpace` each entry
- **Invariant**: `strings.Split(v, ",")` without a trim on each entry is a bug.
- **Enforcement**: `semgrep` — `strings.Split(<expr>, ",")` not followed by `strings.TrimSpace`. Some false positives; worth trying.

---

## Frontend

### 10. `localStorage` cache keys use `ethstar_` prefix
- **Invariant**: Every `localStorage.setItem`/`getItem` uses a key starting with `ethstar_`.
- **Enforcement**: Custom ESLint rule on string literals passed as the first arg to `localStorage.*` methods. A 30-line AST rule.

### 11. `<img>` must have explicit `width` and `height`
- **Invariant**: Prevents CLS.
- **Enforcement**: ESLint `jsx-a11y` doesn't cover this. Use `@next/eslint-plugin-next` style rule (we're not on Next) or a custom rule: any `<img>` without both `width` and `height` attributes fails.

### 12. GraphQL template literal interpolation must be validated
- **Invariant**: Dynamic values interpolated into a GraphQL query string must first pass `VALID_GH_NAME` (or similar).
- **Enforcement**: Custom ESLint rule targeting tagged template literals or string concat forming `POST /graphql` bodies. Non-trivial but high-value for security.

### 13. Tailwind `animate-*` collision on one element
- **Invariant**: At most one `animate-*` utility per element.
- **Enforcement**: Custom ESLint rule counting `animate-` prefix classes in `className` string literals. Easy to prototype.

### 14. `aria-label` on a bare `<div>` without `role`
- **Invariant**: `aria-label` on role-less `<div>` is ignored.
- **Enforcement**: `eslint-plugin-jsx-a11y`'s `no-noninteractive-element-to-interactive-role` is adjacent but not this. Custom rule: `<div aria-label="..." />` without `role` → error.

### 15. Playwright tests must run from `frontend/`
- **Invariant**: `npx playwright test` only works from `frontend/`.
- **Enforcement**: Already de facto enforced by `make test-e2e`. Add a `frontend/scripts/preflight.sh` that `cd`s and exec's, and discourage direct `npx playwright` in README. Low priority.

### 16. Tailwind v4: `hidden` + `sm:inline` (or `:block`/`:flex`/`:grid`) breaks at ≥sm
- **Invariant**: Never combine base `hidden` with a responsive shown-variant (`sm:inline`, `md:block`, etc.) in the same `className`. Tailwind v4 emits `.hidden { display:none }` after the media-query rule in source order, so `.hidden` wins and the element stays invisible at every breakpoint the shown-variant was supposed to target. Use the inverse `max-sm:hidden` / `max-md:hidden` pattern instead.
- **Violation symptom**: Visually empty elements with correct accessible name (so `getByRole` matchers pass while `innerText === ""`). Exact bug: auth-header's "Sign in with GitHub", "ethstar" logo text, "Propose more repos", user name, and auth skeleton all rendered invisible at ≥sm.
- **Enforcement**: ESLint custom rule or `semgrep` pattern on JSX/TSX `className` string literals matching `\bhidden\b[^"`]*\b(sm|md|lg|xl|2xl):(inline|block|flex|grid|inline-block|inline-flex)\b`. Trivial to prototype; zero false positives for the pairing being a bug in v4. Tests in `e2e/home.spec.ts`'s `"header CTAs render the full-length label at ≥sm"` assert the rendered innerText (not the accessible name) to catch this at runtime.

---

## Cross-cutting

### 16. `#nosec` must include a `--` reason
- **Invariant**: Every `#nosec G###` has a `--` comment explaining why.
- **Enforcement**: Custom linter — regex over Go files: `#nosec G\d+(?!\s*--)` fails CI. ~10 lines of bash in a `make` target.

### 17. Repo list changes trigger a multi-asset checklist
- **Invariant**: Changing `frontend/src/lib/repos.ts` requires edits in several other files (MAINTAINERS.md lists them).
- **Enforcement**:
  - A Vitest test enforces `REPO_COUNT === REPOSITORIES.length` (already exists).
  - Opportunity: a CI check that fails if `repos.ts` changed in the diff but `api/og/index.tsx`, `sitemap.xml`, `README.md`, or `og-image.png` did not. Script is ~15 lines; catches the most common miss (forgotten OG image regeneration).

### 18. `gosec` annotations on the correct line
- **Invariant**: `#nosec G704` must sit on the flagged statement, not the function signature.
- **Enforcement**: `gosec` itself surfaces the original violation if the annotation is misplaced. Effectively self-enforcing; no extra tooling needed. Remove once the team is confident.

---

## Prioritization

If we tackle these in order, the first five catch most real incidents:

1. **#8 `go mod tidy` drift** — trivial, zero false positives.
2. **#16 `#nosec` comment requirement** — catches lazy suppressions.
3. **#4 + #5 + #6 CORS/bind/insecure WebSocket** — bundle into one `semgrep` config; these are security defaults.
4. **#11 `<img>` width/height** — low effort, prevents visible regressions.
5. **#17 repo-list diff check** — biggest win for release hygiene.

The remaining rules are good-to-have but involve custom lints (ESLint rule authorship) or `semgrep` patterns with more false-positive risk.
