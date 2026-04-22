import {
	BRANCH_PROTECTION_REQUIRED_CHECKS,
	REVIEW_POLICY_REQUIRED_CHECKS,
} from "../policy/required-checks.js";
import {
	DEFAULT_EXPLICIT_TOOLING_CAPABILITIES,
	PROJECT_MISE_REQUIRED_TOOLS,
	REQUIRED_CODEX_ACTION_PAIRS,
	REQUIRED_CONDITIONAL_PACKAGES,
	REQUIRED_MAKEFILE_TARGETS,
	REQUIRED_PROJECT_BRAIN_MEMORY_EXTENSION_PATHS,
	REQUIRED_TOOLING_BINARIES,
	REQUIRED_TOOLING_DOC_TERMS,
	TOOLING_CAPABILITY_DEPENDENCY_MARKERS,
	TOOLING_CODEX_ENVIRONMENT_PATH,
	TOOLING_MAKEFILE_PATH,
	TOOLING_PACKAGE_JSON_PATH,
	TOOLING_READINESS_SCRIPT_PATH,
} from "../policy/tooling-baseline.js";

export type RiskTier = "high" | "medium" | "low";

export type PolicyAction = "allow" | "block" | "warn";

export type GateVerdict = "pass" | "fail";

export interface PolicyChainTierToAction {
	high: PolicyAction;
	medium: PolicyAction;
	low: PolicyAction;
}

export interface PolicyChainActionToVerdict {
	allow: GateVerdict;
	block: GateVerdict;
	warn: GateVerdict;
}

export interface PolicyChainPolicy {
	tierToAction: PolicyChainTierToAction;
	actionToVerdict: PolicyChainActionToVerdict;
}

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

// === Docs Gate Policy Types ===

export type DocsGateMode = "advisory" | "required";

export type DocsImpactCategory =
	| "cli_surface"
	| "contract_policy"
	| "ci_workflow"
	| "branch_protection_or_required_checks"
	| "init_scaffolding"
	| "tooling_runtime"
	| "architecture_context"
	| "workflow_authority"
	| "adr_artifact"
	| "spec_artifact"
	| "plan_artifact"
	| "brainstorm_artifact"
	| "agent_governance"
	| "doc_only"
	| "unknown_governance_change";

export type DocsSurfaceType =
	| "root_doc"
	| "governance_doc"
	| "generated_template"
	| "workflow_doc";

export type DocsSurfaceOwner =
	| "implementation"
	| "contract"
	| "workflow"
	| "template";

export interface DocsSurface {
	path: string;
	surfaceType: DocsSurfaceType;
	owner: DocsSurfaceOwner;
	requiredFor: DocsImpactCategory[];
}

export interface DocsGateRule {
	ruleId: string;
	when: {
		categories?: DocsImpactCategory[];
		fileGlobs?: string[];
	};
	requireDocs: string[];
	severity: "info" | "warning" | "error";
	allowDocOnly?: boolean;
}

export interface DocsGatePolicy {
	/** Whether docs-gate is enabled for this repository */
	enabled: boolean;
	/** Execution mode: advisory reports findings without blocking, required fails on error findings */
	mode: DocsGateMode;
	/** Rules mapping implementation changes to required documentation updates */
	rules: DocsGateRule[];
	/** Governed documentation surfaces that may be required */
	surfaces?: DocsSurface[];
	/** Whether to enable optional local pre-push hook generation */
	localHookEnabled?: boolean;
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
	/**
	 * Path to the session-log file checked by memory-gate.
	 * Defaults to "FORJAMIE.md" for backward compatibility.
	 * Set this in harness.contract.json to use a project-specific name.
	 */
	sessionLogPath?: string;
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

export const NORTH_STAR_PRIMARY_METRIC = "pr_lead_time" as const;
export const NORTH_STAR_PRIMARY_BOTTLENECK = "review_rework_loop" as const;

export type NorthStarPrimaryMetric = typeof NORTH_STAR_PRIMARY_METRIC;
export type NorthStarPrimaryBottleneck = typeof NORTH_STAR_PRIMARY_BOTTLENECK;

export const NORTH_STAR_DECISION_QUESTION_SPECS = [
	{
		id: "lead_time_path",
		prompt:
			"Does this reduce PR lead time directly, or strengthen the path to lower PR lead time by reducing review or rework cost?",
	},
	{
		id: "manual_glue",
		prompt:
			"Does this remove repeated manual glue work rather than normalizing it?",
	},
	{
		id: "agent_reliability",
		prompt:
			"Does this make acceptable output easier for agents to produce reliably?",
	},
	{
		id: "safety_floor",
		prompt:
			"Does this preserve strict evidence, SHA discipline, and rollback safety?",
	},
] as const;

export type NorthStarDecisionQuestionId =
	(typeof NORTH_STAR_DECISION_QUESTION_SPECS)[number]["id"];

export interface NorthStarDecisionQuestion {
	id: NorthStarDecisionQuestionId;
	prompt: string;
}

export interface NorthStarContract {
	mission: string;
	primaryMetric: NorthStarPrimaryMetric;
	primaryBottleneck: NorthStarPrimaryBottleneck;
	autonomyBoundary: string;
	safetyFloor: string[];
	nonGoals: string[];
	decisionQuestions: NorthStarDecisionQuestion[];
}

export type ProductSurfaceClass = "core" | "adjacent" | "experimental";
export type ProductSurfaceType = "command" | "document" | "policy" | "workflow";

export interface SurfaceRegistration {
	surfaceId: string;
	surfaceType: ProductSurfaceType;
	class: ProductSurfaceClass;
	owner: string;
	northStarContribution: string;
	manualGlueReductionClaim: string;
	reliabilityContribution: string;
	evidenceReference: string;
	reviewCadence?: string;
	ownedPaths: string[];
	lastReviewedAt: string;
}

export interface ProductSurfaceRegistry {
	surfaces: SurfaceRegistration[];
}

export type TrustedReviewerType = "user" | "team" | "service";
export type TrustedReviewerStatus = "active" | "revoked";

export interface TrustedReviewer {
	reviewerId: string;
	reviewerType: TrustedReviewerType;
	signatureRef: string;
	displayName: string;
	status: TrustedReviewerStatus;
}

export interface OverrideReviewerRegistry {
	trustedReviewers: TrustedReviewer[];
}

export const DEFAULT_NORTH_STAR_CONTRACT: NorthStarContract = {
	mission:
		"Coding Harness exists to let humans steer and agents execute safely, with PR lead time as the primary north-star metric.",
	primaryMetric: NORTH_STAR_PRIMARY_METRIC,
	primaryBottleneck: NORTH_STAR_PRIMARY_BOTTLENECK,
	autonomyBoundary:
		"Low and medium-risk autonomy should be automated where evidence is deterministic and rollback is clear; high-risk changes remain human-mediated.",
	safetyFloor: [
		"deterministic evidence over intuition",
		"strict current-head SHA discipline",
		"bounded auto-remediation instead of open-ended write access",
		"explicit rollback paths for higher-risk automation",
		"independent review surfaces that do not collapse back into self-approval",
	],
	nonGoals: [
		"governance surface area as a proxy for progress",
		"feature count without measurable throughput or reliability benefit",
		"manual coordination steps that recur every run or every PR",
		"broad autonomy expansion without evidence that the review or rework loop got cheaper",
	],
	decisionQuestions: NORTH_STAR_DECISION_QUESTION_SPECS.map(
		(question): NorthStarDecisionQuestion => ({
			id: question.id,
			prompt: question.prompt,
		}),
	),
};

export const DEFAULT_PRODUCT_SURFACE_REGISTRY: ProductSurfaceRegistry = {
	surfaces: [],
};

export const DEFAULT_OVERRIDE_REVIEWER_REGISTRY: OverrideReviewerRegistry = {
	trustedReviewers: [
		{
			reviewerId: "jamie-craik",
			reviewerType: "user",
			signatureRef: "refs/reviewers/jamie-craik",
			displayName: "Jamie Craik",
			status: "active",
		},
	],
};

export const PREFLIGHT_PRE_HOOK_IDS = [
	"skip-all-checks",
	"force-fail",
] as const;
export const PREFLIGHT_POST_HOOK_IDS = ["fail-on-warnings"] as const;

export type PreflightPreHookId = (typeof PREFLIGHT_PRE_HOOK_IDS)[number];
export type PreflightPostHookId = (typeof PREFLIGHT_POST_HOOK_IDS)[number];
export type GateExtensionHookId = PreflightPreHookId | PreflightPostHookId;

export interface GateExtensionHook<HookId extends GateExtensionHookId> {
	id: HookId;
	enabled?: boolean | undefined;
}

export type PreflightPreHook = GateExtensionHook<PreflightPreHookId>;
export type PreflightPostHook = GateExtensionHook<PreflightPostHookId>;

export interface PreflightGateExtensionsPolicy {
	pre?: PreflightPreHook[] | undefined;
	post?: PreflightPostHook[] | undefined;
}

export interface GateExtensionsPolicy {
	preflightGate?: PreflightGateExtensionsPolicy | undefined;
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
	/**
	 * Required merge-readiness checks.
	 * In provider fan-in modes (for example CircleCI `pr-pipeline`), multiple
	 * logical check names may resolve to one workflow-level GitHub check context
	 * via `.harness/ci-required-checks.json`.
	 */
	requiredChecks?: string[] | undefined;
	enforceReviewerIndependence?: boolean | undefined;
}

export type CodeQualitySeverity =
	| "errors"
	| "warnings_and_higher"
	| "notes_and_higher"
	| "all";

export type CodeScanningAlertsThreshold =
	| "errors"
	| "errors_and_warnings"
	| "all";

export type CodeScanningSecurityAlertsThreshold =
	| "high_or_higher"
	| "medium_or_higher"
	| "all";

export interface BranchProtectionMergeMethods {
	mergeCommit: boolean;
	squash: boolean;
	rebase: boolean;
}

export interface BranchProtectionCodeQualityPolicy {
	required: boolean;
	severity: CodeQualitySeverity;
}

export interface BranchProtectionCodeScanningPolicy {
	required: boolean;
	publicOnly: boolean;
	tool: string;
	alertsThreshold: CodeScanningAlertsThreshold;
	securityAlertsThreshold: CodeScanningSecurityAlertsThreshold;
}

export interface BranchProtectionPolicy {
	requiredChecks?: string[] | undefined;
	restrictDeletions?: boolean | undefined;
	blockForcePushes?: boolean | undefined;
	requireLinearHistory?: boolean | undefined;
	requirePullRequest?: boolean | undefined;
	requiredApprovingReviewCount?: number | undefined;
	dismissStaleReviewsOnPush?: boolean | undefined;
	requireConversationResolution?: boolean | undefined;
	requireCodeOwnerReview?: boolean | undefined;
	requireLastPushApproval?: boolean | undefined;
	requireBranchesUpToDate?: boolean | undefined;
	allowedMergeMethods?: BranchProtectionMergeMethods | undefined;
	codeQuality?: BranchProtectionCodeQualityPolicy | undefined;
	publicCodeScanning?: BranchProtectionCodeScanningPolicy | undefined;
}

export type ToolingActionIcon = "tool" | "run" | "debug" | "test";

export interface ToolingMiseTool {
	tool: string;
	version: string;
}

export interface ToolingCodexAction {
	name: string;
	icon: ToolingActionIcon;
}

export interface ToolingCodexEnvironmentPolicy {
	path: string;
	requiredActions: ToolingCodexAction[];
}

export interface ToolingMakefilePolicy {
	path: string;
	requiredTargets: string[];
}

export type ToolingCapability = "ui" | "chatgpt_apps_sdk";

export type ToolingPackageDependencyType =
	| "dependencies"
	| "devDependencies"
	| "either";

export interface ToolingCapabilityDetector {
	capability: ToolingCapability;
	dependencyMarkers: string[];
}

export interface ToolingPackageRequirement {
	package: string;
	dependencyType: ToolingPackageDependencyType;
	requiredWhenCapabilities: ToolingCapability[];
}

export interface ToolingPackagePolicy {
	packageJsonPath: string;
	explicitCapabilities?: ToolingCapability[] | undefined;
	capabilityDetectors: ToolingCapabilityDetector[];
	requiredPackages: ToolingPackageRequirement[];
}

export interface ToolingProjectBrainMemoryExtensionPolicy {
	enabled: boolean;
	requiredPaths: string[];
}

export interface ToolingPolicy {
	requiredDocumentationTerms: string[];
	requiredBinaries: string[];
	requiredMiseTools: ToolingMiseTool[];
	miseFilePath: string;
	readinessScriptPath: string;
	codexEnvironment: ToolingCodexEnvironmentPolicy;
	makefile: ToolingMakefilePolicy;
	packagePolicy: ToolingPackagePolicy;
	projectBrainMemoryExtension?:
		| ToolingProjectBrainMemoryExtensionPolicy
		| undefined;
}

export type IssueTrackingProvider = "linear";

export type PrReferenceMode = "refs" | "fixes" | "either";

export interface IssueTrackingPolicy {
	provider: IssueTrackingProvider;
	projectUrl?: string | undefined;
	requirePackageBugsUrl?: boolean | undefined;
	disableGitHubIssues?: boolean | undefined;
	requireBranchIssueKey?: boolean | undefined;
	requirePrIssueKey?: boolean | undefined;
	prReferenceMode?: PrReferenceMode | undefined;
	branchPrefix?: string | undefined;
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

export type ControlPlaneOverrideScope =
	| "advisory_hold"
	| "temporary_unblock"
	| "temporary_promote";

export type ControlPlaneNonOverridableControl =
	| "canonical_runtime_invalid"
	| "governance_trust_mismatch"
	| "missing_required_instruction_surface"
	| "missing_snapshot_integrity_verification";

export interface ControlPlaneOverridePolicy {
	/** Principals allowed to request or approve control-plane overrides */
	authorizedPrincipals: string[];
	/** Override scopes that require dual approval */
	dualApprovalScopes: ControlPlaneOverrideScope[];
	/** Maximum override lifetime in hours */
	maxTtlHours: number;
	/** Controls that cannot be bypassed by any override */
	nonOverridableControls: ControlPlaneNonOverridableControl[];
}

export interface ControlPlanePolicy {
	overridePolicy: ControlPlaneOverridePolicy;
}

export type CIProviderPolicyMode = "shadow" | "primary" | "required";
export type CIProviderMigrationStage =
	| "pre-migration"
	| "dual-provider"
	| "circleci-primary"
	| "circleci-only"
	| "gha-primary"
	| "gha-only"
	| "cutover-complete";

/** Operating model tier for the repository. */
export type CommitMode = "solo" | "team" | "enterprise";

export interface CIProviderPolicy {
	activeProvider: "github-actions" | "circleci";
	mode: CIProviderPolicyMode;
	migrationStage: CIProviderMigrationStage;
	transitionStatusArtifactPath: string;
	authorityConfigPath: string;
	requiredCheckManifestPath: string;
	/** Optional override for the canonical CircleCI workflow-level check context. */
	primaryCheckName?: string | undefined;
	/** Required for team/enterprise mode; omit for solo. */
	trustedPolicyRef?: string | undefined;
	/**
	 * Operating model tier:
	 * - solo: minimal ceremony, no proof packs
	 * - team: branch-protection + PR gates
	 * - enterprise: full proof-pack + merge-queue
	 */
	commitMode?: CommitMode | undefined;
}

export type ContextIntegrityMode = "shadow" | "advisory" | "required";

export type ContextCompactStrategy = "balanced" | "aggressive" | "micro";

export interface ContextCompactPolicy {
	/** Percent of context budget used before compaction tuning is applied (1-100). */
	thresholdPercent: number;
	/** Token cutoff where the policy prefers micro compaction behavior. */
	microCompactThresholdTokens: number;
	/** Strategy profile used by context-related retrieval commands. */
	strategy: ContextCompactStrategy;
}

export type ContextIntegritySourceKind = "file" | "directory";

export type ContextIntegrityTruthSourceAuthority = "canonical" | "governed";

export type ContextContradictionCategory =
	| "command_contract_conflict"
	| "required_check_conflict"
	| "instruction_precedence_conflict"
	| "workflow_policy_conflict"
	| "source_truth_missing";

export interface ContextIntegrityTruthSource {
	path: string;
	kind: ContextIntegritySourceKind;
	authority: ContextIntegrityTruthSourceAuthority;
	required: boolean;
}

export interface ContextContradictionCatalogEntry {
	id: string;
	category: ContextContradictionCategory;
	severity: "warning" | "error";
	description: string;
}

export type ContextHealthTriggerType = "current_checkout" | "recent_artifacts";

export interface ContextHealthSamplingPolicy {
	fixtureSetPath: string;
	fixtureSetId: string;
	allowedTriggerTypes: ContextHealthTriggerType[];
	samplingCadence: string;
	dedupeScope: "query" | "run";
}

export interface ContextIntegrityPolicy {
	mode: ContextIntegrityMode;
	truthSources: ContextIntegrityTruthSource[];
	contradictionCatalog: ContextContradictionCatalogEntry[];
	healthSampling: ContextHealthSamplingPolicy;
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
	restrictDeletions: true,
	blockForcePushes: true,
	requireLinearHistory: true,
	requirePullRequest: true,
	requiredApprovingReviewCount: 0,
	dismissStaleReviewsOnPush: true,
	requireConversationResolution: true,
	requireCodeOwnerReview: false,
	requireLastPushApproval: false,
	requireBranchesUpToDate: true,
	allowedMergeMethods: {
		mergeCommit: true,
		squash: true,
		rebase: true,
	},
	codeQuality: {
		required: true,
		severity: "all",
	},
	publicCodeScanning: {
		required: true,
		publicOnly: true,
		tool: "CodeQL",
		alertsThreshold: "errors",
		securityAlertsThreshold: "high_or_higher",
	},
};

export const DEFAULT_ISSUE_TRACKING_POLICY: IssueTrackingPolicy = {
	provider: "linear",
	requirePackageBugsUrl: true,
	disableGitHubIssues: true,
	requireBranchIssueKey: true,
	requirePrIssueKey: true,
	prReferenceMode: "either",
	branchPrefix: "codex",
};

export const DEFAULT_EVIDENCE_POLICY: EvidencePolicy = {
	requiredFor: [],
	allowedTypes: ["png", "jpeg"],
	maxFileSizeBytes: 1024 * 1024, // 1MB
};

export const DEFAULT_CONTROL_PLANE_POLICY: ControlPlanePolicy = {
	overridePolicy: {
		authorizedPrincipals: [],
		dualApprovalScopes: ["temporary_unblock", "temporary_promote"],
		maxTtlHours: 24,
		nonOverridableControls: [
			"canonical_runtime_invalid",
			"governance_trust_mismatch",
			"missing_required_instruction_surface",
			"missing_snapshot_integrity_verification",
		],
	},
};

export const DEFAULT_CI_PROVIDER_POLICY: CIProviderPolicy = {
	activeProvider: "github-actions",
	mode: "shadow",
	migrationStage: "dual-provider",
	transitionStatusArtifactPath: ".harness/ci-provider-transition-status.json",
	authorityConfigPath: "harness.contract.json",
	requiredCheckManifestPath: ".harness/ci-required-checks.json",
	trustedPolicyRef: "refs/heads/main",
};

export const DEFAULT_CONTEXT_INTEGRITY_POLICY: ContextIntegrityPolicy = {
	mode: "shadow",
	truthSources: [
		{
			path: "README.md",
			kind: "file",
			authority: "canonical",
			required: true,
		},
		{
			path: "AGENTS.md",
			kind: "file",
			authority: "canonical",
			required: true,
		},
		{
			path: "CLAUDE.md",
			kind: "file",
			authority: "canonical",
			required: true,
		},
		{
			path: "CONTRIBUTING.md",
			kind: "file",
			authority: "canonical",
			required: true,
		},
		{
			path: "AI/context/diagram-context.md",
			kind: "file",
			authority: "canonical",
			required: true,
		},
		{
			path: "docs/agents",
			kind: "directory",
			authority: "governed",
			required: true,
		},
		{
			path: "docs/adr",
			kind: "directory",
			authority: "governed",
			required: false,
		},
		{
			path: "docs/specs",
			kind: "directory",
			authority: "governed",
			required: false,
		},
	],
	contradictionCatalog: [
		{
			id: "command-contract-conflict",
			category: "command_contract_conflict",
			severity: "error",
			description:
				"Canonical governance docs disagree with executable package-manager or command contracts.",
		},
		{
			id: "required-check-conflict",
			category: "required_check_conflict",
			severity: "error",
			description:
				"Configured required checks diverge from workflow-enforced required checks.",
		},
		{
			id: "instruction-precedence-conflict",
			category: "instruction_precedence_conflict",
			severity: "warning",
			description:
				"Governance instruction surfaces disagree about authoritative workflow behavior.",
		},
		{
			id: "workflow-policy-conflict",
			category: "workflow_policy_conflict",
			severity: "error",
			description:
				"Workflow or policy surfaces disagree on enforced rollout posture or gate ownership.",
		},
		{
			id: "source-truth-missing",
			category: "source_truth_missing",
			severity: "error",
			description:
				"A configured canonical or governed truth source is missing from the repository.",
		},
	],
	healthSampling: {
		fixtureSetPath: "artifacts/context-integrity/health-sampling-fixtures.json",
		fixtureSetId: "context-integrity-v1",
		allowedTriggerTypes: ["current_checkout", "recent_artifacts"],
		samplingCadence: "per_run",
		dedupeScope: "query",
	},
};

export const DEFAULT_CONTEXT_COMPACT_POLICY: ContextCompactPolicy = {
	thresholdPercent: 85,
	microCompactThresholdTokens: 1200,
	strategy: "balanced",
};

export const DEFAULT_REMEDIATION_POLICY: RemediationPolicy = {
	providerDefaults: {
		codeql: {
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

export const DEFAULT_DOCS_GATE_POLICY: DocsGatePolicy = {
	enabled: true,
	mode: "advisory",
	rules: [
		{
			ruleId: "cli-surface-docs",
			when: { categories: ["cli_surface"] },
			requireDocs: ["README.md"],
			severity: "error",
		},
		{
			ruleId: "contract-policy-docs",
			when: { categories: ["contract_policy"] },
			requireDocs: ["README.md", "AGENTS.md"],
			severity: "error",
		},
		{
			ruleId: "ci-workflow-docs",
			when: { categories: ["ci_workflow"] },
			requireDocs: ["README.md", "CONTRIBUTING.md", "AGENTS.md"],
			severity: "error",
		},
		{
			ruleId: "required-checks-docs",
			when: { categories: ["branch_protection_or_required_checks"] },
			requireDocs: ["README.md", "CONTRIBUTING.md", "AGENTS.md"],
			severity: "error",
		},
		{
			ruleId: "init-scaffold-docs",
			when: { categories: ["init_scaffolding"] },
			requireDocs: ["README.md", "AGENTS.md"],
			severity: "error",
		},
		{
			ruleId: "tooling-runtime-docs",
			when: { categories: ["tooling_runtime"] },
			requireDocs: [
				"docs/agents/02-tooling-policy.md",
				"docs/agents/06-security-and-governance.md",
			],
			severity: "error",
		},
		{
			ruleId: "architecture-context-docs",
			when: { categories: ["architecture_context"] },
			requireDocs: ["docs/agents/00-architecture-bootstrap.md"],
			severity: "error",
		},
		{
			ruleId: "adr-artifact-docs",
			when: { categories: ["adr_artifact"] },
			requireDocs: ["docs/adr/"],
			severity: "error",
		},
		{
			ruleId: "spec-artifact-docs",
			when: { categories: ["spec_artifact"] },
			requireDocs: ["docs/specs/"],
			severity: "error",
		},
		{
			ruleId: "plan-artifact-docs",
			when: { categories: ["plan_artifact"] },
			requireDocs: ["docs/plans/"],
			severity: "error",
		},
		{
			ruleId: "brainstorm-artifact-docs",
			when: { categories: ["brainstorm_artifact"] },
			requireDocs: ["docs/brainstorms/"],
			severity: "error",
		},
		{
			ruleId: "agent-governance-docs",
			when: { categories: ["agent_governance"] },
			requireDocs: ["AGENTS.md", "docs/agents/07b-agent-governance.md"],
			severity: "error",
		},
		{
			ruleId: "unknown-governance-docs",
			when: { categories: ["unknown_governance_change"] },
			requireDocs: [],
			severity: "warning",
		},
	],
	surfaces: [
		{
			path: "README.md",
			surfaceType: "root_doc",
			owner: "implementation",
			requiredFor: [
				"cli_surface",
				"contract_policy",
				"ci_workflow",
				"branch_protection_or_required_checks",
				"init_scaffolding",
			],
		},
		{
			path: "CONTRIBUTING.md",
			surfaceType: "root_doc",
			owner: "contract",
			requiredFor: ["ci_workflow", "branch_protection_or_required_checks"],
		},
		{
			path: "AGENTS.md",
			surfaceType: "governance_doc",
			owner: "contract",
			requiredFor: [
				"contract_policy",
				"ci_workflow",
				"branch_protection_or_required_checks",
				"agent_governance",
			],
		},
		{
			path: "docs/agents/04-validation.md",
			surfaceType: "governance_doc",
			owner: "contract",
			requiredFor: ["ci_workflow", "workflow_authority"],
		},
		{
			path: "docs/agents/07b-agent-governance.md",
			surfaceType: "governance_doc",
			owner: "contract",
			requiredFor: ["agent_governance"],
		},
		{
			path: "docs/agents/01-instruction-map.md",
			surfaceType: "workflow_doc",
			owner: "workflow",
			requiredFor: ["workflow_authority"],
		},
		{
			path: "docs/agents/00-architecture-bootstrap.md",
			surfaceType: "governance_doc",
			owner: "workflow",
			requiredFor: ["architecture_context"],
		},
		{
			path: "docs/adr/",
			surfaceType: "workflow_doc",
			owner: "workflow",
			requiredFor: ["adr_artifact"],
		},
		{
			path: "docs/specs/",
			surfaceType: "workflow_doc",
			owner: "workflow",
			requiredFor: ["spec_artifact"],
		},
		{
			path: "docs/plans/",
			surfaceType: "workflow_doc",
			owner: "workflow",
			requiredFor: ["plan_artifact"],
		},
		{
			path: "docs/brainstorms/",
			surfaceType: "workflow_doc",
			owner: "workflow",
			requiredFor: ["brainstorm_artifact"],
		},
		{
			path: "docs/agents/02-tooling-policy.md",
			surfaceType: "governance_doc",
			owner: "workflow",
			requiredFor: ["tooling_runtime"],
		},
		{
			path: "docs/agents/06-security-and-governance.md",
			surfaceType: "governance_doc",
			owner: "workflow",
			requiredFor: ["tooling_runtime"],
		},
		{
			path: "docs/agents/12-ai-review-governance.md",
			surfaceType: "governance_doc",
			owner: "contract",
			requiredFor: ["agent_governance"],
		},
		{
			path: "docs/agents/13-linear-production-workflow.md",
			surfaceType: "workflow_doc",
			owner: "workflow",
			requiredFor: ["workflow_authority"],
		},
		{
			path: "docs/agents/08-release-and-change-control.md",
			surfaceType: "workflow_doc",
			owner: "workflow",
			requiredFor: ["workflow_authority"],
		},
		{
			path: "docs/agents/10-agent-testing-gates.md",
			surfaceType: "workflow_doc",
			owner: "workflow",
			requiredFor: ["workflow_authority"],
		},
		{
			path: "docs/agents/14-docs-gate-rollout.md",
			surfaceType: "workflow_doc",
			owner: "workflow",
			requiredFor: ["workflow_authority"],
		},
		{
			path: "docs/agents/15-context-integrity-compact.md",
			surfaceType: "workflow_doc",
			owner: "workflow",
			requiredFor: ["workflow_authority"],
		},
		{
			path: "docs/agents/16-linear-production-compact.md",
			surfaceType: "workflow_doc",
			owner: "workflow",
			requiredFor: ["workflow_authority"],
		},
	],
	localHookEnabled: false,
};

export const DEFAULT_TOOLING_POLICY: ToolingPolicy = {
	requiredDocumentationTerms: [...REQUIRED_TOOLING_DOC_TERMS],
	requiredBinaries: [...REQUIRED_TOOLING_BINARIES],
	requiredMiseTools: PROJECT_MISE_REQUIRED_TOOLS.map(([tool, version]) => ({
		tool,
		version,
	})),
	miseFilePath: ".mise.toml",
	readinessScriptPath: TOOLING_READINESS_SCRIPT_PATH,
	codexEnvironment: {
		path: TOOLING_CODEX_ENVIRONMENT_PATH,
		requiredActions: REQUIRED_CODEX_ACTION_PAIRS.map(({ name, icon }) => ({
			name,
			icon,
		})),
	},
	makefile: {
		path: TOOLING_MAKEFILE_PATH,
		requiredTargets: [...REQUIRED_MAKEFILE_TARGETS],
	},
	packagePolicy: {
		packageJsonPath: TOOLING_PACKAGE_JSON_PATH,
		explicitCapabilities: [...DEFAULT_EXPLICIT_TOOLING_CAPABILITIES],
		capabilityDetectors: TOOLING_CAPABILITY_DEPENDENCY_MARKERS.map(
			({ capability, dependencyMarkers }) => ({
				capability,
				dependencyMarkers: [...dependencyMarkers],
			}),
		),
		requiredPackages: REQUIRED_CONDITIONAL_PACKAGES.map(
			({
				package: requiredPackage,
				dependencyType,
				requiredWhenCapabilities,
			}) => ({
				package: requiredPackage,
				dependencyType,
				requiredWhenCapabilities: [...requiredWhenCapabilities],
			}),
		),
	},
	projectBrainMemoryExtension: {
		enabled: true,
		requiredPaths: [...REQUIRED_PROJECT_BRAIN_MEMORY_EXTENSION_PATHS],
	},
};

export const DEFAULT_POLICY_CHAIN: PolicyChainPolicy = {
	tierToAction: {
		high: "warn",
		medium: "warn",
		low: "allow",
	},
	actionToVerdict: {
		allow: "pass",
		block: "fail",
		warn: "pass",
	},
};

// === Contract Interface ===

export interface HarnessContract {
	version: string;
	riskTierRules: Record<string, RiskTier>;
	/** Canonical throughput-oriented mission and decision rubric */
	northStar?: NorthStarContract | undefined;
	/** Governed inventory of product surfaces aligned to north-star outcomes */
	productSurface?: ProductSurfaceRegistry | undefined;
	/** Trusted reviewer identities used for override acknowledgement verification */
	overrideReviewerRegistry?: OverrideReviewerRegistry | undefined;
	policyChain?: PolicyChainPolicy | undefined;
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
	/** Optional gate extension hook configuration */
	gateExtensions?: GateExtensionsPolicy | undefined;
	/** Branch protection configuration */
	branchProtection?: BranchProtectionPolicy | undefined;
	/** Issue tracking enforcement policy */
	issueTrackingPolicy?: IssueTrackingPolicy | undefined;
	/** Remediation policy for automatic fix application */
	remediationPolicy?: RemediationPolicy | undefined;
	/** Semantic loop stage contract for workflow parity validation */
	loopStageContracts?: LoopStageContracts | undefined;
	/** Docs gate policy for governance documentation parity enforcement */
	docsGatePolicy?: DocsGatePolicy | undefined;
	/** Context compaction policy for threshold-driven retrieval tuning */
	contextCompact?: ContextCompactPolicy | undefined;
	/** Context-integrity policy for authoritative retrieval, contradiction checks, and scorecard sampling */
	contextIntegrityPolicy?: ContextIntegrityPolicy | undefined;
	/** Control-plane override authority and non-overridable guardrails */
	controlPlanePolicy?: ControlPlanePolicy | undefined;
	/** Required local tooling surface enforced by scaffold and readiness checks */
	toolingPolicy?: ToolingPolicy | undefined;
	/** CI provider transition policy for required checks and trusted policy refs */
	ciProviderPolicy?: CIProviderPolicy | undefined;
	/** Auto-detected or operator-specified project type. Absence is treated as "unknown" at all read sites. */
	projectType?: "cli" | "desktop" | "library" | "web" | "unknown" | undefined;
}

export const DEFAULT_CONTRACT: HarnessContract = {
	version: "1.6.0",
	northStar: DEFAULT_NORTH_STAR_CONTRACT,
	productSurface: DEFAULT_PRODUCT_SURFACE_REGISTRY,
	overrideReviewerRegistry: DEFAULT_OVERRIDE_REVIEWER_REGISTRY,
	riskTierRules: {},
	policyChain: DEFAULT_POLICY_CHAIN,
	reviewPolicy: DEFAULT_REVIEW_POLICY,
	evidencePolicy: DEFAULT_EVIDENCE_POLICY,
	pilotGapCasePolicy: DEFAULT_PILOT_GAP_CASE_POLICY,
	pilotRollbackPolicy: DEFAULT_PILOT_ROLLBACK_POLICY,
	pilotAuthzPolicy: DEFAULT_PILOT_AUTHZ_POLICY,
	branchProtection: DEFAULT_BRANCH_PROTECTION_POLICY,
	issueTrackingPolicy: DEFAULT_ISSUE_TRACKING_POLICY,
	remediationPolicy: DEFAULT_REMEDIATION_POLICY,
	loopStageContracts: DEFAULT_LOOP_STAGE_CONTRACTS,
	docsGatePolicy: DEFAULT_DOCS_GATE_POLICY,
	contextCompact: DEFAULT_CONTEXT_COMPACT_POLICY,
	contextIntegrityPolicy: DEFAULT_CONTEXT_INTEGRITY_POLICY,
	controlPlanePolicy: DEFAULT_CONTROL_PLANE_POLICY,
	toolingPolicy: DEFAULT_TOOLING_POLICY,
	ciProviderPolicy: DEFAULT_CI_PROVIDER_POLICY,
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
 * Branded type for bundled preset names.
 * Prevents confusion with local paths or remote URLs at compile time.
 */
export type BundledPreset = string & { readonly __brand: "BundledPreset" };

/**
 * Branded type for remote preset URLs.
 * Prevents confusion with bundled names or local paths at compile time.
 */
export type RemotePreset = string & { readonly __brand: "RemotePreset" };

/**
 * Branded type for local preset file paths.
 * Prevents confusion with bundled names or remote URLs at compile time.
 */
export type LocalPreset = string & { readonly __brand: "LocalPreset" };

/**
 * Discriminated union of all preset source types.
 * Use type guards to narrow to specific types.
 */
export type PresetSource = BundledPreset | RemotePreset | LocalPreset;

/**
 * Runtime discriminator for preset source kinds.
 */
export type PresetSourceKind = "bundled" | "remote" | "local";

/**
 * Tagged preset source with runtime kind information.
 */
export interface TaggedPresetSource {
	kind: PresetSourceKind;
	source: PresetSource;
}

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

// ============================================================================
// Preset Source Type Guards
// ============================================================================

const URL_PATTERN = /^https?:\/\//i;
const BUNDLED_PRESET_PATTERN = /^[a-z0-9-]+$/i;

/**
 * Check if a string looks like a remote URL.
 */
function looksLikeRemote(value: string): boolean {
	return URL_PATTERN.test(value);
}

/**
 * Check if a string looks like a bundled preset name.
 */
function looksLikeBundled(value: string): boolean {
	return (
		BUNDLED_PRESET_PATTERN.test(value) &&
		!value.includes("/") &&
		!value.includes("\\") &&
		!value.includes(".")
	);
}

/**
 * Type guard: Check if value is a RemotePreset.
 */
export function isRemotePreset(value: string): value is RemotePreset {
	return looksLikeRemote(value);
}

/**
 * Type guard: Check if value is a BundledPreset.
 */
export function isBundledPreset(value: string): value is BundledPreset {
	return looksLikeBundled(value);
}

/**
 * Type guard: Check if value is a LocalPreset.
 */
export function isLocalPreset(value: string): value is LocalPreset {
	return !looksLikeRemote(value) && !looksLikeBundled(value);
}

/**
 * Determine the kind of preset source.
 */
export function getPresetSourceKind(value: string): PresetSourceKind {
	if (isRemotePreset(value)) return "remote";
	if (isBundledPreset(value)) return "bundled";
	return "local";
}

/**
 * Tag a preset source with its runtime kind.
 */
export function tagPresetSource(source: string): TaggedPresetSource {
	return {
		kind: getPresetSourceKind(source),
		source: source as PresetSource,
	};
}

/**
 * Assert that a string is a BundledPreset.
 * Throws if the value is not a valid bundled preset name.
 */
export function asBundledPreset(value: string): BundledPreset {
	if (!isBundledPreset(value)) {
		throw new Error(
			`Invalid bundled preset name: "${value}". Expected alphanumeric with hyphens only.`,
		);
	}
	return value as BundledPreset;
}

/**
 * Assert that a string is a RemotePreset.
 * Throws if the value is not a valid remote URL.
 */
export function asRemotePreset(value: string): RemotePreset {
	if (!isRemotePreset(value)) {
		throw new Error(
			`Invalid remote preset URL: "${value}". Expected http:// or https:// URL.`,
		);
	}
	return value as RemotePreset;
}

/**
 * Assert that a string is a LocalPreset.
 * Throws if the value looks like a remote URL or bundled preset.
 */
export function asLocalPreset(value: string): LocalPreset {
	if (isRemotePreset(value)) {
		throw new Error(
			`Invalid local preset path: "${value}" looks like a remote URL.`,
		);
	}
	if (isBundledPreset(value)) {
		throw new Error(
			`Invalid local preset path: "${value}" looks like a bundled preset name.`,
		);
	}
	return value as LocalPreset;
}
