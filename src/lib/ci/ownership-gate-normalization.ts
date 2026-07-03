import { SECURITY_SCAN_CHECK_NAME } from "../policy/required-check-names.js";

interface RawCIOwnershipInput {
	schemaVersion?: unknown;
	primaryPrGate?: unknown;
	reviewProvider?: unknown;
	securityChecks?: unknown;
	fallbackWorkflows?: unknown;
}

/** Normalized fallback GitHub Actions workflow ownership policy. */
export interface NormalizedFallbackWorkflow {
	path: string;
	role: string;
	purpose: string;
	allowAutomaticPrTriggers: boolean;
	allowAutomaticPrTriggersValid: boolean;
}

/** Deterministic CI ownership policy shape consumed by the gate validator. */
export interface NormalizedCIOwnership {
	schemaVersion: string;
	policyValid: boolean;
	primaryPrGate: string;
	reviewProvider: string;
	securityChecks: string[];
	securityChecksValid: boolean;
	fallbackWorkflowsValid: boolean;
	fallbackWorkflows: NormalizedFallbackWorkflow[];
}

export const DEFAULT_CI_OWNERSHIP = {
	schemaVersion: "ci-ownership/v1",
	primaryPrGate: "circleci",
	reviewProvider: "coderabbit",
	securityChecks: [SECURITY_SCAN_CHECK_NAME],
	fallbackWorkflows: [],
} as const;

/**
 * Normalize a possibly missing or malformed CI ownership contract section into a deterministic structure.
 */
export function normalizeCIOwnership(
	value: RawCIOwnershipInput | undefined,
): NormalizedCIOwnership {
	if (!isCIOwnershipRecord(value)) return defaultOwnership(value === undefined);
	return {
		policyValid: true,
		schemaVersion: stringOrDefault(
			value.schemaVersion,
			DEFAULT_CI_OWNERSHIP.schemaVersion,
		),
		primaryPrGate: stringOrDefault(
			value.primaryPrGate,
			DEFAULT_CI_OWNERSHIP.primaryPrGate,
		),
		reviewProvider: stringOrDefault(
			value.reviewProvider,
			DEFAULT_CI_OWNERSHIP.reviewProvider,
		),
		...normalizeSecurityChecks(value.securityChecks),
		...normalizeFallbackWorkflows(value.fallbackWorkflows),
	};
}

/** Build deterministic default CI ownership with validity metadata. */
function defaultOwnership(policyValid: boolean): NormalizedCIOwnership {
	return {
		...DEFAULT_CI_OWNERSHIP,
		policyValid,
		securityChecks: [...DEFAULT_CI_OWNERSHIP.securityChecks],
		securityChecksValid: true,
		fallbackWorkflowsValid: true,
		fallbackWorkflows: [],
	};
}

/** Return whether a raw value is an object-shaped CI ownership policy. */
function isCIOwnershipRecord(
	value: RawCIOwnershipInput | undefined,
): value is RawCIOwnershipInput {
	return (
		value !== undefined &&
		value !== null &&
		typeof value === "object" &&
		!Array.isArray(value)
	);
}

/** Return a string policy field or its canonical default. */
function stringOrDefault(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

/** Normalize security check policy while preserving malformed-array evidence. */
function normalizeSecurityChecks(value: unknown): {
	securityChecks: string[];
	securityChecksValid: boolean;
} {
	if (!Array.isArray(value)) {
		return {
			securityChecks: [...DEFAULT_CI_OWNERSHIP.securityChecks],
			securityChecksValid: true,
		};
	}
	return {
		securityChecks: value
			.filter(isValidSecurityCheckName)
			.map((check) => check.trim()),
		securityChecksValid: value.every(isValidSecurityCheckName),
	};
}

/** Normalize fallback workflow policy while preserving malformed-shape evidence. */
function normalizeFallbackWorkflows(value: unknown): {
	fallbackWorkflows: NormalizedFallbackWorkflow[];
	fallbackWorkflowsValid: boolean;
} {
	if (value === undefined) {
		return { fallbackWorkflows: [], fallbackWorkflowsValid: true };
	}
	if (!Array.isArray(value)) {
		return { fallbackWorkflows: [], fallbackWorkflowsValid: false };
	}
	return {
		fallbackWorkflows: value
			.filter(isFallbackWorkflowRecord)
			.map(normalizeFallbackWorkflow),
		fallbackWorkflowsValid: value.every(isFallbackWorkflowInputValid),
	};
}

/** Normalize one fallback workflow object for downstream validation. */
function normalizeFallbackWorkflow(
	workflow: Record<string, unknown>,
): NormalizedFallbackWorkflow {
	return {
		path: String(workflow.path ?? ""),
		role: String(workflow.role ?? ""),
		purpose: String(workflow.purpose ?? ""),
		allowAutomaticPrTriggers: workflow.allowAutomaticPrTriggers === true,
		allowAutomaticPrTriggersValid:
			typeof workflow.allowAutomaticPrTriggers === "boolean",
	};
}

/** Return whether a value can be interpreted as a fallback workflow object. */
function isFallbackWorkflowRecord(
	value: unknown,
): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate typed fields on one fallback workflow input. */
function isFallbackWorkflowInputValid(value: unknown): boolean {
	if (!isFallbackWorkflowRecord(value)) return false;
	return (
		(value.path === undefined || typeof value.path === "string") &&
		(value.role === undefined || typeof value.role === "string") &&
		(value.purpose === undefined || typeof value.purpose === "string") &&
		(value.allowAutomaticPrTriggers === undefined ||
			typeof value.allowAutomaticPrTriggers === "boolean")
	);
}

/** Return whether a raw security check value is a non-empty name. */
function isValidSecurityCheckName(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}
