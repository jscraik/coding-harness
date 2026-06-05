export const DOCS_TASK_EVAL_REPORT_SCHEMA = "docs-task-eval-report/v1" as const;

export const DOCS_TASK_EVAL_CATEGORIES = [
	"review-state-truth",
	"research-vs-canon",
	"generated-context-boundary",
	"downstream-distribution",
	"pr-closeout-lifecycle-impact",
	"progressive-disclosure-safety",
] as const;

/** Supported reader-task fixture categories for the first advisory eval lane. */
export type DocsTaskEvalCategory = (typeof DOCS_TASK_EVAL_CATEGORIES)[number];

/** Enforcement level for a fixture or finding. */
export type DocsTaskEvalSeverity = "advisory" | "required";

/** Top-level and per-fixture pass/fail state. */
export type DocsTaskEvalStatus = "pass" | "fail";

/** Advisory-only status that can warn without failing required validation. */
export type DocsTaskEvalAdvisoryStatus = "pass" | "warn" | "not_applicable";

/** Finding class that separates fixture contract defects from repo evidence. */
export type DocsTaskEvalFindingKind =
	| "configuration"
	| "repository-evidence"
	| "category-coverage";

/** Deterministic task fixture used to prove canonical source routing. */
export type DocsTaskEvalFixture = {
	id: string;
	title: string;
	category: DocsTaskEvalCategory;
	prompt: string;
	expected_sources: readonly string[];
	expected_validation: readonly string[];
	expected_stop_condition: string;
	forbidden_claims: readonly string[];
	severity: DocsTaskEvalSeverity;
	acceptance_ids: readonly string[];
	notes?: string;
};

/** Machine-readable reader-task eval finding. */
export type DocsTaskEvalFinding = {
	id: string;
	fixture_id?: string;
	severity: DocsTaskEvalSeverity;
	kind: DocsTaskEvalFindingKind;
	message: string;
	path?: string;
	fix: string;
};

/** Per-fixture result included in docs-task-eval reports. */
export type DocsTaskEvalFixtureResult = {
	id: string;
	title: string;
	category: DocsTaskEvalCategory | "unknown";
	severity: DocsTaskEvalSeverity | "unknown";
	status: DocsTaskEvalStatus;
	acceptance_ids: readonly string[];
	findings: readonly string[];
	evidence_ref: readonly string[];
};

/** Summary counts for docs-task-eval report consumers. */
export type DocsTaskEvalSummary = {
	total: number;
	passed: number;
	failed: number;
	advisory: number;
	required: number;
};

/** Stable JSON report emitted by the docs-task-eval runner and CLI. */
export type DocsTaskEvalReport = {
	schema: typeof DOCS_TASK_EVAL_REPORT_SCHEMA;
	status: DocsTaskEvalStatus;
	advisory_status: DocsTaskEvalAdvisoryStatus;
	fixtures: readonly DocsTaskEvalFixtureResult[];
	findings: readonly DocsTaskEvalFinding[];
	summary: DocsTaskEvalSummary;
	evidence_ref: readonly string[];
};

/** Options for running docs-task-eval against a repository root. */
export type RunDocsTaskEvalOptions = {
	repoRoot: string;
	fixtures?: readonly unknown[];
};
