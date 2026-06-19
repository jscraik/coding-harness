import type {
	ContextContradictionCategory,
	DocsImpactCategory,
} from "../lib/contract/types.js";
import { DEFAULT_DOCS_GATE_POLICY } from "../lib/contract/types.js";

/** Docs Gate Mode. */
export type DocsGateMode = "advisory" | "required";
/** Docs Gate Trigger. */
export type DocsGateTrigger =
	| "local"
	| "pull_request"
	| "merge_group"
	| "manual_ci";
/** Docs Gate Status. */
export type DocsGateStatus = "success" | "partial" | "blocked";
/** Docs Gate Outcome. */
export type DocsGateOutcome =
	| "ok"
	| "drift_detected"
	| "bootstrap_gap"
	| "trust_mismatch"
	| "policy_error"
	| "runtime_error";
/** Docs Gate Error Class. */
export type DocsGateErrorClass =
	| "none"
	| "io"
	| "schema"
	| "runtime"
	| "trust_loading";
/** Docs Rule Result. */
export type DocsRuleResult = "pass" | "fail" | "not_applicable" | "error";
/** Docs Severity. */
export type DocsSeverity = "info" | "warning" | "error";

/** Docs Gate Options. */
export interface DocsGateOptions {
	mode?: DocsGateMode;
	trigger?: DocsGateTrigger;
	json?: boolean;
	outPath?: string;
	changedFiles?: string[];
	deletedFiles?: string[];
	repoRoot?: string;
	trustedBaseRef?: string;
	trustedContractSha?: string;
	trustedWorkflowSha?: string;
	mergeQueueTargetRef?: string;
	mergeQueueBaseSha?: string;
}

/** Docs Finding. */
export interface DocsFinding {
	rule_id: string;
	category: DocsImpactCategory | ContextContradictionCategory | "system";
	surface: string;
	rule_result: DocsRuleResult;
	result: "pass" | "fail" | "not_applicable" | "error";
	severity: DocsSeverity;
	message: string;
	path?: string;
	details?: string;
	source_of_truth_ref?: string;
}

/** Docs Gate Execution Context. */
export interface DocsGateExecutionContext {
	trigger: DocsGateTrigger;
	policyMode: DocsGateMode;
	mergeAuthoritative: boolean;
	trustedBaseAvailable: boolean;
	trustedBaseRef: string | undefined;
	trustedContractSha: string | undefined;
	trustedWorkflowSha: string | undefined;
	evaluatedSha: string | undefined;
	mergeQueueTargetRef: string | undefined;
	mergeQueueBaseSha: string | undefined;
	bootstrapState: "fully_wired" | "shadow_only" | "missing_wiring";
	changedFilesSource: "explicit_flag" | "git_diff" | "full_repo_fallback";
	outputRoot: string;
}

/** Docs Gate Report. */
export interface DocsGateReport {
	schemaVersion: "1.0.0";
	command: "docs-gate";
	mode: DocsGateMode;
	status: DocsGateStatus;
	outcome: DocsGateOutcome;
	error_class: DocsGateErrorClass;
	generated_at: string;
	repo_root: string;
	base_ref: string | undefined;
	execution_context: DocsGateExecutionContext;
	changed_files: string[];
	categories: DocsImpactCategory[];
	summary: {
		finding_count: number;
		error_count: number;
		warning_count: number;
		required_surface_count: number;
		missing_surface_count: number;
		contradiction_count: number;
		bootstrap_gap_count: number;
		unknown_category_count: number;
		archive_candidate_count?: number;
		archive_repair_finding_count?: number;
		archive_protected_file_count?: number;
		archive_ignored_file_count?: number;
	};
	findings: DocsFinding[];
}

/** Docs Gate Result. */
export interface DocsGateResult {
	report: DocsGateReport;
	exitCode: number;
}

/** Changed-file discovery result used to scope docs-gate validation. */
export interface ChangedFilesResolution {
	changedFiles: string[];
	deletedFiles: string[];
	source: DocsGateExecutionContext["changedFilesSource"];
	error?: string;
}

/** Docs finding enriched with contradiction tracking metadata. */
export interface ContradictionFinding extends DocsFinding {
	finding_id: string;
	source_paths: string[];
}

/** Persisted contradiction-history record for open and resolved findings. */
export interface ContradictionRecord {
	findingId: string;
	category: ContextContradictionCategory;
	status: "open" | "resolved";
	message: string;
	sourcePaths: string[];
	detectedAt: string;
	resolvedAt?: string;
}

export const DEFAULT_OUT_PATH =
	"artifacts/consistency-gate/docs-gate-report.json";
export const CONTRACT_PATH = "harness.contract.json";
export const PACKAGE_JSON_PATH = "package.json";
export const WORKFLOW_PATH = ".github/workflows/pr-pipeline.yml";
export const CONTRADICTION_HISTORY_PATH =
	"artifacts/context-integrity/contradiction-history.jsonl";
export const INSTRUCTION_PRECEDENCE_SOURCE_PATHS = [
	"AGENTS.md",
	"README.md",
	"CONTRIBUTING.md",
] as const;
export const WORKFLOW_POLICY_ADDITIONAL_SOURCE_PATHS = [
	"docs/agents/17-ci-required-checks.md",
] as const;
export const WORKFLOW_AUTHORITY_DOC_PATHS = Array.from(
	new Set(
		(DEFAULT_DOCS_GATE_POLICY.surfaces ?? [])
			.filter((surface) => surface.requiredFor.includes("workflow_authority"))
			.map((surface) => surface.path)
			.filter((path) => path.endsWith(".md")),
	),
);
export const WORKFLOW_POLICY_SOURCE_PATHS: readonly string[] = Array.from(
	new Set([
		...INSTRUCTION_PRECEDENCE_SOURCE_PATHS,
		...WORKFLOW_AUTHORITY_DOC_PATHS,
		...WORKFLOW_POLICY_ADDITIONAL_SOURCE_PATHS,
	]),
);
export const DEEP_MODULE_README_SOURCE_PATTERN =
	/^src\/lib\/([^/]+)\/(?!README\.md$).+\.(?:cjs|cts|js|json|md|mjs|mts|ts|tsx|yml|yaml)$/;
