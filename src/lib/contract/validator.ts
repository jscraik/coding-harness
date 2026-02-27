import type {
	DiffBudget,
	DocsDriftRules,
	EvidencePolicy,
	GapCasePolicy,
	HarnessContract,
	ImageFormat,
	MemoryEvalPolicy,
	MemoryMaintenancePolicy,
	MemoryPolicy,
	MergePolicy,
	MergePolicyEntry,
	MergePolicyValue,
	ObservabilityPolicy,
	PackageManagerPolicy,
	RemediationPolicy,
	ReviewPolicy,
	RiskTier,
	RuntimePolicy,
	TimeoutAction,
	UILoopPolicy,
	UILoopSLO,
} from "./types.js";

const VALID_RISK_TIERS: RiskTier[] = ["high", "medium", "low"];
const VALID_TIMEOUT_ACTIONS: TimeoutAction[] = ["fail", "warn"];
const VALID_IMAGE_FORMATS: ImageFormat[] = ["png", "jpeg"];
const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype"] as const;
const VALID_TOP_LEVEL_KEYS = [
	"version",
	"riskTierRules",
	"reviewPolicy",
	"evidencePolicy",
	"mergePolicy",
	"docsDriftRules",
	"diffBudget",
	"uiLoopPolicy",
	"runtimePolicy",
	"memoryPolicy",
	"memoryMaintenancePolicy",
	"memoryEvalPolicy",
	"observabilityPolicy",
	"packageManagerPolicy",
	"remediationPolicy",
	"gapCasePolicy",
	"pilotGapCasePolicy",
	"pilotRollbackPolicy",
	"pilotAuthzPolicy",
] as const;
const VALID_UI_LOOP_POLICY_KEYS = [
	"fastCommand",
	"verifyCommand",
	"exploreCommand",
	"sloTargets",
] as const;
const VALID_SLO_TARGET_KEYS = ["fastLoopSeconds", "verifyLoopSeconds"] as const;
const VALID_RUNTIME_POLICY_KEYS = ["nodeVersion"] as const;
const VALID_MEMORY_POLICY_KEYS = [
	"enabled",
	"provider",
	"sessionIdTemplate",
	"domain",
	"requiredTags",
	"maxObservationsPerStep",
	"allowedLevels",
	"requireStartRead",
	"requireCloseoutSummary",
	"forbiddenContentPatterns",
] as const;
const VALID_MEMORY_MAINTENANCE_POLICY_KEYS = [
	"validateSchedule",
	"reflectSchedule",
	"questionSlaDays",
	"duplicateThreshold",
] as const;
const VALID_MEMORY_EVAL_POLICY_KEYS = [
	"trialsPerTask",
	"requiredMetrics",
	"passPowKThreshold",
] as const;
const VALID_OBSERVABILITY_POLICY_KEYS = [
	"provider",
	"collectorEndpoint",
] as const;
const VALID_PACKAGE_MANAGER_POLICY_KEYS = [
	"allowedManagers",
	"requiredManager",
] as const;
const VALID_REMEDIATION_PROVIDER_KEYS = ["codeql", "codex"] as const;
const VALID_REMEDIATION_PROVIDER_VALUES = ["high", "medium", "low"] as const;
const VALID_REMEDIATION_POLICY_KEYS = [
	"providerDefaults",
	"canonicalRerunWorkflow",
	"marker",
	"timeoutMinutes",
	"retryLimit",
	"requireEvidence",
] as const;
const VALID_GAP_CASE_POLICY_KEYS = [
	"requiredEvidenceStatuses",
	"requiredCloseReasons",
	"defaultDueDays",
	"caseIdPrefix",
	"caseStore",
	"allowEvidencelessResolve",
] as const;
const VALID_MERGE_POLICY_VALUE_KEYS = ["high", "medium", "low"] as const;

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

function hasForbiddenKey(value: string): boolean {
	return FORBIDDEN_KEYS.includes(value as (typeof FORBIDDEN_KEYS)[number]);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidRiskTier(value: unknown): value is RiskTier {
	return (
		typeof value === "string" && VALID_RISK_TIERS.includes(value as RiskTier)
	);
}

function isValidRiskTierRules(
	value: unknown,
): value is Record<string, RiskTier> {
	if (!isPlainObject(value)) return false;

	for (const [pattern, tier] of Object.entries(value)) {
		if (hasForbiddenKey(pattern)) {
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
	if (!isPlainObject(value)) return false;
	const policy = value as Record<string, unknown>;

	// Reject unknown top-level keys
	const unknownKeys = Object.keys(policy).filter(
		(key) => !["timeoutSeconds", "timeoutAction"].includes(key),
	);
	if (unknownKeys.length > 0) {
		return false;
	}

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

function isValidDiffBudget(value: unknown): value is DiffBudget {
	if (!isPlainObject(value)) return false;
	const budget = value as Record<string, unknown>;

	if (typeof budget.maxFiles !== "number" || budget.maxFiles < 0) {
		return false;
	}
	if (!Number.isInteger(budget.maxFiles)) {
		return false;
	}

	if (typeof budget.maxNetLOC !== "number" || budget.maxNetLOC < 0) {
		return false;
	}
	if (!Number.isInteger(budget.maxNetLOC)) {
		return false;
	}

	if (
		budget.overrideLabel !== undefined &&
		typeof budget.overrideLabel !== "string"
	) {
		return false;
	}

	const invalidKeys = Object.keys(budget).filter(
		(key) => !["maxFiles", "maxNetLOC", "overrideLabel"].includes(key),
	);
	if (invalidKeys.length > 0) {
		return false;
	}

	return true;
}

function isValidUILoopSLO(value: unknown): value is UILoopSLO {
	if (!isPlainObject(value)) return false;
	const slo = value as Record<string, unknown>;

	if (
		Object.keys(slo).length !== VALID_SLO_TARGET_KEYS.length ||
		!Object.keys(slo).every((key) =>
			VALID_SLO_TARGET_KEYS.includes(
				key as (typeof VALID_SLO_TARGET_KEYS)[number],
			),
		)
	) {
		return false;
	}
	if (typeof slo.fastLoopSeconds !== "number" || slo.fastLoopSeconds <= 0) {
		return false;
	}
	if (!Number.isInteger(slo.fastLoopSeconds)) {
		return false;
	}
	if (typeof slo.verifyLoopSeconds !== "number" || slo.verifyLoopSeconds <= 0) {
		return false;
	}
	if (!Number.isInteger(slo.verifyLoopSeconds)) {
		return false;
	}
	return true;
}

function isValidUILoopPolicy(value: unknown): value is UILoopPolicy {
	if (!isPlainObject(value)) return false;
	const policy = value as Record<string, unknown>;

	if (
		Object.keys(policy).length !== VALID_UI_LOOP_POLICY_KEYS.length ||
		!Object.keys(policy).every((key) =>
			VALID_UI_LOOP_POLICY_KEYS.includes(
				key as (typeof VALID_UI_LOOP_POLICY_KEYS)[number],
			),
		)
	) {
		return false;
	}
	if (
		typeof policy.fastCommand !== "string" ||
		policy.fastCommand.length === 0
	) {
		return false;
	}
	if (
		typeof policy.verifyCommand !== "string" ||
		policy.verifyCommand.length === 0
	) {
		return false;
	}
	if (
		typeof policy.exploreCommand !== "string" ||
		policy.exploreCommand.length === 0
	) {
		return false;
	}

	return isValidUILoopSLO(policy.sloTargets);
}

function isValidRuntimePolicy(value: unknown): value is RuntimePolicy {
	if (!isPlainObject(value)) return false;
	const policy = value as Record<string, unknown>;

	const invalidKeys = Object.keys(policy).filter(
		(key) =>
			!VALID_RUNTIME_POLICY_KEYS.includes(
				key as (typeof VALID_RUNTIME_POLICY_KEYS)[number],
			),
	);
	if (invalidKeys.length > 0) {
		return false;
	}
	if (
		typeof policy.nodeVersion !== "string" ||
		policy.nodeVersion.length === 0
	) {
		return false;
	}
	return true;
}

function isValidMemoryPolicy(value: unknown): value is MemoryPolicy {
	if (!isPlainObject(value)) return false;
	const policy = value as Record<string, unknown>;

	const invalidKeys = Object.keys(policy).filter(
		(key) =>
			!VALID_MEMORY_POLICY_KEYS.includes(
				key as (typeof VALID_MEMORY_POLICY_KEYS)[number],
			),
	);
	if (invalidKeys.length > 0) {
		return false;
	}

	if (typeof policy.enabled !== "boolean") return false;
	if (typeof policy.provider !== "string" || policy.provider.length === 0)
		return false;
	if (
		typeof policy.sessionIdTemplate !== "string" ||
		policy.sessionIdTemplate.length === 0
	)
		return false;
	if (typeof policy.domain !== "string" || policy.domain.length === 0)
		return false;
	if (!Array.isArray(policy.requiredTags)) return false;
	if (!policy.requiredTags.every((value) => typeof value === "string"))
		return false;
	if (
		typeof policy.maxObservationsPerStep !== "number" ||
		!Number.isInteger(policy.maxObservationsPerStep) ||
		policy.maxObservationsPerStep < 0
	)
		return false;
	if (!Array.isArray(policy.allowedLevels)) return false;
	if (!policy.allowedLevels.every((value) => typeof value === "string"))
		return false;
	if (typeof policy.requireStartRead !== "boolean") return false;
	if (typeof policy.requireCloseoutSummary !== "boolean") return false;
	if (!Array.isArray(policy.forbiddenContentPatterns)) return false;
	if (
		!policy.forbiddenContentPatterns.every((value) => typeof value === "string")
	)
		return false;
	return true;
}

function isValidMemoryMaintenancePolicy(
	value: unknown,
): value is MemoryMaintenancePolicy {
	if (!isPlainObject(value)) return false;
	const policy = value as Record<string, unknown>;

	const invalidKeys = Object.keys(policy).filter(
		(key) =>
			!VALID_MEMORY_MAINTENANCE_POLICY_KEYS.includes(
				key as (typeof VALID_MEMORY_MAINTENANCE_POLICY_KEYS)[number],
			),
	);
	if (invalidKeys.length > 0) {
		return false;
	}
	if (
		typeof policy.validateSchedule !== "string" ||
		policy.validateSchedule.length === 0
	)
		return false;
	if (
		typeof policy.reflectSchedule !== "string" ||
		policy.reflectSchedule.length === 0
	)
		return false;
	if (
		typeof policy.questionSlaDays !== "number" ||
		!Number.isInteger(policy.questionSlaDays) ||
		policy.questionSlaDays < 0
	)
		return false;
	if (
		typeof policy.duplicateThreshold !== "number" ||
		policy.duplicateThreshold < 0 ||
		policy.duplicateThreshold > 1
	)
		return false;
	return true;
}

function isValidMemoryEvalPolicy(value: unknown): value is MemoryEvalPolicy {
	if (!isPlainObject(value)) return false;
	const policy = value as Record<string, unknown>;

	const invalidKeys = Object.keys(policy).filter(
		(key) =>
			!VALID_MEMORY_EVAL_POLICY_KEYS.includes(
				key as (typeof VALID_MEMORY_EVAL_POLICY_KEYS)[number],
			),
	);
	if (invalidKeys.length > 0) {
		return false;
	}
	if (
		typeof policy.trialsPerTask !== "number" ||
		!Number.isInteger(policy.trialsPerTask) ||
		policy.trialsPerTask < 0
	)
		return false;
	if (!Array.isArray(policy.requiredMetrics)) return false;
	if (!policy.requiredMetrics.every((value) => typeof value === "string"))
		return false;
	if (
		typeof policy.passPowKThreshold !== "number" ||
		policy.passPowKThreshold < 0 ||
		policy.passPowKThreshold > 1
	)
		return false;
	return true;
}

function isValidObservabilityPolicy(
	value: unknown,
): value is ObservabilityPolicy {
	if (!isPlainObject(value)) return false;
	const policy = value as Record<string, unknown>;

	const invalidKeys = Object.keys(policy).filter(
		(key) =>
			!VALID_OBSERVABILITY_POLICY_KEYS.includes(
				key as (typeof VALID_OBSERVABILITY_POLICY_KEYS)[number],
			),
	);
	if (invalidKeys.length > 0) {
		return false;
	}
	if (typeof policy.provider !== "string" || policy.provider.length === 0)
		return false;
	if (
		typeof policy.collectorEndpoint !== "string" ||
		policy.collectorEndpoint.length === 0
	) {
		return false;
	}
	try {
		new URL(policy.collectorEndpoint);
	} catch {
		return false;
	}
	return true;
}

function isValidPackageManagerPolicy(
	value: unknown,
): value is PackageManagerPolicy {
	if (!isPlainObject(value)) return false;
	const policy = value as Record<string, unknown>;

	const invalidKeys = Object.keys(policy).filter(
		(key) =>
			!VALID_PACKAGE_MANAGER_POLICY_KEYS.includes(
				key as (typeof VALID_PACKAGE_MANAGER_POLICY_KEYS)[number],
			),
	);
	if (invalidKeys.length > 0) {
		return false;
	}
	if (!Array.isArray(policy.allowedManagers)) return false;
	if (!policy.allowedManagers.every((value) => typeof value === "string"))
		return false;
	if (
		policy.requiredManager === undefined ||
		(typeof policy.requiredManager !== "string" &&
			policy.requiredManager !== null)
	) {
		return false;
	}
	return true;
}

function isValidRemediationPolicy(value: unknown): value is RemediationPolicy {
	if (!isPlainObject(value)) return false;
	const policy = value as Record<string, unknown>;

	const invalidKeys = Object.keys(policy).filter(
		(key) =>
			!VALID_REMEDIATION_POLICY_KEYS.includes(
				key as (typeof VALID_REMEDIATION_POLICY_KEYS)[number],
			),
	);
	if (invalidKeys.length > 0) {
		return false;
	}

	const providerDefaults = policy.providerDefaults;
	if (!isPlainObject(providerDefaults)) return false;
	for (const provider of VALID_REMEDIATION_PROVIDER_KEYS) {
		const providerPolicy = providerDefaults[provider];
		if (!isPlainObject(providerPolicy)) return false;
		const entry = providerPolicy as Record<string, unknown>;
		if (
			typeof entry.autoApplyMaxTier !== "string" ||
			!VALID_REMEDIATION_PROVIDER_VALUES.includes(
				entry.autoApplyMaxTier as (typeof VALID_REMEDIATION_PROVIDER_VALUES)[number],
			)
		) {
			return false;
		}
		if (typeof entry.dryRunOnlyByDefault !== "boolean") {
			return false;
		}
	}

	if (typeof policy.marker !== "string" || policy.marker.length === 0) {
		return false;
	}
	if (
		policy.canonicalRerunWorkflow !== null &&
		policy.canonicalRerunWorkflow !== undefined &&
		typeof policy.canonicalRerunWorkflow !== "string"
	) {
		return false;
	}
	if (
		typeof policy.timeoutMinutes !== "number" ||
		!Number.isInteger(policy.timeoutMinutes) ||
		policy.timeoutMinutes < 1
	) {
		return false;
	}
	if (
		typeof policy.retryLimit !== "number" ||
		!Number.isInteger(policy.retryLimit) ||
		policy.retryLimit < 0
	) {
		return false;
	}
	if (typeof policy.requireEvidence !== "boolean") {
		return false;
	}

	return true;
}

function isValidGapCasePolicy(value: unknown): value is GapCasePolicy {
	if (!isPlainObject(value)) return false;
	const policy = value as Record<string, unknown>;

	const invalidKeys = Object.keys(policy).filter(
		(key) =>
			!VALID_GAP_CASE_POLICY_KEYS.includes(
				key as (typeof VALID_GAP_CASE_POLICY_KEYS)[number],
			),
	);
	if (invalidKeys.length > 0) {
		return false;
	}
	if (!Array.isArray(policy.requiredEvidenceStatuses)) return false;
	if (
		!policy.requiredEvidenceStatuses.every((value) => typeof value === "string")
	) {
		return false;
	}
	if (!Array.isArray(policy.requiredCloseReasons)) return false;
	if (
		!policy.requiredCloseReasons.every((value) => typeof value === "string")
	) {
		return false;
	}
	if (
		typeof policy.defaultDueDays !== "number" ||
		!Number.isInteger(policy.defaultDueDays) ||
		policy.defaultDueDays <= 0
	) {
		return false;
	}
	if (
		typeof policy.caseIdPrefix !== "string" ||
		policy.caseIdPrefix.length === 0
	) {
		return false;
	}
	if (typeof policy.caseStore !== "string" || policy.caseStore.length === 0) {
		return false;
	}
	if (typeof policy.allowEvidencelessResolve !== "boolean") return false;

	return true;
}

/**
 * Check if a value is a valid legacy array-style merge policy value.
 */
function isLegacyMergePolicyValue(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((item) => typeof item === "string")
	);
}

/**
 * Check if a value is a valid roadmap object-style merge policy entry.
 */
function isRoadmapMergePolicyEntry(value: unknown): value is MergePolicyEntry {
	if (!isPlainObject(value)) return false;
	const entry = value as Record<string, unknown>;
	if (!Array.isArray(entry.requiredChecks)) return false;
	return entry.requiredChecks.every((item) => typeof item === "string");
}

/**
 * Check if a value is a valid merge policy value (either shape).
 */
function isValidMergePolicyValue(value: unknown): value is MergePolicyValue {
	return isLegacyMergePolicyValue(value) || isRoadmapMergePolicyEntry(value);
}

function isValidMergePolicy(value: unknown): value is MergePolicy {
	if (!isPlainObject(value)) return false;
	const policy = value as Record<string, unknown>;

	if (Object.keys(policy).length === 0) {
		return true;
	}
	for (const [severity, entry] of Object.entries(policy)) {
		if (hasForbiddenKey(severity) || !isValidMergePolicyValue(entry)) {
			return false;
		}
	}
	const disallowedKeys = Object.keys(policy).filter(
		(key) =>
			!VALID_MERGE_POLICY_VALUE_KEYS.includes(
				key as (typeof VALID_MERGE_POLICY_VALUE_KEYS)[number],
			),
	);
	if (disallowedKeys.length > 0) {
		return false;
	}
	return true;
}

function isValidDocsDriftRules(value: unknown): value is DocsDriftRules {
	if (!isPlainObject(value)) return false;
	for (const [pattern, rules] of Object.entries(value)) {
		if (hasForbiddenKey(pattern) || !Array.isArray(rules)) {
			return false;
		}
		if (!rules.every((rule) => typeof rule === "string")) {
			return false;
		}
	}
	return true;
}

function isValidTopLevel(
	data: Record<string, unknown>,
	errors: ValidationError[],
): void {
	const unknownKeys = Object.keys(data).filter(
		(key) =>
			!VALID_TOP_LEVEL_KEYS.includes(
				key as (typeof VALID_TOP_LEVEL_KEYS)[number],
			),
	);
	for (const key of unknownKeys) {
		errors.push({
			code: ValidationErrorCode.INVALID_VALUE,
			path: "root",
			message: `Unknown top-level key '${key}' is not allowed`,
			fix: "Remove the unknown field before re-running this command",
		});
	}
}

export function isValidEvidencePolicy(value: unknown): value is EvidencePolicy {
	if (!isPlainObject(value)) return false;
	const policy = value as Record<string, unknown>;

	const invalidKeys = Object.keys(policy).filter(
		(key) => !["requiredFor", "allowedTypes", "maxFileSizeBytes"].includes(key),
	);
	if (invalidKeys.length > 0) {
		return false;
	}

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
	isValidTopLevel(obj, errors);

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

	// Validate mergePolicy
	let mergePolicy: MergePolicy | undefined;
	if ("mergePolicy" in obj && obj.mergePolicy !== undefined) {
		if (!isValidMergePolicy(obj.mergePolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "mergePolicy",
				message:
					"mergePolicy must be an object of severity keys (high/medium/low) mapped to string arrays",
				expected:
					"{ high: ['review-gate', ...], medium: ['review-gate'], low: [] }",
				received: JSON.stringify(obj.mergePolicy),
				fix: "Ensure mergePolicy has only valid severity keys and array values",
			});
		} else {
			mergePolicy = obj.mergePolicy as MergePolicy;
		}
	}

	// Validate docsDriftRules
	let docsDriftRules: DocsDriftRules | undefined;
	if ("docsDriftRules" in obj && obj.docsDriftRules !== undefined) {
		if (!isValidDocsDriftRules(obj.docsDriftRules)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "docsDriftRules",
				message:
					"docsDriftRules must be an object mapping patterns to string[]",
				expected: "{ 'src/ui/**': ['require-review'], 'docs/**/*.md': [] }",
				received: JSON.stringify(obj.docsDriftRules),
				fix: "Ensure docsDriftRules uses string-array values and no forbidden keys",
			});
		} else {
			docsDriftRules = obj.docsDriftRules as DocsDriftRules;
		}
	}

	// Validate diffBudget
	let diffBudget: DiffBudget | undefined;
	if ("diffBudget" in obj && obj.diffBudget !== undefined) {
		if (!isValidDiffBudget(obj.diffBudget)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "diffBudget",
				message:
					"diffBudget must include maxFiles, maxNetLOC, and optional overrideLabel",
				expected:
					"{ maxFiles: number, maxNetLOC: number, overrideLabel?: string }",
				received: JSON.stringify(obj.diffBudget),
				fix: "Provide integer maxFiles and maxNetLOC values",
			});
		} else {
			diffBudget = obj.diffBudget as DiffBudget;
		}
	}

	// Validate uiLoopPolicy
	let uiLoopPolicy: UILoopPolicy | undefined;
	if ("uiLoopPolicy" in obj && obj.uiLoopPolicy !== undefined) {
		if (!isValidUILoopPolicy(obj.uiLoopPolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "uiLoopPolicy",
				message:
					"uiLoopPolicy must include fastCommand, verifyCommand, exploreCommand, and sloTargets",
				expected:
					"{ fastCommand: string, verifyCommand: string, exploreCommand: string, sloTargets: { fastLoopSeconds: number, verifyLoopSeconds: number } }",
				received: JSON.stringify(obj.uiLoopPolicy),
				fix: "Ensure uiLoopPolicy keys/values are correctly shaped",
			});
		} else {
			uiLoopPolicy = obj.uiLoopPolicy as UILoopPolicy;
		}
	}

	// Validate runtimePolicy
	let runtimePolicy: RuntimePolicy | undefined;
	if ("runtimePolicy" in obj && obj.runtimePolicy !== undefined) {
		if (!isValidRuntimePolicy(obj.runtimePolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "runtimePolicy",
				message: "runtimePolicy must include nodeVersion",
				expected: "{ nodeVersion: string }",
				received: JSON.stringify(obj.runtimePolicy),
				fix: "Ensure runtimePolicy includes only nodeVersion as a non-empty string",
			});
		} else {
			runtimePolicy = obj.runtimePolicy as RuntimePolicy;
		}
	}

	// Validate memoryPolicy
	let memoryPolicy: MemoryPolicy | undefined;
	if ("memoryPolicy" in obj && obj.memoryPolicy !== undefined) {
		if (!isValidMemoryPolicy(obj.memoryPolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "memoryPolicy",
				message: "memoryPolicy fields are invalid",
				expected:
					"{ enabled, provider, sessionIdTemplate, domain, requiredTags, maxObservationsPerStep, allowedLevels, requireStartRead, requireCloseoutSummary, forbiddenContentPatterns }",
				received: JSON.stringify(obj.memoryPolicy),
				fix: "Ensure all required fields exist and are typed correctly",
			});
		} else {
			memoryPolicy = obj.memoryPolicy as MemoryPolicy;
		}
	}

	// Validate memoryMaintenancePolicy
	let memoryMaintenancePolicy: MemoryMaintenancePolicy | undefined;
	if (
		"memoryMaintenancePolicy" in obj &&
		obj.memoryMaintenancePolicy !== undefined
	) {
		if (!isValidMemoryMaintenancePolicy(obj.memoryMaintenancePolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "memoryMaintenancePolicy",
				message: "memoryMaintenancePolicy fields are invalid",
				expected:
					"{ validateSchedule, reflectSchedule, questionSlaDays, duplicateThreshold }",
				received: JSON.stringify(obj.memoryMaintenancePolicy),
				fix: "Use a fully-populated memoryMaintenancePolicy object",
			});
		} else {
			memoryMaintenancePolicy =
				obj.memoryMaintenancePolicy as MemoryMaintenancePolicy;
		}
	}

	// Validate memoryEvalPolicy
	let memoryEvalPolicy: MemoryEvalPolicy | undefined;
	if ("memoryEvalPolicy" in obj && obj.memoryEvalPolicy !== undefined) {
		if (!isValidMemoryEvalPolicy(obj.memoryEvalPolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "memoryEvalPolicy",
				message: "memoryEvalPolicy fields are invalid",
				expected: "{ trialsPerTask, requiredMetrics, passPowKThreshold }",
				received: JSON.stringify(obj.memoryEvalPolicy),
				fix: "Use a fully-populated memoryEvalPolicy object",
			});
		} else {
			memoryEvalPolicy = obj.memoryEvalPolicy as MemoryEvalPolicy;
		}
	}

	// Validate observabilityPolicy
	let observabilityPolicy: ObservabilityPolicy | undefined;
	if ("observabilityPolicy" in obj && obj.observabilityPolicy !== undefined) {
		if (!isValidObservabilityPolicy(obj.observabilityPolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "observabilityPolicy",
				message: "observabilityPolicy fields are invalid",
				expected: "{ provider, collectorEndpoint }",
				received: JSON.stringify(obj.observabilityPolicy),
				fix: "Ensure provider and collectorEndpoint are valid and collectorEndpoint is a URL",
			});
		} else {
			observabilityPolicy = obj.observabilityPolicy as ObservabilityPolicy;
		}
	}

	// Validate packageManagerPolicy
	let packageManagerPolicy: PackageManagerPolicy | undefined;
	if ("packageManagerPolicy" in obj && obj.packageManagerPolicy !== undefined) {
		if (!isValidPackageManagerPolicy(obj.packageManagerPolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "packageManagerPolicy",
				message:
					"packageManagerPolicy requires allowedManagers and optional requiredManager",
				expected:
					"{ allowedManagers: string[], requiredManager: string | null }",
				received: JSON.stringify(obj.packageManagerPolicy),
				fix: "Ensure packageManagerPolicy has only allowedManager keys and value types",
			});
		} else {
			packageManagerPolicy = obj.packageManagerPolicy as PackageManagerPolicy;
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

	// Validate remediationPolicy (optional)
	let remediationPolicy: RemediationPolicy | undefined;
	if ("remediationPolicy" in obj && obj.remediationPolicy !== undefined) {
		if (!isValidRemediationPolicy(obj.remediationPolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "remediationPolicy",
				message:
					"remediationPolicy must define providerDefaults, marker, timeoutMinutes, retryLimit, and requireEvidence",
				expected:
					"{ providerDefaults: { codeql: { autoApplyMaxTier: 'high'|'medium'|'low', dryRunOnlyByDefault: boolean }, codex: { autoApplyMaxTier: 'high'|'medium'|'low', dryRunOnlyByDefault: boolean } }, canonicalRerunWorkflow?: string | null, marker: string, timeoutMinutes: number, retryLimit: number, requireEvidence: boolean }",
				received: JSON.stringify(obj.remediationPolicy),
				fix: "Ensure remediationPolicy contains only supported keys and valid types",
			});
		} else {
			remediationPolicy = obj.remediationPolicy as RemediationPolicy;
		}
	}

	// Validate gapCasePolicy (optional)
	let gapCasePolicy: GapCasePolicy | undefined;
	if ("gapCasePolicy" in obj && obj.gapCasePolicy !== undefined) {
		if (!isValidGapCasePolicy(obj.gapCasePolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "gapCasePolicy",
				message:
					"gapCasePolicy must define requiredEvidenceStatuses, requiredCloseReasons, defaultDueDays, caseIdPrefix, caseStore, and allowEvidencelessResolve",
				expected:
					"{ requiredEvidenceStatuses: string[], requiredCloseReasons: string[], defaultDueDays: number, caseIdPrefix: string, caseStore: string, allowEvidencelessResolve: boolean }",
				received: JSON.stringify(obj.gapCasePolicy),
				fix: "Ensure gapCasePolicy contains only supported keys and valid types",
			});
		} else {
			gapCasePolicy = obj.gapCasePolicy as GapCasePolicy;
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
			mergePolicy,
			docsDriftRules,
			diffBudget,
			uiLoopPolicy,
			runtimePolicy,
			memoryPolicy,
			memoryMaintenancePolicy,
			memoryEvalPolicy,
			observabilityPolicy,
			packageManagerPolicy,
			remediationPolicy,
			gapCasePolicy,
			// Pass through pilot policy fields (validated by type only for v1)
			pilotGapCasePolicy: obj.pilotGapCasePolicy as
				| HarnessContract["pilotGapCasePolicy"]
				| undefined,
			pilotRollbackPolicy: obj.pilotRollbackPolicy as
				| HarnessContract["pilotRollbackPolicy"]
				| undefined,
			pilotAuthzPolicy: obj.pilotAuthzPolicy as
				| HarnessContract["pilotAuthzPolicy"]
				| undefined,
		},
		errors: [],
	};
}
