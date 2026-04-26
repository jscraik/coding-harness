import { describe, expect, it } from "vitest";
import {
	renderGitHubActionsPnpmSetupStep,
	renderGitHubActionsPrPipelineWorkflow,
} from "./scaffold-github-actions-pr-pipeline-template.js";

describe("GitHub Actions PR pipeline scaffold template", () => {
	const pipelineInput = {
		installCommand: "pnpm install",
		lintCommand: "pnpm lint",
		typecheckCommand: "pnpm typecheck",
		testCommand: "pnpm test:ci",
		auditCommand: "pnpm audit",
		checkCommand: "pnpm check",
		memoryValidateCommand: "pnpm memory:validate",
		linearTrackingEnabled: true,
	};

	it("renders pnpm setup with the required package-manager version guard", () => {
		const setupStep = renderGitHubActionsPnpmSetupStep();

		expect(setupStep).toContain('required_pnpm_version="10.33.0"');
		expect(setupStep).toContain(
			'current_pnpm_version="$(pnpm --version || true)"',
		);
		expect(setupStep).toContain(
			'npm install --global --prefix "$NPM_CONFIG_PREFIX" "pnpm@${required_pnpm_version}"',
		);
	});

	it("renders the GitHub Actions PR pipeline with Linear gating enabled", () => {
		const workflow = renderGitHubActionsPrPipelineWorkflow(pipelineInput);

		expect(workflow).not.toContain("\t");
		expect(workflow).toContain("linear-gate:");
		expect(workflow).toContain("pnpm exec tsx src/cli.ts linear-gate");
		expect(workflow).toContain("needs: [pr-template, linear-gate]");
		expect(workflow).toContain("needs.linear-gate.result == 'success'");
		expect(workflow).toContain("run: pnpm lint");
		expect(workflow).toContain("run: pnpm typecheck");
		expect(workflow).toContain("run: pnpm test:ci");
		expect(workflow).toContain("run: pnpm audit");
		expect(workflow).toContain("run: pnpm check");
		expect(workflow).toContain("run: pnpm memory:validate");
		expect(workflow).toContain("pnpm exec tsx src/cli.ts linear-gate \\");
		expect(workflow).not.toContain("pnpm exec tsx src/cli.ts linear-gate \\\\");
		expect(workflow).toContain("pnpm exec tsx src/cli.ts preflight-gate \\");
		expect(workflow).not.toContain(
			"pnpm exec tsx src/cli.ts preflight-gate \\\\",
		);
		expect(workflow).not.toMatch(/{{[a-zA-Z]+}}/);
		expect(workflow).toContain(
			'done < <(rg -n "^[[:space:]]*(-[[:space:]]*)?uses:[[:space:]]*[^[:space:]]+" .github/workflows/*.yml 2>/dev/null || true)',
		);
		expect(workflow).not.toContain("uses_matches=");
		expect(workflow).toContain(
			"Advisory report missing; generated deterministic fallback report.",
		);
	});

	it("renders the GitHub Actions PR pipeline without Linear gating", () => {
		const workflow = renderGitHubActionsPrPipelineWorkflow({
			...pipelineInput,
			linearTrackingEnabled: false,
		});

		expect(workflow).not.toContain("linear-gate:");
		expect(workflow).not.toContain("pnpm exec tsx src/cli.ts linear-gate");
		expect(workflow).toContain("needs: [pr-template]");
		expect(workflow).toContain("needs.pr-template.result == 'success'");
		expect(workflow).not.toContain("needs.linear-gate");
	});
});
