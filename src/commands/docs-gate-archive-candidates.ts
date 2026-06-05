import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	DOCS_ARCHIVE_CANDIDATES_RULE_ID,
	validateDocsArchiveCandidatesReport,
} from "../lib/docs-surface/archive-candidates-contract.js";
import { runDocsArchiveCandidates } from "../lib/docs-surface/archive-candidates.js";
import { sanitizeError } from "../lib/input/sanitize.js";

/** Summary fields added to docs-gate reports for archive-candidate visibility. */
export interface ArchiveCandidateDocsGateCounts {
	archive_candidate_count: number;
	archive_repair_finding_count: number;
	archive_protected_file_count: number;
	archive_ignored_file_count: number;
}

/** Docs-gate-compatible projection of the advisory archive-candidate report. */
export interface ArchiveCandidateDocsGateProjection {
	findings: {
		rule_id: typeof DOCS_ARCHIVE_CANDIDATES_RULE_ID;
		category: "doc_only";
		surface: "docs:archive-candidates";
		rule_result: "not_applicable" | "error";
		result: "not_applicable" | "error";
		severity: "warning" | "error";
		message: string;
		details?: string;
		source_of_truth_ref: string;
	}[];
	counts: ArchiveCandidateDocsGateCounts;
}

/** Project advisory archive-candidate results into docs-gate warnings/errors. */
export function collectArchiveCandidateDocsGateProjection(
	repoRoot: string,
): ArchiveCandidateDocsGateProjection {
	if (!existsSync(join(repoRoot, ".git"))) {
		return { findings: [], counts: emptyArchiveCandidateCounts() };
	}
	try {
		const report = runDocsArchiveCandidates({ repoRoot });
		const validationErrors = validateDocsArchiveCandidatesReport(report);
		if (validationErrors.length > 0) {
			return archiveCandidateError(
				"Archive-candidate report failed its stable schema contract.",
				validationErrors.join("; "),
				"docs-archive-candidates-report/v1",
			);
		}
		const findings: ArchiveCandidateDocsGateProjection["findings"] = [];
		if (report.candidates.length > 0) {
			findings.push({
				rule_id: DOCS_ARCHIVE_CANDIDATES_RULE_ID,
				category: "doc_only",
				surface: "docs:archive-candidates",
				rule_result: "not_applicable",
				result: "not_applicable",
				severity: "warning",
				message: `Advisory stale-document archive candidates found: ${report.candidates.length}`,
				details: report.candidates
					.slice(0, 5)
					.map(
						(candidate) =>
							`${candidate.path} [${candidate.reasons.join(", ")}]`,
					)
					.join("; "),
				source_of_truth_ref: "pnpm docs:archive-candidates -- --json",
			});
		}
		if (report.repairFindings.length > 0) {
			findings.push({
				rule_id: DOCS_ARCHIVE_CANDIDATES_RULE_ID,
				category: "doc_only",
				surface: "docs:archive-candidates",
				rule_result: "not_applicable",
				result: "not_applicable",
				severity: "warning",
				message: `Advisory stale-document repair findings found: ${report.repairFindings.length}`,
				details: report.repairFindings
					.slice(0, 5)
					.map((finding) => `${finding.path} [${finding.code}]`)
					.join("; "),
				source_of_truth_ref: "pnpm docs:archive-candidates -- --json",
			});
		}
		return {
			findings,
			counts: {
				archive_candidate_count: report.candidates.length,
				archive_repair_finding_count: report.repairFindings.length,
				archive_protected_file_count: report.protectedFiles.length,
				archive_ignored_file_count: report.ignoredFiles.length,
			},
		};
	} catch (error) {
		return archiveCandidateError(
			"Archive-candidate scanner failed before producing advisory evidence.",
			sanitizeError(error),
			"pnpm docs:archive-candidates",
		);
	}
}

function archiveCandidateError(
	message: string,
	details: string,
	sourceOfTruthRef: string,
): ArchiveCandidateDocsGateProjection {
	return {
		findings: [
			{
				rule_id: DOCS_ARCHIVE_CANDIDATES_RULE_ID,
				category: "doc_only",
				surface: "docs:archive-candidates",
				rule_result: "error",
				result: "error",
				severity: "error",
				message,
				details,
				source_of_truth_ref: sourceOfTruthRef,
			},
		],
		counts: emptyArchiveCandidateCounts(),
	};
}

function emptyArchiveCandidateCounts(): ArchiveCandidateDocsGateCounts {
	return {
		archive_candidate_count: 0,
		archive_repair_finding_count: 0,
		archive_protected_file_count: 0,
		archive_ignored_file_count: 0,
	};
}
