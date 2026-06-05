/** Stable schema identifier for advisory stale-document archive reports. */
export const DOCS_ARCHIVE_CANDIDATES_REPORT_SCHEMA =
	"docs-archive-candidates-report/v1" as const;

/** Stable schema identifier for CLI usage errors. */
export const DOCS_ARCHIVE_CANDIDATES_ERROR_SCHEMA =
	"docs-archive-candidates-error/v1" as const;

/** Docs-gate rule used for advisory archive-candidate projection. */
export const DOCS_ARCHIVE_CANDIDATES_RULE_ID =
	"docs.archive_candidates.advisory" as const;

/** Unsupported mutation-shaped options that must fail closed. */
export const DESTRUCTIVE_ARCHIVE_CANDIDATE_OPTIONS = [
	"--archive",
	"--delete",
	"--move",
	"--demote",
	"--rewrite-metadata",
	"--update-manifest",
	"--update-active-artifacts",
	"--repair-index",
	"--apply",
	"--fix",
	"--write",
	"--rm",
	"-a",
	"-d",
	"-m",
	"-w",
	"-f",
	"-r",
] as const;

/** Reason a document was reported as an archive candidate. */
export type ArchiveCandidateReason =
	| "superseded_status"
	| "archived_status_still_active"
	| "stale_execution_input"
	| "unreferenced_supporting_document"
	| "expired_remove_after"
	| "raw_research_without_promotion";

/** Reason a document was protected from archive candidacy. */
export type ArchiveProtectionReason =
	| "canonical_source"
	| "active_lifecycle_state"
	| "execution_input"
	| "recently_reviewed"
	| "research_value_retained"
	| "active_artifact_verified";

/** Repair class for source-of-truth issues discovered during scanning. */
export type ArchiveRepairCode =
	| "active_artifacts_stale"
	| "active_artifacts_missing"
	| "active_artifacts_route_mismatch"
	| "generated_output_do_not_edit"
	| "repair_generated_source_link"
	| "metadata_unparseable";

/** Suggested next action for an advisory candidate. */
export type ArchiveSuggestedAction =
	| "review_archive_candidate"
	| "repair_metadata"
	| "promote_or_archive_research"
	| "repair_index"
	| "no_action";

/** Confidence is intentionally bounded because stale signals are evidence, not verdicts. */
export type ArchiveCandidateConfidence = "low" | "medium";

/** File-list source used by the scanner. */
export type ArchiveCandidateFileListSource = "git-index" | "injected-fixture";

/** One advisory document archive candidate. */
export interface ArchiveCandidate {
	path: string;
	reasons: readonly ArchiveCandidateReason[];
	confidence: ArchiveCandidateConfidence;
	suggestedAction: ArchiveSuggestedAction;
	evidenceRefs: readonly string[];
	notes?: string;
}

/** One document that must not be considered an archive candidate. */
export interface ArchiveProtectedFile {
	path: string;
	reasons: readonly ArchiveProtectionReason[];
	evidenceRefs: readonly string[];
}

/** One file ignored by the scanner. */
export interface ArchiveIgnoredFile {
	path: string;
	reason: ArchiveRepairCode | "unsupported_file_type" | "path_outside_repo";
	evidenceRefs: readonly string[];
}

/** One advisory repair finding discovered while evaluating stale-document state. */
export interface ArchiveRepairFinding {
	path: string;
	code: ArchiveRepairCode;
	message: string;
	fix: string;
	evidenceRefs: readonly string[];
}

/** Summary counts for archive-candidate report consumers. */
export interface ArchiveCandidatesSummary {
	candidateCount: number;
	repairFindingCount: number;
	protectedFileCount: number;
	ignoredFileCount: number;
	fileListSource: ArchiveCandidateFileListSource;
	actionAuthority: "advisory-only";
	mutationSupported: false;
}

/** Stable JSON report emitted by docs:archive-candidates. */
export interface DocsArchiveCandidatesReport {
	schema: typeof DOCS_ARCHIVE_CANDIDATES_REPORT_SCHEMA;
	status: "pass";
	generatedAt: string;
	repoRoot: string;
	summary: ArchiveCandidatesSummary;
	candidates: readonly ArchiveCandidate[];
	repairFindings: readonly ArchiveRepairFinding[];
	protectedFiles: readonly ArchiveProtectedFile[];
	ignoredFiles: readonly ArchiveIgnoredFile[];
	evidenceRefs: readonly string[];
}

/** Stable JSON usage-error envelope emitted by the CLI. */
export interface DocsArchiveCandidatesCliError {
	schema: typeof DOCS_ARCHIVE_CANDIDATES_ERROR_SCHEMA;
	status: "error";
	code: "destructive_option_unsupported" | "usage_error" | "runtime_error";
	message: string;
	option?: string;
}

/** Options for running archive-candidate analysis. */
export interface RunDocsArchiveCandidatesOptions {
	repoRoot: string;
	trackedFiles?: readonly string[];
	now?: Date;
	activeArtifactsPath?: string;
	activeArtifactsContent?: string | null;
}

const REPO_RELATIVE_PATH_PATTERN =
	/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\).+/;

/** Return true when a value is a contained repository-relative path. */
export function isRepoRelativeArchivePath(value: string): boolean {
	return REPO_RELATIVE_PATH_PATTERN.test(value);
}

/** Validate the stable archive-candidate report shape used by automation. */
export function validateDocsArchiveCandidatesReport(
	report: DocsArchiveCandidatesReport,
): string[] {
	const errors: string[] = [];
	if (report.schema !== DOCS_ARCHIVE_CANDIDATES_REPORT_SCHEMA) {
		errors.push("schema must be docs-archive-candidates-report/v1");
	}
	if (report.status !== "pass") errors.push("status must remain pass");
	if (report.summary.actionAuthority !== "advisory-only") {
		errors.push("summary.actionAuthority must be advisory-only");
	}
	if (report.summary.mutationSupported !== false) {
		errors.push("summary.mutationSupported must be false");
	}
	for (const path of collectReportPaths(report)) {
		if (!isRepoRelativeArchivePath(path)) {
			errors.push(`path must be repository-relative: ${path}`);
		}
	}
	if (report.summary.candidateCount !== report.candidates.length) {
		errors.push("summary.candidateCount does not match candidates length");
	}
	if (report.summary.repairFindingCount !== report.repairFindings.length) {
		errors.push(
			"summary.repairFindingCount does not match repairFindings length",
		);
	}
	if (report.summary.protectedFileCount !== report.protectedFiles.length) {
		errors.push(
			"summary.protectedFileCount does not match protectedFiles length",
		);
	}
	if (report.summary.ignoredFileCount !== report.ignoredFiles.length) {
		errors.push("summary.ignoredFileCount does not match ignoredFiles length");
	}
	return errors;
}

function collectReportPaths(report: DocsArchiveCandidatesReport): string[] {
	const paths = [
		...report.candidates.map((candidate) => candidate.path),
		...report.protectedFiles.map((file) => file.path),
		...report.ignoredFiles.map((file) => file.path),
		...report.repairFindings.map((finding) => finding.path),
	];
	for (const candidate of report.candidates) {
		paths.push(...candidate.evidenceRefs);
	}
	for (const finding of report.repairFindings) {
		paths.push(...finding.evidenceRefs);
	}
	for (const file of report.protectedFiles) {
		paths.push(...file.evidenceRefs);
	}
	for (const file of report.ignoredFiles) {
		paths.push(...file.evidenceRefs);
	}
	paths.push(...report.evidenceRefs);
	return paths;
}
