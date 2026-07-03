import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CIOwnershipGateFinding } from "./ownership-gate.js";
import {
	DEFAULT_CI_OWNERSHIP,
	type NormalizedCIOwnership,
	type NormalizedFallbackWorkflow,
} from "./ownership-gate-normalization.js";
import { workflowHasAutomaticPrTrigger } from "./ownership-gate-workflow-triggers.js";

const CI_FALLBACK_WORKFLOW_ROLES = new Set([
	"fallback_pr_gate",
	"release_publishing",
]);

/** Append validation findings for the normalized CI ownership contract. */
export function validateCIOwnershipContract(input: {
	findings: CIOwnershipGateFinding[];
	ciOwnership: NormalizedCIOwnership;
	contractPath: string;
	repoRoot: string;
}): void {
	appendPolicyShapeFindings(input);
	appendIdentityFindings(input);
	appendSecurityCheckFindings(input);
	appendFallbackWorkflowFindings(input);
}

/** Append findings for malformed top-level CI ownership policy fields. */
function appendPolicyShapeFindings(input: {
	findings: CIOwnershipGateFinding[];
	ciOwnership: NormalizedCIOwnership;
	contractPath: string;
}): void {
	if (!input.ciOwnership.policyValid) {
		input.findings.push({
			id: "ci-ownership.policy.invalid",
			severity: "error",
			message: "ciOwnership malformed: expected object.",
			path: input.contractPath,
			fix: "Set ciOwnership to an object with schemaVersion, primaryPrGate, reviewProvider, securityChecks, and fallbackWorkflows.",
		});
	}
	if (!input.ciOwnership.fallbackWorkflowsValid) {
		input.findings.push({
			id: "ci-ownership.fallback-workflows.invalid",
			severity: "error",
			message:
				"ciOwnership.fallbackWorkflows must be an array of workflow objects with typed fields.",
			path: input.contractPath,
			fix: "Set ciOwnership.fallbackWorkflows to an array of workflow objects, or remove the malformed value.",
		});
	}
}

/** Append findings for canonical CI ownership identity fields. */
function appendIdentityFindings(input: {
	findings: CIOwnershipGateFinding[];
	ciOwnership: NormalizedCIOwnership;
	contractPath: string;
}): void {
	appendExpectedFieldFinding(input, {
		field: "schemaVersion",
		id: "ci-ownership.schema-version.invalid",
		fix: `Update ciOwnership.schemaVersion to ${DEFAULT_CI_OWNERSHIP.schemaVersion} and migrate fields intentionally.`,
	});
	appendExpectedFieldFinding(input, {
		field: "primaryPrGate",
		id: "ci-ownership.primary-role.mismatch",
		fix: `Set ciOwnership.primaryPrGate to ${DEFAULT_CI_OWNERSHIP.primaryPrGate} unless an intentional ownership migration is planned.`,
	});
	appendExpectedFieldFinding(input, {
		field: "reviewProvider",
		id: "ci-ownership.review-provider.mismatch",
		fix: `Set ciOwnership.reviewProvider to ${DEFAULT_CI_OWNERSHIP.reviewProvider}.`,
	});
}

/** Append a finding when a normalized identity field differs from its default. */
function appendExpectedFieldFinding(
	input: {
		findings: CIOwnershipGateFinding[];
		ciOwnership: NormalizedCIOwnership;
		contractPath: string;
	},
	expected: {
		field: "schemaVersion" | "primaryPrGate" | "reviewProvider";
		id: string;
		fix: string;
	},
): void {
	const actual = input.ciOwnership[expected.field];
	const wanted = DEFAULT_CI_OWNERSHIP[expected.field];
	if (actual === wanted) return;
	input.findings.push({
		id: expected.id,
		severity: "error",
		message: `ciOwnership.${expected.field} must be ${wanted}.`,
		path: input.contractPath,
		fix: expected.fix,
	});
}

/** Append findings for the required security-scan ownership check. */
function appendSecurityCheckFindings(input: {
	findings: CIOwnershipGateFinding[];
	ciOwnership: NormalizedCIOwnership;
	contractPath: string;
}): void {
	const requiredSecurityCheck = DEFAULT_CI_OWNERSHIP.securityChecks[0];
	if (!input.ciOwnership.securityChecks.includes(requiredSecurityCheck)) {
		input.findings.push({
			id: `ci-ownership.security-check.${findingIdToken(requiredSecurityCheck)}.missing`,
			severity: "error",
			message: `ciOwnership.securityChecks must include ${requiredSecurityCheck}.`,
			path: input.contractPath,
			fix: `Add ${requiredSecurityCheck} to ciOwnership.securityChecks.`,
		});
	}
	if (!input.ciOwnership.securityChecksValid) {
		input.findings.push({
			id: "ci-ownership.security-checks.invalid",
			severity: "error",
			message:
				"ciOwnership.securityChecks must be an array of non-empty check names.",
			path: input.contractPath,
			fix: `Set ciOwnership.securityChecks to an array containing ${requiredSecurityCheck}.`,
		});
	}
}

/** Validate all configured fallback workflow ownership entries. */
function appendFallbackWorkflowFindings(input: {
	findings: CIOwnershipGateFinding[];
	ciOwnership: NormalizedCIOwnership;
	repoRoot: string;
}): void {
	for (const workflow of input.ciOwnership.fallbackWorkflows) {
		validateFallbackWorkflow({
			findings: input.findings,
			workflow,
			repoRoot: input.repoRoot,
		});
	}
}

/** Validate static fallback workflow metadata and its workflow trigger surface. */
function validateFallbackWorkflow(input: {
	findings: CIOwnershipGateFinding[];
	workflow: NormalizedFallbackWorkflow;
	repoRoot: string;
}): void {
	const invalid = fallbackWorkflowStaticFinding(input.workflow);
	if (invalid) {
		input.findings.push(invalid);
		return;
	}
	const workflowPath = resolve(input.repoRoot, input.workflow.path);
	const content = readWorkflowContent({
		findings: input.findings,
		workflow: input.workflow,
		workflowPath,
	});
	if (content === null) return;
	appendWorkflowTriggerFinding({
		findings: input.findings,
		workflow: input.workflow,
		content,
	});
}

/** Return the first static schema finding for a fallback workflow. */
function fallbackWorkflowStaticFinding(
	workflow: NormalizedFallbackWorkflow,
): CIOwnershipGateFinding | null {
	if (workflow.path.trim() === "") {
		return {
			id: "ci-ownership.fallback-workflow.path.invalid",
			severity: "error",
			message: "Configured fallback workflow requires a non-empty path.",
			fix: "Set ciOwnership.fallbackWorkflows[].path to a workflow file path or remove the entry.",
		};
	}
	if (!CI_FALLBACK_WORKFLOW_ROLES.has(workflow.role)) {
		return {
			id: `ci-ownership.fallback-workflow.${workflow.path}.role-invalid`,
			severity: "error",
			message: `${workflow.path} has unsupported fallback workflow role ${workflow.role || "missing"}.`,
			path: workflow.path,
			fix: "Use role fallback_pr_gate or release_publishing.",
		};
	}
	if (workflow.purpose.trim() === "") {
		return {
			id: `ci-ownership.fallback-workflow.${workflow.path}.purpose-invalid`,
			severity: "error",
			message: `${workflow.path} requires a non-empty fallback workflow purpose.`,
			path: workflow.path,
			fix: "Describe why this fallback workflow exists in ciOwnership.fallbackWorkflows[].purpose.",
		};
	}
	if (!workflow.allowAutomaticPrTriggersValid) {
		return {
			id: `ci-ownership.fallback-workflow.${workflow.path}.allow-automatic-pr-triggers-invalid`,
			severity: "error",
			message: `${workflow.path} requires boolean allowAutomaticPrTriggers.`,
			path: workflow.path,
			fix: "Set allowAutomaticPrTriggers to true or false.",
		};
	}
	return null;
}

/** Read a declared workflow file, appending findings for missing or unreadable files. */
function readWorkflowContent(input: {
	findings: CIOwnershipGateFinding[];
	workflow: NormalizedFallbackWorkflow;
	workflowPath: string;
}): string | null {
	if (!existsSync(input.workflowPath)) {
		input.findings.push({
			id: `ci-ownership.fallback-workflow.${input.workflow.path}.missing`,
			severity: "error",
			message: `Configured fallback workflow is missing: ${input.workflow.path}.`,
			path: input.workflow.path,
			fix: "Restore the workflow or remove it from ciOwnership.fallbackWorkflows.",
		});
		return null;
	}
	try {
		return readFileSync(input.workflowPath, "utf-8");
	} catch (error) {
		input.findings.push({
			id: `ci-ownership.fallback-workflow.${input.workflow.path}.read-failed`,
			severity: "error",
			message: `Configured fallback workflow could not be read: ${input.workflow.path}.`,
			path: input.workflow.path,
			fix: `Restore readable workflow contents or remove ${input.workflow.path} from ciOwnership.fallbackWorkflows. ${error instanceof Error ? error.message : String(error)}`,
		});
		return null;
	}
}

/** Append a finding for fallback workflow PR trigger compliance. */
function appendWorkflowTriggerFinding(input: {
	findings: CIOwnershipGateFinding[];
	workflow: NormalizedFallbackWorkflow;
	content: string;
}): void {
	const hasPrTrigger = workflowHasAutomaticPrTrigger(input.content);
	if (hasPrTrigger && !input.workflow.allowAutomaticPrTriggers) {
		input.findings.push({
			id: `ci-ownership.fallback-workflow.${input.workflow.path}.automatic-pr-trigger`,
			severity: "error",
			message: `${input.workflow.path} is classified as ${input.workflow.role} but has automatic PR-like triggers.`,
			path: input.workflow.path,
			fix: "Remove pull_request, pull_request_target, or merge_group triggers, or explicitly migrate CI ownership in harness.contract.json.",
		});
		return;
	}
	input.findings.push({
		id: `ci-ownership.fallback-workflow.${input.workflow.path}.ok`,
		severity: "info",
		message: `${input.workflow.path} is constrained for ${input.workflow.role} ownership.`,
		path: input.workflow.path,
	});
}

/** Convert a check name into a stable finding identifier token. */
function findingIdToken(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}
