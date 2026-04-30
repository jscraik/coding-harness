import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SEMGREP_CLOUD_CHECK_NAME } from "../policy/required-checks.js";
import { CIRCLECI_PRIMARY_CHECK } from "./branch-protect-sync.js";

export const CI_OWNERSHIP_GATE_SCHEMA_VERSION = "ci-ownership-gate/v1";

/** Aggregate CI ownership gate status. */
export type CIOwnershipGateStatus = "pass" | "fail";

/** Severity for one CI ownership gate finding. */
export type CIOwnershipGateSeverity = "error" | "info";

/** Structured finding emitted by the CI ownership gate. */
export interface CIOwnershipGateFinding {
	id: string;
	severity: CIOwnershipGateSeverity;
	message: string;
	path?: string | undefined;
	fix?: string | undefined;
}

/** Machine-readable CI ownership gate result. */
export interface CIOwnershipGateResult {
	schemaVersion: typeof CI_OWNERSHIP_GATE_SCHEMA_VERSION;
	status: CIOwnershipGateStatus;
	contractPath: string;
	findings: CIOwnershipGateFinding[];
	summary: {
		errors: number;
		info: number;
		total: number;
	};
}

/** Options for evaluating CI ownership policy. */
export interface RunCIOwnershipGateOptions {
	repoRoot?: string | undefined;
	contractPath?: string | undefined;
	expectedPrimaryProvider?: "circleci" | undefined;
}

interface HarnessContractLike {
	ciProviderPolicy?: {
		activeProvider?: unknown;
	};
	branchProtection?: {
		requiredChecks?: unknown;
	};
	ciOwnership?: {
		schemaVersion?: unknown;
		primaryPrGate?: unknown;
		reviewProvider?: unknown;
		securityChecks?: unknown;
		fallbackWorkflows?: unknown;
	};
}

const DEFAULT_CONTRACT_PATH = "harness.contract.json";
const CODERABBIT_REQUIRED_CHECK = "CodeRabbit";
const DEFAULT_CI_OWNERSHIP = {
	schemaVersion: "ci-ownership/v1",
	primaryPrGate: "circleci",
	reviewProvider: "coderabbit",
	securityChecks: [SEMGREP_CLOUD_CHECK_NAME],
	fallbackWorkflows: [],
};

/**
 * Evaluate a repository's CI ownership contract and produce machine-readable findings about primary provider, review, and security check requirements.
 *
 * @param options - Optional overrides:
 *   - repoRoot: filesystem root of the repository (defaults to `process.cwd()`).
 *   - contractPath: path to the CI ownership contract relative to `repoRoot` (defaults to `harness.contract.json`).
 *   - expectedPrimaryProvider: expected active CI provider for the primary PR gate (defaults to `"circleci"`).
 * @returns The gate result containing schemaVersion, overall status (`"pass"` or `"fail"`), the resolved contractPath, an array of findings, and a summary with counts of errors and info findings.
 */
export function runCIOwnershipGate(
	options: RunCIOwnershipGateOptions = {},
): CIOwnershipGateResult {
	const repoRoot = options.repoRoot ?? process.cwd();
	const contractPath = options.contractPath ?? DEFAULT_CONTRACT_PATH;
	const expectedPrimaryProvider = options.expectedPrimaryProvider ?? "circleci";
	const resolvedContractPath = resolve(repoRoot, contractPath);
	const findings: CIOwnershipGateFinding[] = [];

	if (!existsSync(resolvedContractPath)) {
		findings.push({
			id: "ci-ownership.contract.missing",
			severity: "error",
			message: `CI ownership contract not found at ${contractPath}.`,
			path: contractPath,
			fix: "Create or restore harness.contract.json with ciProviderPolicy and branchProtection.requiredChecks.",
		});
		return buildResult(contractPath, findings);
	}

	let contract: HarnessContractLike;
	try {
		contract = JSON.parse(
			readFileSync(resolvedContractPath, "utf-8"),
		) as HarnessContractLike;
	} catch (error) {
		findings.push({
			id: "ci-ownership.contract.unreadable",
			severity: "error",
			message: `CI ownership contract could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
			path: contractPath,
			fix: "Fix harness.contract.json so it is valid JSON.",
		});
		return buildResult(contractPath, findings);
	}

	const activeProvider = contract.ciProviderPolicy?.activeProvider;
	const ciOwnership = normalizeCIOwnership(contract.ciOwnership);
	if (!contract.ciOwnership) {
		findings.push({
			id: "ci-ownership.contract.defaulted",
			severity: "info",
			message:
				"ciOwnership is missing; using deterministic legacy defaults for CircleCI primary, CodeRabbit review, and Semgrep Cloud security ownership.",
			path: contractPath,
		});
	}
	validateCIOwnershipContract({
		findings,
		ciOwnership,
		contractPath,
		repoRoot,
	});

	if (activeProvider !== expectedPrimaryProvider) {
		findings.push({
			id: "ci-ownership.primary-provider.mismatch",
			severity: "error",
			message: `Primary PR gate provider must be ${expectedPrimaryProvider}; found ${String(activeProvider ?? "missing")}.`,
			path: contractPath,
			fix: `Set ciProviderPolicy.activeProvider to ${expectedPrimaryProvider} or update the CI ownership policy intentionally.`,
		});
	} else {
		findings.push({
			id: "ci-ownership.primary-provider.ok",
			severity: "info",
			message: `Primary PR gate provider is ${expectedPrimaryProvider}.`,
			path: contractPath,
		});
	}

	const requiredChecks = normalizeRequiredChecks(
		contract.branchProtection?.requiredChecks,
	);
	requireCheck({
		findings,
		requiredChecks,
		check: CIRCLECI_PRIMARY_CHECK,
		id: "ci-ownership.circleci-primary-check.missing",
		message: `${CIRCLECI_PRIMARY_CHECK} must remain the CircleCI-owned primary PR workflow check.`,
		contractPath,
	});
	requireCheck({
		findings,
		requiredChecks,
		check: CODERABBIT_REQUIRED_CHECK,
		id: "ci-ownership.coderabbit-review-check.missing",
		message: "CodeRabbit must remain an independent required review check.",
		contractPath,
	});
	requireCheck({
		findings,
		requiredChecks,
		check: SEMGREP_CLOUD_CHECK_NAME,
		id: "ci-ownership.semgrep-cloud-check.missing",
		message:
			"Semgrep Cloud must remain an external GitHub App required security check.",
		contractPath,
	});

	return buildResult(contractPath, findings);
}

/**
 * Normalize a possibly missing or malformed `ciOwnership` contract section into a deterministic structure.
 *
 * @param value - The raw `ciOwnership` value from a parsed harness contract; may be undefined, null, or not an object.
 * @returns An object with the normalized fields:
 * - `schemaVersion`: the schema version string.
 * - `primaryPrGate`: the designated primary PR gate name.
 * - `reviewProvider`: the designated review provider name.
 * - `securityChecks`: an array of security check names (only string entries are kept).
 * - `fallbackWorkflows`: an array of fallback workflow descriptors, each containing:
 *   - `path`: workflow file path (string).
 *   - `role`: workflow role (string).
 *   - `purpose`: workflow purpose (string).
 *   - `allowAutomaticPrTriggers`: boolean indicating whether automatic PR triggers are allowed.
 *
 * When `value` is missing or not an object, the function returns the module's default CI ownership structure.
 */
function normalizeCIOwnership(value: HarnessContractLike["ciOwnership"]): {
	schemaVersion: string;
	primaryPrGate: string;
	reviewProvider: string;
	securityChecks: string[];
	fallbackWorkflows: Array<{
		path: string;
		role: string;
		purpose: string;
		allowAutomaticPrTriggers: boolean;
	}>;
} {
	if (!value || typeof value !== "object") return DEFAULT_CI_OWNERSHIP;
	return {
		schemaVersion:
			typeof value.schemaVersion === "string"
				? value.schemaVersion
				: DEFAULT_CI_OWNERSHIP.schemaVersion,
		primaryPrGate:
			typeof value.primaryPrGate === "string"
				? value.primaryPrGate
				: DEFAULT_CI_OWNERSHIP.primaryPrGate,
		reviewProvider:
			typeof value.reviewProvider === "string"
				? value.reviewProvider
				: DEFAULT_CI_OWNERSHIP.reviewProvider,
		securityChecks: Array.isArray(value.securityChecks)
			? value.securityChecks.filter(
					(check): check is string => typeof check === "string",
				)
			: DEFAULT_CI_OWNERSHIP.securityChecks,
		fallbackWorkflows: Array.isArray(value.fallbackWorkflows)
			? value.fallbackWorkflows
					.filter(
						(workflow): workflow is Record<string, unknown> =>
							typeof workflow === "object" && workflow !== null,
					)
					.map((workflow) => ({
						path: String(workflow.path ?? ""),
						role: String(workflow.role ?? ""),
						purpose: String(workflow.purpose ?? ""),
						allowAutomaticPrTriggers:
							workflow.allowAutomaticPrTriggers === true,
					}))
			: [],
	};
}

/**
 * Validate a normalized CI ownership contract and append any resulting findings.
 *
 * Validates schema version, primary PR gate, review provider, and required security checks; it also validates each configured fallback workflow and pushes corresponding findings into the supplied findings array.
 *
 * @param input - Validation inputs
 * @param input.findings - Array that will receive new findings describing validation errors or informational notes
 * @param input.ciOwnership - Normalized CI ownership object to validate
 * @param input.contractPath - Path to the contract file used as the `path` in any findings
 * @param input.repoRoot - Repository root directory used when validating fallback workflow file paths
 */
function validateCIOwnershipContract(input: {
	findings: CIOwnershipGateFinding[];
	ciOwnership: ReturnType<typeof normalizeCIOwnership>;
	contractPath: string;
	repoRoot: string;
}): void {
	if (input.ciOwnership.schemaVersion !== "ci-ownership/v1") {
		input.findings.push({
			id: "ci-ownership.schema-version.invalid",
			severity: "error",
			message: "ciOwnership.schemaVersion must be ci-ownership/v1.",
			path: input.contractPath,
			fix: "Update ciOwnership.schemaVersion to ci-ownership/v1 and migrate fields intentionally.",
		});
	}
	if (input.ciOwnership.primaryPrGate !== "circleci") {
		input.findings.push({
			id: "ci-ownership.primary-role.mismatch",
			severity: "error",
			message: "ciOwnership.primaryPrGate must remain circleci.",
			path: input.contractPath,
			fix: "Set ciOwnership.primaryPrGate to circleci unless an intentional ownership migration is planned.",
		});
	}
	if (input.ciOwnership.reviewProvider !== "coderabbit") {
		input.findings.push({
			id: "ci-ownership.review-provider.mismatch",
			severity: "error",
			message: "ciOwnership.reviewProvider must remain coderabbit.",
			path: input.contractPath,
			fix: "Set ciOwnership.reviewProvider to coderabbit.",
		});
	}
	if (!input.ciOwnership.securityChecks.includes(SEMGREP_CLOUD_CHECK_NAME)) {
		input.findings.push({
			id: "ci-ownership.security-check.semgrep-cloud.missing",
			severity: "error",
			message:
				"ciOwnership.securityChecks must include semgrep-cloud-platform/scan.",
			path: input.contractPath,
			fix: "Add semgrep-cloud-platform/scan to ciOwnership.securityChecks.",
		});
	}
	for (const workflow of input.ciOwnership.fallbackWorkflows) {
		validateFallbackWorkflow({
			findings: input.findings,
			workflow,
			repoRoot: input.repoRoot,
		});
	}
}

/**
 * Validate a single configured fallback workflow and append findings describing its status.
 *
 * Checks that the referenced workflow file exists, treats non-`fallback_pr_gate` roles as informational,
 * and for `fallback_pr_gate` workflows ensures they do not contain automatic PR-like triggers unless
 * `allowAutomaticPrTriggers` is true. Findings describing errors or informational status (and suggested fixes)
 * are pushed into `input.findings`.
 *
 * @param input - Validation inputs
 * @param input.findings - Array that will receive generated findings describing problems or OK statuses
 * @param input.workflow - A normalized fallback workflow entry (from `normalizeCIOwnership(...).fallbackWorkflows`)
 * @param input.repoRoot - Repository root used to resolve the workflow file path
 */
function validateFallbackWorkflow(input: {
	findings: CIOwnershipGateFinding[];
	workflow: ReturnType<
		typeof normalizeCIOwnership
	>["fallbackWorkflows"][number];
	repoRoot: string;
}): void {
	const workflowPath = resolve(input.repoRoot, input.workflow.path);
	if (!existsSync(workflowPath)) {
		input.findings.push({
			id: `ci-ownership.fallback-workflow.${input.workflow.path}.missing`,
			severity: "error",
			message: `Configured fallback workflow is missing: ${input.workflow.path}.`,
			path: input.workflow.path,
			fix: "Restore the workflow or remove it from ciOwnership.fallbackWorkflows.",
		});
		return;
	}
	if (input.workflow.role !== "fallback_pr_gate") {
		input.findings.push({
			id: `ci-ownership.fallback-workflow.${input.workflow.path}.ok`,
			severity: "info",
			message: `${input.workflow.path} is classified as ${input.workflow.role}.`,
			path: input.workflow.path,
		});
		return;
	}
	const content = readFileSync(workflowPath, "utf-8");
	const hasPrTrigger = /^\s*(pull_request|merge_group)\s*:/m.test(content);
	if (hasPrTrigger && !input.workflow.allowAutomaticPrTriggers) {
		input.findings.push({
			id: `ci-ownership.fallback-workflow.${input.workflow.path}.automatic-pr-trigger`,
			severity: "error",
			message: `${input.workflow.path} is a fallback PR gate but has automatic PR-like triggers.`,
			path: input.workflow.path,
			fix: "Remove pull_request/merge_group triggers or explicitly migrate CI ownership in harness.contract.json.",
		});
		return;
	}
	input.findings.push({
		id: `ci-ownership.fallback-workflow.${input.workflow.path}.ok`,
		severity: "info",
		message: `${input.workflow.path} is constrained for fallback PR gate ownership.`,
		path: input.workflow.path,
	});
}

/**
 * Normalize a branch-protection `requiredChecks`-like value into a set of check names.
 *
 * @param value - The `branchProtection.requiredChecks`-style input (expected to be an array of values)
 * @returns A Set containing string entries from `value`; empty if `value` is not an array
 */
function normalizeRequiredChecks(value: unknown): Set<string> {
	if (!Array.isArray(value)) return new Set();
	return new Set(
		value.filter((item): item is string => typeof item === "string"),
	);
}

/**
 * Adds an "info" finding when a specific required check exists in the normalized set, otherwise adds an "error" finding that includes a suggested fix to add the check.
 *
 * @param input - Function inputs
 * @param input.findings - Array to which the generated finding will be appended
 * @param input.requiredChecks - Normalized set of required branch-protection checks
 * @param input.check - The check name to verify presence of in `requiredChecks`
 * @param input.id - Finding identifier to use when the check is missing (".missing" will be replaced with ".ok" for the present case)
 * @param input.message - Error message to use when the check is missing
 * @param input.contractPath - Path to the contract file used as the finding's `path`
 */
function requireCheck(input: {
	findings: CIOwnershipGateFinding[];
	requiredChecks: Set<string>;
	check: string;
	id: string;
	message: string;
	contractPath: string;
}): void {
	if (input.requiredChecks.has(input.check)) {
		input.findings.push({
			id: input.id.replace(".missing", ".ok"),
			severity: "info",
			message: `${input.check} is present in branchProtection.requiredChecks.`,
			path: input.contractPath,
		});
		return;
	}
	input.findings.push({
		id: input.id,
		severity: "error",
		message: input.message,
		path: input.contractPath,
		fix: `Add ${input.check} to branchProtection.requiredChecks.`,
	});
}

/**
 * Assembles the final CI ownership gate result object.
 *
 * @param contractPath - Filesystem path to the resolved contract used to produce the result
 * @param findings - All findings produced by the gate checks
 * @returns The gate result object containing `schemaVersion`, `status` (`"fail"` if any finding has `severity === "error"`, otherwise `"pass"`), the provided `contractPath`, `findings`, and a `summary` with counts of errors, info, and total findings
 */
function buildResult(
	contractPath: string,
	findings: CIOwnershipGateFinding[],
): CIOwnershipGateResult {
	const errors = findings.filter(
		(finding) => finding.severity === "error",
	).length;
	const info = findings.filter((finding) => finding.severity === "info").length;
	return {
		schemaVersion: CI_OWNERSHIP_GATE_SCHEMA_VERSION,
		status: errors > 0 ? "fail" : "pass",
		contractPath,
		findings,
		summary: {
			errors,
			info,
			total: findings.length,
		},
	};
}
