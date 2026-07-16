// biome-ignore-all lint/suspicious/noTemplateCurlyInString: tests assert literal shell placeholders emitted into generated workflows.
import { describe, expect, it } from "vitest";
import { renderGitHubActionsPrPipelineWorkflowTemplate } from "./scaffold-github-actions-pr-pipeline-renderer.js";

const pipelineInput = {
	installCommand: "pnpm install",
	lintCommand: "pnpm lint",
	typecheckCommand: "pnpm typecheck",
	testCommand: "pnpm test:ci",
	auditCommand: "pnpm run audit",
	checkCommand: "pnpm check",
	memoryValidateCommand: "pnpm memory:validate",
	linearTrackingEnabled: true,
};

const pnpmSetupStep = `      - name: Ensure pnpm available
        run: echo "setup"`;

describe("GitHub Actions PR pipeline renderer", () => {
	it("renders linear gating and risk-policy needs when tracking is enabled", () => {
		const workflow = renderGitHubActionsPrPipelineWorkflowTemplate(
			pipelineInput,
			pnpmSetupStep,
		);

		expect(workflow).toContain("linear-gate:");
		expect(workflow).toContain("needs: [pr-template, linear-gate]");
		expect(workflow).toContain("needs.linear-gate.result == 'success'");
		expect(workflow).toContain(
			"node --import tsx src/cli.ts pr-template-gate --json",
		);
		expect(workflow).toContain(
			"PR_TEMPLATE_BODY: ${{ github.event.pull_request.body }}",
		);
		expect(workflow).not.toContain("const classifyReference");
		expect(workflow).not.toContain("ignored_local_path");
		expect(workflow).toContain("run: pnpm lint");
		expect(workflow).toContain("run: pnpm typecheck");
		expect(workflow).toContain("run: pnpm test:ci");
	});

	it("omits linear gating and narrows needs when tracking is disabled", () => {
		const workflow = renderGitHubActionsPrPipelineWorkflowTemplate(
			{ ...pipelineInput, linearTrackingEnabled: false },
			pnpmSetupStep,
		);

		expect(workflow).not.toContain("linear-gate:");
		expect(workflow).toContain("needs: [pr-template]");
		expect(workflow).toContain("needs.pr-template.result == 'success'");
		expect(workflow).not.toContain("needs.linear-gate");
	});
});
