// biome-ignore-all lint/suspicious/noTemplateCurlyInString: tests assert literal shell placeholders emitted into generated hooks.
import { spawnSync } from "node:child_process";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	renderCheckHookCriticalConfigSyncScript,
	renderCheckStagedSecretsScript,
	renderPreCommitHookScript,
	renderPrePushHookScript,
	renderRunPackageCommandScript,
	renderSetupGitHooksScript,
	renderValidateCommitMsgScript,
} from "./scaffold-hook-templates.js";

function expectScriptSyntax(
	name: string,
	script: string,
	checker: "bash" | "node",
): void {
	const tempDir = mkdtempSync(join(tmpdir(), "scaffold-hook-template-"));
	const scriptPath = join(tempDir, name);
	writeFileSync(scriptPath, script);
	try {
		const args =
			checker === "bash" ? ["-n", scriptPath] : ["--check", scriptPath];
		const result = spawnSync(checker, args, { encoding: "utf8" });
		expect(result.status, result.stderr || result.stdout).toBe(0);
	} finally {
		rmSync(tempDir, { force: true, recursive: true });
	}
}

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
		const pnpmLintCommand = "bash ./scripts/run-package-command.sh pnpm lint";
		const pnpmTypecheckCommand =
			"bash ./scripts/run-package-command.sh pnpm typecheck";

		expect(preCommit).toContain("check-hook-critical-config-sync.sh");
		expect(preCommit).toContain("bash ./scripts/validate-codestyle.sh --fast");
		expect(preCommit).toContain(
			"bash ./scripts/run-package-command.sh node -e",
		);
		expect(preCommit).toContain("make related-tests-staged");
		expect(preCommit.indexOf("make codestyle-parity")).toBeLessThan(
			preCommit.indexOf("bash ./scripts/validate-codestyle.sh --fast"),
		);
		expect(
			preCommit.indexOf("bash ./scripts/validate-codestyle.sh --fast"),
		).toBeLessThan(preCommit.indexOf(pnpmLintCommand));
		expect(
			preCommit.indexOf("bash ./scripts/validate-codestyle.sh --fast"),
		).toBeLessThan(preCommit.indexOf(pnpmTypecheckCommand));
		expect(preCommit).toContain("package_script_exists()");
		expect(preCommit).toContain(
			"Skipping optional package script ${script_name}; package.json does not define it.",
		);
		expect(preCommit).toContain(
			'run_optional_package_script "quality:behavior-tests" bash ./scripts/run-package-command.sh pnpm quality:behavior-tests',
		);
		expect(preCommit).toContain(
			'run_optional_package_script "quality:git-env-sanitizer" bash ./scripts/run-package-command.sh pnpm quality:git-env-sanitizer',
		);
		expect(preCommit).toContain(
			'run_optional_package_script "harness:audit-tracking" bash ./scripts/run-package-command.sh pnpm harness:audit-tracking',
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

		expect(preCommit).toContain("bash ./scripts/validate-codestyle.sh --fast");
		expect(preCommit).toContain("npm run lint");
		expect(preCommit).toContain("npm run docs:lint");
		expect(preCommit).toContain("npm run quality:docstrings");
		expect(preCommit).toContain(
			'run_optional_package_script "quality:behavior-tests" bash ./scripts/run-package-command.sh npm run quality:behavior-tests',
		);
		expect(preCommit).not.toContain("pnpm lint");
		expect(prePush).toContain("npm run build");
		expect(prePush).not.toContain("pnpm build");
	});

	it("renders yarn hook package-script commands without pnpm fallbacks", () => {
		const preCommit = renderPreCommitHookScript("yarn");
		const prePush = renderPrePushHookScript("yarn");

		expect(preCommit).toContain("bash ./scripts/validate-codestyle.sh --fast");
		expect(preCommit).toContain("yarn lint");
		expect(preCommit).toContain("yarn docs:lint");
		expect(preCommit).toContain("yarn quality:docstrings");
		expect(preCommit).toContain(
			'run_optional_package_script "quality:behavior-tests" bash ./scripts/run-package-command.sh yarn quality:behavior-tests',
		);
		expect(preCommit).not.toContain("pnpm lint");
		expect(preCommit).not.toContain("npm run lint");
		expect(prePush).toContain("yarn build");
		expect(prePush).not.toContain("pnpm build");
		expect(prePush).not.toContain("npm run build");
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

	it("renders the mise-aware package-command wrapper", () => {
		const script = renderRunPackageCommandScript();

		expect(script).toContain(
			"Usage: bash scripts/run-package-command.sh <command> [args...]",
		);
		expect(script).toContain(
			'mise_tool_is_managed "$command_name" || return 0',
		);
		expect(script).toContain('mise --cd "$repo_root" which node');
		expect(script).toContain('mise --cd "$repo_root" which "$command_name"');
		expect(script).toContain(
			"Error: .mise.toml is present but mise is not installed or not on PATH",
		);
		expect(script).toContain(
			"Error: mise could not resolve pinned tool '$command_name' from .mise.toml",
		);
		expect(script).not.toContain("which node 2>/dev/null || true");
		expect(script).not.toContain('which "$command_name" 2>/dev/null || true');
		expect(script).toContain('exec "$command_name" "$@"');
	});

	it("lets unpinned yarn commands use PATH in generated package wrapper", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "scaffold-yarn-wrapper-"));
		const scriptsDir = join(tempDir, "scripts");
		const fakeBin = join(tempDir, "bin");
		mkdirSync(scriptsDir);
		mkdirSync(fakeBin);
		writeFileSync(join(tempDir, ".mise.toml"), '[tools]\nnode = "26.3.0"\n');
		writeFileSync(
			join(scriptsDir, "run-package-command.sh"),
			renderRunPackageCommandScript(),
			{ mode: 0o755 },
		);
		writeFileSync(
			join(fakeBin, "mise"),
			"#!/usr/bin/env bash\necho mise should not run >&2\nexit 99\n",
			{ mode: 0o755 },
		);
		writeFileSync(
			join(fakeBin, "yarn"),
			"#!/usr/bin/env bash\nprintf 'yarn:%s\\n' \"$*\"\n",
			{ mode: 0o755 },
		);
		chmodSync(join(fakeBin, "mise"), 0o755);
		chmodSync(join(fakeBin, "yarn"), 0o755);

		try {
			const result = spawnSync(
				"bash",
				["scripts/run-package-command.sh", "yarn", "lint"],
				{
					cwd: tempDir,
					encoding: "utf8",
					env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH ?? ""}` },
				},
			);
			expect(result.status, result.stderr || result.stdout).toBe(0);
			expect(result.stdout.trim()).toBe("yarn:lint");
			expect(result.stderr).not.toContain("mise should not run");
		} finally {
			rmSync(tempDir, { force: true, recursive: true });
		}
	});

	it("renders shell hook templates with valid Bash syntax", () => {
		const shellTemplates = [
			["hook-pre-commit.sh", renderPreCommitHookScript()],
			["hook-pre-push.sh", renderPrePushHookScript()],
			["run-package-command.sh", renderRunPackageCommandScript()],
			["check-staged-secrets.sh", renderCheckStagedSecretsScript()],
			[
				"check-hook-critical-config-sync.sh",
				renderCheckHookCriticalConfigSyncScript(),
			],
		] as const;

		for (const [name, script] of shellTemplates) {
			expectScriptSyntax(name, script, "bash");
		}
	});

	it("renders JavaScript hook templates with valid Node syntax", () => {
		const nodeTemplates = [
			["setup-git-hooks.js", renderSetupGitHooksScript()],
			["validate-commit-msg.js", renderValidateCommitMsgScript()],
		] as const;

		for (const [name, script] of nodeTemplates) {
			expectScriptSyntax(name, script, "node");
		}
	});
});
