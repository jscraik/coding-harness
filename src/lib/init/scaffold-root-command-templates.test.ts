import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	AGENT_BRANCH_PREFIX,
	renderDefaultNpmrc,
	renderMakefileTemplate,
	renderMemoryValidateCommand,
	renderScriptCommand,
	renderWorkflowBootstrapInstallCommand,
} from "./scaffold-root-command-templates.js";

describe("scaffold root command templates", () => {
	it("renders package-manager script commands", () => {
		expect(renderScriptCommand("npm", "check")).toBe("npm run check");
		expect(renderScriptCommand("pnpm", "check")).toBe("pnpm check");
		expect(renderScriptCommand("pnpm", "audit")).toContain(
			'if(typeof p.scripts?.audit!=="string")',
		);
		expect(renderScriptCommand("pnpm", "audit")).toContain("&& pnpm run audit");
	});

	it("renders workflow bootstrap install commands", () => {
		expect(renderWorkflowBootstrapInstallCommand("npm")).toBe("npm ci");
		expect(renderWorkflowBootstrapInstallCommand("pnpm")).toBe(
			"pnpm install --frozen-lockfile",
		);
	});

	it("fails the generated pnpm audit route when scripts.audit is absent", () => {
		const repo = mkdtempSync(join(tmpdir(), "harness-audit-script-required-"));
		writeFileSync(join(repo, "package.json"), '{"scripts":{}}\n', "utf8");
		try {
			const result = spawnSync(
				"bash",
				["-lc", renderScriptCommand("pnpm", "audit")],
				{ cwd: repo, encoding: "utf8" },
			);
			expect(result.status).not.toBe(0);
			expect(result.stderr).toContain("package.json scripts.audit is required");
			expect(result.stderr).not.toContain("ERR_PNPM_NO_SCRIPT");
		} finally {
			rmSync(repo, { recursive: true, force: true });
		}
	});

	it("keeps generated governance defaults explicit", () => {
		expect(AGENT_BRANCH_PREFIX).toBe("jscraik/feature");
		expect(renderMemoryValidateCommand()).toContain('.meta.version == "1.0"');
		expect(renderDefaultNpmrc()).toContain("ignore-scripts=true");
		expect(renderDefaultNpmrc()).toContain("node-linker=isolated");
		expect(renderDefaultNpmrc()).not.toContain("_authToken=");
	});

	it("renders the root Makefile command surface", () => {
		const makefile = renderMakefileTemplate();

		expect(makefile).toContain("hooks-pre-push:");
		expect(makefile).toContain("bash ./scripts/hook-pre-commit.sh");
		expect(makefile).toContain("bash ./scripts/hook-pre-push.sh");
		expect(makefile).toContain("related-tests-staged:");
		expect(makefile).toContain("bash scripts/check-related-tests.sh --staged");
		expect(makefile).not.toContain("make hooks-pre-commit");
		expect(makefile).not.toContain("make hooks-pre-push");
		expect(makefile).toContain("package.json scripts.audit is required");
		expect(makefile).toContain("&& pnpm run audit");
		expect(makefile).toContain(
			"bash ./scripts/refresh-diagram-context.sh --force",
		);
	});

	it("renders Makefile commands for the selected package manager", () => {
		const makefile = renderMakefileTemplate("npm");

		expect(makefile).toContain("\tnpm install");
		expect(makefile).toContain("\tnpm run lint");
		expect(makefile).toContain("@bash ./scripts/hook-pre-commit.sh");
		expect(makefile).toContain("\tnpm run test:related");
		expect(makefile).toContain(
			"related-tests: ## Run related tests for changed src implementation files",
		);
		expect(makefile).toContain(
			"related-tests-staged: ## Run related tests for staged src implementation files",
		);
		expect(makefile).not.toContain("pnpm run quality:size");
	});
});
