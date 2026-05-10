// biome-ignore-all lint/suspicious/noTemplateCurlyInString: tests assert literal shell placeholders emitted into generated scripts.
import { describe, expect, it } from "vitest";
import { renderCheckEnvironmentScript } from "./scaffold-environment-templates.js";

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
			"repo source CLI (cd repo && node --import tsx src/cli.ts)",
		);
		expect(script).toContain(
			'bash -lc \'cd "$1" && shift && exec "$@"\' _ "$REPO_ROOT" node --import tsx src/cli.ts',
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
		expect(script).toContain("missing repo-local PREK_HOME patch");
		expect(script).toContain('PREK_HOME="${PREK_HOME:-$HERE/../.cache/prek}"');
		expect(script).toContain(
			"printf 'Fix: ensure the session activates mise first",
		);
	});

	it("preserves runner fallback order from source checkout to global harness", () => {
		const script = renderCheckEnvironmentScript();

		const sourceIndex = script.indexOf(
			"repo source CLI (cd repo && node --import tsx src/cli.ts)",
		);
		const distIndex = script.indexOf("repo dist CLI");
		const wrapperIndex = script.indexOf("repo wrapper");
		const miseIndex = script.indexOf("mise harness");
		const globalIndex = script.indexOf("global npm harness");

		expect(sourceIndex).toBeGreaterThan(-1);
		expect(wrapperIndex).toBeGreaterThan(sourceIndex);
		expect(distIndex).toBeGreaterThan(wrapperIndex);
		expect(miseIndex).toBeGreaterThan(distIndex);
		expect(globalIndex).toBeGreaterThan(miseIndex);
	});
});
