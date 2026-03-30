- Read @CLAUDE.md — contains accumulated learnings, pitfalls, and project instructions. This is critical context to avoid repeating mistakes.
- Read @DNA.md — architectural blueprint, conventions, and quality gates.
- Read @SPEC.md — project specification and design decisions.
- Pick the most important incompleted phase from @TASKS.md, built it, commit the changes and exit.
- While building a phase, check if the phase is marked as planned in @TASKS.md. If it is, mark it as in progress and proceed with the implementation. If it is not, enter in plan mode, replace the phase's document with the new plan and ask me to approve it. After approval, mark the phase as in progress and finish the session.
- ULTRATHINK

IMPORTANT:
- Load the /go-tdd skill before writing any Go code
- **Strict TDD**: Write failing test first, watch it fail, write minimal code to pass, verify green, refactor. Exception: mechanical refactoring where existing tests are the validation.
- Use the /review-local skill to review your work after completing all tasks. Then address any issues from the review and repeat the review process until all issues have been addressed or the user decides to ignore some issues.
- Log any issues you don't fix found during the review. Find the best place to report them as items of work (by default a @TASKS.md document at the project root).
- DO NOT MAKE ASSUMPTIONS. Ask me questions about anything that is not crystal clear.
- DO NOT COMMIT FRONTEND CHANGES WITHOUT VALIDATING THEM. Look at the Frontend Validation section below for more details.
- Use Serena, and Sequential Thinking tools if necessary.

## Self-Improving Pipeline

After completing work in each session:
1. **Update the tasks document**: Open the specific tasks document (e.g., `TASKS.md`) and mark completed items with `[x]`. Any items NOT completed must remain as `[ ]` so the next session knows exactly what's left. If you discover new work items during the session, add them as unchecked `[ ]` items.
2. **Log learnings**: Append any new insights, pitfalls, or workarounds discovered during the session to @CLAUDE.md under the appropriate category in the "Learnings & Pitfalls" section.
3. **Update architecture docs if impacted**: If your changes affect DNA.md or GUIDELINES.md, update them to reflect the current state.
4. These updates ensure the next agent session starts with full context and avoids repeating mistakes.

## Context-Efficient Test Runner

Use `gosilent` (a Go test output formatter) instead of `go test` for all Go test runs. It wraps `go test -json` and collapses passing packages into a single summary line, expanding only failures with full details. This reduces test output by ~358x, critical for keeping agent context windows clean.

```bash
# Instead of:  go test ./...
gosilent test ./...

# With flags:  gosilent test -race -count=1 ./...
# Detailed:    gosilent test --detail ./...
# Raw output:  gosilent test --verbose ./...
```

The Makefile `test-go` target uses `gosilent`. If `gosilent` is not installed, fall back to `go test`.

## API Validation

When a task involves API changes (new endpoints, modified request/response shapes, new filters, etc.), you MUST validate them through the integration test suite before considering the task complete:

1. **Run integration tests**: `gosilent test -tags=integration ./internal/integration/...`
   - These tests use `httptest.NewServer` with real SQLite stores (in-memory) and a mock external client.
   - They cover all API endpoints with real HTTP requests through the full middleware stack.
   - If you add a new endpoint, add corresponding integration tests in `internal/integration/`.

2. **For frontend-visible changes**, also validate with browser automation and E2E tests (see Frontend Validation below).

3. **For API contract changes** (new fields, changed status codes, modified error shapes):
   - Update integration tests to assert the new contract.
   - Update E2E tests if the frontend depends on the changed API shape.
   - Run `make test` to verify both Go and E2E tests pass.

## Frontend Validation

When a task involves frontend changes (new components, layout fixes, styling, routing, etc.), you MUST validate them in a real browser session before considering the task complete:

1. **Start both dev servers** (if not already running):
   - Terminal 1: `make dev-go` (Go API on :8080)
   - Terminal 2: `make dev-frontend` (Vite on :5173)
   - Verify both are responding before proceeding.

2. **Open the app in Chrome** using the browser automation tools (`mcp__claude-in-chrome__*`):
   - Call `tabs_context_mcp` first, then `tabs_create_mcp` + `navigate` to `http://localhost:5173`.
   - Walk through the user-facing workflow affected by your changes. Take screenshots at each step.
   - Verify visual correctness: no overflow, no layout breakage, no dead links, no blank pages.
   - Test interactive elements: clicks, form inputs, navigation, dialogs, scroll behavior.

3. **Write Playwright regression tests** for every bug fix or behavioral change:
   - Add tests to the appropriate file in `frontend/e2e/`.
   - Use `page.route()` to mock API responses when testing UI behavior independent of backend data.
   - Run `make test-e2e` to verify all E2E tests pass, not just the new ones.

4. **If you discover additional bugs** during browser validation, fix them and add regression tests before moving on.

## Quality Gates

All gates must pass before a phase is considered complete. Run `make check` to execute all static checks at once.

| Gate              | Command                 | What it checks                                                                  | Blocks |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------- | ------ |
| **Go lint**       | `make lint-go`          | `golangci-lint run` — runs linters (vet, staticcheck, errcheck, gosimple, etc.) | Merge  |
| **Go tests**      | `make test-go`          | All Go tests pass (via gosilent)                                                | Merge  |
| **Go race**       | `make test-go-race`     | Tests pass with `-race` detector                                                | Merge  |
| **Go security**   | `make security`         | `gosec` — OWASP-style vulnerability scan                                        | Merge  |
| **Integration**   | `make test-integration` | API integration tests with real DB                                              | Merge  |
| **Frontend lint** | `make lint-frontend`    | ESLint on all frontend code                                                     | Merge  |
| **TypeScript**    | `make typecheck`        | `tsc --noEmit` — no type errors                                                 | Merge  |
| **E2E tests**     | `make test-e2e`         | Playwright tests pass                                                           | Merge  |
| **Build**         | `make build`            | Frontend builds + Go binary compiles                                            | Merge  |

**Quick check** (pre-commit level): `make check` = lint + typecheck + security.
**Full check** (pre-merge level): `make gate` = checks + race detector + build.
