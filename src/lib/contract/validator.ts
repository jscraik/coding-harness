import type {
	EvidencePolicy,
	HarnessContract,
	ImageFormat,
	PilotAuthzPolicy,
	PilotGapCasePolicy,
	PilotRollbackPolicy,
	RemediationPolicy,
	RemediationProviderPolicy,
	ReviewPolicy,
	RiskTier,
	TimeoutAction,
} from "./types.js";

const VALID_RISK_TIERS: RiskTier[] = ["high", "medium", "low"];
const VALID_TIMEOUT_ACTIONS: TimeoutAction[] = ["fail", "warn"];
const VALID_IMAGE_FORMATS: ImageFormat[] = ["png", "jpeg"];
const VALID_ROLLBACK_MODES = ["manual", "autonomous"] as const;
const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype"] as const;

// Machine-readable error codes for programmatic handling
export enum ValidationErrorCode {
	MISSING_REQUIRED_FIELD = "MISSING_REQUIRED_FIELD",
	INVALID_TYPE = "INVALID_TYPE",
	INVALID_VALUE = "INVALID_VALUE",
	FORBIDDEN_KEY = "FORBIDDEN_KEY",
}

export interface ValidationError {
	code: ValidationErrorCode;
	path: string;
	message: string;
	expected?: string;
	received?: string;
	fix?: string;
}

export interface ValidationResult<T> {
	success: boolean;
	data?: T;
	errors: ValidationError[];
}

function isValidRiskTier(value: unknown): value is RiskTier {
	return (
		typeof value === "string" && VALID_RISK_TIERS.includes(value as RiskTier)
	);
}

function isValidRiskTierRules(
	value: unknown,
): value is Record<string, RiskTier> {
	if (typeof value !== "object" || value === null) return false;
	for (const [pattern, tier] of Object.entries(
		value as Record<string, unknown>,
	)) {
		// Block prototype pollution
		if (FORBIDDEN_KEYS.includes(pattern as (typeof FORBIDDEN_KEYS)[number])) {
			return false;
		}
		if (typeof pattern !== "string" || !isValidRiskTier(tier)) return false;
	}
	return true;
}

function isValidTimeoutAction(value: unknown): value is TimeoutAction {
	return (
		typeof value === "string" &&
		VALID_TIMEOUT_ACTIONS.includes(value as TimeoutAction)
	);
}

function isValidReviewPolicy(value: unknown): value is ReviewPolicy {
	if (typeof value !== "object" || value === null) return false;
	const policy = value as Record<string, unknown>;

	// Validate timeoutSeconds
	if (
		typeof policy.timeoutSeconds !== "number" ||
		policy.timeoutSeconds <= 0 ||
		!Number.isInteger(policy.timeoutSeconds)
	) {
		return false;
	}

	// Validate timeoutAction
	if (!isValidTimeoutAction(policy.timeoutAction)) {
		return false;
	}

	return true;
}

function isValidImageFormat(value: unknown): value is ImageFormat {
	return (
		typeof value === "string" &&
		VALID_IMAGE_FORMATS.includes(value as ImageFormat)
	);
}

export function isValidEvidencePolicy(value: unknown): value is EvidencePolicy {
	if (typeof value !== "object" || value === null) return false;
	const policy = value as Record<string, unknown>;

	// Validate requiredFor (must be array of strings)
	if (!Array.isArray(policy.requiredFor)) {
		return false;
	}
	for (const pattern of policy.requiredFor) {
		if (typeof pattern !== "string") {
			return false;
		}
		// Block prototype pollution
		if (FORBIDDEN_KEYS.includes(pattern as (typeof FORBIDDEN_KEYS)[number])) {
			return false;
		}
	}

	// Validate allowedTypes (must be array of valid formats)
	if (!Array.isArray(policy.allowedTypes)) {
		return false;
	}
	for (const format of policy.allowedTypes) {
		if (!isValidImageFormat(format)) {
			return false;
		}
	}

	// Validate maxFileSizeBytes (optional, must be positive integer)
	if (
		policy.maxFileSizeBytes !== undefined &&
		(typeof policy.maxFileSizeBytes !== "number" ||
			policy.maxFileSizeBytes <= 0 ||
			!Number.isInteger(policy.maxFileSizeBytes))
	) {
		return false;
	}

	return true;
}

/**
 * Validate remediation provider policy.
 */
function isValidRemediationProviderPolicy(
	value: unknown,
): value is RemediationProviderPolicy {
	if (typeof value !== "object" || value === null) return false;
	const policy = value as Record<string, unknown>;

	// Validate autoApplyMaxTier
	if (!isValidRiskTier(policy.autoApplyMaxTier)) {
		return false;
	}

	// Validate dryRunOnlyByDefault
	if (typeof policy.dryRunOnlyByDefault !== "boolean") {
		return false;
	}

	return true;
}

/**
 * Validate full remediation policy.
 */
export function isValidRemediationPolicy(
	value: unknown,
): value is RemediationPolicy {
	if (typeof value !== "object" || value === null) return false;
	const policy = value as Record<string, unknown>;

	// Validate providerDefaults (must be object of provider policies)
	if (
		typeof policy.providerDefaults !== "object" ||
		policy.providerDefaults === null
	) {
		return false;
	}
	for (const [provider, providerPolicy] of Object.entries(
		policy.providerDefaults as Record<string, unknown>,
	)) {
		// Block prototype pollution
		if (FORBIDDEN_KEYS.includes(provider as (typeof FORBIDDEN_KEYS)[number])) {
			return false;
		}
		if (!isValidRemediationProviderPolicy(providerPolicy)) {
			return false;
		}
	}

	// Validate marker (required string)
	if (typeof policy.marker !== "string") {
		return false;
	}

	// Validate timeoutMinutes (required positive integer)
	if (
		typeof policy.timeoutMinutes !== "number" ||
		policy.timeoutMinutes <= 0 ||
		!Number.isInteger(policy.timeoutMinutes)
	) {
		return false;
	}

	// Validate retryLimit (required non-negative integer)
	if (
		typeof policy.retryLimit !== "number" ||
		policy.retryLimit < 0 ||
		!Number.isInteger(policy.retryLimit)
	) {
		return false;
	}

	// Validate requireEvidence (required boolean)
	if (typeof policy.requireEvidence !== "boolean") {
		return false;
	}

	return true;
}

/**
 * Validate pilot gap-case policy.
 */
export function isValidPilotGapCasePolicy(
	value: unknown,
): value is PilotGapCasePolicy {
	if (typeof value !== "object" || value === null) return false;
	const policy = value as Record<string, unknown>;

	// Validate enabled (required boolean)
	if (typeof policy.enabled !== "boolean") {
		return false;
	}

	// Validate defaultSlaHours (required positive integer)
	if (
		typeof policy.defaultSlaHours !== "number" ||
		policy.defaultSlaHours <= 0 ||
		!Number.isInteger(policy.defaultSlaHours)
	) {
		return false;
	}

	// Validate requireClosureEvidence (required boolean)
	if (typeof policy.requireClosureEvidence !== "boolean") {
		return false;
	}

	// Validate storePath (optional string)
	if (policy.storePath !== undefined && typeof policy.storePath !== "string") {
		return false;
	}

	return true;
}

/**
 * Validate pilot rollback policy.
 */
export function isValidPilotRollbackPolicy(
	value: unknown,
): value is PilotRollbackPolicy {
	if (typeof value !== "object" || value === null) return false;
	const policy = value as Record<string, unknown>;

	// Validate autoTrigger (required boolean)
	if (typeof policy.autoTrigger !== "boolean") {
		return false;
	}

	// Validate requireManualRelease (required boolean)
	if (typeof policy.requireManualRelease !== "boolean") {
		return false;
	}

	// Validate completionMarkerPath (required string)
	if (typeof policy.completionMarkerPath !== "string") {
		return false;
	}

	// Validate mode (required, must be valid value)
	if (
		typeof policy.mode !== "string" ||
		!VALID_ROLLBACK_MODES.includes(
			policy.mode as (typeof VALID_ROLLBACK_MODES)[number],
		)
	) {
		return false;
	}

	return true;
}

/**
 * Validate pilot authorization policy.
 */
export function isValidPilotAuthzPolicy(
	value: unknown,
): value is PilotAuthzPolicy {
	if (typeof value !== "object" || value === null) return false;
	const policy = value as Record<string, unknown>;

	// Validate githubScopeAllowlist (required string array)
	if (!Array.isArray(policy.githubScopeAllowlist)) {
		return false;
	}
	for (const scope of policy.githubScopeAllowlist) {
		if (typeof scope !== "string") {
			return false;
		}
	}

	// Validate repoAllowlist (required string array)
	if (!Array.isArray(policy.repoAllowlist)) {
		return false;
	}
	for (const pattern of policy.repoAllowlist) {
		if (typeof pattern !== "string") {
			return false;
		}
		// Block prototype pollution
		if (FORBIDDEN_KEYS.includes(pattern as (typeof FORBIDDEN_KEYS)[number])) {
			return false;
		}
	}

	// Validate branchAllowlist (required string array)
	if (!Array.isArray(policy.branchAllowlist)) {
		return false;
	}
	for (const pattern of policy.branchAllowlist) {
		if (typeof pattern !== "string") {
			return false;
		}
		// Block prototype pollution
		if (FORBIDDEN_KEYS.includes(pattern as (typeof FORBIDDEN_KEYS)[number])) {
			return false;
		}
	}

	// Validate protectedBranchDenylist (required string array)
	if (!Array.isArray(policy.protectedBranchDenylist)) {
		return false;
	}
	for (const pattern of policy.protectedBranchDenylist) {
		if (typeof pattern !== "string") {
			return false;
		}
		// Block prototype pollution
		if (FORBIDDEN_KEYS.includes(pattern as (typeof FORBIDDEN_KEYS)[number])) {
			return false;
		}
	}

	// Validate enforceBranchProtection (required boolean)
	if (typeof policy.enforceBranchProtection !== "boolean") {
		return false;
	}

	return true;
}

export function validateContract(
	data: unknown,
): ValidationResult<HarnessContract> {
	const errors: ValidationError[] = [];

	if (typeof data !== "object" || data === null) {
		errors.push({
			code: ValidationErrorCode.INVALID_TYPE,
			path: "root",
			message: "Contract must be an object",
			expected: "object",
			received: data === null ? "null" : typeof data,
		});
		return { success: false, errors };
	}

	const obj = data as Record<string, unknown>;

	// Validate version (required)
	if (typeof obj.version !== "string") {
		errors.push({
			code: ValidationErrorCode.MISSING_REQUIRED_FIELD,
			path: "version",
			message: "Required field 'version' must be a string",
			expected: "string (e.g., '1.0')",
			received: typeof obj.version,
			fix: 'Add "version": "1.0" to your contract',
		});
	}

	// Validate riskTierRules
	if ("riskTierRules" in obj) {
		const rules = obj.riskTierRules;
		if (typeof rules !== "object" || rules === null) {
			errors.push({
				code: ValidationErrorCode.INVALID_TYPE,
				path: "riskTierRules",
				message: "Must be an object mapping glob patterns to risk tiers",
				expected: "{ 'src/auth/**': 'high' | 'medium' | 'low' }",
				received: typeof rules,
			});
		} else {
			// Check for forbidden keys (prototype pollution)
			for (const key of Object.keys(rules as Record<string, unknown>)) {
				if (FORBIDDEN_KEYS.includes(key as (typeof FORBIDDEN_KEYS)[number])) {
					errors.push({
						code: ValidationErrorCode.FORBIDDEN_KEY,
						path: `riskTierRules.${key}`,
						message: `Forbidden key '${key}' is not allowed`,
						fix: `Remove '${key}' from riskTierRules`,
					});
				}
			}
			// Validate tier values
			if (!isValidRiskTierRules(rules)) {
				errors.push({
					code: ValidationErrorCode.INVALID_VALUE,
					path: "riskTierRules",
					message: "All tier values must be 'high', 'medium', or 'low'",
					fix: "Ensure all tier values are valid risk tiers",
				});
			}
		}
	}

	// Validate reviewPolicy (optional)
	let reviewPolicy: ReviewPolicy | undefined;
	if ("reviewPolicy" in obj && obj.reviewPolicy !== undefined) {
		if (!isValidReviewPolicy(obj.reviewPolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "reviewPolicy",
				message:
					"reviewPolicy must have timeoutSeconds (positive integer) and timeoutAction ('fail' | 'warn')",
				expected: "{ timeoutSeconds: 600, timeoutAction: 'fail' | 'warn' }",
				received: JSON.stringify(obj.reviewPolicy),
				fix: "Ensure reviewPolicy has valid timeoutSeconds and timeoutAction",
			});
		} else {
			reviewPolicy = obj.reviewPolicy as ReviewPolicy;
		}
	}

	// Validate evidencePolicy (optional)
	let evidencePolicy: EvidencePolicy | undefined;
	if ("evidencePolicy" in obj && obj.evidencePolicy !== undefined) {
		if (!isValidEvidencePolicy(obj.evidencePolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "evidencePolicy",
				message:
					"evidencePolicy must have requiredFor (string array) and allowedTypes ('png' | 'jpeg' array)",
				expected:
					"{ requiredFor: ['src/ui/**'], allowedTypes: ['png', 'jpeg'], maxFileSizeBytes?: number }",
				received: JSON.stringify(obj.evidencePolicy),
				fix: "Ensure evidencePolicy has valid requiredFor and allowedTypes",
			});
		} else {
			evidencePolicy = obj.evidencePolicy as EvidencePolicy;
		}
	}

	// Validate remediationPolicy (optional)
	let remediationPolicy: RemediationPolicy | undefined;
	if ("remediationPolicy" in obj && obj.remediationPolicy !== undefined) {
		if (!isValidRemediationPolicy(obj.remediationPolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "remediationPolicy",
				message:
					"remediationPolicy must have providerDefaults, marker, timeoutMinutes, retryLimit, and requireEvidence",
				expected:
					"{ providerDefaults: {...}, marker: string, timeoutMinutes: number, retryLimit: number, requireEvidence: boolean }",
				received: JSON.stringify(obj.remediationPolicy),
				fix: "Ensure remediationPolicy has all required fields with valid values",
			});
		} else {
			remediationPolicy = obj.remediationPolicy as RemediationPolicy;
		}
	}

	// Validate pilotGapCasePolicy (optional)
	let pilotGapCasePolicy: PilotGapCasePolicy | undefined;
	if ("pilotGapCasePolicy" in obj && obj.pilotGapCasePolicy !== undefined) {
		if (!isValidPilotGapCasePolicy(obj.pilotGapCasePolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "pilotGapCasePolicy",
				message:
					"pilotGapCasePolicy must have enabled (boolean), defaultSlaHours (positive integer), requireClosureEvidence (boolean)",
				expected:
					"{ enabled: boolean, defaultSlaHours: number, requireClosureEvidence: boolean, storePath?: string }",
				received: JSON.stringify(obj.pilotGapCasePolicy),
				fix: "Ensure pilotGapCasePolicy has all required fields with valid values",
			});
		} else {
			pilotGapCasePolicy = obj.pilotGapCasePolicy as PilotGapCasePolicy;
		}
	}

	// Validate pilotRollbackPolicy (optional)
	let pilotRollbackPolicy: PilotRollbackPolicy | undefined;
	if ("pilotRollbackPolicy" in obj && obj.pilotRollbackPolicy !== undefined) {
		if (!isValidPilotRollbackPolicy(obj.pilotRollbackPolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "pilotRollbackPolicy",
				message:
					"pilotRollbackPolicy must have autoTrigger, requireManualRelease (booleans), completionMarkerPath (string), mode ('manual' | 'autonomous')",
				expected:
					"{ autoTrigger: boolean, requireManualRelease: boolean, completionMarkerPath: string, mode: 'manual' | 'autonomous' }",
				received: JSON.stringify(obj.pilotRollbackPolicy),
				fix: "Ensure pilotRollbackPolicy has all required fields with valid values",
			});
		} else {
			pilotRollbackPolicy = obj.pilotRollbackPolicy as PilotRollbackPolicy;
		}
	}

	// Validate pilotAuthzPolicy (optional)
	let pilotAuthzPolicy: PilotAuthzPolicy | undefined;
	if ("pilotAuthzPolicy" in obj && obj.pilotAuthzPolicy !== undefined) {
		if (!isValidPilotAuthzPolicy(obj.pilotAuthzPolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "pilotAuthzPolicy",
				message:
					"pilotAuthzPolicy must have githubScopeAllowlist, repoAllowlist, branchAllowlist, protectedBranchDenylist (string arrays), and enforceBranchProtection (boolean)",
				expected:
					"{ githubScopeAllowlist: string[], repoAllowlist: string[], branchAllowlist: string[], protectedBranchDenylist: string[], enforceBranchProtection: boolean }",
				received: JSON.stringify(obj.pilotAuthzPolicy),
				fix: "Ensure pilotAuthzPolicy has all required fields with valid values",
			});
		} else {
			pilotAuthzPolicy = obj.pilotAuthzPolicy as PilotAuthzPolicy;
		}
	}

	if (errors.length > 0) {
		return { success: false, errors };
	}

	return {
		success: true,
		data: {
			version: obj.version as string,
			riskTierRules: (obj.riskTierRules as Record<string, RiskTier>) ?? {},
			reviewPolicy,
			evidencePolicy,
			remediationPolicy,
			pilotGapCasePolicy,
			pilotRollbackPolicy,
			pilotAuthzPolicy,
		},
		errors: [],
	};
}
