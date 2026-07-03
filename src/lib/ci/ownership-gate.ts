import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CIRCLECI_PRIMARY_CHECK } from "./branch-protect-sync.js";
import { normalizeCIOwnership } from "./ownership-gate-normalization.js";
import { validateCIOwnershipContract } from "./ownership-gate-validation.js";

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

/**
 * Evaluate a repository's CI ownership contract and produce machine-readable findings about primary provider, review, and security check requirements.
 */
export function runCIOwnershipGate(
	options: RunCIOwnershipGateOptions = {},
): CIOwnershipGateResult {
	const repoRoot = options.repoRoot ?? process.cwd();
	const contractPath = options.contractPath ?? DEFAULT_CONTRACT_PATH;
	const expectedPrimaryProvider = options.expectedPrimaryProvider ?? "circleci";
	const resolvedContractPath = resolve(repoRoot, contractPath);
	const findings: CIOwnershipGateFinding[] = [];
	const contract = readHarnessContract({
		resolvedContractPath,
		contractPath,
		findings,
	});
	if (!contract) return buildResult(contractPath, findings);

	const ciOwnership = normalizeCIOwnership(contract.ciOwnership);
	appendDefaultedOwnershipFinding({
		hasCIOwnership: Boolean(contract.ciOwnership),
		findings,
		contractPath,
	});
	validateCIOwnershipContract({
		findings,
		ciOwnership,
		contractPath,
		repoRoot,
	});
	appendPrimaryProviderFinding({
		findings,
		activeProvider: contract.ciProviderPolicy?.activeProvider,
		expectedPrimaryProvider,
		contractPath,
	});
	appendRequiredCheckFindings({
		findings,
		requiredChecks: normalizeRequiredChecks(
			contract.branchProtection?.requiredChecks,
		),
		securityChecks: ciOwnership.securityChecks,
		contractPath,
	});

	return buildResult(contractPath, findings);
}

/** Read and parse the harness contract, appending a finding when it is missing or invalid. */
function readHarnessContract(input: {
	resolvedContractPath: string;
	contractPath: string;
	findings: CIOwnershipGateFinding[];
}): HarnessContractLike | null {
	if (!existsSync(input.resolvedContractPath)) {
		input.findings.push({
			id: "ci-ownership.contract.missing",
			severity: "error",
			message: `CI ownership contract not found at ${input.contractPath}.`,
			path: input.contractPath,
			fix: "Create or restore harness.contract.json with ciProviderPolicy and branchProtection.requiredChecks.",
		});
		return null;
	}
	try {
		return JSON.parse(
			readFileSync(input.resolvedContractPath, "utf-8"),
		) as HarnessContractLike;
	} catch (error) {
		input.findings.push({
			id: "ci-ownership.contract.unreadable",
			severity: "error",
			message: `CI ownership contract could not be parsed: ${error instanceof Error ? error.message : String(error)}`,
			path: input.contractPath,
			fix: "Fix harness.contract.json so it is valid JSON.",
		});
		return null;
	}
}

/** Record that legacy deterministic CI ownership defaults were used. */
function appendDefaultedOwnershipFinding(input: {
	hasCIOwnership: boolean;
	findings: CIOwnershipGateFinding[];
	contractPath: string;
}): void {
	if (input.hasCIOwnership) return;
	input.findings.push({
		id: "ci-ownership.contract.defaulted",
		severity: "info",
		message:
			"ciOwnership is missing; using deterministic defaults for CircleCI primary, CodeRabbit review, and CircleCI security-scan ownership.",
		path: input.contractPath,
	});
}

/** Validate that the configured primary PR provider remains CircleCI. */
function appendPrimaryProviderFinding(input: {
	findings: CIOwnershipGateFinding[];
	activeProvider: unknown;
	expectedPrimaryProvider: "circleci";
	contractPath: string;
}): void {
	if (input.activeProvider === input.expectedPrimaryProvider) {
		input.findings.push({
			id: "ci-ownership.primary-provider.ok",
			severity: "info",
			message: `Primary PR gate provider is ${input.expectedPrimaryProvider}.`,
			path: input.contractPath,
		});
		return;
	}
	input.findings.push({
		id: "ci-ownership.primary-provider.mismatch",
		severity: "error",
		message: `Primary PR gate provider must be ${input.expectedPrimaryProvider}; found ${String(input.activeProvider ?? "missing")}.`,
		path: input.contractPath,
		fix: `Set ciProviderPolicy.activeProvider to ${input.expectedPrimaryProvider} or update the CI ownership policy intentionally.`,
	});
}

/** Validate required branch-protection checks for CI, review, and security ownership. */
function appendRequiredCheckFindings(input: {
	findings: CIOwnershipGateFinding[];
	requiredChecks: Set<string>;
	securityChecks: string[];
	contractPath: string;
}): void {
	requireCheck({
		findings: input.findings,
		requiredChecks: input.requiredChecks,
		check: CIRCLECI_PRIMARY_CHECK,
		id: "ci-ownership.circleci-primary-check.missing",
		message: `${CIRCLECI_PRIMARY_CHECK} must remain the CircleCI-owned primary PR workflow check.`,
		contractPath: input.contractPath,
	});
	requireCheck({
		findings: input.findings,
		requiredChecks: input.requiredChecks,
		check: CODERABBIT_REQUIRED_CHECK,
		id: "ci-ownership.coderabbit-review-check.missing",
		message: "CodeRabbit must remain an independent required review check.",
		contractPath: input.contractPath,
	});
	for (const securityCheck of input.securityChecks) {
		requireCheck({
			findings: input.findings,
			requiredChecks: input.requiredChecks,
			check: securityCheck,
			id: `ci-ownership.security-check.${findingIdToken(securityCheck)}.missing`,
			message: `${securityCheck} must remain an independent required security check.`,
			contractPath: input.contractPath,
		});
	}
}

/** Normalize branch-protection required checks into a lookup set. */
function normalizeRequiredChecks(value: unknown): Set<string> {
	if (!Array.isArray(value)) return new Set();
	return new Set(
		value.filter((item): item is string => typeof item === "string"),
	);
}

/** Append a pass or fail finding for a single required check. */
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

/** Convert a check name into a stable finding identifier token. */
function findingIdToken(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** Build the final CI ownership gate result summary. */
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
