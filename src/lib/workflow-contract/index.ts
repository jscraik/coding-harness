/**
 * Workflow Contract module
 *
 * Symphony-aligned workflow contract validation per
 * `docs/specs/workflow-contract-v1.md`.
 *
 * Public surface:
 * - `checkWorkflowContract()` — validate a workflow contract
 * - `loadRegistry()` / `validateRegistry()` — artifact registry
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
export { REQUIRED_ERROR_CODES, REQUIRED_LOG_FIELDS, TERMINAL_STATES } from "./types.js";

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

