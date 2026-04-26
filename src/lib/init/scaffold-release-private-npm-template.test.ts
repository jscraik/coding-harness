import { describe, expect, it } from "vitest";
import { renderReleasePrivateNpmWorkflow } from "./scaffold-release-private-npm-template.js";

describe("scaffold private npm release template", () => {
	it("renders the private npm release workflow for pnpm", () => {
		const workflow = renderReleasePrivateNpmWorkflow({
			packageManager: "pnpm",
			installCommand: "pnpm install --frozen-lockfile",
			checkCommand: "pnpm check",
			buildCommand: "pnpm build",
		});

		expect(workflow).toContain("name: Release to private npm");
		expect(workflow).toContain('required_pnpm_version="10.33.0"');
		expect(workflow).toContain("run: pnpm install --frozen-lockfile");
		expect(workflow).toContain("run: pnpm check");
		expect(workflow).toContain("run: pnpm build");
		expect(workflow).toContain(
			"pnpm publish --no-git-checks --access restricted\n",
		);
		expect(workflow).toContain(
			"pnpm publish --no-git-checks --access restricted --provenance",
		);
		expect(workflow).not.toMatch(/__[A-Z_]+__/);
	});

	it("renders the private npm release workflow for npm without pnpm setup", () => {
		const workflow = renderReleasePrivateNpmWorkflow({
			packageManager: "npm",
			installCommand: "npm ci",
			checkCommand: "npm run check",
			buildCommand: "npm run build",
		});

		expect(workflow).not.toContain('required_pnpm_version="10.33.0"');
		expect(workflow).toContain("run: npm ci");
		expect(workflow).toContain("run: npm run check");
		expect(workflow).toContain("run: npm run build");
		expect(workflow).toContain("npm publish --access restricted\n");
		expect(workflow).toContain("npm publish --access restricted --provenance");
		expect(workflow).not.toContain("pnpm publish");
		expect(workflow).not.toMatch(/__[A-Z_]+__/);
	});
});
