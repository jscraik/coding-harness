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
			actionAuthority: "advisory_only",
			mutationSupported: false,
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
			actionAuthority: "advisory_only",
			mutationSupported: false,
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

	it("rejects malformed scanned-file invariants and unsafe repair actions", () => {
		const report: DocsArchiveCandidatesReport = {
			schema: DOCS_ARCHIVE_CANDIDATES_REPORT_SCHEMA,
			advisoryStatus: "pass",
			generatedAt: "2026-06-05T00:00:00.000Z",
			repoRef: ".",
			headSha: null,
			advisoryOnly: true,
			actionAuthority: "write" as "advisory_only",
			mutationSupported: true as false,
			summary: {
				candidateCount: 0,
				repairFindingCount: 1,
				protectedFileCount: 0,
				ignoredFileCount: 0,
				fileListSource: "injected-fixture",
				actionAuthority: "advisory_only",
				mutationSupported: false,
			},
			scannedFiles: {
				candidateCount: 0,
				repairFindingCount: 1,
				protectedFileCount: 0,
				ignoredFileCount: 0,
				fileListSource: "injected-fixture",
				actionAuthority: "write" as "advisory_only",
				mutationSupported: true as false,
			},
			candidates: [],
			repairFindings: [
				{
					path: "docs/index.md",
					findingKind: "repair_finding",
					code: "protection_repair_needed",
					message: "unsafe",
					suggestedAction: "delete" as never,
					actionAuthority: "advisory_only",
					requiresReviewedDecision: true,
					evidenceRefs: ["docs/index.md"],
				},
			],
			protectedFiles: [],
			ignoredFiles: [],
			evidenceRefs: ["file:///tmp/outside.md", "C:/outside.md"],
		};

		expect(validateDocsArchiveCandidatesReport(report)).toEqual(
			expect.arrayContaining([
				"scannedFiles.actionAuthority must be advisory_only",
				"scannedFiles.mutationSupported must be false",
				"actionAuthority must be advisory_only",
				"mutationSupported must be false",
				"repairFinding suggestedAction is unsupported: docs/index.md",
				"path must be repository-relative: file:///tmp/outside.md",
				"path must be repository-relative: C:/outside.md",
			]),
		);
	});
});
