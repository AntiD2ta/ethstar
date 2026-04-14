.PHONY: help install dev kill-server dev-go dev-frontend build build-frontend build-go run test test-go test-go-race test-integration test-unit test-unit-watch test-unit-coverage test-e2e test-e2e-ui test-e2e-headed test-e2e-codegen test-e2e-report lint lint-go lint-frontend typecheck check security gofix gate typegen add-component clean nuke

# ─── Default ──────────────────────────────────────────────────

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Setup ────────────────────────────────────────────────────

install: ## Install all dependencies (Go + npm + Playwright)
	go mod download
	npm install
	cd frontend && npm install
	cd frontend && npx playwright install chromium

# ─── Development ──────────────────────────────────────────────

dev: ## Show instructions for running dev servers
	@echo ""
	@echo "  Start two terminals:"
	@echo ""
	@echo "    Terminal 1:  make dev-go        (Go API on :8080)"
	@echo "    Terminal 2:  make dev-frontend   (Vite on :5173, proxies /api → :8080)"
	@echo ""
	@echo "  Then visit http://localhost:5173"
	@echo ""

kill-server: ## Kill any process listening on :8080
	@lsof -ti :8080 | xargs kill -9 2>/dev/null && echo "Killed server on :8080" || echo "No server running on :8080"

dev-go: ## Start Go backend server
	go run ./cmd/server

dev-frontend: ## Start Vite dev server (with API proxy to Go)
	cd frontend && npm run dev

# ─── Build ────────────────────────────────────────────────────

build: build-frontend build-go ## Build everything (frontend + Go binary)

build-frontend: ## Build frontend → web/static/
	cd frontend && npm run build

build-go: ## Build Go binary with embedded frontend
	go build -o bin/server ./cmd/server

# ─── Code Generation ─────────────────────────────────────────

typegen: ## Generate TypeScript types from Go structs
	@mkdir -p frontend/src/shared/schemas
	go run ./cmd/typegen

# ─── Run ──────────────────────────────────────────────────────

run: build ## Build and run the production binary
	./bin/server

# ─── Testing ──────────────────────────────────────────────────

test: test-go test-integration test-unit test-e2e ## Run all tests (Go + integration + unit + E2E)

test-go: ## Run Go tests (uses gosilent for compact output)
	@if command -v gosilent >/dev/null 2>&1; then \
		gosilent test $$(go list ./... | grep -v -e frontend -e '/api/'); \
	else \
		go test $$(go list ./... | grep -v -e frontend -e '/api/'); \
	fi

test-go-race: ## Run Go tests with race detector
	@if command -v gosilent >/dev/null 2>&1; then \
		gosilent test -race $$(go list ./... | grep -v -e frontend -e '/api/'); \
	else \
		go test -race $$(go list ./... | grep -v -e frontend -e '/api/'); \
	fi

test-integration: ## Run API integration tests (real DB, mock externals)
	@if command -v gosilent >/dev/null 2>&1; then \
		gosilent test -tags=integration ./internal/integration/...; \
	else \
		go test -tags=integration ./internal/integration/...; \
	fi

test-unit: ## Run frontend Vitest unit + integration tests
	cd frontend && npm run test:unit

test-unit-watch: ## Vitest in watch mode
	cd frontend && npm run test:unit:watch

test-unit-coverage: ## Vitest with v8 coverage report
	cd frontend && npm run test:unit:coverage

test-e2e: ## Run Playwright E2E tests (headless)
	cd frontend && npx playwright test

test-e2e-ui: ## Open Playwright interactive test UI
	cd frontend && npx playwright test --ui

test-e2e-headed: ## Run Playwright tests in visible browser
	cd frontend && npx playwright test --headed

test-e2e-codegen: ## Record E2E tests interactively
	cd frontend && npx playwright codegen http://localhost:5173

test-e2e-report: ## Show last Playwright test report
	cd frontend && npx playwright show-report

# ─── Code Quality ─────────────────────────────────────────────

lint: lint-go lint-frontend ## Run all linters

lint-go: ## Run golangci-lint on all Go packages
	@if command -v golangci-lint >/dev/null 2>&1; then \
		golangci-lint run ./...; \
	else \
		echo "golangci-lint not found, falling back to go vet"; \
		go vet $$(go list ./... | grep -v -e frontend -e '/api/'); \
	fi

lint-frontend: ## Run ESLint on frontend
	cd frontend && npm run lint

typecheck: ## Run TypeScript type checking
	cd frontend && npm run typecheck

security: ## Run gosec security scanner on Go code
	gosec -exclude-dir=frontend -exclude-dir=.claude -exclude-dir=api -quiet ./...

gofix: ## Run go fix to modernize Go code
	go fix $$(go list ./... | grep -v -e frontend -e '/api/')

check: lint typecheck security ## Run all static checks (lint + typecheck + security)

gate: check test-go-race test-unit build-go ## Full pre-merge gate (static checks + tests with race detector + unit tests + build)

# ─── shadcn/ui ────────────────────────────────────────────────

add-component: ## Add a shadcn/ui component (usage: make add-component NAME=dialog)
	cd frontend && npx shadcn@latest add $(NAME) -y

# ─── Cleanup ──────────────────────────────────────────────────

clean: ## Remove build artifacts
	rm -rf bin/ frontend/test-results frontend/playwright-report
	find web/static -not -name '.gitkeep' -not -path web/static -delete 2>/dev/null || true

nuke: clean ## Full clean: remove node_modules and all artifacts
	rm -rf frontend/node_modules
	@echo "Run 'make install' to reinstall dependencies"
