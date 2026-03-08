import {
	BRANCH_PROTECTION_REQUIRED_CHECKS,
	REVIEW_POLICY_REQUIRED_CHECKS,
} from "../policy/required-checks.js";

export type RiskTier = "high" | "medium" | "low";

export type TimeoutAction = "fail" | "warn";

export type ImageFormat = "png" | "jpeg";

/**
 * Roadmap-style merge policy entry with required checks array.
 * Used for extended policy configuration.
 */
export interface MergePolicyEntry {
	requiredChecks: string[];
}

/**
 * Merge policy value - supports both legacy array and roadmap object shapes.
 * - Legacy: `["check1", "check2"]`
 * - Roadmap: `{ "requiredChecks": ["check1", "check2"] }`
 */
export type MergePolicyValue = string[] | MergePolicyEntry;

/**
 * Diff budget configuration for limiting PR scope.
 */
export interface DiffBudget {
	/** Maximum number of files allowed in a PR */
	maxFiles: number;
	/** Maximum net lines of code (additions - deletions) */
	maxNetLOC: number;
	/** Optional label referenced by override payloads */
	overrideLabel?: string;
}

export interface MergePolicy {
	[severity: string]: MergePolicyValue;
}

export interface DocsDriftRules {
	[pattern: string]: string[];
}

export interface UILoopSLO {
	/** Target seconds to reach stable "fast" loop execution */
	fastLoopSeconds: number;
	/** Target seconds to complete "verify" loop execution */
	verifyLoopSeconds: number;
}

export interface UILoopPolicy {
	fastCommand: string;
	verifyCommand: string;
	exploreCommand: string;
	sloTargets: UILoopSLO;
}

export interface RuntimePolicy {
	nodeVersion: string;
	/** Require issue creation/update when agents find reproducible harness issues */
	createIssueOnAgentFindings?: boolean;
}

export interface MemoryPolicy {
	enabled: boolean;
	provider: string;
	sessionIdTemplate: string;
	domain: string;
	requiredTags: string[];
	maxObservationsPerStep: number;
	allowedLevels: string[];
	requireStartRead: boolean;
	requireCloseoutSummary: boolean;
	forbiddenContentPatterns: string[];
}

export interface MemoryMaintenancePolicy {
	validateSchedule: string;
	reflectSchedule: string;
	questionSlaDays: number;
	duplicateThreshold: number;
}

export interface MemoryEvalPolicy {
	trialsPerTask: number;
	requiredMetrics: string[];
	passPowKThreshold: number;
}

export interface ObservabilityPolicy {
	provider: string;
	collectorEndpoint: string;
}

export interface PackageManagerPolicy {
	allowedManagers: string[];
	requiredManager: string | null;
}

export interface BlastRadiusRule {
	/** Glob pattern for matching file paths */
	pattern: string;
	/** Required checks when files match this pattern */
	checks: string[];
	/** Optional rule description */
	description?: string | undefined;
}

export type BlastRadiusRulesMode = "merge" | "replace";

/**
 * Gap-case policy for lifecycle and severity controls.
 */
export interface GapCasePolicy {
	requiredEvidenceStatuses: string[];
	requiredCloseReasons: string[];
	defaultDueDays: number;
	caseIdPrefix: string;
	caseStore: string;
	allowEvidencelessResolve: boolean;
}

/**
 * Override metadata when diff budget is exceeded.
 */
export interface DiffBudgetOverride {
	/** Person approving the override */
	approvedBy: string;
	/** Reason for the override */
	reason: string;
	/** Timestamp of approval */
	timestamp: string;
}

export interface ReviewPolicy {
	timeoutSeconds: number;
	timeoutAction: TimeoutAction;
	requiredChecks?: string[] | undefined;
	enforceReviewerIndependence?: boolean | undefined;
}

export interface BranchProtectionPolicy {
	requiredChecks?: string[] | undefined;
}

export type LoopStageFailPolicy = "fail_closed" | "warn_only";

export type LoopStageName =
	| "risk-policy-gate"
	| "review-gate"
	| "evidence-verify"
	| "remediation-decision";

/**
 * Semantic contract for a loop stage. Used to validate generated and
 * repo-native workflow parity at the stage-behavior level.
 */
export interface LoopStageContract {
	inputs: string[];
	outputs: string[];
	schema: string;
	failPolicy: LoopStageFailPolicy;
	if: string;
	permissions: string[];
	timeoutMinutes: number;
	concurrency: string;
}

export type LoopStageContracts = Record<LoopStageName, LoopStageContract>;

/**
 * Evidence policy configuration for requiring evidence files.
 */
export interface EvidencePolicy {
	/** Glob patterns for paths requiring evidence */
	requiredFor: string[];
	/** Allowed image formats for evidence */
	allowedTypes: ImageFormat[];
	/** Allowed video formats for evidence (optional) */
	allowedVideoTypes?: ("mp4" | "webm")[] | undefined;
	/** Maximum file size in bytes (optional, defaults to 1MB for images) */
	maxFileSizeBytes?: number | undefined;
	/** Maximum video file size in bytes (optional, defaults to 100MB) */
	maxVideoSizeBytes?: number | undefined;
}

/**
 * Provider-specific remediation policy settings.
 */
export interface RemediationProviderPolicy {
	/** Maximum severity tier for automatic remediation */
	autoApplyMaxTier: RiskTier;
	/** Whether to default to dry-run mode for this provider */
	dryRunOnlyByDefault: boolean;
}

/**
 * Remediation policy configuration for automatic fix application.
 */
export interface RemediationPolicy {
	/** Provider-specific defaults keyed by provider name */
	providerDefaults: Record<string, RemediationProviderPolicy>;
	/** Comment marker for remediation commits/comments */
	marker: string;
	/** Timeout for remediation operations in minutes */
	timeoutMinutes: number;
	/** Maximum retry attempts for failed remediations */
	retryLimit: number;
	/** Whether evidence is required for remediation */
	requireEvidence: boolean;
}

/**
 * Pilot gap-case policy for incident tracking workflow.
 * Minimal v1 surface for incident → gap-case creation/update.
 */
export interface PilotGapCasePolicy {
	/** Whether gap-case tracking is enabled */
	enabled: boolean;
	/** Default SLA in hours for gap-case resolution */
	defaultSlaHours: number;
	/** Whether evidence URL is required for closure */
	requireClosureEvidence: boolean;
	/** Optional custom path for gap-case store (default: .harness/gap-cases.v1.json) */
	storePath?: string | undefined;
}

/**
 * Pilot rollback policy for automatic rollback behavior.
 * Controls how the system responds to high-risk automation incidents.
 */
export interface PilotRollbackPolicy {
	/** Automatically trigger rollback on high-risk automation incident */
	autoTrigger: boolean;
	/** Require explicit manual release before resuming automation */
	requireManualRelease: boolean;
	/** Path to rollback completion marker artifact */
	completionMarkerPath: string;
	/** Mode state: 'manual' or 'autonomous' */
	mode: "manual" | "autonomous";
}

/**
 * Pilot authorization policy for least-privilege enforcement.
 * Controls what operations are permitted based on token scope and targets.
 */
export interface PilotAuthzPolicy {
	/** Allowed GitHub App or fine-grained PAT scopes */
	githubScopeAllowlist: string[];
	/** Allowed repository patterns (glob patterns) */
	repoAllowlist: string[];
	/** Allowed branch patterns (glob patterns) */
	branchAllowlist: string[];
	/** Branches that are always write-protected (cannot be overridden) */
	protectedBranchDenylist: string[];
	/** Whether to enforce branch protection checks */
	enforceBranchProtection: boolean;
}

// === Default Values ===

export const DEFAULT_REVIEW_POLICY: ReviewPolicy = {
	timeoutSeconds: 600, // 10 minutes
	timeoutAction: "fail",
	requiredChecks: [...REVIEW_POLICY_REQUIRED_CHECKS],
	enforceReviewerIndependence: true,
};

export const DEFAULT_BRANCH_PROTECTION_POLICY: BranchProtectionPolicy = {
	requiredChecks: [...BRANCH_PROTECTION_REQUIRED_CHECKS],
};

export const DEFAULT_EVIDENCE_POLICY: EvidencePolicy = {
	requiredFor: [],
	allowedTypes: ["png", "jpeg"],
	maxFileSizeBytes: 1024 * 1024, // 1MB
};

export const DEFAULT_REMEDIATION_POLICY: RemediationPolicy = {
	providerDefaults: {
		codeql: {
			autoApplyMaxTier: "medium",
			dryRunOnlyByDefault: false,
		},
		greptile: {
			autoApplyMaxTier: "medium",
			dryRunOnlyByDefault: false,
		},
		codex: {
			autoApplyMaxTier: "low",
			dryRunOnlyByDefault: true,
		},
	},
	marker: "[auto-remediate]",
	timeoutMinutes: 10,
	retryLimit: 3,
	requireEvidence: true,
};

export const DEFAULT_LOOP_STAGE_CONTRACTS: LoopStageContracts = {
	"risk-policy-gate": {
		inputs: ["changed_files", "harness.contract.json"],
		outputs: ["risk-policy-gate.result"],
		schema: "loop-stage-contract/v1",
		failPolicy: "fail_closed",
		if: "always()",
		permissions: ["contents:read", "pull-requests:read"],
		timeoutMinutes: 15,
		concurrency: "none",
	},
	"review-gate": {
		inputs: ["risk-policy-gate.result", "head_sha", "harness.contract.json"],
		outputs: ["review-gate.result"],
		schema: "loop-stage-contract/v1",
		failPolicy: "fail_closed",
		if: "always()",
		permissions: ["contents:read", "pull-requests:read"],
		timeoutMinutes: 15,
		concurrency: "none",
	},
	"evidence-verify": {
		inputs: ["review-gate.result", "evidence_files", "harness.contract.json"],
		outputs: ["evidence-verify.result", "browser-evidence-artifacts"],
		schema: "loop-stage-contract/v1",
		failPolicy: "fail_closed",
		if: "always()",
		permissions: ["contents:read"],
		timeoutMinutes: 15,
		concurrency: "none",
	},
	"remediation-decision": {
		inputs: [
			"evidence-verify.result",
			"findings.json",
			"harness.contract.json",
		],
		outputs: ["remediation-decision.result", "remediation-decision-artifacts"],
		schema: "loop-stage-contract/v1",
		failPolicy: "fail_closed",
		if: "always()",
		permissions: ["contents:read", "pull-requests:write"],
		timeoutMinutes: 15,
		concurrency: "none",
	},
};

export const DEFAULT_PILOT_GAP_CASE_POLICY: PilotGapCasePolicy = {
	enabled: false,
	defaultSlaHours: 72, // 3 days
	requireClosureEvidence: true,
	storePath: ".harness/gap-cases.v1.json",
};

export const DEFAULT_PILOT_ROLLBACK_POLICY: PilotRollbackPolicy = {
	autoTrigger: true,
	requireManualRelease: true,
	completionMarkerPath: ".harness/rollback-marker.json",
	mode: "manual", // Start in manual mode for safety
};

export const DEFAULT_PILOT_AUTHZ_POLICY: PilotAuthzPolicy = {
	githubScopeAllowlist: [
		"pull_requests:write",
		"contents:read",
		"issues:write",
	],
	repoAllowlist: [], // Empty = deny all repos by default
	branchAllowlist: [], // Empty = deny all branches by default
	protectedBranchDenylist: ["main", "master", "release/*"],
	enforceBranchProtection: true,
};

// === Contract Interface ===

export interface HarnessContract {
	version: string;
	riskTierRules: Record<string, RiskTier>;
	mergePolicy?: MergePolicy | undefined;
	docsDriftRules?: DocsDriftRules | undefined;
	diffBudget?: DiffBudget | undefined;
	uiLoopPolicy?: UILoopPolicy | undefined;
	runtimePolicy?: RuntimePolicy | undefined;
	memoryPolicy?: MemoryPolicy | undefined;
	memoryMaintenancePolicy?: MemoryMaintenancePolicy | undefined;
	memoryEvalPolicy?: MemoryEvalPolicy | undefined;
	observabilityPolicy?: ObservabilityPolicy | undefined;
	packageManagerPolicy?: PackageManagerPolicy | undefined;
	gapCasePolicy?: GapCasePolicy | undefined;
	reviewPolicy?: ReviewPolicy | undefined;
	/** Evidence policy for requiring verification artifacts */
	evidencePolicy?: EvidencePolicy | undefined;
	/** Pilot gap-case tracking policy */
	pilotGapCasePolicy?: PilotGapCasePolicy | undefined;
	/** Pilot rollback behavior policy */
	pilotRollbackPolicy?: PilotRollbackPolicy | undefined;
	/** Pilot authorization policy for least-privilege */
	pilotAuthzPolicy?: PilotAuthzPolicy | undefined;
	/** Blast-radius resolver rules */
	blastRadiusRules?: BlastRadiusRule[] | undefined;
	/** Blast-radius merge behavior */
	blastRadiusRulesMode?: BlastRadiusRulesMode | undefined;
	/** Branch protection configuration */
	branchProtection?: BranchProtectionPolicy | undefined;
	/** Remediation policy for automatic fix application */
	remediationPolicy?: RemediationPolicy | undefined;
	/** Semantic loop stage contract for workflow parity validation */
	loopStageContracts?: LoopStageContracts | undefined;
}

export const DEFAULT_CONTRACT: HarnessContract = {
	version: "1.0",
	riskTierRules: {},
	reviewPolicy: DEFAULT_REVIEW_POLICY,
	evidencePolicy: DEFAULT_EVIDENCE_POLICY,
	pilotGapCasePolicy: DEFAULT_PILOT_GAP_CASE_POLICY,
	pilotRollbackPolicy: DEFAULT_PILOT_ROLLBACK_POLICY,
	pilotAuthzPolicy: DEFAULT_PILOT_AUTHZ_POLICY,
	branchProtection: DEFAULT_BRANCH_PROTECTION_POLICY,
	remediationPolicy: DEFAULT_REMEDIATION_POLICY,
	loopStageContracts: DEFAULT_LOOP_STAGE_CONTRACTS,
};

// === Preset Inheritance Types ===

/**
 * Branded type for HTTP/HTTPS URLs to prevent confusion with local paths.
 */
export type HttpsUrl = string & { readonly __brand: "HttpsUrl" };

/**
 * Branded type for local file paths to prevent confusion with URLs.
 */
export type LocalPath = string & { readonly __brand: "LocalPath" };

/**
 * Reference to a preset source - either a bundled preset name, local path, or remote URL.
 */
export type PresetSource = string;

/**
 * Configuration for a single preset reference.
 */
export interface PresetReference {
	/** Preset source: bundled name, local path, or remote URL */
	source: PresetSource;
	/** Merge strategy for array fields */
	arrays?: "replace" | "append" | "prepend";
	/** SRI integrity hash for remote presets (sha256-...) */
	integrity?: string;
}

/**
 * Contract with preset inheritance support.
 * Extends the base contract with an 'extends' field for preset references.
 */
export interface HarnessContractWithPreset extends HarnessContract {
	/** Preset(s) to extend - single reference, array, or string shorthand */
	extends?: PresetReference | PresetReference[] | PresetSource | PresetSource[];
}

/**
 * Result of contract merge operation with audit trail.
 */
export interface MergeResult {
	/** The merged contract */
	contract: HarnessContract;
	/** Sources that were resolved during merge (for audit trail) */
	sources: string[];
}

/**
 * Options for contract merge operation.
 */
export interface MergeOptions {
	/** Strategy for merging arrays */
	arrayMergeStrategy: "replace" | "concat";
	/** Maximum recursion depth */
	maxDepth: number;
}

/**
 * Default merge options.
 */
export const DEFAULT_MERGE_OPTIONS: MergeOptions = {
	arrayMergeStrategy: "replace",
	maxDepth: 20,
};

/**
 * Maximum inheritance chain depth to prevent circular references.
 */
export const MAX_INHERITANCE_DEPTH = 10;
