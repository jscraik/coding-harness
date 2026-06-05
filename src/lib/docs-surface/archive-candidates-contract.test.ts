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
			status: "pass",
			generatedAt: "2026-06-05T00:00:00.000Z",
			repoRoot: "/repo",
			summary: {
				candidateCount: 1,
				repairFindingCount: 0,
				protectedFileCount: 0,
				ignoredFileCount: 0,
				fileListSource: "injected-fixture",
				actionAuthority: "advisory-only",
				mutationSupported: false,
			},
			candidates: [
				{
					path: "docs/old.md",
					reasons: ["superseded_status"],
					confidence: "medium",
					suggestedAction: "review_archive_candidate",
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
			status: "pass",
			generatedAt: "2026-06-05T00:00:00.000Z",
			repoRoot: "/repo",
			summary: {
				candidateCount: 0,
				repairFindingCount: 0,
				protectedFileCount: 0,
				ignoredFileCount: 0,
				fileListSource: "injected-fixture",
				actionAuthority: "advisory-only",
				mutationSupported: false,
			},
			candidates: [],
			repairFindings: [],
			protectedFiles: [
				{
					path: "/absolute.md",
					reasons: ["canonical_source"],
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
