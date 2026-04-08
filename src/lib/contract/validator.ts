import {
	CONTEXT_COMPACT_STRATEGIES,
	PREFLIGHT_POST_HOOK_IDS,
	PREFLIGHT_PRE_HOOK_IDS,
} from "./json-schema.js";
import type {
	BlastRadiusRule,
	BlastRadiusRulesMode,
	BranchProtectionCodeQualityPolicy,
	BranchProtectionCodeScanningPolicy,
	BranchProtectionMergeMethods,
	BranchProtectionPolicy,
	CIProviderMigrationStage,
	CIProviderPolicy,
	CIProviderPolicyMode,
	CodeQualitySeverity,
	CodeScanningAlertsThreshold,
	CodeScanningSecurityAlertsThreshold,
	ContextCompactPolicy,
	ContextCompactStrategy,
	ContextIntegrityMode,
	ContextIntegrityPolicy,
	ContextIntegrityTruthSource,
	ControlPlaneOverridePolicy,
	ControlPlaneOverrideScope,
	ControlPlanePolicy,
	DiffBudget,
	DocsDriftRules,
	DocsGateMode,
	DocsGatePolicy,
	DocsGateRule,
	DocsImpactCategory,
	DocsSurface,
	EvidencePolicy,
	GapCasePolicy,
	GateExtensionHook,
	GateExtensionHookId,
	GateExtensionsPolicy,
	HarnessContract,
	ImageFormat,
	IssueTrackingPolicy,
	LoopStageContract,
	LoopStageContracts,
	LoopStageFailPolicy,
	LoopStageName,
	MemoryEvalPolicy,
	MemoryMaintenancePolicy,
	MemoryPolicy,
	MergePolicy,
	MergePolicyEntry,
	MergePolicyValue,
	ObservabilityPolicy,
	PackageManagerPolicy,
	PilotAuthzPolicy,
	PilotGapCasePolicy,
	PilotRollbackPolicy,
	PrReferenceMode,
	PreflightGateExtensionsPolicy,
	RemediationPolicy,
	RemediationProviderPolicy,
	ReviewPolicy,
	RiskTier,
	RuntimePolicy,
	TimeoutAction,
	ToolingCapabilityDetector,
	ToolingCodexAction,
	ToolingCodexEnvironmentPolicy,
	ToolingMakefilePolicy,
	ToolingMiseTool,
	ToolingPackagePolicy,
	ToolingPackageRequirement,
	ToolingPolicy,
	UILoopPolicy,
	UILoopSLO,
} from "./types.js";
import { isValidUILoopCommandSpec } from "./ui-loop-command.js";

const VALID_RISK_TIERS: RiskTier[] = ["high", "medium", "low"];
const VALID_TIMEOUT_ACTIONS: TimeoutAction[] = ["fail", "warn"];
const VALID_IMAGE_FORMATS: ImageFormat[] = ["png", "jpeg"];
const VALID_ROLLBACK_MODES = ["manual", "autonomous"] as const;
const VALID_BLAST_RADIUS_RULES_MODES = ["merge", "replace"] as const;
const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype"] as const;
const VALID_TOP_LEVEL_KEYS = [
	"version",
	"riskTierRules",
	"blastRadiusRules",
	"blastRadiusRulesMode",
	"gateExtensions",
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
	"loopStageContracts",
	"branchProtection",
	"issueTrackingPolicy",
	"docsGatePolicy",
	"contextCompact",
	"contextIntegrityPolicy",
	"controlPlanePolicy",
	"toolingPolicy",
	"ciProviderPolicy",
	"extends",
] as const;
const VALID_UI_LOOP_POLICY_KEYS = [
	"fastCommand",
	"verifyCommand",
	"exploreCommand",
	"sloTargets",
] as const;
const VALID_SLO_TARGET_KEYS = ["fastLoopSeconds", "verifyLoopSeconds"] as const;
const VALID_RUNTIME_POLICY_KEYS = [
	"nodeVersion",
	"createIssueOnAgentFindings",
] as const;
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
const VALID_TOOLING_POLICY_KEYS = [
	"requiredDocumentationTerms",
	"requiredBinaries",
	"requiredMiseTools",
	"miseFilePath",
	"readinessScriptPath",
	"codexEnvironment",
	"makefile",
	"packagePolicy",
] as const;
const VALID_TOOLING_CODEX_ENVIRONMENT_KEYS = [
	"path",
	"requiredActions",
] as const;
const VALID_TOOLING_CODEX_ACTION_KEYS = ["name", "icon"] as const;
const VALID_TOOLING_MAKEFILE_KEYS = ["path", "requiredTargets"] as const;
const VALID_TOOLING_MISE_TOOL_KEYS = ["tool", "version"] as const;
const VALID_TOOLING_PACKAGE_POLICY_KEYS = [
	"packageJsonPath",
	"explicitCapabilities",
	"capabilityDetectors",
	"requiredPackages",
] as const;
const VALID_TOOLING_CAPABILITY_DETECTOR_KEYS = [
	"capability",
	"dependencyMarkers",
] as const;
const VALID_TOOLING_PACKAGE_REQUIREMENT_KEYS = [
	"package",
	"dependencyType",
	"requiredWhenCapabilities",
] as const;
const VALID_CI_PROVIDER_POLICY_KEYS = [
	"activeProvider",
	"mode",
	"migrationStage",
	"transitionStatusArtifactPath",
	"authorityConfigPath",
	"requiredCheckManifestPath",
	"trustedPolicyRef",
	"commitMode",
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
const VALID_LOOP_STAGE_NAMES: LoopStageName[] = [
	"risk-policy-gate",
	"review-gate",
	"evidence-verify",
	"remediation-decision",
];
const VALID_LOOP_STAGE_FAIL_POLICIES: LoopStageFailPolicy[] = [
	"fail_closed",
	"warn_only",
];
const VALID_PR_REFERENCE_MODES: PrReferenceMode[] = ["refs", "fixes", "either"];
const VALID_CODE_QUALITY_SEVERITIES: CodeQualitySeverity[] = [
	"errors",
	"warnings_and_higher",
	"notes_and_higher",
	"all",
];
const VALID_CODE_SCANNING_ALERTS_THRESHOLDS: CodeScanningAlertsThreshold[] = [
	"errors",
	"errors_and_warnings",
	"all",
];
const VALID_CODE_SCANNING_SECURITY_ALERTS_THRESHOLDS: CodeScanningSecurityAlertsThreshold[] =
	["high_or_higher", "medium_or_higher", "all"];
const VALID_CONTROL_PLANE_OVERRIDE_SCOPES: ControlPlaneOverrideScope[] = [
	"advisory_hold",
	"temporary_unblock",
	"temporary_promote",
];
const VALID_NON_OVERRIDABLE_CONTROLS = [
	"canonical_runtime_invalid",
	"governance_trust_mismatch",
	"missing_required_instruction_surface",
	"missing_snapshot_integrity_verification",
] as const;
const VALID_CI_PROVIDER_MODES: CIProviderPolicyMode[] = [
	"shadow",
	"primary",
	"required",
];
const VALID_CI_PROVIDER_MIGRATION_STAGES: CIProviderMigrationStage[] = [
	"pre-migration",
	"dual-provider",
	"circleci-primary",
	"circleci-only",
	"gha-primary",
	"gha-only",
	"cutover-complete",
];
const VALID_CI_PROVIDERS = ["github-actions", "circleci"] as const;
const VALID_GATE_EXTENSIONS_POLICY_KEYS = ["preflightGate"] as const;
const VALID_PREFLIGHT_GATE_EXTENSIONS_POLICY_KEYS = ["pre", "post"] as const;
const VALID_GATE_EXTENSION_HOOK_KEYS = ["id", "enabled"] as const;
const VALID_PREFLIGHT_PRE_HOOK_IDS = PREFLIGHT_PRE_HOOK_IDS;
const VALID_PREFLIGHT_POST_HOOK_IDS = PREFLIGHT_POST_HOOK_IDS;

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

function isValidBlastRadiusRulesMode(
	value: unknown,
): value is BlastRadiusRulesMode {
	return (
		typeof value === "string" &&
		VALID_BLAST_RADIUS_RULES_MODES.includes(
			value as (typeof VALID_BLAST_RADIUS_RULES_MODES)[number],
		)
	);
}

function isValidBlastRadiusRule(value: unknown): value is BlastRadiusRule {
	if (!isPlainObject(value)) {
		return false;
	}
	const rule = value as Record<string, unknown>;
	const validKeys = ["pattern", "checks", "description"] as const;

	const invalidKeys = Object.keys(rule).filter(
		(key) => !validKeys.includes(key as (typeof validKeys)[number]),
	);
	if (invalidKeys.length > 0) {
		return false;
	}

	if (typeof rule.pattern !== "string" || rule.pattern.length === 0) {
		return false;
	}

	if (!Array.isArray(rule.checks)) {
		return false;
	}
	for (const check of rule.checks) {
		if (typeof check !== "string" || check.length === 0) {
			return false;
		}
	}

	if (rule.description !== undefined && typeof rule.description !== "string") {
		return false;
	}

	return true;
}

function isValidBlastRadiusRules(value: unknown): value is BlastRadiusRule[] {
	if (!Array.isArray(value)) {
		return false;
	}
	for (const rule of value) {
		if (!isValidBlastRadiusRule(rule)) {
			return false;
		}
	}
	return true;
}

function isValidTimeoutAction(value: unknown): value is TimeoutAction {
	return (
		typeof value === "string" &&
		VALID_TIMEOUT_ACTIONS.includes(value as TimeoutAction)
	);
}

function isValidRequiredChecks(value: unknown): value is string[] {
	if (!Array.isArray(value)) {
		return false;
	}
	for (const check of value) {
		if (typeof check !== "string" || check.trim().length === 0) {
			return false;
		}
	}
	return true;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
	if (!Array.isArray(value)) {
		return false;
	}
	return value.every(
		(item) => typeof item === "string" && item.trim().length > 0,
	);
}

function isValidToolingMiseTool(value: unknown): value is ToolingMiseTool {
	if (!isPlainObject(value)) return false;
	const item = value as Record<string, unknown>;
	const unknownKeys = Object.keys(item).filter(
		(key) =>
			!VALID_TOOLING_MISE_TOOL_KEYS.includes(
				key as (typeof VALID_TOOLING_MISE_TOOL_KEYS)[number],
			),
	);
	if (unknownKeys.length > 0) {
		return false;
	}
	return (
		typeof item.tool === "string" &&
		item.tool.trim().length > 0 &&
		typeof item.version === "string" &&
		item.version.trim().length > 0
	);
}

function isValidToolingCodexAction(
	value: unknown,
): value is ToolingCodexAction {
	if (!isPlainObject(value)) return false;
	const action = value as Record<string, unknown>;
	const unknownKeys = Object.keys(action).filter(
		(key) =>
			!VALID_TOOLING_CODEX_ACTION_KEYS.includes(
				key as (typeof VALID_TOOLING_CODEX_ACTION_KEYS)[number],
			),
	);
	if (unknownKeys.length > 0) {
		return false;
	}

	return (
		typeof action.name === "string" &&
		action.name.trim().length > 0 &&
		(action.icon === "tool" ||
			action.icon === "run" ||
			action.icon === "debug" ||
			action.icon === "test")
	);
}

function isValidToolingCodexEnvironment(
	value: unknown,
): value is ToolingCodexEnvironmentPolicy {
	if (!isPlainObject(value)) return false;
	const env = value as Record<string, unknown>;
	const unknownKeys = Object.keys(env).filter(
		(key) =>
			!VALID_TOOLING_CODEX_ENVIRONMENT_KEYS.includes(
				key as (typeof VALID_TOOLING_CODEX_ENVIRONMENT_KEYS)[number],
			),
	);
	if (unknownKeys.length > 0) {
		return false;
	}

	return (
		typeof env.path === "string" &&
		env.path.trim().length > 0 &&
		Array.isArray(env.requiredActions) &&
		env.requiredActions.every((action) => isValidToolingCodexAction(action))
	);
}

function isValidToolingMakefile(
	value: unknown,
): value is ToolingMakefilePolicy {
	if (!isPlainObject(value)) return false;
	const makefile = value as Record<string, unknown>;
	const unknownKeys = Object.keys(makefile).filter(
		(key) =>
			!VALID_TOOLING_MAKEFILE_KEYS.includes(
				key as (typeof VALID_TOOLING_MAKEFILE_KEYS)[number],
			),
	);
	if (unknownKeys.length > 0) {
		return false;
	}

	return (
		typeof makefile.path === "string" &&
		makefile.path.trim().length > 0 &&
		isNonEmptyStringArray(makefile.requiredTargets)
	);
}

function isValidToolingCapabilityDetector(
	value: unknown,
): value is ToolingCapabilityDetector {
	if (!isPlainObject(value)) return false;
	const detector = value as Record<string, unknown>;
	const unknownKeys = Object.keys(detector).filter(
		(key) =>
			!VALID_TOOLING_CAPABILITY_DETECTOR_KEYS.includes(
				key as (typeof VALID_TOOLING_CAPABILITY_DETECTOR_KEYS)[number],
			),
	);
	if (unknownKeys.length > 0) {
		return false;
	}

	return (
		(detector.capability === "ui" ||
			detector.capability === "chatgpt_apps_sdk") &&
		isNonEmptyStringArray(detector.dependencyMarkers)
	);
}

function isValidToolingPackageRequirement(
	value: unknown,
): value is ToolingPackageRequirement {
	if (!isPlainObject(value)) return false;
	const requirement = value as Record<string, unknown>;
	const unknownKeys = Object.keys(requirement).filter(
		(key) =>
			!VALID_TOOLING_PACKAGE_REQUIREMENT_KEYS.includes(
				key as (typeof VALID_TOOLING_PACKAGE_REQUIREMENT_KEYS)[number],
			),
	);
	if (unknownKeys.length > 0) {
		return false;
	}

	return (
		typeof requirement.package === "string" &&
		requirement.package.trim().length > 0 &&
		(requirement.dependencyType === "dependencies" ||
			requirement.dependencyType === "devDependencies" ||
			requirement.dependencyType === "either") &&
		Array.isArray(requirement.requiredWhenCapabilities) &&
		requirement.requiredWhenCapabilities.every(
			(capability) => capability === "ui" || capability === "chatgpt_apps_sdk",
		)
	);
}

function isValidToolingPackagePolicy(
	value: unknown,
): value is ToolingPackagePolicy {
	if (!isPlainObject(value)) return false;
	const packagePolicy = value as Record<string, unknown>;
	const unknownKeys = Object.keys(packagePolicy).filter(
		(key) =>
			!VALID_TOOLING_PACKAGE_POLICY_KEYS.includes(
				key as (typeof VALID_TOOLING_PACKAGE_POLICY_KEYS)[number],
			),
	);
	if (unknownKeys.length > 0) {
		return false;
	}

	return (
		typeof packagePolicy.packageJsonPath === "string" &&
		packagePolicy.packageJsonPath.trim().length > 0 &&
		(packagePolicy.explicitCapabilities === undefined ||
			(Array.isArray(packagePolicy.explicitCapabilities) &&
				packagePolicy.explicitCapabilities.every(
					(capability) =>
						capability === "ui" || capability === "chatgpt_apps_sdk",
				))) &&
		Array.isArray(packagePolicy.capabilityDetectors) &&
		packagePolicy.capabilityDetectors.every((item) =>
			isValidToolingCapabilityDetector(item),
		) &&
		Array.isArray(packagePolicy.requiredPackages) &&
		packagePolicy.requiredPackages.every((item) =>
			isValidToolingPackageRequirement(item),
		)
	);
}

function isValidToolingPolicy(value: unknown): value is ToolingPolicy {
	if (!isPlainObject(value)) return false;
	const policy = value as Record<string, unknown>;
	const unknownKeys = Object.keys(policy).filter(
		(key) =>
			!VALID_TOOLING_POLICY_KEYS.includes(
				key as (typeof VALID_TOOLING_POLICY_KEYS)[number],
			),
	);
	if (unknownKeys.length > 0) {
		return false;
	}

	return (
		isNonEmptyStringArray(policy.requiredDocumentationTerms) &&
		isNonEmptyStringArray(policy.requiredBinaries) &&
		Array.isArray(policy.requiredMiseTools) &&
		policy.requiredMiseTools.every((item) => isValidToolingMiseTool(item)) &&
		typeof policy.miseFilePath === "string" &&
		policy.miseFilePath.trim().length > 0 &&
		typeof policy.readinessScriptPath === "string" &&
		policy.readinessScriptPath.trim().length > 0 &&
		isValidToolingCodexEnvironment(policy.codexEnvironment) &&
		isValidToolingMakefile(policy.makefile) &&
		isValidToolingPackagePolicy(policy.packagePolicy)
	);
}

function isValidReviewPolicy(value: unknown): value is ReviewPolicy {
	if (!isPlainObject(value)) return false;
	const policy = value as Record<string, unknown>;

	// Reject unknown top-level keys
	const unknownKeys = Object.keys(policy).filter(
		(key) =>
			![
				"timeoutSeconds",
				"timeoutAction",
				"requiredChecks",
				"enforceReviewerIndependence",
			].includes(key),
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

	// Validate requiredChecks (optional)
	if (policy.requiredChecks !== undefined) {
		if (!isValidRequiredChecks(policy.requiredChecks)) {
			return false;
		}
	}

	// Validate enforceReviewerIndependence (optional)
	if (
		policy.enforceReviewerIndependence !== undefined &&
		typeof policy.enforceReviewerIndependence !== "boolean"
	) {
		return false;
	}

	return true;
}

function isValidBranchProtection(
	value: unknown,
): value is BranchProtectionPolicy {
	if (!isPlainObject(value)) return false;
	const policy = value as Record<string, unknown>;

	const unknownKeys = Object.keys(policy).filter(
		(key) =>
			![
				"requiredChecks",
				"restrictDeletions",
				"blockForcePushes",
				"requireLinearHistory",
				"requirePullRequest",
				"requiredApprovingReviewCount",
				"dismissStaleReviewsOnPush",
				"requireConversationResolution",
				"requireCodeOwnerReview",
				"requireLastPushApproval",
				"requireBranchesUpToDate",
				"allowedMergeMethods",
				"codeQuality",
				"publicCodeScanning",
			].includes(key),
	);
	if (unknownKeys.length > 0) {
		return false;
	}

	if (
		policy.requiredChecks !== undefined &&
		!isValidRequiredChecks(policy.requiredChecks)
	) {
		return false;
	}

	const booleanKeys = [
		"restrictDeletions",
		"blockForcePushes",
		"requireLinearHistory",
		"requirePullRequest",
		"dismissStaleReviewsOnPush",
		"requireConversationResolution",
		"requireCodeOwnerReview",
		"requireLastPushApproval",
		"requireBranchesUpToDate",
	] as const;
	for (const key of booleanKeys) {
		if (policy[key] !== undefined && typeof policy[key] !== "boolean") {
			return false;
		}
	}

	if (
		policy.requiredApprovingReviewCount !== undefined &&
		(typeof policy.requiredApprovingReviewCount !== "number" ||
			!Number.isInteger(policy.requiredApprovingReviewCount) ||
			policy.requiredApprovingReviewCount < 0)
	) {
		return false;
	}

	if (
		policy.allowedMergeMethods !== undefined &&
		!isValidBranchProtectionMergeMethods(policy.allowedMergeMethods)
	) {
		return false;
	}

	if (
		policy.codeQuality !== undefined &&
		!isValidBranchProtectionCodeQualityPolicy(policy.codeQuality)
	) {
		return false;
	}

	if (
		policy.publicCodeScanning !== undefined &&
		!isValidBranchProtectionCodeScanningPolicy(policy.publicCodeScanning)
	) {
		return false;
	}

	return true;
}

function isValidBranchProtectionMergeMethods(
	value: unknown,
): value is BranchProtectionMergeMethods {
	if (!isPlainObject(value)) {
		return false;
	}

	const mergeMethods = value as Record<string, unknown>;
	const unknownKeys = Object.keys(mergeMethods).filter(
		(key) => !["mergeCommit", "squash", "rebase"].includes(key),
	);
	if (unknownKeys.length > 0) {
		return false;
	}

	return (
		typeof mergeMethods.mergeCommit === "boolean" &&
		typeof mergeMethods.squash === "boolean" &&
		typeof mergeMethods.rebase === "boolean"
	);
}

function isValidBranchProtectionCodeQualityPolicy(
	value: unknown,
): value is BranchProtectionCodeQualityPolicy {
	if (!isPlainObject(value)) {
		return false;
	}

	const policy = value as Record<string, unknown>;
	const unknownKeys = Object.keys(policy).filter(
		(key) => !["required", "severity"].includes(key),
	);
	if (unknownKeys.length > 0) {
		return false;
	}

	return (
		typeof policy.required === "boolean" &&
		typeof policy.severity === "string" &&
		VALID_CODE_QUALITY_SEVERITIES.includes(
			policy.severity as CodeQualitySeverity,
		)
	);
}

function isValidBranchProtectionCodeScanningPolicy(
	value: unknown,
): value is BranchProtectionCodeScanningPolicy {
	if (!isPlainObject(value)) {
		return false;
	}

	const policy = value as Record<string, unknown>;
	const unknownKeys = Object.keys(policy).filter(
		(key) =>
			![
				"required",
				"publicOnly",
				"tool",
				"alertsThreshold",
				"securityAlertsThreshold",
			].includes(key),
	);
	if (unknownKeys.length > 0) {
		return false;
	}

	return (
		typeof policy.required === "boolean" &&
		typeof policy.publicOnly === "boolean" &&
		typeof policy.tool === "string" &&
		policy.tool.trim().length > 0 &&
		typeof policy.alertsThreshold === "string" &&
		VALID_CODE_SCANNING_ALERTS_THRESHOLDS.includes(
			policy.alertsThreshold as CodeScanningAlertsThreshold,
		) &&
		typeof policy.securityAlertsThreshold === "string" &&
		VALID_CODE_SCANNING_SECURITY_ALERTS_THRESHOLDS.includes(
			policy.securityAlertsThreshold as CodeScanningSecurityAlertsThreshold,
		)
	);
}

function isValidControlPlaneOverridePolicy(
	value: unknown,
): value is ControlPlaneOverridePolicy {
	if (!isPlainObject(value)) {
		return false;
	}

	const policy = value as Record<string, unknown>;
	const validKeys = [
		"authorizedPrincipals",
		"dualApprovalScopes",
		"maxTtlHours",
		"nonOverridableControls",
	] as const;
	const invalidKeys = Object.keys(policy).filter(
		(key) => !validKeys.includes(key as (typeof validKeys)[number]),
	);
	if (invalidKeys.length > 0) {
		return false;
	}

	if (!isStringArray(policy.authorizedPrincipals)) {
		return false;
	}

	if (
		!Array.isArray(policy.dualApprovalScopes) ||
		!policy.dualApprovalScopes.every(
			(scope) =>
				typeof scope === "string" &&
				VALID_CONTROL_PLANE_OVERRIDE_SCOPES.includes(
					scope as ControlPlaneOverrideScope,
				),
		)
	) {
		return false;
	}

	if (
		typeof policy.maxTtlHours !== "number" ||
		!Number.isInteger(policy.maxTtlHours) ||
		policy.maxTtlHours <= 0 ||
		policy.maxTtlHours > 24
	) {
		return false;
	}

	if (
		!Array.isArray(policy.nonOverridableControls) ||
		!policy.nonOverridableControls.every(
			(control) =>
				typeof control === "string" &&
				VALID_NON_OVERRIDABLE_CONTROLS.includes(
					control as (typeof VALID_NON_OVERRIDABLE_CONTROLS)[number],
				),
		)
	) {
		return false;
	}

	return true;
}

export function isValidControlPlanePolicy(
	value: unknown,
): value is ControlPlanePolicy {
	if (!isPlainObject(value)) {
		return false;
	}

	const policy = value as Record<string, unknown>;
	const validKeys = ["overridePolicy"] as const;
	const invalidKeys = Object.keys(policy).filter(
		(key) => !validKeys.includes(key as (typeof validKeys)[number]),
	);
	if (invalidKeys.length > 0) {
		return false;
	}

	return isValidControlPlaneOverridePolicy(policy.overridePolicy);
}

function isValidCIProviderPolicy(value: unknown): value is CIProviderPolicy {
	if (!isPlainObject(value)) {
		return false;
	}
	const policy = value as Record<string, unknown>;
	const invalidKeys = Object.keys(policy).filter(
		(key) =>
			!VALID_CI_PROVIDER_POLICY_KEYS.includes(
				key as (typeof VALID_CI_PROVIDER_POLICY_KEYS)[number],
			),
	);
	if (invalidKeys.length > 0) {
		return false;
	}
	if (
		!VALID_CI_PROVIDERS.includes(
			policy.activeProvider as (typeof VALID_CI_PROVIDERS)[number],
		)
	) {
		return false;
	}
	if (!VALID_CI_PROVIDER_MODES.includes(policy.mode as CIProviderPolicyMode)) {
		return false;
	}
	if (
		!VALID_CI_PROVIDER_MIGRATION_STAGES.includes(
			policy.migrationStage as CIProviderMigrationStage,
		)
	) {
		return false;
	}
	if (
		typeof policy.transitionStatusArtifactPath !== "string" ||
		policy.transitionStatusArtifactPath.trim().length === 0
	) {
		return false;
	}
	if (
		typeof policy.authorityConfigPath !== "string" ||
		policy.authorityConfigPath.trim().length === 0
	) {
		return false;
	}
	if (
		typeof policy.requiredCheckManifestPath !== "string" ||
		policy.requiredCheckManifestPath.trim().length === 0
	) {
		return false;
	}
	// trustedPolicyRef is optional (required only for enterprise mode; checked in cross-field pass)
	if (
		policy.trustedPolicyRef !== undefined &&
		(typeof policy.trustedPolicyRef !== "string" ||
			policy.trustedPolicyRef.trim().length === 0)
	) {
		return false;
	}
	return true;
}

function isValidLinearProjectUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return (
			url.protocol === "https:" &&
			url.hostname === "linear.app" &&
			url.pathname.includes("/project/")
		);
	} catch {
		return false;
	}
}

function isValidIssueTrackingPolicy(
	value: unknown,
): value is IssueTrackingPolicy {
	if (!isPlainObject(value)) {
		return false;
	}

	const policy = value as Record<string, unknown>;
	const unknownKeys = Object.keys(policy).filter(
		(key) =>
			![
				"provider",
				"projectUrl",
				"requirePackageBugsUrl",
				"disableGitHubIssues",
				"requireBranchIssueKey",
				"requirePrIssueKey",
				"prReferenceMode",
				"branchPrefix",
			].includes(key),
	);
	if (unknownKeys.length > 0) {
		return false;
	}

	if (policy.provider !== "linear") {
		return false;
	}
	if (
		policy.projectUrl !== undefined &&
		(typeof policy.projectUrl !== "string" ||
			!isValidLinearProjectUrl(policy.projectUrl))
	) {
		return false;
	}
	if (
		policy.requirePackageBugsUrl !== undefined &&
		typeof policy.requirePackageBugsUrl !== "boolean"
	) {
		return false;
	}
	if (
		policy.disableGitHubIssues !== undefined &&
		typeof policy.disableGitHubIssues !== "boolean"
	) {
		return false;
	}
	if (
		policy.requireBranchIssueKey !== undefined &&
		typeof policy.requireBranchIssueKey !== "boolean"
	) {
		return false;
	}
	if (
		policy.requirePrIssueKey !== undefined &&
		typeof policy.requirePrIssueKey !== "boolean"
	) {
		return false;
	}
	if (
		policy.prReferenceMode !== undefined &&
		(typeof policy.prReferenceMode !== "string" ||
			!VALID_PR_REFERENCE_MODES.includes(
				policy.prReferenceMode as PrReferenceMode,
			))
	) {
		return false;
	}
	if (
		policy.branchPrefix !== undefined &&
		(typeof policy.branchPrefix !== "string" ||
			policy.branchPrefix.trim().length === 0 ||
			policy.branchPrefix.includes("/"))
	) {
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
	if (!isValidUILoopCommandSpec(policy.fastCommand)) {
		return false;
	}
	if (!isValidUILoopCommandSpec(policy.verifyCommand)) {
		return false;
	}
	if (!isValidUILoopCommandSpec(policy.exploreCommand)) {
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
	if (
		policy.createIssueOnAgentFindings !== undefined &&
		typeof policy.createIssueOnAgentFindings !== "boolean"
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

function isValidGateExtensionHook<HookId extends GateExtensionHookId>(
	value: unknown,
	allowedHookIds: readonly HookId[],
): value is GateExtensionHook<HookId> {
	if (!isPlainObject(value)) {
		return false;
	}
	const hook = value as Record<string, unknown>;
	const invalidKeys = Object.keys(hook).filter(
		(key) =>
			!VALID_GATE_EXTENSION_HOOK_KEYS.includes(
				key as (typeof VALID_GATE_EXTENSION_HOOK_KEYS)[number],
			),
	);
	if (invalidKeys.length > 0) {
		return false;
	}

	if (typeof hook.id !== "string" || hook.id.length === 0) {
		return false;
	}

	if (!allowedHookIds.includes(hook.id as HookId)) {
		return false;
	}

	if (hook.enabled !== undefined && typeof hook.enabled !== "boolean") {
		return false;
	}

	return true;
}

function isValidPreflightGateExtensionsPolicy(
	value: unknown,
): value is PreflightGateExtensionsPolicy {
	if (!isPlainObject(value)) {
		return false;
	}
	const policy = value as Record<string, unknown>;
	const invalidKeys = Object.keys(policy).filter(
		(key) =>
			!VALID_PREFLIGHT_GATE_EXTENSIONS_POLICY_KEYS.includes(
				key as (typeof VALID_PREFLIGHT_GATE_EXTENSIONS_POLICY_KEYS)[number],
			),
	);
	if (invalidKeys.length > 0) {
		return false;
	}

	if (policy.pre !== undefined) {
		if (!Array.isArray(policy.pre)) {
			return false;
		}
		for (const hook of policy.pre) {
			if (!isValidGateExtensionHook(hook, VALID_PREFLIGHT_PRE_HOOK_IDS)) {
				return false;
			}
		}
	}

	if (policy.post !== undefined) {
		if (!Array.isArray(policy.post)) {
			return false;
		}
		for (const hook of policy.post) {
			if (!isValidGateExtensionHook(hook, VALID_PREFLIGHT_POST_HOOK_IDS)) {
				return false;
			}
		}
	}

	return true;
}

function isValidGateExtensionsPolicy(
	value: unknown,
): value is GateExtensionsPolicy {
	if (!isPlainObject(value)) {
		return false;
	}
	const policy = value as Record<string, unknown>;
	const invalidKeys = Object.keys(policy).filter(
		(key) =>
			!VALID_GATE_EXTENSIONS_POLICY_KEYS.includes(
				key as (typeof VALID_GATE_EXTENSIONS_POLICY_KEYS)[number],
			),
	);
	if (invalidKeys.length > 0) {
		return false;
	}

	if (
		policy.preflightGate !== undefined &&
		!isValidPreflightGateExtensionsPolicy(policy.preflightGate)
	) {
		return false;
	}

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

function isStringArray(
	value: unknown,
	options: { minLength?: number } = {},
): value is string[] {
	if (!Array.isArray(value)) {
		return false;
	}
	if (options.minLength !== undefined && value.length < options.minLength) {
		return false;
	}
	return value.every((entry) => typeof entry === "string" && entry.length > 0);
}

function isValidLoopStageContract(value: unknown): value is LoopStageContract {
	if (!isPlainObject(value)) {
		return false;
	}

	const contract = value as Record<string, unknown>;
	const validKeys = [
		"inputs",
		"outputs",
		"schema",
		"failPolicy",
		"if",
		"permissions",
		"timeoutMinutes",
		"concurrency",
	] as const;
	const invalidKeys = Object.keys(contract).filter(
		(key) => !validKeys.includes(key as (typeof validKeys)[number]),
	);
	if (invalidKeys.length > 0) {
		return false;
	}

	if (!isStringArray(contract.inputs, { minLength: 1 })) {
		return false;
	}
	if (!isStringArray(contract.outputs, { minLength: 1 })) {
		return false;
	}
	if (typeof contract.schema !== "string" || contract.schema.length === 0) {
		return false;
	}
	if (
		typeof contract.failPolicy !== "string" ||
		!VALID_LOOP_STAGE_FAIL_POLICIES.includes(
			contract.failPolicy as LoopStageFailPolicy,
		)
	) {
		return false;
	}
	if (typeof contract.if !== "string" || contract.if.length === 0) {
		return false;
	}
	if (!isStringArray(contract.permissions, { minLength: 1 })) {
		return false;
	}
	if (
		typeof contract.timeoutMinutes !== "number" ||
		contract.timeoutMinutes <= 0 ||
		!Number.isInteger(contract.timeoutMinutes)
	) {
		return false;
	}
	if (
		typeof contract.concurrency !== "string" ||
		contract.concurrency.length === 0
	) {
		return false;
	}

	return true;
}

function isValidLoopStageContracts(
	value: unknown,
): value is LoopStageContracts {
	if (!isPlainObject(value)) {
		return false;
	}

	const contracts = value as Record<string, unknown>;
	const keys = Object.keys(contracts);
	if (keys.length !== VALID_LOOP_STAGE_NAMES.length) {
		return false;
	}

	for (const stageName of keys) {
		if (!VALID_LOOP_STAGE_NAMES.includes(stageName as LoopStageName)) {
			return false;
		}
		if (!isValidLoopStageContract(contracts[stageName])) {
			return false;
		}
	}

	for (const requiredStage of VALID_LOOP_STAGE_NAMES) {
		if (!(requiredStage in contracts)) {
			return false;
		}
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

// === Docs Gate Policy Validation ===

const VALID_DOCS_GATE_MODES: DocsGateMode[] = ["advisory", "required"];
const VALID_DOCS_IMPACT_CATEGORIES: DocsImpactCategory[] = [
	"cli_surface",
	"contract_policy",
	"ci_workflow",
	"branch_protection_or_required_checks",
	"init_scaffolding",
	"tooling_runtime",
	"architecture_context",
	"workflow_authority",
	"adr_artifact",
	"spec_artifact",
	"plan_artifact",
	"brainstorm_artifact",
	"agent_governance",
	"doc_only",
	"unknown_governance_change",
];
const VALID_DOCS_SURFACE_TYPES = [
	"root_doc",
	"governance_doc",
	"generated_template",
	"workflow_doc",
] as const;
const VALID_DOCS_SURFACE_OWNERS = [
	"implementation",
	"contract",
	"workflow",
	"template",
] as const;
const VALID_DOCS_RULE_SEVERITIES = ["info", "warning", "error"] as const;
const VALID_CONTEXT_INTEGRITY_MODES: ContextIntegrityMode[] = [
	"shadow",
	"advisory",
	"required",
];
const VALID_CONTEXT_INTEGRITY_SOURCE_KINDS = ["file", "directory"] as const;
const VALID_CONTEXT_INTEGRITY_AUTHORITIES = ["canonical", "governed"] as const;
const VALID_CONTEXT_CONTRADICTION_CATEGORIES = [
	"command_contract_conflict",
	"required_check_conflict",
	"instruction_precedence_conflict",
	"workflow_policy_conflict",
	"source_truth_missing",
] as const;
const VALID_CONTEXT_HEALTH_TRIGGER_TYPES = [
	"current_checkout",
	"recent_artifacts",
] as const;
const VALID_CONTEXT_HEALTH_DEDUPE_SCOPES = ["query", "run"] as const;
const VALID_CONTEXT_COMPACT_POLICY_KEYS = [
	"thresholdPercent",
	"microCompactThresholdTokens",
	"strategy",
] as const;
const VALID_CONTEXT_COMPACT_STRATEGIES: readonly ContextCompactStrategy[] =
	CONTEXT_COMPACT_STRATEGIES;

function isValidDocsImpactCategory(
	value: unknown,
): value is DocsImpactCategory {
	return (
		typeof value === "string" &&
		VALID_DOCS_IMPACT_CATEGORIES.includes(value as DocsImpactCategory)
	);
}

function isValidDocsSurface(value: unknown): value is DocsSurface {
	if (!isPlainObject(value)) return false;
	const surface = value as Record<string, unknown>;

	// Validate path (required string)
	if (typeof surface.path !== "string" || surface.path.length === 0) {
		return false;
	}

	// Validate surfaceType (required, must be valid value)
	if (
		typeof surface.surfaceType !== "string" ||
		!VALID_DOCS_SURFACE_TYPES.includes(
			surface.surfaceType as (typeof VALID_DOCS_SURFACE_TYPES)[number],
		)
	) {
		return false;
	}

	// Validate owner (required, must be valid value)
	if (
		typeof surface.owner !== "string" ||
		!VALID_DOCS_SURFACE_OWNERS.includes(
			surface.owner as (typeof VALID_DOCS_SURFACE_OWNERS)[number],
		)
	) {
		return false;
	}

	// Validate requiredFor (required string array of valid categories)
	if (!Array.isArray(surface.requiredFor)) {
		return false;
	}
	for (const category of surface.requiredFor) {
		if (!isValidDocsImpactCategory(category)) {
			return false;
		}
	}

	return true;
}

function isValidDocsGateRule(value: unknown): value is DocsGateRule {
	if (!isPlainObject(value)) return false;
	const rule = value as Record<string, unknown>;

	// Validate ruleId (required string)
	if (typeof rule.ruleId !== "string" || rule.ruleId.length === 0) {
		return false;
	}

	// Validate when (required object with categories and/or fileGlobs)
	if (!isPlainObject(rule.when)) {
		return false;
	}
	const when = rule.when as Record<string, unknown>;

	// Validate when.categories (optional array of valid categories)
	if (when.categories !== undefined) {
		if (!Array.isArray(when.categories)) {
			return false;
		}
		for (const category of when.categories) {
			if (!isValidDocsImpactCategory(category)) {
				return false;
			}
		}
	}

	// Validate when.fileGlobs (optional string array)
	if (when.fileGlobs !== undefined) {
		if (!Array.isArray(when.fileGlobs)) {
			return false;
		}
		for (const glob of when.fileGlobs) {
			if (typeof glob !== "string" || glob.length === 0) {
				return false;
			}
		}
	}

	// Validate requireDocs (required string array)
	if (!Array.isArray(rule.requireDocs)) {
		return false;
	}
	for (const doc of rule.requireDocs) {
		if (typeof doc !== "string" || doc.length === 0) {
			return false;
		}
	}

	// Validate severity (required, must be valid value)
	if (
		typeof rule.severity !== "string" ||
		!VALID_DOCS_RULE_SEVERITIES.includes(
			rule.severity as (typeof VALID_DOCS_RULE_SEVERITIES)[number],
		)
	) {
		return false;
	}

	// Validate allowDocOnly (optional boolean)
	if (
		rule.allowDocOnly !== undefined &&
		typeof rule.allowDocOnly !== "boolean"
	) {
		return false;
	}

	return true;
}

export function isValidDocsGatePolicy(value: unknown): value is DocsGatePolicy {
	if (!isPlainObject(value)) return false;
	const policy = value as Record<string, unknown>;

	// Validate enabled (required boolean)
	if (typeof policy.enabled !== "boolean") {
		return false;
	}

	// Validate mode (required, must be valid value)
	if (
		typeof policy.mode !== "string" ||
		!VALID_DOCS_GATE_MODES.includes(policy.mode as DocsGateMode)
	) {
		return false;
	}

	// Validate rules (required array of valid rules)
	if (!Array.isArray(policy.rules)) {
		return false;
	}
	for (const rule of policy.rules) {
		if (!isValidDocsGateRule(rule)) {
			return false;
		}
	}

	// Validate surfaces (optional array of valid surfaces)
	if (policy.surfaces !== undefined) {
		if (!Array.isArray(policy.surfaces)) {
			return false;
		}
		for (const surface of policy.surfaces) {
			if (!isValidDocsSurface(surface)) {
				return false;
			}
		}
	}

	// Validate localHookEnabled (optional boolean)
	if (
		policy.localHookEnabled !== undefined &&
		typeof policy.localHookEnabled !== "boolean"
	) {
		return false;
	}

	return true;
}

function isValidContextIntegrityTruthSource(
	value: unknown,
): value is ContextIntegrityTruthSource {
	if (!isPlainObject(value)) {
		return false;
	}

	const source = value as Record<string, unknown>;
	const validKeys = ["path", "kind", "authority", "required"] as const;
	const invalidKeys = Object.keys(source).filter(
		(key) => !validKeys.includes(key as (typeof validKeys)[number]),
	);
	if (invalidKeys.length > 0) {
		return false;
	}

	return (
		typeof source.path === "string" &&
		source.path.length > 0 &&
		typeof source.kind === "string" &&
		VALID_CONTEXT_INTEGRITY_SOURCE_KINDS.includes(
			source.kind as (typeof VALID_CONTEXT_INTEGRITY_SOURCE_KINDS)[number],
		) &&
		typeof source.authority === "string" &&
		VALID_CONTEXT_INTEGRITY_AUTHORITIES.includes(
			source.authority as (typeof VALID_CONTEXT_INTEGRITY_AUTHORITIES)[number],
		) &&
		typeof source.required === "boolean"
	);
}

function isValidContextIntegrityPolicy(
	value: unknown,
): value is ContextIntegrityPolicy {
	if (!isPlainObject(value)) {
		return false;
	}

	const policy = value as Record<string, unknown>;
	const validKeys = [
		"mode",
		"truthSources",
		"contradictionCatalog",
		"healthSampling",
	] as const;
	const invalidKeys = Object.keys(policy).filter(
		(key) => !validKeys.includes(key as (typeof validKeys)[number]),
	);
	if (invalidKeys.length > 0) {
		return false;
	}

	if (
		typeof policy.mode !== "string" ||
		!VALID_CONTEXT_INTEGRITY_MODES.includes(policy.mode as ContextIntegrityMode)
	) {
		return false;
	}

	if (
		!Array.isArray(policy.truthSources) ||
		policy.truthSources.length === 0 ||
		!policy.truthSources.every(isValidContextIntegrityTruthSource)
	) {
		return false;
	}

	if (!Array.isArray(policy.contradictionCatalog)) {
		return false;
	}
	for (const entry of policy.contradictionCatalog) {
		if (!isPlainObject(entry)) {
			return false;
		}
		const valueObject = entry as Record<string, unknown>;
		const entryKeys = ["id", "category", "severity", "description"] as const;
		const invalidEntryKeys = Object.keys(valueObject).filter(
			(key) => !entryKeys.includes(key as (typeof entryKeys)[number]),
		);
		if (invalidEntryKeys.length > 0) {
			return false;
		}
		if (
			typeof valueObject.id !== "string" ||
			valueObject.id.length === 0 ||
			typeof valueObject.category !== "string" ||
			!VALID_CONTEXT_CONTRADICTION_CATEGORIES.includes(
				valueObject.category as (typeof VALID_CONTEXT_CONTRADICTION_CATEGORIES)[number],
			) ||
			(valueObject.severity !== "warning" &&
				valueObject.severity !== "error") ||
			typeof valueObject.description !== "string" ||
			valueObject.description.length === 0
		) {
			return false;
		}
	}

	if (!isPlainObject(policy.healthSampling)) {
		return false;
	}
	const healthSampling = policy.healthSampling as Record<string, unknown>;
	const healthSamplingKeys = [
		"fixtureSetPath",
		"fixtureSetId",
		"allowedTriggerTypes",
		"samplingCadence",
		"dedupeScope",
	] as const;
	const invalidHealthSamplingKeys = Object.keys(healthSampling).filter(
		(key) =>
			!healthSamplingKeys.includes(key as (typeof healthSamplingKeys)[number]),
	);
	if (invalidHealthSamplingKeys.length > 0) {
		return false;
	}

	return (
		typeof healthSampling.fixtureSetPath === "string" &&
		healthSampling.fixtureSetPath.length > 0 &&
		typeof healthSampling.fixtureSetId === "string" &&
		healthSampling.fixtureSetId.length > 0 &&
		Array.isArray(healthSampling.allowedTriggerTypes) &&
		healthSampling.allowedTriggerTypes.length > 0 &&
		healthSampling.allowedTriggerTypes.every(
			(value) =>
				typeof value === "string" &&
				VALID_CONTEXT_HEALTH_TRIGGER_TYPES.includes(
					value as (typeof VALID_CONTEXT_HEALTH_TRIGGER_TYPES)[number],
				),
		) &&
		typeof healthSampling.samplingCadence === "string" &&
		healthSampling.samplingCadence.length > 0 &&
		typeof healthSampling.dedupeScope === "string" &&
		VALID_CONTEXT_HEALTH_DEDUPE_SCOPES.includes(
			healthSampling.dedupeScope as (typeof VALID_CONTEXT_HEALTH_DEDUPE_SCOPES)[number],
		)
	);
}

function isValidContextCompactPolicy(
	value: unknown,
): value is ContextCompactPolicy {
	if (!isPlainObject(value)) {
		return false;
	}

	const policy = value as Record<string, unknown>;
	const invalidKeys = Object.keys(policy).filter(
		(key) =>
			!VALID_CONTEXT_COMPACT_POLICY_KEYS.includes(
				key as (typeof VALID_CONTEXT_COMPACT_POLICY_KEYS)[number],
			),
	);
	if (invalidKeys.length > 0) {
		return false;
	}

	if (
		typeof policy.thresholdPercent !== "number" ||
		!Number.isFinite(policy.thresholdPercent) ||
		policy.thresholdPercent <= 0 ||
		policy.thresholdPercent > 100
	) {
		return false;
	}

	if (
		typeof policy.microCompactThresholdTokens !== "number" ||
		!Number.isInteger(policy.microCompactThresholdTokens) ||
		policy.microCompactThresholdTokens <= 0
	) {
		return false;
	}

	return (
		typeof policy.strategy === "string" &&
		VALID_CONTEXT_COMPACT_STRATEGIES.includes(
			policy.strategy as ContextCompactStrategy,
		)
	);
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
		(key) =>
			![
				"requiredFor",
				"allowedTypes",
				"maxFileSizeBytes",
				"allowedVideoTypes",
				"maxVideoSizeBytes",
			].includes(key),
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

	// Validate allowedVideoTypes (optional, must be array of valid video formats)
	if (policy.allowedVideoTypes !== undefined) {
		if (!Array.isArray(policy.allowedVideoTypes)) {
			return false;
		}
		const validVideoFormats = ["mp4", "webm"];
		for (const format of policy.allowedVideoTypes) {
			if (!validVideoFormats.includes(format)) {
				return false;
			}
		}
	}

	// Validate maxVideoSizeBytes (optional, must be positive integer)
	if (
		policy.maxVideoSizeBytes !== undefined &&
		(typeof policy.maxVideoSizeBytes !== "number" ||
			policy.maxVideoSizeBytes <= 0 ||
			!Number.isInteger(policy.maxVideoSizeBytes))
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
				expected:
					"{ nodeVersion: string, createIssueOnAgentFindings?: boolean }",
				received: JSON.stringify(obj.runtimePolicy),
				fix: "Ensure runtimePolicy includes nodeVersion and optional createIssueOnAgentFindings boolean",
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
					"reviewPolicy must have timeoutSeconds (positive integer), timeoutAction ('fail' | 'warn'), optional requiredChecks (string array), and optional enforceReviewerIndependence (boolean)",
				expected:
					"{ timeoutSeconds: 600, timeoutAction: 'fail' | 'warn', requiredChecks?: string[], enforceReviewerIndependence?: boolean }",
				received: JSON.stringify(obj.reviewPolicy),
				fix: "Ensure reviewPolicy has valid timeoutSeconds and timeoutAction",
			});
		} else {
			reviewPolicy = obj.reviewPolicy as ReviewPolicy;
		}
	}

	// Validate branchProtection (optional)
	let branchProtection: BranchProtectionPolicy | undefined;
	if ("branchProtection" in obj && obj.branchProtection !== undefined) {
		if (!isValidBranchProtection(obj.branchProtection)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "branchProtection",
				message:
					"branchProtection must use valid required checks, merge requirements, merge methods, and optional code quality/code scanning policy fields",
				expected:
					"{ requiredChecks?: string[], restrictDeletions?: boolean, blockForcePushes?: boolean, requireLinearHistory?: boolean, requirePullRequest?: boolean, requiredApprovingReviewCount?: number, dismissStaleReviewsOnPush?: boolean, requireConversationResolution?: boolean, requireCodeOwnerReview?: boolean, requireLastPushApproval?: boolean, requireBranchesUpToDate?: boolean, allowedMergeMethods?: { mergeCommit: boolean, squash: boolean, rebase: boolean }, codeQuality?: { required: boolean, severity: 'errors' | 'warnings_and_higher' | 'notes_and_higher' | 'all' }, publicCodeScanning?: { required: boolean, publicOnly: boolean, tool: string, alertsThreshold: 'errors' | 'errors_and_warnings' | 'all', securityAlertsThreshold: 'high_or_higher' | 'medium_or_higher' | 'all' } }",
				received: JSON.stringify(obj.branchProtection),
				fix: "Ensure branchProtection only contains supported booleans, non-negative approval counts, valid merge methods, and supported code quality/code scanning thresholds",
			});
		} else {
			branchProtection = obj.branchProtection as BranchProtectionPolicy;
		}
	}

	// Validate issueTrackingPolicy (optional)
	let issueTrackingPolicy: IssueTrackingPolicy | undefined;
	if ("issueTrackingPolicy" in obj && obj.issueTrackingPolicy !== undefined) {
		if (!isValidIssueTrackingPolicy(obj.issueTrackingPolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "issueTrackingPolicy",
				message:
					"issueTrackingPolicy must declare provider 'linear' plus optional Linear enforcement settings",
				expected:
					"{ provider: 'linear', projectUrl?: 'https://linear.app/.../project/...', requirePackageBugsUrl?: boolean, disableGitHubIssues?: boolean, requireBranchIssueKey?: boolean, requirePrIssueKey?: boolean, prReferenceMode?: 'refs' | 'fixes' | 'either', branchPrefix?: string }",
				received: JSON.stringify(obj.issueTrackingPolicy),
				fix: "Ensure issueTrackingPolicy uses only supported Linear policy fields",
			});
		} else {
			issueTrackingPolicy = obj.issueTrackingPolicy as IssueTrackingPolicy;
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

	// Validate loopStageContracts (optional)
	let loopStageContracts: LoopStageContracts | undefined;
	if ("loopStageContracts" in obj && obj.loopStageContracts !== undefined) {
		if (!isValidLoopStageContracts(obj.loopStageContracts)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "loopStageContracts",
				message:
					"loopStageContracts must define all loop stages with semantic parity fields",
				expected:
					"{ risk-policy-gate, review-gate, evidence-verify, remediation-decision } with inputs/outputs/schema/failPolicy/if/permissions/timeoutMinutes/concurrency",
				received: JSON.stringify(obj.loopStageContracts),
				fix: "Provide complete loopStageContracts entries with valid field types and required stage keys",
			});
		} else {
			loopStageContracts = obj.loopStageContracts as LoopStageContracts;
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

	// Validate docsGatePolicy (optional)
	let docsGatePolicy: DocsGatePolicy | undefined;
	if ("docsGatePolicy" in obj && obj.docsGatePolicy !== undefined) {
		if (!isValidDocsGatePolicy(obj.docsGatePolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "docsGatePolicy",
				message:
					"docsGatePolicy must have enabled (boolean), mode ('advisory' | 'required'), rules (array), and optional surfaces, localHookEnabled",
				expected:
					"{ enabled: boolean, mode: 'advisory' | 'required', rules: [...], surfaces?: [...], localHookEnabled?: boolean }",
				received: JSON.stringify(obj.docsGatePolicy),
				fix: "Ensure docsGatePolicy has valid enabled, mode, and rules fields with valid rule structures",
			});
		} else {
			docsGatePolicy = obj.docsGatePolicy as DocsGatePolicy;
		}
	}

	// Validate controlPlanePolicy (optional)
	let controlPlanePolicy: ControlPlanePolicy | undefined;
	if ("controlPlanePolicy" in obj && obj.controlPlanePolicy !== undefined) {
		if (!isValidControlPlanePolicy(obj.controlPlanePolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "controlPlanePolicy",
				message:
					"controlPlanePolicy must include overridePolicy with authorizedPrincipals, dualApprovalScopes, maxTtlHours (<= 24), and nonOverridableControls",
				expected:
					"{ overridePolicy: { authorizedPrincipals: string[], dualApprovalScopes: ('advisory_hold' | 'temporary_unblock' | 'temporary_promote')[], maxTtlHours: number, nonOverridableControls: string[] } }",
				received: JSON.stringify(obj.controlPlanePolicy),
				fix: "Ensure controlPlanePolicy.overridePolicy uses valid principals, scopes, TTL, and non-overridable control ids",
			});
		} else {
			controlPlanePolicy = obj.controlPlanePolicy as ControlPlanePolicy;
		}
	}

	// Validate contextIntegrityPolicy (optional)
	let contextIntegrityPolicy: ContextIntegrityPolicy | undefined;
	if (
		"contextIntegrityPolicy" in obj &&
		obj.contextIntegrityPolicy !== undefined
	) {
		if (!isValidContextIntegrityPolicy(obj.contextIntegrityPolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "contextIntegrityPolicy",
				message:
					"contextIntegrityPolicy must declare mode, truthSources, contradictionCatalog, and healthSampling",
				expected:
					"{ mode: 'shadow' | 'advisory' | 'required', truthSources: [{ path: string, kind: 'file' | 'directory', authority: 'canonical' | 'governed', required: boolean }], contradictionCatalog: [{ id: string, category: string, severity: 'warning' | 'error', description: string }], healthSampling: { fixtureSetPath: string, fixtureSetId: string, allowedTriggerTypes: ('current_checkout' | 'recent_artifacts')[], samplingCadence: string, dedupeScope: 'query' | 'run' } }",
				received: JSON.stringify(obj.contextIntegrityPolicy),
				fix: "Ensure contextIntegrityPolicy uses supported mode, truth-source, contradiction, and health-sampling shapes",
			});
		} else {
			contextIntegrityPolicy =
				obj.contextIntegrityPolicy as ContextIntegrityPolicy;
		}
	}

	// Validate contextCompact (optional)
	let contextCompact: ContextCompactPolicy | undefined;
	if ("contextCompact" in obj && obj.contextCompact !== undefined) {
		if (!isValidContextCompactPolicy(obj.contextCompact)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "contextCompact",
				message:
					"contextCompact must declare thresholdPercent, microCompactThresholdTokens, and strategy",
				expected:
					"{ thresholdPercent: number (1-100), microCompactThresholdTokens: integer (>0), strategy: 'balanced' | 'aggressive' | 'micro' }",
				received: JSON.stringify(obj.contextCompact),
				fix: "Use supported numeric thresholds and one of the supported contextCompact strategies",
			});
		} else {
			contextCompact = obj.contextCompact as ContextCompactPolicy;
		}
	}

	// Validate toolingPolicy (optional)
	let toolingPolicy: ToolingPolicy | undefined;
	if ("toolingPolicy" in obj && obj.toolingPolicy !== undefined) {
		if (!isValidToolingPolicy(obj.toolingPolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "toolingPolicy",
				message:
					"toolingPolicy must declare required documentation terms, binaries, mise tool pins, readiness script path, Codex environment actions, and Makefile targets",
				expected:
					"{ requiredDocumentationTerms: string[], requiredBinaries: string[], requiredMiseTools: [{ tool: string, version: string }], miseFilePath: string, readinessScriptPath: string, codexEnvironment: { path: string, requiredActions: [{ name: string, icon: 'tool' | 'run' | 'debug' | 'test' }] }, makefile: { path: string, requiredTargets: string[] }, packagePolicy: { packageJsonPath: string, explicitCapabilities?: ('ui' | 'chatgpt_apps_sdk')[], capabilityDetectors: [{ capability: 'ui' | 'chatgpt_apps_sdk', dependencyMarkers: string[] }], requiredPackages: [{ package: string, dependencyType: 'dependencies' | 'devDependencies' | 'either', requiredWhenCapabilities: ('ui' | 'chatgpt_apps_sdk')[] }] } }",
				received: JSON.stringify(obj.toolingPolicy),
				fix: "Ensure toolingPolicy contains only supported keys and uses non-empty strings for terms, binaries, paths, tools, versions, action names, and target names",
			});
		} else {
			toolingPolicy = obj.toolingPolicy as ToolingPolicy;
		}
	}

	// Validate ciProviderPolicy (optional)
	let ciProviderPolicy: CIProviderPolicy | undefined;
	if ("ciProviderPolicy" in obj && obj.ciProviderPolicy !== undefined) {
		if (!isValidCIProviderPolicy(obj.ciProviderPolicy)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "ciProviderPolicy",
				message:
					"ciProviderPolicy must define activeProvider, mode, migrationStage, transitionStatusArtifactPath, authorityConfigPath, requiredCheckManifestPath, and trustedPolicyRef",
				expected:
					"{ activeProvider: 'github-actions' | 'circleci', mode: 'shadow' | 'required', migrationStage: 'dual-provider' | 'circleci-primary' | 'circleci-only', transitionStatusArtifactPath: string, authorityConfigPath: string, requiredCheckManifestPath: string, trustedPolicyRef: string }",
				received: JSON.stringify(obj.ciProviderPolicy),
				fix: "Ensure ciProviderPolicy contains only supported keys, valid enum values, and non-empty string paths",
			});
		} else {
			ciProviderPolicy = obj.ciProviderPolicy as CIProviderPolicy;
		}
	}

	// Validate blastRadiusRules (optional)
	let blastRadiusRules: BlastRadiusRule[] | undefined;
	if ("blastRadiusRules" in obj && obj.blastRadiusRules !== undefined) {
		if (!isValidBlastRadiusRules(obj.blastRadiusRules)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "blastRadiusRules",
				message:
					"blastRadiusRules must be an array of rule objects with pattern/checks",
				expected:
					"[{ pattern: string, checks: string[], description?: string }]",
				received: JSON.stringify(obj.blastRadiusRules),
				fix: "Ensure blastRadiusRules uses valid rule objects with string patterns and string checks",
			});
		} else {
			blastRadiusRules = obj.blastRadiusRules as BlastRadiusRule[];
		}
	}

	// Validate blastRadiusRulesMode (optional)
	let blastRadiusRulesMode: BlastRadiusRulesMode = "merge";
	if ("blastRadiusRulesMode" in obj && obj.blastRadiusRulesMode !== undefined) {
		if (!isValidBlastRadiusRulesMode(obj.blastRadiusRulesMode)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "blastRadiusRulesMode",
				message: "blastRadiusRulesMode must be 'merge' or 'replace'",
				expected: "'merge' | 'replace'",
				received: String(obj.blastRadiusRulesMode),
				fix: "Set blastRadiusRulesMode to 'merge' or 'replace'",
			});
		} else {
			blastRadiusRulesMode = obj.blastRadiusRulesMode;
		}
	}

	// Validate gateExtensions (optional)
	let gateExtensions: GateExtensionsPolicy | undefined;
	if ("gateExtensions" in obj && obj.gateExtensions !== undefined) {
		if (!isValidGateExtensionsPolicy(obj.gateExtensions)) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "gateExtensions",
				message: "gateExtensions must use supported gate keys and hook ids",
				expected:
					"{ preflightGate?: { pre?: [{ id: 'skip-all-checks' | 'force-fail', enabled?: boolean }], post?: [{ id: 'fail-on-warnings', enabled?: boolean }] } }",
				received: JSON.stringify(obj.gateExtensions),
				fix: "Use only supported gate extension hooks and boolean enabled flags",
			});
		} else {
			gateExtensions = obj.gateExtensions as GateExtensionsPolicy;
		}
	}

	if (
		reviewPolicy?.requiredChecks !== undefined &&
		branchProtection?.requiredChecks !== undefined
	) {
		const branchProtectionChecks = new Set(branchProtection.requiredChecks);
		const missingChecks = reviewPolicy.requiredChecks.filter(
			(check) => !branchProtectionChecks.has(check),
		);
		if (missingChecks.length > 0) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "reviewPolicy.requiredChecks",
				message:
					"reviewPolicy.requiredChecks must be a subset of branchProtection.requiredChecks",
				expected: `subset of ${JSON.stringify(branchProtection.requiredChecks)}`,
				received: JSON.stringify(reviewPolicy.requiredChecks),
				fix: `Remove unsupported reviewPolicy checks: ${missingChecks.join(", ")}`,
			});
		}
	}

	// ── Cross-field consistency checks (JSC-69) ───────────────────────────────

	// Check 1: mode=shadow is inconsistent with migrationStage=cutover-complete or circleci-only/gha-only
	if (ciProviderPolicy?.mode === "shadow") {
		const completedStages = [
			"cutover-complete",
			"circleci-only",
			"gha-only",
		] as const;
		const stage = ciProviderPolicy.migrationStage as string | undefined;
		if (
			stage !== undefined &&
			completedStages.includes(stage as (typeof completedStages)[number])
		) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "ciProviderPolicy.mode",
				message: `ciProviderPolicy.mode is "shadow" but migrationStage is "${stage}" — migration is complete but mode still reports as shadow`,
				expected:
					'"primary" or "required" when migrationStage is fully migrated',
				received: `mode="${ciProviderPolicy.mode}", migrationStage="${stage}"`,
				fix: 'Set ciProviderPolicy.mode to "primary" or "required" to match the completed migration stage',
			});
		}
	}

	// Check 2: mode=required is inconsistent with migrationStage=pre-migration or dual-provider
	if (ciProviderPolicy?.mode === "required") {
		const earlyStages = ["pre-migration", "dual-provider"] as const;
		const stage = ciProviderPolicy.migrationStage as string | undefined;
		if (
			stage !== undefined &&
			earlyStages.includes(stage as (typeof earlyStages)[number])
		) {
			errors.push({
				code: ValidationErrorCode.INVALID_VALUE,
				path: "ciProviderPolicy.migrationStage",
				message: `ciProviderPolicy.migrationStage is "${stage}" but mode is "required" — CI can't be required when migration hasn't started`,
				expected:
					'"circleci-primary", "circleci-only", or "cutover-complete" when mode is "required"',
				received: `mode="${ciProviderPolicy.mode}", migrationStage="${stage}"`,
				fix: `Advance migrationStage to match the "required" mode, or revert mode to "shadow"`,
			});
		}
	}

	// Check 3: commitMode=solo is inconsistent with trustedPolicyRef (enterprise field)
	if (
		ciProviderPolicy?.commitMode === "solo" &&
		ciProviderPolicy.trustedPolicyRef !== undefined
	) {
		errors.push({
			code: ValidationErrorCode.INVALID_VALUE,
			path: "ciProviderPolicy.commitMode",
			message:
				'ciProviderPolicy.commitMode is "solo" but trustedPolicyRef is set — solo mode skips enterprise policy gates',
			expected:
				'"team" or "enterprise" commitMode when trustedPolicyRef is configured',
			received: `commitMode="solo", trustedPolicyRef="${String(ciProviderPolicy.trustedPolicyRef)}"`,
			fix: 'Change commitMode to "team" or "enterprise", or remove trustedPolicyRef',
		});
	}

	// Check 4: commitMode=enterprise requires trustedPolicyRef
	if (
		ciProviderPolicy?.commitMode === "enterprise" &&
		ciProviderPolicy.trustedPolicyRef === undefined
	) {
		errors.push({
			code: ValidationErrorCode.INVALID_VALUE,
			path: "ciProviderPolicy.trustedPolicyRef",
			message:
				'ciProviderPolicy.commitMode is "enterprise" but trustedPolicyRef is not set — enterprise mode requires a trusted policy reference',
			expected: 'trustedPolicyRef: "refs/heads/main" or equivalent',
			received: "trustedPolicyRef: undefined",
			fix: 'Add trustedPolicyRef: "refs/heads/main" to ciProviderPolicy',
		});
	}

	if (errors.length > 0) {
		return { success: false, errors };
	}

	return {
		success: true,
		data: {
			version: obj.version as string,
			riskTierRules: (obj.riskTierRules as Record<string, RiskTier>) ?? {},
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
			gapCasePolicy,
			reviewPolicy,
			evidencePolicy,
			remediationPolicy,
			loopStageContracts,
			pilotGapCasePolicy,
			pilotRollbackPolicy,
			pilotAuthzPolicy,
			docsGatePolicy,
			contextCompact,
			contextIntegrityPolicy,
			controlPlanePolicy,
			toolingPolicy,
			ciProviderPolicy,
			branchProtection,
			issueTrackingPolicy,
			blastRadiusRules,
			blastRadiusRulesMode,
			gateExtensions,
		},
		errors: [],
	};
}
