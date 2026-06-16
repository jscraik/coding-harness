// biome-ignore-all lint/suspicious/noTemplateCurlyInString: tests assert literal shell placeholders emitted into generated scripts.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderCheckEnvironmentScript } from "./scaffold-environment-templates.js";

function expectBashSyntax(name: string, script: string): void {
	const tempDir = mkdtempSync(join(tmpdir(), "scaffold-environment-template-"));
	const scriptPath = join(tempDir, name);
	writeFileSync(scriptPath, script);
	try {
		const result = spawnSync("bash", ["-n", scriptPath], { encoding: "utf8" });
		expect(result.status, result.stderr || result.stdout).toBe(0);
	} finally {
		rmSync(tempDir, { force: true, recursive: true });
	}
}

describe("scaffold environment templates", () => {
	it("renders the strict local environment preflight script", () => {
		const script = renderCheckEnvironmentScript();

		expect(script).toMatch(/^#!\/usr\/bin\/env bash/);
		expect(script).toContain("set -euo pipefail");
		expect(script).toContain(
			'CONTRACT_PATH="$REPO_ROOT/harness.contract.json"',
		);
		expect(script).toContain('MISE_PATH="$REPO_ROOT/.mise.toml"');
		expect(script).toContain(
			'CODEX_ENVIRONMENT_PATH="$REPO_ROOT/.codex/environments/environment.toml"',
		);
		expect(script).toContain("required_project_brain_paths=(");
		expect(script).toContain("prepend_standard_tool_paths()");
		expect(script).toContain("CHECK_ENVIRONMENT_REEXECED");
		expect(script).toContain('"/opt/homebrew/bin"');
		expect(script).toContain('"/usr/sbin"');
		expect(script).toContain("required_mise_tools=(");
		expect(script).toContain("required_prek_hooks=(");
		expect(script).toContain("required_package_scripts=(");
		expect(script).toContain("run_check_environment_with_runner()");
		expect(script).toContain('if [[ -f "$PACKAGE_JSON_PATH" ]]; then');
		expect(script).toContain("Fix: run harness init --update");
		expect(script).toContain("Fix: pnpm add -D $pkg");
		expect(script).toContain(
			"repo source CLI (mise exec -- node --import tsx src/cli.ts)",
		);
		expect(script).toContain(
			'mise --cd "$REPO_ROOT" exec -- node --import tsx "$REPO_ROOT/src/cli.ts"',
		);
		expect(script).toContain(
			'installed_hooks_dir="$(git -C "$REPO_ROOT" rev-parse --git-path hooks 2>/dev/null || true)"',
		);
		expect(script).toContain('MISE_TRUST_REPO_PATH="$REPO_ROOT"');
		expect(script).toContain(
			'rg --fixed-strings --line-regexp --quiet "$MISE_TRUST_REPO_PATH: trusted"',
		);
		expect(script).not.toContain("MISE_TRUST_LINE_COUNT");
		expect(script).toContain(
			"for hook_name in pre-commit pre-push commit-msg; do",
		);
		expect(script).toContain("/^\\[\\[repos\\.hooks\\]\\]/");
		expect(script).toContain("missing worktree-local PREK_HOME patch");
		expect(script).toContain(
			'WORKTREE_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"',
		);
		expect(script).toContain(
			'PREK_HOME="${PREK_HOME:-$WORKTREE_ROOT/.cache/prek}"',
		);
		expect(script).toContain(
			"printf 'Fix: ensure the session activates mise first",
		);
	});

	it("preserves runner fallback order from repo wrapper to global harness", () => {
		const script = renderCheckEnvironmentScript();

		const wrapperIndex = script.indexOf("repo wrapper");
		const sourceIndex = script.indexOf(
			"repo source CLI (mise exec -- node --import tsx src/cli.ts)",
		);
		const distIndex = script.indexOf("repo dist CLI");
		const miseIndex = script.indexOf("mise harness");
		const globalIndex = script.indexOf("global npm harness");

		expect(wrapperIndex).toBeGreaterThan(-1);
		expect(sourceIndex).toBeGreaterThan(-1);
		expect(sourceIndex).toBeGreaterThan(wrapperIndex);
		expect(distIndex).toBeGreaterThan(sourceIndex);
		expect(miseIndex).toBeGreaterThan(distIndex);
		expect(globalIndex).toBeGreaterThan(miseIndex);
	});

	it("renders a check-environment script with valid Bash syntax", () => {
		expectBashSyntax("check-environment.sh", renderCheckEnvironmentScript());
	});
});
