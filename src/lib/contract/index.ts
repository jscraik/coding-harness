/**
 * Workflow-Contract Subsystem — Public API (JSC-108)
 *
 * This barrel export defines the public surface of the workflow-contract
 * subsystem. Import from `@/lib/contract` rather than reaching into
 * individual modules.
 *
 * Architectural layers (separated by concern):
 *
 * 1. **Types** — Domain model and contract schema (types.ts)
 * 2. **Parsing & Loading** — JSON parsing with safety guards (loader.ts)
 * 3. **Validation** — Schema and semantic validation (validator.ts, policy-validators.ts)
 * 4. **Inheritance & Merge** — Preset resolution and contract merging (merger.ts, preset-resolver.ts, contract-presets.ts)
 * 5. **Standards Alignment** — NIST control map (standards-map.ts)
 * 6. **Run Records** — Execution telemetry (run-records.ts, run-record-emitter.ts)
 * 7. **UI Loop** — Developer experience loop commands (ui-loop-command.ts)
 *
 * Safety guarantees:
 * - Path traversal protection on all file reads
 * - JSON depth limiting to prevent stack overflow
 * - SRI integrity verification for remote presets
 * - Circular inheritance detection with depth limits
 * - SSRF protection for remote URLs
 *
 * @module lib/contract
 */

// ─── Types & Defaults ────────────────────────────────────────────────────────

export type {
	RiskTier,
	PolicyAction,
	GateVerdict,
	PolicyChainTierToAction,
	PolicyChainActionToVerdict,
	PolicyChainPolicy,
	TimeoutAction,
	ImageFormat,
	MergePolicyEntry,
	MergePolicyValue,
	DiffBudget,
	MergePolicy,
	DocsDriftRules,
	DocsGateMode,
	DocsImpactCategory,
	DocsSurfaceType,
	DocsSurfaceOwner,
	DocsSurface,
	DocsGateRule,
	DocsGatePolicy,
	UILoopSLO,
	UILoopPolicy,
	RuntimePolicy,
	MemoryPolicy,
	MemoryMaintenancePolicy,
	MemoryEvalPolicy,
	ObservabilityPolicy,
	PackageManagerPolicy,
	GateExtensionHook,
	PreflightPreHook,
	PreflightPostHook,
	PreflightGateExtensionsPolicy,
	GateExtensionsPolicy,
	BlastRadiusRule,
	BlastRadiusRulesMode,
	GapCasePolicy,
	DiffBudgetOverride,
	ReviewPolicy,
	CodeQualitySeverity,
	CodeScanningAlertsThreshold,
	CodeScanningSecurityAlertsThreshold,
	BranchProtectionMergeMethods,
	BranchProtectionCodeQualityPolicy,
	BranchProtectionCodeScanningPolicy,
	BranchProtectionPolicy,
	ToolingActionIcon,
	ToolingMiseTool,
	ToolingCodexAction,
	ToolingCodexEnvironmentPolicy,
	ToolingMakefilePolicy,
	ToolingCapability,
	ToolingPackageDependencyType,
	ToolingCapabilityDetector,
	ToolingPackageRequirement,
	ToolingPackagePolicy,
	ToolingProjectBrainMemoryExtensionPolicy,
	ToolingPolicy,
	IssueTrackingProvider,
	PrReferenceMode,
	IssueTrackingPolicy,
	LoopStageFailPolicy,
	LoopStageName,
	LoopStageContract,
	LoopStageContracts,
	EvidencePolicy,
	RemediationProviderPolicy,
	RemediationPolicy,
	PilotGapCasePolicy,
	PilotRollbackPolicy,
	PilotAuthzPolicy,
	ControlPlaneOverrideScope,
	ControlPlaneNonOverridableControl,
	ControlPlaneOverridePolicy,
	ControlPlanePolicy,
	CIProviderPolicyMode,
	CIProviderMigrationStage,
	CommitMode,
	CIProviderPolicy,
	ContextIntegrityMode,
	ContextCompactStrategy,
	ContextCompactPolicy,
	ContextIntegritySourceKind,
	ContextIntegrityTruthSourceAuthority,
	ContextContradictionCategory,
	ContextIntegrityTruthSource,
	ContextContradictionCatalogEntry,
	ContextHealthTriggerType,
	ContextHealthSamplingPolicy,
	ContextIntegrityPolicy,
	HarnessContract,
	HttpsUrl,
	LocalPath,
	BundledPreset,
	RemotePreset,
	LocalPreset,
	PresetSource,
	PresetSourceKind,
	TaggedPresetSource,
	PresetReference,
	HarnessContractWithPreset,
	MergeResult,
	MergeOptions,
	PreflightPreHookId,
	PreflightPostHookId,
	GateExtensionHookId,
} from "./types.js";

export {
	DEFAULT_REVIEW_POLICY,
	DEFAULT_BRANCH_PROTECTION_POLICY,
	DEFAULT_ISSUE_TRACKING_POLICY,
	DEFAULT_EVIDENCE_POLICY,
	DEFAULT_CONTROL_PLANE_POLICY,
	DEFAULT_CI_PROVIDER_POLICY,
	DEFAULT_CONTEXT_INTEGRITY_POLICY,
	DEFAULT_CONTEXT_COMPACT_POLICY,
	DEFAULT_REMEDIATION_POLICY,
	DEFAULT_LOOP_STAGE_CONTRACTS,
	DEFAULT_PILOT_GAP_CASE_POLICY,
	DEFAULT_PILOT_ROLLBACK_POLICY,
	DEFAULT_PILOT_AUTHZ_POLICY,
	DEFAULT_DOCS_GATE_POLICY,
	DEFAULT_TOOLING_POLICY,
	DEFAULT_POLICY_CHAIN,
	DEFAULT_CONTRACT,
	DEFAULT_MERGE_OPTIONS,
	MAX_INHERITANCE_DEPTH,
	PREFLIGHT_PRE_HOOK_IDS,
	PREFLIGHT_POST_HOOK_IDS,
	isRemotePreset,
	isBundledPreset,
	isLocalPreset,
	getPresetSourceKind,
	tagPresetSource,
	asBundledPreset,
	asRemotePreset,
	asLocalPreset,
} from "./types.js";

// ─── Parsing & Loading ──────────────────────────────────────────────────────

export {
	type ContractLoadError as ContractLoadErrorType,
	loadContract,
	clearContractCache,
	ContractLoadError,
} from "./loader.js";

// ─── Validation ──────────────────────────────────────────────────────────────

export {
	ValidationErrorCode,
	validateContract,
	type ValidationResult,
} from "./validator.js";

// ─── Inheritance & Merge ─────────────────────────────────────────────────────

export {
	mergeContracts,
	mergeContractChain,
	contractsEqual,
	isDangerousKey,
	validateNoDangerousKeys,
} from "./merger.js";

export {
	PresetResolver,
	listBundledPresets,
	getBundledPreset,
	resolvePreset,
	loadContractWithInheritance,
	clearPresetCache,
} from "./preset-resolver.js";

// ─── Errors ──────────────────────────────────────────────────────────────────

export type {
	PresetErrorCode,
	UrlValidationErrorCode,
	PresetError,
} from "./errors.js";

export {
	PresetFetchError,
	CircularInheritanceError,
	IntegrityError,
	UrlValidationError,
	MergeError,
	MaxDepthExceededError,
	isPresetError,
	isMissingContractError,
} from "./errors.js";

// ─── Standards Alignment ─────────────────────────────────────────────────────

export type {
	StandardsFramework,
	ControlDomain,
	StandardsControl,
	StandardsReference,
	ControlMapReport,
} from "./standards-map.js";

export {
	getAllControls,
	getControlsByDomain,
	getControlsByFramework,
	getNonOverridableControls,
	generateControlMapReport,
	getControlById,
} from "./standards-map.js";

// ─── Run Records ─────────────────────────────────────────────────────────────

export {
	type RunOutcome,
	type ExitClassification,
	type RunEventType,
	type RunEventStatus,
	type RunEventSeverity,
	type AgentRunArtifactRef,
	type AgentRunManifest,
	type AgentRunEvent,
	type CanonicalRunRecordPaths,
	type LoadedRunRecordBundle,
	RunRecordError,
	computeEventHash,
	validateAgentRunManifest,
	validateAgentRunEvent,
	resolveRunRecordPaths,
} from "./run-records.js";

// ─── UI Loop ─────────────────────────────────────────────────────────────────

export {
	type UILoopCommandSpec,
	type UILoopCommandValidationResult,
	parseUILoopCommandSpec,
	isValidUILoopCommandSpec,
} from "./ui-loop-command.js";
