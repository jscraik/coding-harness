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
node-linker=isolated
shamefully-hoist=false
# Enable hoisted linker only for legacy-compat repos.
# node-linker=hoisted

# Auth should come from user-level ~/.npmrc or CI-injected ~/.npmrc, not this repo.
# Do not add registry auth-token entries here, because they can override
# a valid npm login and break local installs.
`;
}

type MakefileCommands = {
	audit: string;
	build: string;
	check: string;
	dev: string;
	docstrings: string;
	docsLint: string;
	docsStyleChanged: string;
	fmt: string;
	install: string;
	lint: string;
	relatedTests: string;
	secretsStaged: string;
	semgrepChanged: string;
	size: string;
	test: string;
	typecheck: string;
};

function buildMakefileCommands(packageManager: string): MakefileCommands {
	return {
		audit: renderScriptCommand(packageManager, "audit"),
		build: renderScriptCommand(packageManager, "build"),
		check: renderScriptCommand(packageManager, "check"),
		dev: renderScriptCommand(packageManager, "dev"),
		docstrings: renderScriptCommand(packageManager, "quality:docstrings"),
		docsLint: renderScriptCommand(packageManager, "docs:lint"),
		docsStyleChanged: renderScriptCommand(packageManager, "docs:style:changed"),
		fmt: renderScriptCommand(packageManager, "fmt"),
		install: renderInstallCommand(packageManager),
		lint: renderScriptCommand(packageManager, "lint"),
		relatedTests: renderScriptCommand(packageManager, "test:related"),
		secretsStaged: renderScriptCommand(packageManager, "secrets:staged"),
		semgrepChanged: renderScriptCommand(packageManager, "semgrep:changed"),
		size: renderScriptCommand(packageManager, "quality:size"),
		test: renderScriptCommand(packageManager, "test"),
		typecheck: renderScriptCommand(packageManager, "typecheck"),
	};
}

function renderMakefileHeader(): string {
	return `# Harness Development Makefile
# Run \`make help\` to see available commands

.PHONY: help install setup preflight worktree-ready verify-work codestyle-parity codestyle hooks hooks-pre-commit hooks-pre-push hooks-commit-msg secrets-staged docs-style-changed related-tests semgrep-changed diagrams-check dev build lint docs-lint fmt typecheck test check audit secrets security clean reset ci diagrams env-check

# Default target
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\\n", $1, $2}' $(MAKEFILE_LIST)
`;
}

/**
 * Render the "Setup" section of a Makefile, filling in provided command strings.
 *
 * @param commands - Object containing Makefile command strings; `commands.install` is inserted for the `install` target.
 * @returns The Makefile "Setup" section as a string with populated targets (install, setup, preflight, worktree-ready, verify-work, codestyle-parity, codestyle, hooks).
 */
function renderMakefileSetupSection(commands: MakefileCommands): string {
	return `
# === Setup ===

install: ## Install dependencies
	${commands.install}

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
`;
}

/**
 * Render the "Hooks" section of the repository Makefile containing pre-commit, pre-push,
 * commit-message, and related governance targets.
 *
 * Interpolates the provided Makefile command strings into the appropriate targets so the
 * generated section invokes linting, typechecking, docs checks, security scans, and other
 * pre-commit/pre-push workflows.
 *
 * @param commands - An object with command strings for Makefile targets (see MakefileCommands)
 * @returns The text content for the Makefile "Hooks" section
 */
function renderMakefileHookSection(commands: MakefileCommands): string {
	return `

hooks-pre-commit: ## Run local pre-commit gates before creating a commit
	@bash ./scripts/check-hook-critical-config-sync.sh
	$(MAKE) codestyle-parity
	@bash ./scripts/validate-codestyle.sh --fast
	${commands.lint}
	${commands.docsLint}
	${commands.typecheck}
	${commands.docstrings}
	${commands.size}
	$(MAKE) secrets-staged
	$(MAKE) docs-style-changed
	$(MAKE) related-tests

hooks-pre-push: ## Run local pre-push governance gates before pushing
	@if base_ref="$$(git merge-base HEAD '@{upstream}' 2>/dev/null || git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || true)" && \
		[ -n "$$base_ref" ] && \
		changed_files="$$(git diff --name-only --diff-filter=ACMR "$$base_ref"...HEAD --)" && \
		[ -n "$$changed_files" ] && \
		! printf '%s\\n' "$$changed_files" | grep -v '^\\.codex/environments/environment\\.toml$$' >/dev/null; then \
		echo "Environment-only push detected; running check-environment only."; \
		bash ./scripts/check-environment.sh; \
		exit 0; \
	fi
	@bash ./scripts/run-harness-gate.sh docs-gate --mode required --json
	@tmp_changed_files="$$(mktemp)"; \
	trap 'rm -f "$$tmp_changed_files"' EXIT; \
	base_ref="$$(git merge-base HEAD '@{upstream}' 2>/dev/null || git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || true)"; \
	if [ -n "$$base_ref" ]; then \
		git diff --name-only --diff-filter=ACMR "$$base_ref"...HEAD -- > "$$tmp_changed_files"; \
	fi; \
	if [ -s "$$tmp_changed_files" ]; then \
		bash ./scripts/check-diagram-freshness.sh --changed-files "$$tmp_changed_files"; \
	else \
		bash ./scripts/check-diagram-freshness.sh; \
	fi
	@bash ./scripts/run-harness-gate.sh tooling-audit --path . --json
	@bash ./scripts/check-environment.sh
	$(MAKE) semgrep-changed
	$(MAKE) codestyle
	${commands.build}

hooks-commit-msg: ## Validate commit message policy (use HOOK_COMMIT_MSG or MSG_FILE=/path)
	@tmp_file="$(mktemp)"; \
	trap 'rm -f "$tmp_file"' EXIT; \
	if [ -n "$${"${"}HOOK_COMMIT_MSG:-}" ]; then \
		printf '%s\n' "$${"${"}HOOK_COMMIT_MSG}" > "$tmp_file"; \
	elif [ -n "$${"${"}MSG_FILE:-}" ]; then \
		cat "$${"${"}MSG_FILE}" > "$tmp_file"; \
	else \
		echo 'Usage: HOOK_COMMIT_MSG="feat: test" make hooks-commit-msg or make hooks-commit-msg MSG_FILE=/path/to/commit-msg' >&2; \
		exit 2; \
	fi; \
	node scripts/validate-commit-msg.js "$tmp_file"

secrets-staged: ## Scan staged content for secrets before committing
	${commands.secretsStaged}

docs-style-changed: ## Run Vale on staged authoritative docs only
	${commands.docsStyleChanged}

related-tests: ## Run Vitest related mode for staged src implementation files
	${commands.relatedTests}

semgrep-changed: ## Run narrow Semgrep rules against changed src implementation files
	${commands.semgrepChanged}

diagrams-check: ## Refresh architecture diagrams when sensitive paths change and fail on drift
	@bash ./scripts/check-diagram-freshness.sh
`;
}

function renderMakefileDevelopmentSection(commands: MakefileCommands): string {
	return `
# === Development ===

dev: ## Start development server
	${commands.dev}

build: ## Build for production
	${commands.build}

# === Quality ===

lint: ## Run linter
	${commands.lint}

docs-lint: ## Lint markdown/docs
	${commands.docsLint}

fmt: ## Format code
	${commands.fmt}

typecheck: ## Run TypeScript type checking
	${commands.typecheck}

test: ## Run tests
	${commands.test}

check: ## Run all required quality gates
	${commands.check}

# === Security ===

audit: ## Run security audit
	${commands.audit}

secrets: ## Scan for secrets with gitleaks
	@gitleaks detect --source . --verbose || (echo "Install gitleaks: brew install gitleaks" && exit 1)

security: audit secrets ## Run all security checks
`;
}

function renderMakefileMaintenanceSection(commands: MakefileCommands): string {
	return `
# === Maintenance ===

clean: ## Clean build artifacts and caches
	rm -rf dist coverage artifacts .test-traces* .traces
	rm -rf node_modules/.cache

reset: clean ## Full reset: clean and reinstall
	${commands.install}

# === CI ===

ci: ## Run CI-equivalent local checks
	${commands.check}

# === Diagrams ===

diagrams: ## Generate architecture diagrams
	@bash ./scripts/refresh-diagram-context.sh --force

# === Environment ===

env-check: ## Check environment policy envelope
	@bash ./scripts/check-environment.sh
`;
}

function renderMakefileContent(packageManager: string): string {
	const commands = buildMakefileCommands(packageManager);
	return [
		renderMakefileHeader(),
		renderMakefileSetupSection(commands),
		renderMakefileHookSection(commands),
		renderMakefileDevelopmentSection(commands),
		renderMakefileMaintenanceSection(commands),
	].join("");
}

/**
 * Render the root Makefile emitted by `harness init`.
 *
 * @param packageManager - Package manager used by generated script targets.
 * @returns The scaffolded Makefile contents.
 */
export function renderMakefileTemplate(packageManager = "pnpm"): string {
	return renderMakefileContent(packageManager);
}
