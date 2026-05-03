/**
 * Git-hook governance scaffold template rendering for downstream repositories.
 *
 * This module owns hook installer and local hook helper scripts emitted by
 * `harness init`.
 *
 * @module lib/init/scaffold-hook-templates
 */

import { REQUIRED_PREK_HOOKS } from "../policy/tooling-baseline.js";

const PRE_COMMIT_MAKE_TARGET = REQUIRED_PREK_HOOKS["pre-commit"].entry;
const PRE_PUSH_MAKE_TARGET = REQUIRED_PREK_HOOKS["pre-push"].entry;

/**
 * Render the commit-message validation hook script.
 *
 * @param agentBranchPrefix - Branch prefix that requires Codex co-authorship.
 * @returns JavaScript contents for `scripts/validate-commit-msg.js`.
 */
export function renderValidateCommitMsgScript(
	agentBranchPrefix = "codex",
): string {
	return `#!/usr/bin/env node
/**
 * Commit message validation hook
 *
 * Validates commit messages follow governance requirements:
 * - Conventional commit format (feat|fix|chore|docs|refactor|test|style)
 * - Subject line <= 72 chars
 * - Blank line between subject and body/trailers
 * - Co-authored-by trailer on agent branches
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const COMMIT_MSG_FILE = process.argv[2];
const CONVENTIONAL_COMMIT_REGEX =
	/^(feat|fix|chore|docs|refactor|test|style|perf|ci|build|revert)(\\(.+\\))?!?:\\s.+/;
const CO_AUTHOR_LINE_REGEX = /^Co-authored-by:\\s*.+$/gim;
const CODEX_CO_AUTHOR_REGEX =
	/^Co-authored-by:\\s*Codex <noreply@openai\\.com>\\s*$/im;

function main() {
	if (!COMMIT_MSG_FILE) {
		console.error("Usage: validate-commit-msg.js <commit-msg-file>");
		process.exit(1);
	}

	let commitMsg;
	try {
		commitMsg = readFileSync(COMMIT_MSG_FILE, "utf-8");
	} catch (e) {
		console.error(\`Failed to read commit message file: \${e.message}\`);
		process.exit(1);
	}

	const errors = [];
	const lines = commitMsg
		.split(/\\r?\\n/)
		.filter((line) => !line.startsWith("#"));
	const firstLineIndex = lines.findIndex((line) => line.trim().length > 0);
	const firstLine = firstLineIndex >= 0 ? lines[firstLineIndex].trim() : "";

	// Check 1: Subject exists and follows conventional commit format
	if (!firstLine) {
		errors.push("Commit message subject is required");
	} else if (!CONVENTIONAL_COMMIT_REGEX.test(firstLine)) {
		errors.push(
			"Subject must follow conventional commit format: type(scope)!: description",
		);
	}

	// Check 2: Subject length
	if (firstLine && firstLine.length > 72) {
		errors.push(\`Subject exceeds 72 characters (\${firstLine.length} chars)\`);
	}

	// Check 3: Body/trailers must be separated by a blank line
	const hasAdditionalContent = lines
		.slice(Math.max(firstLineIndex + 1, 0))
		.some((line) => line.trim().length > 0);
	if (hasAdditionalContent && lines[firstLineIndex + 1]?.trim() !== "") {
		errors.push(
			"Add a blank line between the subject and the rest of the commit message",
		);
	}

	// Check 4: Co-authorship for agent branches (enforced)
	const coAuthorLines = commitMsg.match(CO_AUTHOR_LINE_REGEX) ?? [];
	const branchName = getBranchName();
	const isAgentBranch = /^(${agentBranchPrefix}|claude|agent)\\//i.test(branchName);

	if (isAgentBranch && coAuthorLines.length !== 1) {
		errors.push(
			"Agent branches require exactly one Co-authored-by trailer for auditability",
		);
	}
	if (isAgentBranch && !CODEX_CO_AUTHOR_REGEX.test(commitMsg)) {
		errors.push(
			"Agent branches must include: Co-authored-by: Codex <noreply@openai.com>",
		);
	}

	// Output results
	if (errors.length > 0) {
		console.error("\\n❌ Commit message validation failed:\\n");
		for (const error of errors) {
			console.error(\`  ✗ \${error}\`);
		}
		console.error(
			"\\nCommit message format example:\\n  feat(scope): add new feature\\n\\n  Why this change is needed and what it impacts.\\n\\n  Co-authored-by: Codex <noreply@openai.com>",
		);
		process.exit(1);
	}
	process.exit(0);
}

function getBranchName() {
	try {
		// Using execFileSync for safety - no shell interpolation
		const output = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		return output.trim();
	} catch {
		return "";
	}
}

main();
		`;
}

/**
 * Render the prek hook installer script.
 *
 * @returns JavaScript contents for `scripts/setup-git-hooks.js`.
 */
export function renderSetupGitHooksScript(): string {
	return `#!/usr/bin/env node
/**
 * Install prek-managed git hooks for this repository.
 *
 * Run from the repo root:
 *   node scripts/setup-git-hooks.js
 *
 * This script:
 *   1. Verifies prek.toml exists
 *   2. Verifies scripts/validate-commit-msg.js exists
 *   3. Runs \`prek install --overwrite\`
 *   4. Prints the canonical wrapper targets used by local governance
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const PREK_CONFIG_PATH = resolve(process.cwd(), "prek.toml");
const COMMIT_MSG_VALIDATOR_PATH = resolve(
	process.cwd(),
	"scripts/validate-commit-msg.js",
);
const PREK_HOOK_MARKER = "# File generated by prek: https://github.com/j178/prek";
const GIT_DIR = resolve(process.cwd(), execFileSync("git", ["rev-parse", "--git-dir"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
const PREK_HOME = process.env.PREK_HOME ?? resolve(GIT_DIR, ".cache/prek");
const PREK_HOOK_PATCH = [
	"# Keep prek cache/logs in repo-local .git to avoid home-dir sandbox write failures",
	'PREK_HOME="\${PREK_HOME:-$HERE/../.cache/prek}"',
	'mkdir -p "$PREK_HOME" 2>/dev/null || true',
	"export PREK_HOME",
	"",
].join("\\n");

function patchInstalledPrekHooks() {
	const hooksDir = resolve(GIT_DIR, "hooks");
	if (!existsSync(hooksDir)) {
		return 0;
	}

	let patchedCount = 0;
	for (const hookName of readdirSync(hooksDir)) {
		const hookPath = resolve(hooksDir, hookName);
		let hookContent = "";
		try {
			hookContent = readFileSync(hookPath, "utf8");
		} catch {
			continue;
		}

		if (!hookContent.includes(PREK_HOOK_MARKER)) {
			continue;
		}
		if (hookContent.includes('PREK_HOME="\${PREK_HOME:-$HERE/../.cache/prek}"')) {
			continue;
		}

		const patched = hookContent.replace(
			'fi\\n\\nexec "$PREK" hook-impl',
			\`fi\\n\\n\${PREK_HOOK_PATCH}exec "$PREK" hook-impl\`,
		);
		if (patched === hookContent) {
			continue;
		}

		writeFileSync(hookPath, patched);
		patchedCount += 1;
	}

	return patchedCount;
}

function main() {
	if (!existsSync(PREK_CONFIG_PATH)) {
		console.error("Error: prek.toml not found in current directory");
		console.error("  Run this script from your project root.");
		process.exit(1);
	}

	if (!existsSync(COMMIT_MSG_VALIDATOR_PATH)) {
		console.error(
			"Error: scripts/validate-commit-msg.js is required for commit message validation.",
		);
		process.exit(1);
	}

	try {
		console.info("Installing prek git hooks...");
		mkdirSync(PREK_HOME, { recursive: true });
		// Keep canonical hook shims and remove legacy migration wrappers.
		execFileSync("prek", ["install", "--overwrite"], { env: { ...process.env, PREK_HOME }, stdio: "inherit" });
		const patchedCount = patchInstalledPrekHooks();
		if (patchedCount > 0) {
			console.info(\`Patched \${patchedCount} prek hook shim(s) with repo-local PREK_HOME\`);
		}
		console.info("\\n✓ Git hooks installed and active!");
		console.info("\\nInstalled git-hook entrypoints:");
		console.info("  • pre-commit: ${PRE_COMMIT_MAKE_TARGET}");
		console.info("  • pre-push: ${PRE_PUSH_MAKE_TARGET}");
		console.info("\\nAvailable governance wrapper targets:");
		console.info("  • make hooks-pre-commit");
		console.info('  • make hooks-commit-msg HOOK_COMMIT_MSG="feat: example"');
		console.info("  • make hooks-pre-push");
	} catch (error) {
		console.error("\\n⚠️  Failed to run \`prek install --overwrite\`.");
		if (error instanceof Error && "message" in error && error.message) {
			console.error("   " + error.message);
		}
		console.error(
			"   Ensure 'prek' is installed and available on PATH, then rerun the script.",
		);
		process.exit(1);
	}
}

main();
`;
}

/**
 * Render the staged-secret scanner hook helper.
 *
 * @returns Shell contents for `scripts/check-staged-secrets.sh`.
 */
export function renderCheckStagedSecretsScript(): string {
	return `#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v gitleaks >/dev/null 2>&1; then
	echo "Error: required binary 'gitleaks' is not installed or not on PATH"
	exit 1
fi

if git diff --cached --quiet --exit-code; then
	echo "No staged changes detected for gitleaks."
	exit 0
fi

config_args=()
if [[ -f "$REPO_ROOT/.gitleaks.toml" ]]; then
	config_args+=(--config "$REPO_ROOT/.gitleaks.toml")
fi

gitleaks git \\
	--staged \\
	--redact \\
	--no-banner \\
	"\${config_args[@]}"
`;
}

/**
 * Render the hook critical-config drift guard.
 *
 * @returns Shell contents for `scripts/check-hook-critical-config-sync.sh`.
 */
export function renderCheckHookCriticalConfigSyncScript(): string {
	return `#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Guard critical hook/lint config from index/worktree drift. Hook runners may
# temporarily stash unstaged changes, which can make pre-commit evaluate an
# older staged config snapshot than the file currently shown in the worktree.
critical_files=("biome.json")
drift_files=()

	for config_path in "\${critical_files[@]}"; do
		if ! git ls-files --error-unmatch -- "$config_path" >/dev/null 2>&1; then
			continue
		fi

		index_blob="$(git rev-parse --verify ":\${config_path}" 2>/dev/null || true)"
		if [[ -n "$index_blob" && ! -e "$config_path" ]]; then
			drift_files+=("$config_path")
			continue
		fi
		if [[ ! -f "$config_path" ]]; then
			continue
		fi
		worktree_blob="$(git hash-object --path="$config_path" "$config_path" 2>/dev/null || true)"
		if [[ -n "$index_blob" && -n "$worktree_blob" && "$index_blob" != "$worktree_blob" ]]; then
			drift_files+=("$config_path")
		fi
	done

if [[ \${#drift_files[@]} -eq 0 ]]; then
	exit 0
fi

echo "Error: critical hook config differs between index and worktree:" >&2
for config_path in "\${drift_files[@]}"; do
	echo "  - $config_path" >&2
done
echo >&2
echo "Why this fails: pre-commit style runners stash unstaged changes, so hooks may read stale staged config." >&2
echo "Fix: stage or stash these files before committing, then retry." >&2
echo "Example: git add \${drift_files[*]}" >&2
exit 1
`;
}
