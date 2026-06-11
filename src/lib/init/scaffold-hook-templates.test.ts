// biome-ignore-all lint/suspicious/noTemplateCurlyInString: tests assert literal shell placeholders emitted into generated hooks.
import { describe, expect, it } from "vitest";
import {
	renderCheckHookCriticalConfigSyncScript,
	renderCheckStagedSecretsScript,
	renderPreCommitHookScript,
	renderPrePushHookScript,
	renderSetupGitHooksScript,
	renderValidateCommitMsgScript,
} from "./scaffold-hook-templates.js";

describe("git-hook scaffold templates", () => {
	it("renders commit-message validation policy", () => {
		const script = renderValidateCommitMsgScript("codex");

		expect(script).toContain("Usage: validate-commit-msg.js <commit-msg-file>");
		expect(script).toContain(
			"Agent branches require exactly one Co-authored-by trailer",
		);
		expect(script).toContain("Co-authored-by: Codex <noreply@openai.com>");
		expect(script).toContain("const isAgentBranch = /^(codex|claude|agent)");
	});

	it("renders the prek hook installer with worktree-local cache patching", () => {
		const script = renderSetupGitHooksScript();

		expect(script).toContain("Installing prek git hooks");
		expect(script).toContain("function getRepoRoot(): string");
		expect(script).toContain(
			'return execFileSync("git", ["rev-parse", "--show-toplevel"]',
		);
		expect(script).toContain(
			'return process.env.PREK_HOME ?? resolve(repoRoot, ".cache/prek")',
		);
		expect(script).toContain(
			'WORKTREE_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"',
		);
		expect(script).toContain(
			'execFileSync("git", ["rev-parse", "--git-path", "hooks"]',
		);
		expect(script).toContain("const gitHooksDir = getGitHooksDir()");
		expect(script).toContain("mkdirSync(PREK_HOME, { recursive: true })");
		expect(script).toContain(
			'execFileSync("bash", ["scripts/run-prek.sh", "install", "--overwrite"]',
		);
		expect(script).toContain("env: { ...process.env, PREK_HOME }");
		expect(script).toContain("patchInstalledPrekHooks");
		expect(script).toContain("LEGACY_PREK_HOOK_PATCH");
		expect(script).toContain('PREK_HOME="${PREK_HOME:-$HERE/../.cache/prek}"');
		expect(script).toContain(
			'PREK_HOME="${PREK_HOME:-$WORKTREE_ROOT/.cache/prek}"',
		);
		expect(script).toContain("bash scripts/hook-pre-commit.sh");
		expect(script).toContain("bash scripts/hook-pre-push.sh");
		expect(script).toContain("make hooks-commit-msg");
		expect(script).not.toContain("simple-git-hooks");
	});

	it("renders leaf hook adapters without nested hook orchestration", () => {
		const preCommit = renderPreCommitHookScript();
		const prePush = renderPrePushHookScript();

		expect(preCommit).toContain("check-hook-critical-config-sync.sh");
		expect(preCommit).toContain("bash ./scripts/validate-codestyle.sh --fast");
		expect(preCommit).toContain("make related-tests-staged");
		expect(preCommit.indexOf("make codestyle-parity")).toBeLessThan(
			preCommit.indexOf("bash ./scripts/validate-codestyle.sh --fast"),
		);
		expect(
			preCommit.indexOf("bash ./scripts/validate-codestyle.sh --fast"),
		).toBeLessThan(preCommit.indexOf("pnpm lint"));
		expect(
			preCommit.indexOf("bash ./scripts/validate-codestyle.sh --fast"),
		).toBeLessThan(preCommit.indexOf("pnpm typecheck"));
		expect(preCommit).toContain("package_script_exists()");
		expect(preCommit).toContain(
			"Skipping optional package script ${script_name}; package.json does not define it.",
		);
		expect(preCommit).toContain(
			'run_optional_package_script "quality:behavior-tests" pnpm quality:behavior-tests',
		);
		expect(preCommit).toContain(
			'run_optional_package_script "quality:git-env-sanitizer" pnpm quality:git-env-sanitizer',
		);
		expect(preCommit).toContain(
			'run_optional_package_script "harness:audit-tracking" pnpm harness:audit-tracking',
		);
		expect(preCommit).not.toContain("make hooks-pre-commit");
		expect(preCommit).not.toContain("pre-commit run");
		expect(prePush).toContain("check-validation-locks.sh");
		expect(prePush).toContain("run-harness-gate.sh tooling-audit");
		expect(prePush).toContain("HARNESS_PRE_PUSH_FULL_CODESTYLE");
		expect(prePush).not.toContain("make hooks-pre-push");
		expect(prePush).not.toContain("pre-commit run");
	});

	it("renders leaf hook package-script commands for the selected package manager", () => {
		const preCommit = renderPreCommitHookScript("npm");
		const prePush = renderPrePushHookScript("npm");

		expect(preCommit).toContain("npm run lint");
		expect(preCommit).toContain("npm run docs:lint");
		expect(preCommit).toContain("npm run quality:docstrings");
		expect(preCommit).toContain(
			'run_optional_package_script "quality:behavior-tests" npm run quality:behavior-tests',
		);
		expect(preCommit).not.toContain("pnpm lint");
		expect(prePush).toContain("npm run build");
		expect(prePush).not.toContain("pnpm build");
	});

	it("renders staged secret scanning with gitleaks", () => {
		const script = renderCheckStagedSecretsScript();

		expect(script).toContain("gitleaks git");
		expect(script).toContain("--staged");
		expect(script).toContain("--redact");
		expect(script).toContain("No staged changes detected for gitleaks.");
	});

	it("renders the hook critical-config drift guard", () => {
		const script = renderCheckHookCriticalConfigSyncScript();

		expect(script).toContain('critical_files=("biome.json")');
		expect(script).toContain('git rev-parse --verify ":${config_path}"');
		expect(script).toContain(
			'git hash-object --path="$config_path" "$config_path"',
		);
		expect(script).toContain("pre-commit style runners stash unstaged changes");
	});
});
