import { PREFLIGHT_POST_HOOK_IDS, PREFLIGHT_PRE_HOOK_IDS } from "./types.js";
import { isValidSharedStateActions } from "./shared-state-action-validator.js";
import type {
	CIProviderMigrationStage,
	CIProviderPolicy,
	CIProviderPolicyMode,
	ContextCompactPolicy,
	ContextCompactStrategy,
	ContextIntegrityMode,
	ContextIntegrityPolicy,
	ContextIntegrityTruthSource,
	ControlPlaneOverridePolicy,
	ControlPlaneOverrideScope,
	ControlPlanePolicy,
	DocsGateMode,
	DocsGatePolicy,
	DocsGateRule,
	DocsImpactCategory,
	DocsSurface,
	EvidencePolicy,
	GateExtensionHook,
	GateExtensionHookId,
	GateExtensionsPolicy,
	PilotAuthzPolicy,
	PilotGapCasePolicy,
	PilotRollbackPolicy,
	RemediationPolicy,
	RemediationProviderPolicy,
	ToolingCapabilityDetector,
	ToolingCodexAction,
	ToolingCodexEnvironmentPolicy,
	ToolingMakefilePolicy,
	ToolingMiseTool,
	ToolingPackagePolicy,
	ToolingPackageRequirement,
	ToolingPolicy,
	ToolingProjectBrainMemoryExtensionPolicy,
} from "./types.js";
import {
	FORBIDDEN_KEYS,
	isNonEmptyStringArray,
	isPlainObject,
	isStringArray,
	isValidImageFormat,
	isValidRiskTier,
} from "./validator-helpers.js";

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
const VALID_CONTEXT_COMPACT_STRATEGIES: readonly ContextCompactStrategy[] = [
	"balanced",
	"aggressive",
	"micro",
];
const VALID_ROLLBACK_MODES = ["manual", "autonomous"] as const;
const VALID_CONTROL_PLANE_OVERRIDE_SCOPES = [
	"advisory_hold",
	"temporary_unblock",
	"temporary_promote",
] as const;
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
const VALID_TOOLING_POLICY_KEYS = [
	"requiredDocumentationTerms",
	"requiredBinaries",
	"requiredMiseTools",
	"miseFilePath",
	"readinessScriptPath",
	"codexEnvironment",
	"makefile",
	"packagePolicy",
	"sharedStateActions",
	"projectBrainMemoryExtension",
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
const VALID_TOOLING_PROJECT_BRAIN_MEMORY_EXTENSION_KEYS = [
	"enabled",
	"requiredPaths",
] as const;
const VALID_EVIDENCE_POLICY_VIDEO_FORMATS = ["mp4", "webm"] as const;
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
const VALID_GATE_EXTENSIONS_POLICY_KEYS = ["preflightGate"] as const;
const VALID_PREFLIGHT_GATE_EXTENSIONS_POLICY_KEYS = ["pre", "post"] as const;
const VALID_GATE_EXTENSION_HOOK_KEYS = ["id", "enabled"] as const;

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

	if (typeof surface.path !== "string" || surface.path.length === 0) {
		return false;
	}
	if (
		typeof surface.surfaceType !== "string" ||
		!VALID_DOCS_SURFACE_TYPES.includes(
			surface.surfaceType as (typeof VALID_DOCS_SURFACE_TYPES)[number],
		)
	) {
		return false;
	}
	if (
		typeof surface.owner !== "string" ||
		!VALID_DOCS_SURFACE_OWNERS.includes(
			surface.owner as (typeof VALID_DOCS_SURFACE_OWNERS)[number],
		)
	) {
		return false;
	}
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

	if (typeof rule.ruleId !== "string" || rule.ruleId.length === 0) {
		return false;
	}
	if (!isPlainObject(rule.when)) {
		return false;
	}
	const when = rule.when as Record<string, unknown>;

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
	if (!Array.isArray(rule.requireDocs)) {
		return false;
	}
	for (const doc of rule.requireDocs) {
		if (typeof doc !== "string" || doc.length === 0) {
			return false;
		}
	}
	if (
		typeof rule.severity !== "string" ||
		!VALID_DOCS_RULE_SEVERITIES.includes(
			rule.severity as (typeof VALID_DOCS_RULE_SEVERITIES)[number],
		)
	) {
		return false;
	}
	if (
		rule.allowDocOnly !== undefined &&
		typeof rule.allowDocOnly !== "boolean"
	) {
		return false;
	}

	return true;
}

/** Public API export. */
export function isValidDocsGatePolicy(value: unknown): value is DocsGatePolicy {
	if (!isPlainObject(value)) return false;
	const policy = value as Record<string, unknown>;

	if (typeof policy.enabled !== "boolean") {
		return false;
	}
	if (
		typeof policy.mode !== "string" ||
		!VALID_DOCS_GATE_MODES.includes(policy.mode as DocsGateMode)
	) {
		return false;
	}
	if (!Array.isArray(policy.rules)) {
		return false;
	}
	for (const rule of policy.rules) {
		if (!isValidDocsGateRule(rule)) {
			return false;
		}
	}
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

/** Public API export. */
export function isValidContextIntegrityPolicy(
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

/** Public API export. */
export function isValidContextCompactPolicy(
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

/** Public API export. */
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

	if (!Array.isArray(policy.requiredFor)) {
		return false;
	}
	for (const pattern of policy.requiredFor) {
		if (typeof pattern !== "string") {
			return false;
		}
		if (FORBIDDEN_KEYS.includes(pattern as (typeof FORBIDDEN_KEYS)[number])) {
			return false;
		}
	}
	if (!Array.isArray(policy.allowedTypes)) {
		return false;
	}
	for (const format of policy.allowedTypes) {
		if (!isValidImageFormat(format)) {
			return false;
		}
	}
	if (
		policy.maxFileSizeBytes !== undefined &&
		(typeof policy.maxFileSizeBytes !== "number" ||
			policy.maxFileSizeBytes <= 0 ||
			!Number.isInteger(policy.maxFileSizeBytes))
	) {
		return false;
	}
	if (policy.allowedVideoTypes !== undefined) {
		if (!Array.isArray(policy.allowedVideoTypes)) {
			return false;
		}
		for (const format of policy.allowedVideoTypes) {
			if (!VALID_EVIDENCE_POLICY_VIDEO_FORMATS.includes(format)) {
				return false;
			}
		}
	}
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

function isValidRemediationProviderPolicy(
	value: unknown,
): value is RemediationProviderPolicy {
	if (typeof value !== "object" || value === null) return false;
	const policy = value as Record<string, unknown>;

	if (!isValidRiskTier(policy.autoApplyMaxTier)) {
		return false;
	}
	if (typeof policy.dryRunOnlyByDefault !== "boolean") {
		return false;
	}

	return true;
}

/** Public API export. */
export function isValidRemediationPolicy(
	value: unknown,
): value is RemediationPolicy {
	if (typeof value !== "object" || value === null) return false;
	const policy = value as Record<string, unknown>;

	if (
		typeof policy.providerDefaults !== "object" ||
		policy.providerDefaults === null
	) {
		return false;
	}
	for (const [provider, providerPolicy] of Object.entries(
		policy.providerDefaults as Record<string, unknown>,
	)) {
		if (FORBIDDEN_KEYS.includes(provider as (typeof FORBIDDEN_KEYS)[number])) {
			return false;
		}
		if (!isValidRemediationProviderPolicy(providerPolicy)) {
			return false;
		}
	}

	if (typeof policy.marker !== "string") {
		return false;
	}
	if (
		typeof policy.timeoutMinutes !== "number" ||
		policy.timeoutMinutes <= 0 ||
		!Number.isInteger(policy.timeoutMinutes)
	) {
		return false;
	}
	if (
		typeof policy.retryLimit !== "number" ||
		policy.retryLimit < 0 ||
		!Number.isInteger(policy.retryLimit)
	) {
		return false;
	}
	if (typeof policy.requireEvidence !== "boolean") {
		return false;
	}

	return true;
}

/** Public API export. */
export function isValidPilotGapCasePolicy(
	value: unknown,
): value is PilotGapCasePolicy {
	if (typeof value !== "object" || value === null) return false;
	const policy = value as Record<string, unknown>;

	if (typeof policy.enabled !== "boolean") {
		return false;
	}
	if (
		typeof policy.defaultSlaHours !== "number" ||
		policy.defaultSlaHours <= 0 ||
		!Number.isInteger(policy.defaultSlaHours)
	) {
		return false;
	}
	if (typeof policy.requireClosureEvidence !== "boolean") {
		return false;
	}
	if (policy.storePath !== undefined && typeof policy.storePath !== "string") {
		return false;
	}

	return true;
}

/** Public API export. */
export function isValidPilotRollbackPolicy(
	value: unknown,
): value is PilotRollbackPolicy {
	if (typeof value !== "object" || value === null) return false;
	const policy = value as Record<string, unknown>;

	if (typeof policy.autoTrigger !== "boolean") {
		return false;
	}
	if (typeof policy.requireManualRelease !== "boolean") {
		return false;
	}
	if (typeof policy.completionMarkerPath !== "string") {
		return false;
	}
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

/** Public API export. */
export function isValidPilotAuthzPolicy(
	value: unknown,
): value is PilotAuthzPolicy {
	if (typeof value !== "object" || value === null) return false;
	const policy = value as Record<string, unknown>;

	if (!Array.isArray(policy.githubScopeAllowlist)) {
		return false;
	}
	for (const scope of policy.githubScopeAllowlist) {
		if (typeof scope !== "string") {
			return false;
		}
	}
	if (!Array.isArray(policy.repoAllowlist)) {
		return false;
	}
	for (const pattern of policy.repoAllowlist) {
		if (typeof pattern !== "string") {
			return false;
		}
		if (FORBIDDEN_KEYS.includes(pattern as (typeof FORBIDDEN_KEYS)[number])) {
			return false;
		}
	}
	if (!Array.isArray(policy.branchAllowlist)) {
		return false;
	}
	for (const pattern of policy.branchAllowlist) {
		if (typeof pattern !== "string") {
			return false;
		}
		if (FORBIDDEN_KEYS.includes(pattern as (typeof FORBIDDEN_KEYS)[number])) {
			return false;
		}
	}
	if (!Array.isArray(policy.protectedBranchDenylist)) {
		return false;
	}
	for (const pattern of policy.protectedBranchDenylist) {
		if (typeof pattern !== "string") {
			return false;
		}
		if (FORBIDDEN_KEYS.includes(pattern as (typeof FORBIDDEN_KEYS)[number])) {
			return false;
		}
	}
	if (typeof policy.enforceBranchProtection !== "boolean") {
		return false;
	}

	return true;
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
/** Public API export. */
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
/** Public API export. */
export function isValidCIProviderPolicy(
	value: unknown,
): value is CIProviderPolicy {
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
	if (
		policy.trustedPolicyRef !== undefined &&
		(typeof policy.trustedPolicyRef !== "string" ||
			policy.trustedPolicyRef.trim().length === 0)
	) {
		return false;
	}
	return true;
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

function isValidToolingProjectBrainMemoryExtension(
	value: unknown,
): value is ToolingProjectBrainMemoryExtensionPolicy {
	if (!isPlainObject(value)) return false;
	const projectBrain = value as Record<string, unknown>;
	const unknownKeys = Object.keys(projectBrain).filter(
		(key) =>
			!VALID_TOOLING_PROJECT_BRAIN_MEMORY_EXTENSION_KEYS.includes(
				key as (typeof VALID_TOOLING_PROJECT_BRAIN_MEMORY_EXTENSION_KEYS)[number],
			),
	);
	if (unknownKeys.length > 0) {
		return false;
	}

	return (
		typeof projectBrain.enabled === "boolean" &&
		isStringArray(projectBrain.requiredPaths, {
			minLength: projectBrain.enabled ? 1 : 0,
		})
	);
}
/** Public API export. */
export function isValidToolingPolicy(value: unknown): value is ToolingPolicy {
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
		isValidToolingPackagePolicy(policy.packagePolicy) &&
		isValidSharedStateActions(policy.sharedStateActions) &&
		(policy.projectBrainMemoryExtension === undefined ||
			isValidToolingProjectBrainMemoryExtension(
				policy.projectBrainMemoryExtension,
			))
	);
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
): value is Record<string, unknown> {
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
			if (!isValidGateExtensionHook(hook, PREFLIGHT_PRE_HOOK_IDS)) {
				return false;
			}
		}
	}
	if (policy.post !== undefined) {
		if (!Array.isArray(policy.post)) {
			return false;
		}
		for (const hook of policy.post) {
			if (!isValidGateExtensionHook(hook, PREFLIGHT_POST_HOOK_IDS)) {
				return false;
			}
		}
	}

	return true;
}

/** Public API export. */
export function isValidGateExtensionsPolicy(
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
