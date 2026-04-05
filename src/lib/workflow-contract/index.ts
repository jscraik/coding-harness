/**
 * Workflow Contract module
 *
 * Symphony-aligned workflow contract validation per
 * `docs/specs/workflow-contract-v1.md`.
 *
 * Public surface:
 * - `checkWorkflowContract()` — validate a workflow contract
 * - `parseWorkflowFile()` — parse markdown workflow files
 * - `loadRegistry()` / `validateRegistry()` — artifact registry
 * - `checkCICompatibility()` — CI provider policy adapter (Slice 2)
 * - `createStateNormalizer()` — state normalization (Slice 3)
 * - `createGateBundle()` — gate bundle consolidation (Slice 4)
 * - `generateScorecard()` — operator feedback dashboard (Slice 4a)
 * - `createGitFixture()` — git fixture utilities (Slice 5)
 * - `assertGatePasses()` / `assertGateFails()` — compact validation (Slice 5)
 * - `validateModuleTestManifest()` — module test manifest (Slice 5)
 * - `createPilotLane()` — scale-out pilot lane management (Slice 6)
 * - `evaluateWindow()` — 14-day window gate evaluation (Slice 6)
 * - `computeTransitionDecision()` — expand/hold/freeze/demote logic (Slice 6)
 * - Types: WorkflowContract, CheckResult, CheckFinding, etc.
 */

export { checkWorkflowContract } from "./checker.js";
export type {
	ChangeClass,
	CheckFinding,
	CheckResult,
	CheckSeverity,
	DryRunSemantics,
	ExecutionMode,
	LogField,
	TestMode,
	TestTier,
	TransitionRow,
	ValidationContract,
	WorkflowContract,
	WorkflowMetadata,
} from "./types.js";
export {
	REQUIRED_ERROR_CODES,
	REQUIRED_LOG_FIELDS,
	TERMINAL_STATES,
} from "./types.js";

// ─── Registry ───────────────────────────────────────────────────────────────────

export {
	loadRegistry,
	validateRegistry,
	validateRegistryPaths,
	REGISTRY_PATH,
} from "./registry.js";
export type {
	ArtifactStatus,
	DeprecationPolicy,
	RegistryFinding,
	RegistryValidationResult,
	WorkflowArtifactEntry,
	WorkflowArtifactRegistry,
} from "./registry.js";

// ─── Parser ─────────────────────────────────────────────────────────────────────

export { parseWorkflowFile, parseFrontmatter } from "./parser.js";
export type { ParseResult, ParseError } from "./parser.js";

// ─── CI Provider Policy Adapter (Slice 2) ───────────────────────────────────────

export {
	checkCICompatibility,
	validateWorkflowCIPolicy,
	DEFAULT_WORKFLOW_CI_POLICY,
} from "./ci-adapter.js";
export type {
	ActiveCIPolicy,
	CIAdapterFinding,
	CIAdapterResult,
	CIProvider,
	FailureBehavior,
	MigrationStage,
	WorkflowCIPolicy,
} from "./ci-adapter.js";

// ─── State Normalization (Slice 3) ──────────────────────────────────────────────

export {
	createStateNormalizer,
	validateAliasMap,
	validateTransitionsUseCanonical,
	LINEAR_STATUS_ALIASES,
	GITHUB_STATUS_ALIASES,
	ALL_CANONICAL_STATES,
	CANONICAL_TERMINAL_STATES,
	CANONICAL_NON_TERMINAL_STATES,
} from "./state-normalizer.js";
export type {
	AliasValidationFinding,
	AliasValidationResult,
	CanonicalState,
	StateNormalizer,
	StatusAlias,
	StatusAliasMap,
	TrackerProvider,
} from "./state-normalizer.js";

// ─── Gate Bundle Consolidation (Slice 4) ────────────────────────────────────────

export {
	createGateBundle,
	createGateBundleFromResults,
	validateGateBundle,
	isBundleReplaySafe,
} from "./gate-bundle.js";
export type {
	BundleDecision,
	BundleSummary,
	GateBundleConfig,
	GateBundleEnvelope,
	GateBundleInput,
	GateCategory,
	GateEntry,
	GateFinding,
	GateFindingSeverity,
	GateInput,
	GateStatus,
} from "./gate-bundle.js";

// ─── Operator Feedback Dashboard (Slice 4a) ─────────────────────────────────────

export {
	generateScorecard,
	validateScorecard,
} from "./operator-scorecard.js";
export type {
	ConfidenceLevel,
	ConfidenceRubric,
	GateStatusRow,
	OperatorScorecard,
	RecommendedAction,
	RemediationSuggestion,
	ScorecardInput,
	TestSummary,
} from "./operator-scorecard.js";

// ─── Agent-Native Test Harness (Slice 5) ─────────────────────────────────────

export {
	createGitFixture,
	sanitizeGitEnv,
	assertGatePasses,
	assertGateFails,
	runGateAssertions,
	validateModuleTestManifest,
	createRedEvidence,
	createGreenEvidence,
	validateTDDEvidencePair,
	WORKFLOW_CONTRACT_MANIFESTS,
} from "./test-harness.js";
export type {
	EvidenceFormat,
	GateAssertionResult,
	GitFixture,
	GitFixtureOptions,
	ManifestFinding,
	ModuleTestManifest,
	TDDEvidence,
} from "./test-harness.js";

// ─── Scale-out Pilot Tracker (Slice 6) ──────────────────────────────────────────

export {
	createPilotLane,
	recordRunOutcome,
	recordScorecardOutcome,
	getRunsInWindow,
	computeWindowMetrics,
	evaluateWindow,
	recordWindowEvaluation,
	computeTransitionDecision,
	freezeLane,
	unfreezeLane,
	validatePilotLane,
	DEFAULT_METRIC_THRESHOLDS,
	DEFAULT_GATE_THRESHOLDS,
} from "./pilot-tracker.js";
export type {
	GateEvaluation,
	MetricThreshold,
	OperatorMetricId,
	PilotGateId,
	PilotLane,
	PilotLaneConfig,
	RunOutcome,
	SupplementalGateActuals,
	SupplementalPilotGateId,
	TransitionDecision,
	TransitionResult,
	WindowEvaluation,
} from "./pilot-tracker.js";
