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

	it("rejects unsafe generated package install arguments", () => {
		expect(() =>
			renderAddPackageCommand("pnpm", "@scope/package; rm -rf /"),
		).toThrow(
			"Invalid package name for scaffold command: @scope/package; rm -rf /",
		);
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

		expect(pnpmWrapper).toContain("is_harness_source_repo");
		expect(pnpmWrapper).toContain('exec node "$REPO_ROOT/dist/cli.js" "$@"');
		expect(pnpmWrapper).toContain(
			'exec pnpm --dir "$REPO_ROOT" exec tsx "$REPO_ROOT/src/cli.ts" "$@"',
		);
		expect(
			pnpmWrapper.indexOf(
				'exec pnpm --dir "$REPO_ROOT" exec tsx "$REPO_ROOT/src/cli.ts" "$@"',
			),
		).toBeLessThan(
			pnpmWrapper.indexOf('exec node "$REPO_ROOT/dist/cli.js" "$@"'),
		);

		expect(npmWrapper).toContain("npm install");
		expect(npmWrapper).toContain(
			"npm install --save-dev @brainwav/coding-harness",
		);
		expect(npmWrapper).toContain("npm exec harness -- <command>");

		expect(npmWrapper).toContain(
			'exec npm exec tsx "$REPO_ROOT/src/cli.ts" "$@"',
		);
	});

	it("renders the harness gate runner fallback chain", () => {
		const runner = renderHarnessGateRunner("pnpm");

		expect(runner).toContain("Usage: bash scripts/run-harness-gate.sh");
		expect(runner).toContain(
			'if pnpm --dir "$REPO_ROOT" exec tsx "$REPO_ROOT/src/cli.ts" "$@" 2>"$tsx_stderr_file"; then',
		);
		expect(runner).toContain("const stderr = readFileSync");
		expect(runner).toContain(
			"/listen EPERM: operation not permitted.*(\\/tmp\\/tsx-|\\.pipe)/.test(stderr)",
		);
		expect(runner).toContain(
			"Warning: tsx IPC startup failed (EPERM/IPC); refusing dist fallback in source checkout because dist freshness cannot be proven deterministically.",
		);
		expect(runner).not.toContain("dist_freshness_marker");
		expect(runner).not.toContain("newest_dist_file");
		expect(runner).not.toContain("tsx IPC startup failed with EPERM");
		expect(runner).toContain('exec node "$REPO_ROOT/dist/cli.js" "$@"');
		expect(runner).toContain('bash "$REPO_ROOT/scripts/harness-cli.sh"');
		expect(runner).toContain("mise which harness");
		expect(runner).toContain("exec harness");
		expect(runner).toContain("pnpm install");
		expect(runner).toContain("pnpm exec harness <command>");
	});
});
