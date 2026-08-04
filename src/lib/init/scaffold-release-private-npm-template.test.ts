import { describe, expect, it } from "vitest";
import { renderReleasePrivateNpmWorkflow } from "./scaffold-release-private-npm-template.js";

describe("scaffold public npm release template", () => {
	it("renders the public npm release workflow for pnpm", () => {
		const workflow = renderReleasePrivateNpmWorkflow({
			packageManager: "pnpm",
			installCommand: "pnpm install --frozen-lockfile",
			checkCommand: "pnpm check",
			buildCommand: "pnpm build",
		});

		expect(workflow).toContain("name: Release to public npm");
		expect(workflow).not.toContain("Configure npm authentication");
		expect(workflow).not.toContain("_authToken=$NPM_TOKEN");
		expect(workflow).toContain(`NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}`);
		expect(workflow).toContain('required_pnpm_version="10.33.0"');
		expect(workflow).toContain("run: pnpm install --frozen-lockfile");
		expect(workflow).toContain(
			"sudo apt-get install --yes --no-install-recommends ripgrep",
		);
		expect(workflow).toContain("rg --version");
		expect(workflow).toContain("run: pnpm check");
		expect(workflow).toContain("run: pnpm build");
		expect(workflow).toContain(
			"pnpm publish --no-git-checks --access public\n",
		);
		expect(workflow).toContain(
			"pnpm publish --no-git-checks --access public --provenance",
		);
		expect(workflow).not.toMatch(/__[A-Z_]+__/);

		// Verify NODE_AUTH_TOKEN is scoped to token-auth publish step only
		const tokenStepMatch = workflow.match(
			/- name: Publish public package \(token\)\s+if: steps\.publish-auth\.outputs\.mode == 'token'\s+env:\s+NODE_AUTH_TOKEN: \${{ secrets\.NPM_TOKEN }}/,
		);
		expect(tokenStepMatch).toBeTruthy();

		// Verify OIDC publish step has no NPM_TOKEN/NODE_AUTH_TOKEN dependency
		const oidcStepMatch = workflow.match(
			/- name: Publish public package \(OIDC trusted publisher\)\s+if: steps\.publish-auth\.outputs\.mode == 'oidc'\s+run:/,
		);
		expect(oidcStepMatch).toBeTruthy();
		const oidcStepStart = workflow.indexOf(
			"- name: Publish public package (OIDC trusted publisher)",
		);
		const nextStepStart = workflow.indexOf(
			"- name: Generate build provenance attestation",
			oidcStepStart,
		);
		const oidcStepContent = workflow.slice(oidcStepStart, nextStepStart);
		expect(oidcStepContent).not.toContain("NPM_TOKEN");
		expect(oidcStepContent).not.toContain("NODE_AUTH_TOKEN");
	});

	it("keeps workflow dispatch inputs out of shell interpolation", () => {
		const workflow = renderReleasePrivateNpmWorkflow({
			packageManager: "npm",
			installCommand: "npm ci",
			checkCommand: "npm run check",
			buildCommand: "npm run build",
		});

		const githubExpression = "$" + "{{";
		const shellParameter = "$" + "{";

		expect(workflow).toContain(
			`RELEASE_TAG_INPUT: ${githubExpression} github.event.inputs.release_tag }}`,
		);
		expect(workflow).toContain(
			`PUBLISH_AUTH_INPUT: ${githubExpression} github.event.inputs.publish_auth }}`,
		);
		expect(workflow).toContain(`TAG="${shellParameter}RELEASE_TAG_INPUT}"`);
		expect(workflow).toContain(
			`MODE="${shellParameter}PUBLISH_AUTH_INPUT:-oidc}"`,
		);
		expect(workflow).not.toContain(
			`TAG="${githubExpression} github.event.inputs.release_tag }}"`,
		);
		expect(workflow).not.toContain(
			`MODE="${githubExpression} github.event_name == 'workflow_dispatch' && github.event.inputs.publish_auth`,
		);
	});

	it("scopes write permissions to the publish job", () => {
		const workflow = renderReleasePrivateNpmWorkflow({
			packageManager: "npm",
			installCommand: "npm ci",
			checkCommand: "npm run check",
			buildCommand: "npm run build",
		});

		expect(workflow).toContain("permissions:\n  contents: read\n\njobs:");
		expect(workflow).toContain(
			"  publish:\n    permissions:\n      attestations: write\n      contents: write\n      id-token: write",
		);
	});

	it("renders the public npm release workflow for npm without pnpm setup", () => {
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
		expect(workflow).toContain("npm publish --access public\n");
		expect(workflow).toContain("npm publish --access public --provenance");
		expect(workflow).not.toContain("pnpm publish");
		expect(workflow).not.toMatch(/__[A-Z_]+__/);
	});
});
