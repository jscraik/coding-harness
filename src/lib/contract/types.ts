export type RiskTier = "high" | "medium" | "low";

export type TimeoutAction = "fail" | "warn";

export type ImageFormat = "png" | "jpeg";

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
	[severity: string]: string[];
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

export type RemediationMode = "run" | "apply";
export type RemediationAutoTier = "high" | "medium" | "low";

export interface RemediationPolicy {
	providerDefaults: {
		codeql: {
			autoApplyMaxTier: RemediationAutoTier;
			dryRunOnlyByDefault: boolean;
		};
		codex: {
			autoApplyMaxTier: RemediationAutoTier;
			dryRunOnlyByDefault: boolean;
		};
	};
	canonicalRerunWorkflow?: string | null;
	marker: string;
	timeoutMinutes: number;
	retryLimit: number;
	requireEvidence: boolean;
}

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
}

/**
 * Evidence policy configuration for requiring evidence files.
 */
export interface EvidencePolicy {
	/** Glob patterns for paths requiring evidence */
	requiredFor: string[];
	/** Allowed image formats for evidence */
	allowedTypes: ImageFormat[];
	/** Maximum file size in bytes (optional, defaults to 1MB) */
	maxFileSizeBytes?: number | undefined;
}

export interface HarnessContract {
	version: string;
	riskTierRules: Record<string, RiskTier>;
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
	/** Remediation policy for deterministic fix/retry workflows */
	remediationPolicy?: RemediationPolicy | undefined;
	/** Gap-case lifecycle policy */
	gapCasePolicy?: GapCasePolicy | undefined;
}

export const DEFAULT_REMEDIATION_POLICY: RemediationPolicy = {
	providerDefaults: {
		codeql: {
			autoApplyMaxTier: "medium",
			dryRunOnlyByDefault: true,
		},
		codex: {
			autoApplyMaxTier: "medium",
			dryRunOnlyByDefault: true,
		},
	},
	canonicalRerunWorkflow: "greptile-rerun.yml",
	marker: "<!-- harness-remediation-rerun -->",
	timeoutMinutes: 20,
	retryLimit: 3,
	requireEvidence: true,
};

export const DEFAULT_GAP_CASE_POLICY: GapCasePolicy = {
	requiredEvidenceStatuses: ["passed", "approved"],
	requiredCloseReasons: ["fix", "workaround", "waived"],
	defaultDueDays: 7,
	caseIdPrefix: "gap-",
	caseStore: ".harness/gap-cases.json",
	allowEvidencelessResolve: false,
};

export const DEFAULT_REVIEW_POLICY: ReviewPolicy = {
	timeoutSeconds: 600, // 10 minutes
	timeoutAction: "fail",
};

export const DEFAULT_EVIDENCE_POLICY: EvidencePolicy = {
	requiredFor: [],
	allowedTypes: ["png", "jpeg"],
	maxFileSizeBytes: 1024 * 1024, // 1MB
};

export const DEFAULT_CONTRACT: HarnessContract = {
	version: "1.2.0",
	riskTierRules: {},
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
};

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
