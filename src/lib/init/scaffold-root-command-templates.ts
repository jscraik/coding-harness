/**
 * Root command templates and package-manager command helpers for harness init.
 *
 * This module owns scaffolded root command surfaces that are reused across
 * generated docs, workflows, and hook scripts.
 *
 * @module lib/init/scaffold-root-command-templates
 */

import { renderInstallCommand } from "./scaffold-shell-templates.js";

/** Default agent branch prefix emitted into generated governance files. */
export const AGENT_BRANCH_PREFIX = "codex";

/**
 * Build the shell command to invoke a package script using the given package manager.
 *
 * @param packageManager - Package manager identifier; when `"npm"` the returned command uses `npm run`.
 * @param script - The script name to execute as defined in `package.json`.
 * @returns The shell command string that runs the specified script.
 */
export function renderScriptCommand(
	packageManager: string,
	script: string,
): string {
	if (packageManager === "npm") {
		return `npm run ${script}`;
	}
	return `${packageManager} ${script}`;
}

/**
 * Construct a package-manager-specific install command used during workflow bootstrap.
 *
 * @param packageManager - Package manager identifier.
 * @returns The install command string for the selected package manager.
 */
export function renderWorkflowBootstrapInstallCommand(
	packageManager: string,
): string {
	if (packageManager === "npm") {
		return "npm ci";
	}
	return `${renderInstallCommand(packageManager)} --frozen-lockfile`;
}

/**
 * Render the jq-based memory validation command embedded in generated CI surfaces.
 *
 * @returns Shell command that validates scaffolded memory.json shape.
 */
export function renderMemoryValidateCommand(): string {
	return `test -f memory.json && jq -e '.meta.version == "1.0" and (.preamble.bootstrap | type == "boolean") and (.preamble.search | type == "boolean") and (.entries | type == "array")' memory.json >/dev/null`;
}

/**
 * Produce the repository-level `.npmrc` contents used by generated projects.
 *
 * @returns The `.npmrc` file contents to write into the scaffolded repository.
 */
export function renderDefaultNpmrc(): string {
	return `@brainwav:registry=https://registry.npmjs.org/
ignore-scripts=true
strict-peer-dependencies=false
auto-install-peers=false
shamefully-hoist=false
# Keep pnpm's isolated linker default; enable hoisted linker only for legacy-compat repos.
# node-linker=hoisted

# Auth should come from user-level ~/.npmrc or CI-injected ~/.npmrc, not this repo.
# Do not add //registry.npmjs.org/:_authToken=... here, because it can override
# a valid npm login and break local installs.
`;
}

const MAKEFILE_TEMPLATE = `# Harness Development Makefile
# Run \`make help\` to see available commands

.PHONY: help install setup preflight worktree-ready verify-work codestyle-parity codestyle hooks hooks-pre-commit hooks-pre-push hooks-commit-msg secrets-staged docs-style-changed related-tests semgrep-changed diagrams-check dev build lint docs-lint fmt typecheck test check audit secrets security clean reset ci diagrams env-check

# Default target
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\\n", $1, $2}' $(MAKEFILE_LIST)

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
	$(MAKE) secrets-staged
	$(MAKE) docs-style-changed
	$(MAKE) related-tests

hooks-pre-push: ## Run local pre-push governance gates before pushing
	pnpm exec tsx src/cli.ts docs-gate --mode required --json
	@bash ./scripts/check-diagram-freshness.sh
	pnpm exec tsx src/cli.ts tooling-audit --path . --json
	@bash ./scripts/check-environment.sh
	$(MAKE) semgrep-changed
	$(MAKE) codestyle
	pnpm build

hooks-commit-msg: ## Validate commit message policy (use HOOK_COMMIT_MSG or MSG_FILE=/path)
	@tmp_file="$(mktemp)"; \
	trap 'rm -f "$tmp_file"' EXIT; \
	if [ -n "$${"${"}HOOK_COMMIT_MSG:-}" ]; then \
		printf '%s\n' "$${"${"}HOOK_COMMIT_MSG}" > "$tmp_file"; \
	elif [ -n "$${"${"}MSG_FILE:-}" ]; then \
		cat "$${"${"}MSG_FILE}" > "$tmp_file"; \
	else \
		echo "Usage: HOOK_COMMIT_MSG=\"feat: test\" make hooks-commit-msg or make hooks-commit-msg MSG_FILE=/path/to/commit-msg" >&2; \
		exit 2; \
	fi; \
	node scripts/validate-commit-msg.js "$tmp_file"

secrets-staged: ## Scan staged content for secrets before committing
	pnpm run secrets:staged

docs-style-changed: ## Run Vale on staged authoritative docs only
	pnpm run docs:style:changed

related-tests: ## Run Vitest related mode for staged src implementation files
	pnpm run test:related

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
`;
/**
 * Render the root Makefile emitted by `harness init`.
 *
 * @returns The scaffolded Makefile contents.
 */
export function renderMakefileTemplate(): string {
	return MAKEFILE_TEMPLATE;
}
