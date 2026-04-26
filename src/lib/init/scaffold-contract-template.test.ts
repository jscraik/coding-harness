import { describe, expect, it } from "vitest";
import { renderHarnessContractTemplate } from "./scaffold-contract-template.js";
import type { TemplateRenderContext } from "./types.js";

const baseContext: TemplateRenderContext = {
	targetDir: "/tmp/project",
	ciProvider: "circleci",
	packageScripts: [],
	projectName: "demo-repo",
	issueTrackingUrl:
		"https://linear.app/jscraik/project/coding-harness-bb735dbbda79",
};

function renderContract(context: TemplateRenderContext = baseContext) {
	return JSON.parse(
		renderHarnessContractTemplate({
			agentBranchPrefix: "codex",
			context,
			packageManager: "pnpm",
			requiredChecks: ["lint", "typecheck", "test"],
		}),
	);
}

describe("contract scaffold template", () => {
	it("renders contract policy defaults from a narrow scaffold interface", () => {
		const contract = renderContract();

		expect(contract.version).toBe("1.6.0");
		expect(contract.riskTierRules["src/auth/**"]).toBe("high");
		expect(contract.branchProtection.requiredChecks).toEqual([
			"lint",
			"typecheck",
			"test",
		]);
		expect(contract.branchProtection.requiredApprovingReviewCount).toBe(1);
		expect(contract.uiLoopPolicy.fastCommand).toBe("pnpm ui:fast");
		expect(contract.loopStageContracts["review-gate"].timeoutMinutes).toBe(15);
		expect(contract.controlPlanePolicy.overridePolicy.maxTtlHours).toBe(24);
		expect(contract.contextIntegrityPolicy.mode).toBe("shadow");
	});

	it("renders project-specific north-star and reviewer identity defaults", () => {
		const contract = renderContract();

		expect(contract.northStar.mission).toContain("demo-repo");
		expect(contract.northStar.mission).not.toContain(
			"Coding Harness exists to let humans steer",
		);
		expect(
			contract.productSurface.surfaces[0].manualGlueReductionClaim,
		).toContain("recurring reviewer reminders");
		expect(contract.productSurface.surfaces[0].lastReviewedAt).toMatch(
			/^\d{4}-\d{2}-\d{2}$/,
		);
		expect(contract.productSurface.surfaces[0].lastReviewedAt).toBe(
			"2026-04-22",
		);
		expect(
			contract.overrideReviewerRegistry.trustedReviewers[0].displayName,
		).toBe("demo-repo Maintainers");
	});

	it("omits Linear tracking policy when tracker mode is not Linear", () => {
		const contract = renderContract({
			...baseContext,
			issueTracker: "github",
		});

		expect(contract.issueTrackingPolicy).toBeUndefined();
	});

	it("uses npm run for generated package script commands", () => {
		const contract = JSON.parse(
			renderHarnessContractTemplate({
				agentBranchPrefix: "codex",
				context: baseContext,
				packageManager: "npm",
				requiredChecks: [],
			}),
		);

		expect(contract.uiLoopPolicy.verifyCommand).toBe("npm run ui:verify");
	});
});
