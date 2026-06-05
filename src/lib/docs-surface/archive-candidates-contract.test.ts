import { describe, expect, it } from "vitest";
import {
	DOCS_ARCHIVE_CANDIDATES_REPORT_SCHEMA,
	type DocsArchiveCandidatesReport,
	validateDocsArchiveCandidatesReport,
} from "./archive-candidates-contract.js";

describe("validateDocsArchiveCandidatesReport", () => {
	it("accepts advisory-only reports with repo-relative evidence", () => {
		const report: DocsArchiveCandidatesReport = {
			schema: DOCS_ARCHIVE_CANDIDATES_REPORT_SCHEMA,
			advisoryStatus: "warn",
			generatedAt: "2026-06-05T00:00:00.000Z",
			repoRef: ".",
			headSha: null,
			advisoryOnly: true,
			summary: {
				candidateCount: 1,
				repairFindingCount: 0,
				protectedFileCount: 0,
				ignoredFileCount: 0,
				fileListSource: "injected-fixture",
				actionAuthority: "advisory_only",
				mutationSupported: false,
			},
			scannedFiles: {
				candidateCount: 1,
				repairFindingCount: 0,
				protectedFileCount: 0,
				ignoredFileCount: 0,
				fileListSource: "injected-fixture",
				actionAuthority: "advisory_only",
				mutationSupported: false,
			},
			candidates: [
				{
					path: "docs/old.md",
					kind: "archive_candidate",
					reasons: ["superseded_status"],
					confidence: "medium",
					suggestedAction: "create_separate_archive_decision",
					actionAuthority: "advisory_only",
					requiresReviewedDecision: true,
					evidenceRefs: ["docs/old.md"],
				},
			],
			repairFindings: [],
			protectedFiles: [],
			ignoredFiles: [],
			evidenceRefs: ["docs/doc-lifecycle-manifest.json"],
		};

		expect(validateDocsArchiveCandidatesReport(report)).toEqual([]);
	});

	it("rejects mutation authority and unsafe paths", () => {
		const report: DocsArchiveCandidatesReport = {
			schema: DOCS_ARCHIVE_CANDIDATES_REPORT_SCHEMA,
			advisoryStatus: "pass",
			generatedAt: "2026-06-05T00:00:00.000Z",
			repoRef: ".",
			headSha: null,
			advisoryOnly: true,
			summary: {
				candidateCount: 0,
				repairFindingCount: 0,
				protectedFileCount: 0,
				ignoredFileCount: 0,
				fileListSource: "injected-fixture",
				actionAuthority: "advisory_only",
				mutationSupported: false,
			},
			scannedFiles: {
				candidateCount: 0,
				repairFindingCount: 0,
				protectedFileCount: 0,
				ignoredFileCount: 0,
				fileListSource: "injected-fixture",
				actionAuthority: "advisory_only",
				mutationSupported: false,
			},
			candidates: [],
			repairFindings: [],
			protectedFiles: [
				{
					path: "/absolute.md",
					reasons: ["root_entrypoint"],
					evidenceRefs: ["/absolute.md"],
				},
			],
			ignoredFiles: [],
			evidenceRefs: [],
		};

		expect(validateDocsArchiveCandidatesReport(report)).toContain(
			"path must be repository-relative: /absolute.md",
		);
	});
});
