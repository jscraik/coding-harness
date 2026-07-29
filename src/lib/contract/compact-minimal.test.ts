import { describe, expect, it } from "vitest";
import { renderHarnessContractTemplate } from "../init/scaffold-contract-template.js";
import type { TemplateRenderContext } from "../init/types.js";
import { validateContract } from "./validator.js";
import { isCompactMinimalRawContract } from "./compact-minimal.js";

const compactContext: TemplateRenderContext = {
	targetDir: "/tmp/compact-minimal-contract",
	ciProvider: "circleci",
	packageScripts: [],
	projectName: "compact-minimal",
	minimal: true,
};

function compactContract(
	projectType?: TemplateRenderContext["projectType"],
): Record<string, unknown> {
	return JSON.parse(
		renderHarnessContractTemplate({
			agentBranchPrefix: "codex",
			context: { ...compactContext, ...(projectType ? { projectType } : {}) },
			packageManager: "pnpm",
			requiredChecks: [],
		}),
	) as Record<string, unknown>;
}

describe("isCompactMinimalRawContract", () => {
	it("recognizes the exact review-disabled minimal template", () => {
		const contract = compactContract();

		expect(validateContract(contract).success).toBe(true);
		expect(isCompactMinimalRawContract(contract)).toBe(true);
	});

	it("accepts the project type emitted into a detected minimal contract", () => {
		const contract = compactContract("web");

		expect(validateContract(contract).success).toBe(true);
		expect(isCompactMinimalRawContract(contract)).toBe(true);
	});

	it("rejects an unsupported project type", () => {
		const contract = compactContract("web");
		contract.projectType = "service";

		const result = validateContract(contract);
		expect(result.success).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "projectType" }),
			]),
		);
	});

	it("rejects a schema-valid minimal-shaped contract that enables review context", () => {
		const contract = compactContract();
		contract.reviewPolicy = {
			...(contract.reviewPolicy as Record<string, unknown>),
			requireReviewContext: true,
		};

		expect(validateContract(contract).success).toBe(true);
		expect(isCompactMinimalRawContract(contract)).toBe(false);
	});
});
