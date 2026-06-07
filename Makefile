# Harness Development Makefile
# Run `make help` to see available commands

.PHONY: all help install setup preflight worktree-ready verify-work codestyle-parity codestyle hooks hooks-pre-commit hooks-pre-push hooks-commit-msg validation-locks secrets-staged docs-style-changed related-tests related-tests-staged semgrep-changed diagrams-check dev build lint docs-lint fmt typecheck test check audit secrets security clean reset ci diagrams env-check

# Default target
all: help ## Default aggregate target

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# === Setup ===

install: ## Install dependencies
	pnpm install

setup: install hooks ## Full setup: install deps and configure git hooks

preflight: ## Run repository preflight checks (required local-memory gate by default)
	@bash ./scripts/codex-preflight.sh

worktree-ready: ## Bootstrap a fresh git worktree before first push
	@bash ./scripts/prepare-worktree.sh

verify-work: ## Run canonical repo-local verification wrapper
	@bash ./scripts/verify-work.sh

codestyle-parity: ## Verify CODESTYLE pack parity checksums
	@bash ./scripts/check-codestyle-parity.sh

codestyle: ## Run fail-closed codestyle validation
	@bash ./scripts/validate-codestyle.sh

hooks: ## Setup git hooks
	node scripts/setup-git-hooks.js

hooks-pre-commit: ## Run local pre-commit gates before creating a commit
	@bash ./scripts/check-hook-critical-config-sync.sh
	$(MAKE) codestyle-parity
	pnpm lint
	pnpm docs:lint
	pnpm typecheck
	pnpm run quality:docstrings
	pnpm run quality:size
	pnpm run quality:behavior-tests
	pnpm run quality:git-env-sanitizer
	pnpm run harness:audit-tracking
	$(MAKE) secrets-staged
	$(MAKE) docs-style-changed
	$(MAKE) related-tests-staged

hooks-pre-push: ## Run local pre-push governance gates before pushing
	$(MAKE) validation-locks
	@if base_ref="$$(git merge-base HEAD '@{upstream}' 2>/dev/null || git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || true)" && \
		[ -n "$$base_ref" ] && \
		changed_files="$$(git diff --name-only --diff-filter=ACMRDT "$$base_ref"...HEAD --)" && \
		[ -n "$$changed_files" ] && \
		! printf '%s\n' "$$changed_files" | grep -v '^\.codex/environments/environment\.toml$$' >/dev/null; then \
		echo "Environment-only push detected; running check-environment only."; \
		bash ./scripts/check-environment.sh; \
		exit 0; \
	fi
	pnpm exec tsx src/cli.ts docs-gate --mode required --json
	@tmp_changed_files="$$(mktemp)"; \
	trap 'rm -f "$$tmp_changed_files"' EXIT; \
	base_ref="$$(git merge-base HEAD '@{upstream}' 2>/dev/null || git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || true)"; \
	if [ -n "$$base_ref" ]; then \
		git diff --name-only --diff-filter=ACMRDT "$$base_ref"...HEAD -- > "$$tmp_changed_files"; \
	fi; \
	if [ -s "$$tmp_changed_files" ]; then \
		bash ./scripts/check-diagram-freshness.sh --changed-files "$$tmp_changed_files"; \
	else \
		bash ./scripts/check-diagram-freshness.sh --changed-files "$$tmp_changed_files"; \
	fi
	pnpm exec tsx src/cli.ts tooling-audit --path . --json
	@bash ./scripts/check-environment.sh
	$(MAKE) semgrep-changed
	$(MAKE) codestyle
	pnpm build

validation-locks: ## Fail fast when a validation lane is already running
	@bash ./scripts/check-validation-locks.sh

hooks-commit-msg: ## Validate commit message policy (use HOOK_COMMIT_MSG or MSG_FILE=/path)
	@tmp_file="$$(mktemp)"; \
	trap 'rm -f "$$tmp_file"' EXIT; \
	if [ -n "$${HOOK_COMMIT_MSG:-}" ]; then \
		printf '%s\n' "$${HOOK_COMMIT_MSG}" > "$$tmp_file"; \
	elif [ -n "$${MSG_FILE:-}" ]; then \
		cat "$${MSG_FILE}" > "$$tmp_file"; \
	else \
		echo 'Usage: HOOK_COMMIT_MSG="feat: test" make hooks-commit-msg or make hooks-commit-msg MSG_FILE=/path/to/commit-msg' >&2; \
		exit 2; \
	fi; \
	node scripts/validate-commit-msg.js "$$tmp_file"

secrets-staged: ## Scan staged content for secrets before committing
	pnpm run secrets:staged

docs-style-changed: ## Run Vale on staged authoritative docs only
	pnpm run docs:style:changed

related-tests: ## Run Vitest related mode for changed src implementation files
	pnpm run test:related

related-tests-staged: ## Run Vitest related mode for staged src implementation files
	bash scripts/check-related-tests.sh --staged

semgrep-changed: ## Run narrow Semgrep rules against changed src implementation files
	pnpm run semgrep:changed

diagrams-check: ## Refresh architecture diagrams when sensitive paths change and fail on drift
	@bash ./scripts/check-diagram-freshness.sh

# === Development ===

dev: ## Start development server
	pnpm dev

build: ## Build for production
	pnpm build

# === Quality ===

lint: ## Run linter
	pnpm lint

docs-lint: ## Lint markdown/docs
	pnpm docs:lint

fmt: ## Format code
	pnpm fmt

typecheck: ## Run TypeScript type checking
	pnpm typecheck

test: ## Run tests
	pnpm test

check: ## Run all required quality gates
	pnpm check

# === Security ===

audit: ## Run security audit
	pnpm audit

secrets: ## Scan for secrets with gitleaks
	@gitleaks detect --source . --verbose || (echo "Install gitleaks: brew install gitleaks" && exit 1)

security: audit secrets ## Run all security checks

# === Maintenance ===

clean: ## Clean build artifacts and caches
	rm -rf dist coverage artifacts .test-traces* .traces
	rm -rf node_modules/.cache

reset: clean ## Full reset: clean and reinstall
	pnpm install

# === CI ===

ci: ## Run CI-equivalent local checks
	pnpm check

# === Diagrams ===

diagrams: ## Generate architecture diagrams
	@bash ./scripts/refresh-diagram-context.sh --force

# === Environment ===

env-check: ## Check environment policy envelope
	@bash ./scripts/check-environment.sh
