/** Severity emitted by Project Brain lint findings. */
export type BrainLintSeverity = "error" | "warning" | "info";

/** Aggregate Project Brain lint status. */
export type BrainLintStatus = "pass" | "warn" | "fail";

/** Machine-readable category for a Project Brain lint finding. */
export type BrainLintFindingKind =
	| "missing_frontmatter"
	| "missing_source"
	| "malformed_source"
	| "unsupported_assertion"
	| "missing_sensitivity"
	| "stale_reviewed_date"
	| "broken_wikilink"
	| "duplicate_alias"
	| "orphan_page"
	| "missing_mutation_log"
	| "attachment_outside_approved_path";

/** Single Project Brain lint finding with enough evidence for agents. */
export interface BrainLintFinding {
	severity: BrainLintSeverity;
	kind: BrainLintFindingKind;
	path: string;
	line?: number | undefined;
	evidence: string;
	owner: "project-brain";
}

/** Project Brain lint result schema used by CLI and automation. */
export interface BrainLintResult {
	schema_version: "project-brain-lint/v1";
	status: BrainLintStatus;
	harnessDir: string;
	findings: BrainLintFinding[];
	summary: {
		errors: number;
		warnings: number;
		info: number;
		filesScanned: number;
	};
}
