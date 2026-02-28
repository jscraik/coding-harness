import type { BlastRadiusRule } from "../blast-radius/resolver.js";
import { DEFAULT_BLAST_RADIUS_RULES } from "../blast-radius/resolver.js";

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
}

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
 * Gap-case lifecycle policy configuration.
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
	/** Directory for pilot artifacts including rollback events (default: artifacts/pilot) */
	artifactsDir?: string | undefined;
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
};

export const DEFAULT_EVIDENCE_POLICY: EvidencePolicy = {
	requiredFor: [],
	allowedTypes: ["png", "jpeg"],
	maxFileSizeBytes: 1024 * 1024, // 1MB
};

export const DEFAULT_GAP_CASE_POLICY: GapCasePolicy = {
	requiredEvidenceStatuses: ["passed", "approved"],
	requiredCloseReasons: ["fix", "workaround", "waived"],
	defaultDueDays: 7,
	caseIdPrefix: "gap-",
	caseStore: ".harness/gap-cases.json",
	allowEvidencelessResolve: false,
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
	/** Optional blast-radius overrides by glob pattern */
	blastRadiusRules?: BlastRadiusRule[] | undefined;
	reviewPolicy?: ReviewPolicy | undefined;
	/** Evidence policy for requiring verification artifacts */
	evidencePolicy?: EvidencePolicy | undefined;
	/** Optional merge policy by severity */
	mergePolicy?: MergePolicy | undefined;
	/** Documentation drift rules by path patterns */
	docsDriftRules?: DocsDriftRules | undefined;
	/** Diff budget limits */
	diffBudget?: DiffBudget | undefined;
	/** UI loop command and SLO policy */
	uiLoopPolicy?: UILoopPolicy | undefined;
	/** Runtime requirements */
	runtimePolicy?: RuntimePolicy | undefined;
	/** Memory policy for local-memory behavior */
	memoryPolicy?: MemoryPolicy | undefined;
	/** Memory maintenance policy */
	memoryMaintenancePolicy?: MemoryMaintenancePolicy | undefined;
	/** Memory evaluation policy */
	memoryEvalPolicy?: MemoryEvalPolicy | undefined;
	/** Observability policy */
	observabilityPolicy?: ObservabilityPolicy | undefined;
	/** Package manager policy */
	packageManagerPolicy?: PackageManagerPolicy | undefined;
	/** Remediation policy for automatic fix application */
	remediationPolicy?: RemediationPolicy | undefined;
	/** Gap-case lifecycle policy */
	gapCasePolicy?: GapCasePolicy | undefined;
	/** Pilot gap-case tracking policy */
	pilotGapCasePolicy?: PilotGapCasePolicy | undefined;
	/** Pilot rollback behavior policy */
	pilotRollbackPolicy?: PilotRollbackPolicy | undefined;
	/** Pilot authorization policy for least-privilege */
	pilotAuthzPolicy?: PilotAuthzPolicy | undefined;
}

export const DEFAULT_CONTRACT: HarnessContract = {
	version: "1.2.0",
	riskTierRules: {},
	blastRadiusRules: DEFAULT_BLAST_RADIUS_RULES,
	reviewPolicy: DEFAULT_REVIEW_POLICY,
	evidencePolicy: DEFAULT_EVIDENCE_POLICY,
	mergePolicy: {
		high: ["review-gate", "evidence-verify"],
		medium: ["review-gate"],
		low: [],
	},
	docsDriftRules: {},
	diffBudget: {
		maxFiles: 10,
		maxNetLOC: 400,
		overrideLabel: "diff-budget-override",
	},
	uiLoopPolicy: {
		fastCommand: "pnpm ui:fast",
		verifyCommand: "pnpm ui:verify",
		exploreCommand: "pnpm ui:explore",
		sloTargets: {
			fastLoopSeconds: 30,
			verifyLoopSeconds: 120,
		},
	},
	runtimePolicy: {
		nodeVersion: "20.x",
	},
	memoryPolicy: {
		enabled: true,
		provider: "local",
		sessionIdTemplate: "repo:<name>:task:<id>",
		domain: "default",
		requiredTags: ["repo", "area", "type"],
		maxObservationsPerStep: 3,
		allowedLevels: ["observation", "learning", "pattern"],
		requireStartRead: true,
		requireCloseoutSummary: true,
		forbiddenContentPatterns: [
			"token",
			"api[_-]?key",
			"secret",
			"password",
			"credential",
		],
	},
	memoryMaintenancePolicy: {
		validateSchedule: "weekly",
		reflectSchedule: "weekly",
		questionSlaDays: 7,
		duplicateThreshold: 0.8,
	},
	memoryEvalPolicy: {
		trialsPerTask: 3,
		requiredMetrics: ["pass^k", "tool_errors", "duplicate_rate"],
		passPowKThreshold: 0.8,
	},
	observabilityPolicy: {
		provider: "logs",
		collectorEndpoint: "http://localhost:4318",
	},
	packageManagerPolicy: {
		allowedManagers: ["pnpm", "npm", "yarn"],
		requiredManager: null,
	},
	remediationPolicy: DEFAULT_REMEDIATION_POLICY,
	gapCasePolicy: DEFAULT_GAP_CASE_POLICY,
	pilotGapCasePolicy: DEFAULT_PILOT_GAP_CASE_POLICY,
	pilotRollbackPolicy: DEFAULT_PILOT_ROLLBACK_POLICY,
	pilotAuthzPolicy: DEFAULT_PILOT_AUTHZ_POLICY,
};
