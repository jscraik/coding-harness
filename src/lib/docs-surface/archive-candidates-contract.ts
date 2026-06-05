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
	| "no_inbound_references"
	| "not_in_lifecycle_manifest"
	| "not_active_artifact"
	| "not_referenced_by_current_plan_or_spec"
	| "superseded_status"
	| "raw_research_without_admission"
	| "generated_projection_without_source_ref"
	| "stale_review_date"
	| "missing_lifecycle_metadata"
	| "active_reference_stale_or_unverified"
	| "metadata_repair_needed"
	| "protection_repair_needed";

/** Reason a document was protected from archive candidacy. */
export type ArchiveProtectionReason =
	| "canon_or_canonical"
	| "execution_input"
	| "active_artifact_reference"
	| "manifest_listed"
	| "package_distribution_surface"
	| "root_entrypoint"
	| "agent_instruction_surface"
	| "current_plan_or_spec_dependency"
	| "research_value_retained"
	| "generated_output_do_not_edit"
	| "historical_evidence_retained";

/** Repair class for source-of-truth issues discovered during scanning. */
export type ArchiveRepairCode =
	| "active_reference_stale_or_unverified"
	| "generated_output_do_not_edit"
	| "repair_generated_source_link"
	| "metadata_repair_needed"
	| "protection_repair_needed"
	| "metadata_unparseable";

/** Suggested next action for an advisory candidate. */
export type ArchiveSuggestedAction =
	| "review_for_retention"
	| "repair_manifest_registration"
	| "repair_lifecycle_metadata"
	| "refresh_active_artifact_route"
	| "add_supersession_pointer"
	| "add_research_admission_pointer"
	| "repair_archive_index_reference"
	| "repair_generated_source_link"
	| "regenerate_from_source"
	| "create_separate_archive_decision";

/** Confidence is intentionally bounded because stale signals are evidence, not verdicts. */
export type ArchiveCandidateConfidence = "low" | "medium" | "high";

/** File-list source used by the scanner. */
export type ArchiveCandidateFileListSource = "git-index" | "injected-fixture";

/** One advisory document archive candidate. */
export interface ArchiveCandidate {
	path: string;
	kind: "archive_candidate";
	lifecycleStatus?: string;
	reasons: readonly ArchiveCandidateReason[];
	confidence: ArchiveCandidateConfidence;
	suggestedAction: ArchiveSuggestedAction;
	actionAuthority: "advisory_only";
	requiresReviewedDecision: true;
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
	reason:
		| ArchiveRepairCode
		| "unsupported_file_type"
		| "path_outside_repo"
		| "symlink_not_allowed";
	evidenceRefs: readonly string[];
}

/** One advisory repair finding discovered while evaluating stale-document state. */
export interface ArchiveRepairFinding {
	path: string;
	findingKind: "repair_finding";
	code: ArchiveRepairCode;
	message: string;
	suggestedAction: ArchiveSuggestedAction;
	actionAuthority: "advisory_only";
	requiresReviewedDecision: true;
	evidenceRefs: readonly string[];
}

/** Summary counts for archive-candidate report consumers. */
export interface ArchiveCandidatesSummary {
	candidateCount: number;
	repairFindingCount: number;
	protectedFileCount: number;
	ignoredFileCount: number;
	fileListSource: ArchiveCandidateFileListSource;
	actionAuthority: "advisory_only";
	mutationSupported: false;
}

/** Stable JSON report emitted by docs:archive-candidates. */
export interface DocsArchiveCandidatesReport {
	schema: typeof DOCS_ARCHIVE_CANDIDATES_REPORT_SCHEMA;
	advisoryStatus: "pass" | "warn" | "fail";
	generatedAt: string;
	repoRef: ".";
	headSha: string | null;
	advisoryOnly: true;
	actionAuthority: "advisory_only";
	mutationSupported: false;
	scannedFiles: ArchiveCandidatesSummary;
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
	/^(?![A-Za-z][A-Za-z0-9+.-]*:)(?![A-Za-z]:)(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\).+/;

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
	if (!["pass", "warn", "fail"].includes(report.advisoryStatus)) {
		errors.push("advisoryStatus must be pass, warn, or fail");
	}
	if (report.advisoryOnly !== true) {
		errors.push("advisoryOnly must be true");
	}
	if (report.actionAuthority !== "advisory_only") {
		errors.push("actionAuthority must be advisory_only");
	}
	if (report.mutationSupported !== false) {
		errors.push("mutationSupported must be false");
	}
	if (report.repoRef !== ".") {
		errors.push("repoRef must be . for local advisory reports");
	}
	if (report.summary.actionAuthority !== "advisory_only") {
		errors.push("summary.actionAuthority must be advisory_only");
	}
	if (report.summary.mutationSupported !== false) {
		errors.push("summary.mutationSupported must be false");
	}
	if (report.scannedFiles.actionAuthority !== "advisory_only") {
		errors.push("scannedFiles.actionAuthority must be advisory_only");
	}
	if (report.scannedFiles.mutationSupported !== false) {
		errors.push("scannedFiles.mutationSupported must be false");
	}
	for (const path of collectReportPaths(report)) {
		if (!isRepoRelativeArchivePath(path)) {
			errors.push(`path must be repository-relative: ${path}`);
		}
	}
	for (const candidate of report.candidates) {
		if (candidate.actionAuthority !== "advisory_only") {
			errors.push(
				`candidate.actionAuthority must be advisory_only: ${candidate.path}`,
			);
		}
		if (candidate.requiresReviewedDecision !== true) {
			errors.push(
				`candidate.requiresReviewedDecision must be true: ${candidate.path}`,
			);
		}
		if (containsDestructiveActionText(candidate.suggestedAction)) {
			errors.push(
				`candidate suggestedAction is unsupported: ${candidate.path}`,
			);
		}
	}
	for (const finding of report.repairFindings) {
		if (finding.actionAuthority !== "advisory_only") {
			errors.push(
				`repairFinding.actionAuthority must be advisory_only: ${finding.path}`,
			);
		}
		if (finding.requiresReviewedDecision !== true) {
			errors.push(
				`repairFinding.requiresReviewedDecision must be true: ${finding.path}`,
			);
		}
		if (containsDestructiveActionText(finding.suggestedAction)) {
			errors.push(
				`repairFinding suggestedAction is unsupported: ${finding.path}`,
			);
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

function containsDestructiveActionText(value: string): boolean {
	return /(?:delete|move|archive_now|apply|write|rm|demote)/i.test(value);
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
