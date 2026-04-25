import { describe, expect, it } from "vitest";
import {
	renderAddPackageCommand,
	renderCodexEnforcedTemplate,
	renderCodexLearnTemplate,
	renderCodexPreflightLegacyLocalMemoryTemplate,
	renderCodexPreflightTemplate,
	renderHarnessCliWrapper,
	renderHarnessGateRunner,
	renderInstallCommand,
	renderLocalHarnessExecCommand,
	renderVerifyWorkScript,
} from "./scaffold-shell-templates.js";

describe("scaffold shell templates", () => {
	it("renders package-manager-specific helper commands", () => {
		expect(renderInstallCommand("pnpm")).toBe("pnpm install");
		expect(renderAddPackageCommand("pnpm", "@brainwav/coding-harness")).toBe(
			"pnpm add -D @brainwav/coding-harness",
		);
		expect(renderAddPackageCommand("npm", "@brainwav/coding-harness")).toBe(
			"npm install --save-dev @brainwav/coding-harness",
		);
		expect(renderAddPackageCommand("yarn", "@brainwav/coding-harness")).toBe(
			"yarn add --dev @brainwav/coding-harness",
		);
		expect(renderLocalHarnessExecCommand("pnpm")).toBe("pnpm exec harness");
		expect(renderLocalHarnessExecCommand("npm")).toBe("npm exec harness --");
		expect(renderLocalHarnessExecCommand("yarn")).toBe("yarn harness");
	});

	it("loads packaged Codex shell templates", () => {
		const templates = [
			renderCodexPreflightTemplate(),
			renderCodexPreflightLegacyLocalMemoryTemplate(),
			renderCodexLearnTemplate(),
			renderCodexEnforcedTemplate(),
			renderVerifyWorkScript("pnpm"),
		];

		for (const template of templates) {
			expect(template).toMatch(/^#!\/usr\/bin\/env bash/);
			expect(template).toContain("set -euo pipefail");
		}
	});

	it("renders harness CLI repair guidance for the selected package manager", () => {
		const pnpmWrapper = renderHarnessCliWrapper("pnpm");
		const npmWrapper = renderHarnessCliWrapper("npm");

		expect(pnpmWrapper).toContain("pnpm install");
		expect(pnpmWrapper).toContain("pnpm add -D @brainwav/coding-harness");
		expect(pnpmWrapper).toContain("pnpm exec harness <command>");
		expect(npmWrapper).toContain("npm install");
		expect(npmWrapper).toContain(
			"npm install --save-dev @brainwav/coding-harness",
		);
		expect(npmWrapper).toContain("npm exec harness -- <command>");
	});

	it("renders the harness gate runner fallback chain", () => {
		const runner = renderHarnessGateRunner("pnpm");

		expect(runner).toContain("Usage: bash scripts/run-harness-gate.sh");
		expect(runner).toContain('exec pnpm --dir "$REPO_ROOT" exec tsx');
		expect(runner).toContain('exec node "$REPO_ROOT/dist/cli.js" "$@"');
		expect(runner).toContain('bash "$REPO_ROOT/scripts/harness-cli.sh"');
		expect(runner).toContain("mise which harness");
		expect(runner).toContain("exec harness");
		expect(runner).toContain("pnpm install");
		expect(runner).toContain("pnpm exec harness <command>");
	});
});
