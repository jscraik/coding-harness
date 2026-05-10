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
	});

	it("renders workflow bootstrap install commands", () => {
		expect(renderWorkflowBootstrapInstallCommand("npm")).toBe("npm ci");
		expect(renderWorkflowBootstrapInstallCommand("pnpm")).toBe(
			"pnpm install --frozen-lockfile",
		);
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
		expect(makefile).toContain("bash ./scripts/validate-codestyle.sh --fast");
		expect(makefile).toContain("bash ./scripts/run-harness-gate.sh docs-gate");
		expect(makefile).toContain(
			"bash ./scripts/run-harness-gate.sh tooling-audit",
		);
		expect(makefile).toContain("pnpm quality:size");
		expect(makefile).toContain(
			"bash ./scripts/refresh-diagram-context.sh --force",
		);
	});

	it("renders Makefile commands for the selected package manager", () => {
		const makefile = renderMakefileTemplate("npm");

		expect(makefile).toContain("\tnpm install");
		expect(makefile).toContain("\tnpm run lint");
		expect(makefile).toContain("\tnpm run quality:size");
		expect(makefile).toContain("\tnpm run test:related");
		expect(makefile).not.toContain("pnpm run quality:size");
	});
});
