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
		expect(script).toContain("required_mise_tools=(");
		expect(script).toContain("required_prek_hooks=(");
		expect(script).toContain("required_package_scripts=(");
		expect(script).toContain("run_check_environment_with_runner()");
		expect(script).toContain('if [[ -f "$PACKAGE_JSON_PATH" ]]; then');
		expect(script).toContain("Fix: run harness init --update");
		expect(script).toContain("Fix: pnpm add -D $pkg");
		expect(script).toContain('pnpm --dir "$REPO_ROOT" exec tsx');
	});

	it("preserves runner fallback order from source checkout to global harness", () => {
		const script = renderCheckEnvironmentScript();

		const sourceIndex = script.indexOf("repo source CLI");
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
