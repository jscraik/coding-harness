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

// === Docs Gate Policy Types ===

export type DocsGateMode = "advisory" | "required";

export type DocsImpactCategory =
	| "cli_surface"
	| "contract_policy"
	| "ci_workflow"
	| "branch_protection_or_required_checks"
	| "init_scaffolding"
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
			requiredFor: ["ci_workflow"],
		},
		{
			path: "docs/agents/07b-agent-governance.md",
			surfaceType: "governance_doc",
			owner: "contract",
			requiredFor: ["agent_governance"],
		},
		{
			path: "docs/agents/12-greptile-ai-governance.md",
			surfaceType: "governance_doc",
			owner: "contract",
			requiredFor: ["agent_governance"],
		},
		{
			path: "docs/agents/13-linear-production-workflow.md",
			surfaceType: "governance_doc",
			owner: "contract",
			requiredFor: ["ci_workflow"],
		},
	],
	localHookEnabled: false,
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
	/** Issue tracking enforcement policy */
	issueTrackingPolicy?: IssueTrackingPolicy | undefined;
	/** Remediation policy for automatic fix application */
	remediationPolicy?: RemediationPolicy | undefined;
	/** Semantic loop stage contract for workflow parity validation */
	loopStageContracts?: LoopStageContracts | undefined;
	/** Docs gate policy for governance documentation parity enforcement */
	docsGatePolicy?: DocsGatePolicy | undefined;
}

export const DEFAULT_CONTRACT: HarnessContract = {
	version: "1.3.0",
	riskTierRules: {},
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
