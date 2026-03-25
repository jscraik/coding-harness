import { describe, expect, it } from "vitest";
import {
	type ActiveCIPolicy,
	type CIAdapterFinding,
	DEFAULT_WORKFLOW_CI_POLICY,
	type WorkflowCIPolicy,
	checkCICompatibility,
	validateWorkflowCIPolicy,
} from "./ci-adapter.js";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function hasCode(findings: CIAdapterFinding[], code: string): boolean {
	return findings.some((f) => f.code === code);
}

function defaultActivePolicy(): ActiveCIPolicy {
	return {
		activeProvider: "github-actions",
		mode: "shadow",
		migrationStage: "dual-provider",
		requiredCheckManifestPath: ".harness/ci-required-checks.json",
	};
}

function defaultWorkflowPolicy(): WorkflowCIPolicy {
	return {
		provider: "github-actions",
		required_checks: ["lint", "test", "typecheck"],
		timeout: "15m",
		escalation: "Block and notify workflow owner",
		compatible_stages: ["dual-provider", "circleci-primary", "circleci-only"],
		failure_behavior: "fail-closed",
	};
}

// ─── validateWorkflowCIPolicy ───────────────────────────────────────────────────

describe("validateWorkflowCIPolicy", () => {
	it("accepts a valid policy with no findings", () => {
		const findings = validateWorkflowCIPolicy(defaultWorkflowPolicy());
		const errors = findings.filter((f) => f.severity === "error");
		expect(errors).toEqual([]);
	});

	it("rejects invalid provider", () => {
		const policy = defaultWorkflowPolicy();
		(policy as unknown as Record<string, unknown>).provider = "jenkins";
		const findings = validateWorkflowCIPolicy(policy);
		expect(hasCode(findings, "CI_INVALID_PROVIDER")).toBe(true);
	});

	it("rejects empty check names", () => {
		const policy = defaultWorkflowPolicy();
		policy.required_checks = ["lint", "", "test"];
		const findings = validateWorkflowCIPolicy(policy);
		expect(hasCode(findings, "CI_EMPTY_CHECK_NAME")).toBe(true);
	});

	it("warns when timeout is empty", () => {
		const policy = defaultWorkflowPolicy();
		policy.timeout = "";
		const findings = validateWorkflowCIPolicy(policy);
		expect(hasCode(findings, "CI_MISSING_TIMEOUT")).toBe(true);
		expect(
			findings.find((f) => f.code === "CI_MISSING_TIMEOUT")?.severity,
		).toBe("warning");
	});

	it("warns when escalation is empty", () => {
		const policy = defaultWorkflowPolicy();
		policy.escalation = "";
		const findings = validateWorkflowCIPolicy(policy);
		expect(hasCode(findings, "CI_MISSING_ESCALATION")).toBe(true);
	});

	it("rejects empty compatible stages", () => {
		const policy = defaultWorkflowPolicy();
		policy.compatible_stages = [];
		const findings = validateWorkflowCIPolicy(policy);
		expect(hasCode(findings, "CI_NO_COMPATIBLE_STAGES")).toBe(true);
	});

	it("rejects invalid migration stage", () => {
		const policy = defaultWorkflowPolicy();
		(policy.compatible_stages as string[]).push("invalid-stage");
		const findings = validateWorkflowCIPolicy(policy);
		expect(hasCode(findings, "CI_INVALID_STAGE")).toBe(true);
	});

	it("rejects invalid failure behavior", () => {
		const policy = defaultWorkflowPolicy();
		(policy as unknown as Record<string, unknown>).failure_behavior = "ignore";
		const findings = validateWorkflowCIPolicy(policy);
		expect(hasCode(findings, "CI_INVALID_FAILURE_BEHAVIOR")).toBe(true);
	});

	it("validates the default policy without errors", () => {
		const findings = validateWorkflowCIPolicy(DEFAULT_WORKFLOW_CI_POLICY);
		const errors = findings.filter((f) => f.severity === "error");
		expect(errors).toEqual([]);
	});
});

// ─── checkCICompatibility ───────────────────────────────────────────────────────

describe("checkCICompatibility", () => {
	describe("provider matching", () => {
		it("passes when providers match", () => {
			const result = checkCICompatibility(
				defaultWorkflowPolicy(),
				defaultActivePolicy(),
			);
			expect(result.pass).toBe(true);
			expect(hasCode(result.findings, "CI_PROVIDER_MISMATCH")).toBe(false);
		});

		it("warns on provider mismatch in dual-provider mode", () => {
			const workflow = defaultWorkflowPolicy();
			workflow.provider = "circleci";
			const active = defaultActivePolicy();
			active.migrationStage = "dual-provider";

			const result = checkCICompatibility(workflow, active);
			expect(hasCode(result.findings, "CI_PROVIDER_MISMATCH_DUAL")).toBe(true);
			// Should be a warning, not an error (dual-provider allows both)
			const finding = result.findings.find(
				(f) => f.code === "CI_PROVIDER_MISMATCH_DUAL",
			);
			expect(finding?.severity).toBe("warning");
		});

		it("errors on provider mismatch in circleci-only mode with fail-closed", () => {
			const workflow = defaultWorkflowPolicy();
			workflow.provider = "github-actions";
			workflow.failure_behavior = "fail-closed";
			const active = defaultActivePolicy();
			active.activeProvider = "circleci";
			active.migrationStage = "circleci-only";

			const result = checkCICompatibility(workflow, active);
			expect(hasCode(result.findings, "CI_PROVIDER_MISMATCH")).toBe(true);
			const finding = result.findings.find(
				(f) => f.code === "CI_PROVIDER_MISMATCH",
			);
			expect(finding?.severity).toBe("error");
			expect(result.pass).toBe(false);
		});

		it("warns on provider mismatch in circleci-primary mode with fail-open", () => {
			const workflow = defaultWorkflowPolicy();
			workflow.provider = "github-actions";
			workflow.failure_behavior = "fail-open";
			const active = defaultActivePolicy();
			active.activeProvider = "circleci";
			active.migrationStage = "circleci-primary";

			const result = checkCICompatibility(workflow, active);
			expect(hasCode(result.findings, "CI_PROVIDER_MISMATCH")).toBe(true);
			const finding = result.findings.find(
				(f) => f.code === "CI_PROVIDER_MISMATCH",
			);
			expect(finding?.severity).toBe("warning");
		});
	});

	describe("migration stage compatibility", () => {
		it("passes when stage is compatible", () => {
			const result = checkCICompatibility(
				defaultWorkflowPolicy(),
				defaultActivePolicy(),
			);
			expect(hasCode(result.findings, "CI_STAGE_INCOMPATIBLE")).toBe(false);
		});

		it("errors when stage is incompatible and fail-closed", () => {
			const workflow = defaultWorkflowPolicy();
			workflow.compatible_stages = ["dual-provider"];
			workflow.failure_behavior = "fail-closed";
			const active = defaultActivePolicy();
			active.migrationStage = "circleci-only";

			const result = checkCICompatibility(workflow, active);
			expect(hasCode(result.findings, "CI_STAGE_INCOMPATIBLE")).toBe(true);
			const finding = result.findings.find(
				(f) => f.code === "CI_STAGE_INCOMPATIBLE",
			);
			expect(finding?.severity).toBe("error");
			expect(result.pass).toBe(false);
		});

		it("warns when stage is incompatible and fail-open", () => {
			const workflow = defaultWorkflowPolicy();
			workflow.compatible_stages = ["dual-provider"];
			workflow.failure_behavior = "fail-open";
			const active = defaultActivePolicy();
			active.migrationStage = "circleci-only";

			const result = checkCICompatibility(workflow, active);
			expect(hasCode(result.findings, "CI_STAGE_INCOMPATIBLE")).toBe(true);
			const finding = result.findings.find(
				(f) => f.code === "CI_STAGE_INCOMPATIBLE",
			);
			expect(finding?.severity).toBe("warning");
		});
	});

	describe("required mode enforcement", () => {
		it("errors when no required_checks in required mode with fail-closed", () => {
			const workflow = defaultWorkflowPolicy();
			workflow.required_checks = [];
			workflow.failure_behavior = "fail-closed";
			const active = defaultActivePolicy();
			active.mode = "required";

			const result = checkCICompatibility(workflow, active);
			expect(hasCode(result.findings, "CI_NO_CHECKS_IN_REQUIRED_MODE")).toBe(
				true,
			);
			const finding = result.findings.find(
				(f) => f.code === "CI_NO_CHECKS_IN_REQUIRED_MODE",
			);
			expect(finding?.severity).toBe("error");
		});

		it("warns when no required_checks in required mode with fail-open", () => {
			const workflow = defaultWorkflowPolicy();
			workflow.required_checks = [];
			workflow.failure_behavior = "fail-open";
			const active = defaultActivePolicy();
			active.mode = "required";

			const result = checkCICompatibility(workflow, active);
			expect(hasCode(result.findings, "CI_NO_CHECKS_IN_REQUIRED_MODE")).toBe(
				true,
			);
			const finding = result.findings.find(
				(f) => f.code === "CI_NO_CHECKS_IN_REQUIRED_MODE",
			);
			expect(finding?.severity).toBe("warning");
		});

		it("does not flag required_checks in shadow mode", () => {
			const workflow = defaultWorkflowPolicy();
			workflow.required_checks = [];
			const active = defaultActivePolicy();
			active.mode = "shadow";

			const result = checkCICompatibility(workflow, active);
			expect(hasCode(result.findings, "CI_NO_CHECKS_IN_REQUIRED_MODE")).toBe(
				false,
			);
		});

		it("passes when required_checks are declared in required mode", () => {
			const workflow = defaultWorkflowPolicy();
			workflow.required_checks = ["lint", "test"];
			const active = defaultActivePolicy();
			active.mode = "required";

			const result = checkCICompatibility(workflow, active);
			expect(hasCode(result.findings, "CI_NO_CHECKS_IN_REQUIRED_MODE")).toBe(
				false,
			);
		});
	});

	describe("fail-open/fail-closed behavior", () => {
		it("warns when fail-open is used in required mode", () => {
			const workflow = defaultWorkflowPolicy();
			workflow.failure_behavior = "fail-open";
			const active = defaultActivePolicy();
			active.mode = "required";

			const result = checkCICompatibility(workflow, active);
			expect(hasCode(result.findings, "CI_FAIL_OPEN_IN_REQUIRED_MODE")).toBe(
				true,
			);
		});

		it("does not warn fail-open in shadow mode", () => {
			const workflow = defaultWorkflowPolicy();
			workflow.failure_behavior = "fail-open";
			const active = defaultActivePolicy();
			active.mode = "shadow";

			const result = checkCICompatibility(workflow, active);
			expect(hasCode(result.findings, "CI_FAIL_OPEN_IN_REQUIRED_MODE")).toBe(
				false,
			);
		});

		it("does not warn fail-closed in required mode", () => {
			const workflow = defaultWorkflowPolicy();
			workflow.failure_behavior = "fail-closed";
			const active = defaultActivePolicy();
			active.mode = "required";

			const result = checkCICompatibility(workflow, active);
			expect(hasCode(result.findings, "CI_FAIL_OPEN_IN_REQUIRED_MODE")).toBe(
				false,
			);
		});
	});

	describe("summary counts", () => {
		it("counts errors and warnings correctly", () => {
			const workflow = defaultWorkflowPolicy();
			workflow.required_checks = [];
			workflow.failure_behavior = "fail-open";
			workflow.compatible_stages = ["dual-provider"];
			const active = defaultActivePolicy();
			active.mode = "required";
			active.migrationStage = "circleci-only";

			const result = checkCICompatibility(workflow, active);
			expect(result.summary.errors + result.summary.warnings).toBe(
				result.findings.length,
			);
		});

		it("pass is true when only warnings", () => {
			const workflow = defaultWorkflowPolicy();
			workflow.timeout = ""; // warning
			const active = defaultActivePolicy();

			const result = checkCICompatibility(workflow, active);
			expect(result.summary.warnings).toBeGreaterThan(0);
			expect(result.summary.errors).toBe(0);
			expect(result.pass).toBe(true);
		});
	});

	describe("full happy path", () => {
		it("matching workflow + active policy produces clean result", () => {
			const result = checkCICompatibility(
				defaultWorkflowPolicy(),
				defaultActivePolicy(),
			);
			expect(result.pass).toBe(true);
			expect(result.summary.errors).toBe(0);
			expect(result.summary.warnings).toBe(0);
			expect(result.findings).toEqual([]);
		});

		it("circleci workflow + circleci active in circleci-only passes", () => {
			const workflow = defaultWorkflowPolicy();
			workflow.provider = "circleci";
			workflow.compatible_stages = ["circleci-only"];
			const active: ActiveCIPolicy = {
				activeProvider: "circleci",
				mode: "required",
				migrationStage: "circleci-only",
				requiredCheckManifestPath: ".harness/ci-required-checks.json",
			};

			const result = checkCICompatibility(workflow, active);
			expect(result.pass).toBe(true);
			expect(result.summary.errors).toBe(0);
		});
	});
});
