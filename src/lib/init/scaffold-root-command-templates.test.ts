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
		expect(AGENT_BRANCH_PREFIX).toBe("codex");
		expect(renderMemoryValidateCommand()).toContain('.meta.version == "1.0"');
		expect(renderDefaultNpmrc()).toContain("ignore-scripts=true");
	});

	it("renders the root Makefile command surface", () => {
		const makefile = renderMakefileTemplate();

		expect(makefile).toContain("hooks-pre-push:");
		expect(makefile).toContain("pnpm exec tsx src/cli.ts docs-gate");
		expect(makefile).toContain("pnpm run quality:size");
		expect(makefile).toContain(
			"bash ./scripts/refresh-diagram-context.sh --force",
		);
	});
});
