import { describe, expect, it } from "vitest";
import {
	renderCheckHookCriticalConfigSyncScript,
	renderCheckStagedSecretsScript,
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

	it("renders the prek hook installer with repo-local cache patching", () => {
		const script = renderSetupGitHooksScript();

		expect(script).toContain("Installing prek git hooks");
		expect(script).toContain(
			'const GIT_DIR = resolve(process.cwd(), execFileSync("git", ["rev-parse", "--git-dir"]',
		);
		expect(script).toContain(
			'const PREK_HOME = process.env.PREK_HOME ?? resolve(GIT_DIR, ".cache/prek")',
		);
		expect(script).toContain('execFileSync("git", ["rev-parse", "--git-dir"]');
		expect(script).toContain('execFileSync("git", ["rev-parse", "--git-path", "hooks"]');
		expect(script).toContain("GIT_HOOKS_DIR");
		expect(script).toContain("mkdirSync(PREK_HOME, { recursive: true })");
		expect(script).toContain('execFileSync("prek", ["install", "--overwrite"]');
		expect(script).toContain("env: { ...process.env, PREK_HOME }");
		expect(script).toContain("patchInstalledPrekHooks");
		expect(script).toContain('PREK_HOME="${PREK_HOME:-$HERE/../.cache/prek}"');
		expect(script).toContain("make hooks-pre-commit");
		expect(script).toContain("make hooks-pre-push");
		expect(script).toContain("make hooks-commit-msg");
		expect(script).not.toContain("simple-git-hooks");
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
