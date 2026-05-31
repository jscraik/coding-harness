import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	FEEDBACK_LOOP_AUDIT_SCHEMA_VERSION,
	buildFeedbackLoopAudit,
} from "./feedback-loop-audit.js";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function makeTempRepo(): string {
	const dir = mkdtempSync(join(tmpdir(), "feedback-loop-audit-"));
	tempDirs.push(dir);
	return dir;
}

function writeIndex(
	repoRoot: string,
	overrides: Record<string, unknown> = {},
): void {
	const indexDir = join(repoRoot, ".harness", "feedback-loops");
	mkdirSync(indexDir, { recursive: true });
	const loops = Array.from({ length: 19 }, (_, index) => ({
		rank: index + 1,
		id: `loop-${(index + 1).toString()}`,
		name: `Loop ${(index + 1).toString()}`,
		leverage: "high",
		owner: "owner",
		sources: ["source"],
		recipients: ["recipient"],
		expectedDelay: "minutes",
		failureClass: "failure",
		action: "act",
		closureState: "implemented",
		evidenceRefs: ["evidence"],
	}));
	const index = {
		schemaVersion: "feedback-loop-index/v1",
		generatedAt: "2026-05-30T20:54:32.000Z",
		sourceAudit: ".harness/audits/2026-05-30-feedback-loops-audit.md",
		status: "implemented",
		owner: "coding-harness",
		summary: {
			loopCount: 19,
			crossLoopGapCount: 5,
			recommendationCount: 7,
			openFindingCount: 0,
		},
		loops,
		crossLoopGaps: Array.from({ length: 5 }, (_, index) => ({
			id: `gap-${(index + 1).toString()}`,
			description: `Gap ${(index + 1).toString()}`,
			closureState: "implemented",
			evidenceRefs: ["evidence"],
		})),
		recommendations: Array.from({ length: 7 }, (_, index) => ({
			id: `recommendation-${(index + 1).toString()}`,
			description: `Recommendation ${(index + 1).toString()}`,
			closureState: "implemented",
			evidenceRefs: ["evidence"],
		})),
		...overrides,
	};
	writeFileSync(join(indexDir, "index.json"), JSON.stringify(index, null, 2));
}

describe("buildFeedbackLoopAudit", () => {
	it("passes when all audit loops, gaps, and recommendations are implemented", () => {
		const repoRoot = makeTempRepo();
		writeIndex(repoRoot);

		const report = buildFeedbackLoopAudit({ repoRoot });

		expect(report.schemaVersion).toBe(FEEDBACK_LOOP_AUDIT_SCHEMA_VERSION);
		expect(report.status).toBe("pass");
		expect(report.summary).toMatchObject({
			loopCount: 19,
			crossLoopGapCount: 5,
			recommendationCount: 7,
			openFindingCount: 0,
			implementedLoopCount: 19,
			implementedGapCount: 5,
			implementedRecommendationCount: 7,
		});
		expect(report.findings.every((finding) => finding.status === "pass")).toBe(
			true,
		);
	});

	it("passes closure checks when implemented gaps and recommendations include one non-blank evidence ref", () => {
		const repoRoot = makeTempRepo();
		writeIndex(repoRoot, {
			crossLoopGaps: Array.from({ length: 5 }, (_, index) => ({
				id: `gap-${(index + 1).toString()}`,
				description: `Gap ${(index + 1).toString()}`,
				closureState: "implemented",
				evidenceRefs: ["", " evidence ", "   "],
			})),
			recommendations: Array.from({ length: 7 }, (_, index) => ({
				id: `recommendation-${(index + 1).toString()}`,
				description: `Recommendation ${(index + 1).toString()}`,
				closureState: "implemented",
				evidenceRefs: ["", " evidence ", "   "],
			})),
		});

		const report = buildFeedbackLoopAudit({ repoRoot });

		expect(report.findings).toContainEqual(
			expect.objectContaining({
				code: "cross_loop_gaps_closed",
				status: "pass",
			}),
		);
		expect(report.findings).toContainEqual(
			expect.objectContaining({
				code: "recommended_next_steps_closed",
				status: "pass",
			}),
		);
	});

	it("fails when the feedback-loop index is missing", () => {
		const repoRoot = makeTempRepo();

		const report = buildFeedbackLoopAudit({ repoRoot });

		expect(report.status).toBe("fail");
		expect(report.findings).toContainEqual(
			expect.objectContaining({ code: "feedback_loop_index_missing" }),
		);
	});

	it("fails without throwing when the feedback-loop index is malformed", () => {
		const repoRoot = makeTempRepo();
		const indexDir = join(repoRoot, ".harness", "feedback-loops");
		mkdirSync(indexDir, { recursive: true });
		writeFileSync(join(indexDir, "index.json"), "{not-json");

		const report = buildFeedbackLoopAudit({ repoRoot });

		expect(report.status).toBe("fail");
		expect(report.findings).toContainEqual(
			expect.objectContaining({
				code: "feedback_loop_index_malformed",
				status: "fail",
			}),
		);
	});

	it("fails when the feedback-loop index schema version is unsupported", () => {
		const repoRoot = makeTempRepo();
		writeIndex(repoRoot, { schemaVersion: "feedback-loop-index/v0" });

		const report = buildFeedbackLoopAudit({ repoRoot });

		expect(report.status).toBe("fail");
		expect(report.findings).toContainEqual(
			expect.objectContaining({
				code: "feedback_loop_index_schema_version",
				status: "fail",
			}),
		);
	});

	it("fails when a feedback-loop entry omits leverage", () => {
		const repoRoot = makeTempRepo();
		writeIndex(repoRoot, {
			loops: [
				{
					rank: 1,
					id: "loop-1",
					name: "Loop 1",
					owner: "owner",
					sources: ["source"],
					recipients: ["recipient"],
					expectedDelay: "minutes",
					failureClass: "failure",
					action: "act",
					closureState: "implemented",
					evidenceRefs: ["evidence"],
				},
			],
		});

		const report = buildFeedbackLoopAudit({ repoRoot });

		expect(report.status).toBe("fail");
		expect(report.findings).toContainEqual(
			expect.objectContaining({
				code: "feedback_loop_entries_actionable",
				status: "fail",
			}),
		);
	});

	const completeFeedbackLoopEntry = {
		rank: 1,
		id: "loop-1",
		name: "Loop 1",
		leverage: "high",
		owner: "owner",
		sources: ["source"],
		recipients: ["recipient"],
		expectedDelay: "minutes",
		failureClass: "failure",
		action: "act",
		closureState: "implemented",
		evidenceRefs: ["evidence"],
	};

	const blankRequiredLoopMetadataCases: Array<
		[string, Record<string, unknown>]
	> = [
		["id", { id: " " }],
		["name", { name: " " }],
		["leverage", { leverage: " " }],
		["owner", { owner: " " }],
		["sources", { sources: ["source", " "] }],
		["recipients", { recipients: ["recipient", " "] }],
		["expectedDelay", { expectedDelay: " " }],
		["failureClass", { failureClass: " " }],
		["action", { action: " " }],
		["evidenceRefs", { evidenceRefs: ["evidence", " "] }],
	];

	for (const [fieldName, override] of blankRequiredLoopMetadataCases) {
		it(`fails when a feedback-loop entry has blank ${fieldName} metadata`, () => {
			const repoRoot = makeTempRepo();
			writeIndex(repoRoot, {
				loops: [{ ...completeFeedbackLoopEntry, ...override }],
			});

			const report = buildFeedbackLoopAudit({ repoRoot });

			expect(report.status).toBe("fail");
			expect(report.findings).toContainEqual(
				expect.objectContaining({
					code: "feedback_loop_entries_actionable",
					status: "fail",
				}),
			);
		});
	}

	it("fails when audit recommendations are not closed", () => {
		const repoRoot = makeTempRepo();
		writeIndex(repoRoot, {
			recommendations: [],
		});

		const report = buildFeedbackLoopAudit({ repoRoot });

		expect(report.status).toBe("fail");
		expect(report.findings).toContainEqual(
			expect.objectContaining({
				code: "recommended_next_steps_closed",
				status: "fail",
			}),
		);
	});

	it("fails when the cross-loop gap summary count drifts from the closed gap evidence", () => {
		const repoRoot = makeTempRepo();
		writeIndex(repoRoot, {
			summary: {
				loopCount: 19,
				crossLoopGapCount: 4,
				recommendationCount: 7,
				openFindingCount: 0,
			},
		});

		const report = buildFeedbackLoopAudit({ repoRoot });

		expect(report.status).toBe("fail");
		expect(report.findings).toContainEqual(
			expect.objectContaining({
				code: "cross_loop_gaps_closed",
				status: "fail",
			}),
		);
	});

	for (const fieldName of ["id", "description"] as const) {
		it(`fails when implemented cross-loop gaps have blank ${fieldName} metadata`, () => {
			const repoRoot = makeTempRepo();
			writeIndex(repoRoot, {
				crossLoopGaps: Array.from({ length: 5 }, (_, index) => {
					const entry = {
						id: `gap-${(index + 1).toString()}`,
						description: `Gap ${(index + 1).toString()}`,
						closureState: "implemented",
						evidenceRefs: ["evidence"],
					};
					return index === 0 ? { ...entry, [fieldName]: " " } : entry;
				}),
			});

			const report = buildFeedbackLoopAudit({ repoRoot });

			expect(report.status).toBe("fail");
			expect(report.findings).toContainEqual(
				expect.objectContaining({
					code: "cross_loop_gaps_closed",
					status: "fail",
				}),
			);
		});
	}

	for (const fieldName of ["id", "description"] as const) {
		it(`fails when implemented recommendations have blank ${fieldName} metadata`, () => {
			const repoRoot = makeTempRepo();
			writeIndex(repoRoot, {
				recommendations: Array.from({ length: 7 }, (_, index) => {
					const entry = {
						id: `recommendation-${(index + 1).toString()}`,
						description: `Recommendation ${(index + 1).toString()}`,
						closureState: "implemented",
						evidenceRefs: ["evidence"],
					};
					return index === 0 ? { ...entry, [fieldName]: " " } : entry;
				}),
			});

			const report = buildFeedbackLoopAudit({ repoRoot });

			expect(report.status).toBe("fail");
			expect(report.findings).toContainEqual(
				expect.objectContaining({
					code: "recommended_next_steps_closed",
					status: "fail",
				}),
			);
		});
	}

	it("fails when the recommendation summary count drifts from the closed recommendation evidence", () => {
		const repoRoot = makeTempRepo();
		writeIndex(repoRoot, {
			summary: {
				loopCount: 19,
				crossLoopGapCount: 5,
				recommendationCount: 6,
				openFindingCount: 0,
			},
		});

		const report = buildFeedbackLoopAudit({ repoRoot });

		expect(report.status).toBe("fail");
		expect(report.findings).toContainEqual(
			expect.objectContaining({
				code: "recommended_next_steps_closed",
				status: "fail",
			}),
		);
	});

	it("fails when implemented cross-loop gaps omit closure evidence", () => {
		const repoRoot = makeTempRepo();
		writeIndex(repoRoot, {
			crossLoopGaps: Array.from({ length: 5 }, (_, index) => ({
				id: `gap-${(index + 1).toString()}`,
				description: `Gap ${(index + 1).toString()}`,
				closureState: "implemented",
				evidenceRefs: [],
			})),
		});

		const report = buildFeedbackLoopAudit({ repoRoot });

		expect(report.status).toBe("fail");
		expect(report.findings).toContainEqual(
			expect.objectContaining({
				code: "cross_loop_gaps_closed",
				status: "fail",
			}),
		);
	});

	it("fails when implemented recommendations omit closure evidence", () => {
		const repoRoot = makeTempRepo();
		writeIndex(repoRoot, {
			recommendations: Array.from({ length: 7 }, (_, index) => ({
				id: `recommendation-${(index + 1).toString()}`,
				description: `Recommendation ${(index + 1).toString()}`,
				closureState: "implemented",
				evidenceRefs: [],
			})),
		});

		const report = buildFeedbackLoopAudit({ repoRoot });

		expect(report.status).toBe("fail");
		expect(report.findings).toContainEqual(
			expect.objectContaining({
				code: "recommended_next_steps_closed",
				status: "fail",
			}),
		);
	});

	it("fails when implemented cross-loop gaps have only blank evidence", () => {
		const repoRoot = makeTempRepo();
		writeIndex(repoRoot, {
			crossLoopGaps: Array.from({ length: 5 }, (_, index) => ({
				id: `gap-${(index + 1).toString()}`,
				description: `Gap ${(index + 1).toString()}`,
				closureState: "implemented",
				evidenceRefs: index === 0 ? [""] : ["   "],
			})),
		});

		const report = buildFeedbackLoopAudit({ repoRoot });

		expect(report.status).toBe("fail");
		expect(report.findings).toContainEqual(
			expect.objectContaining({
				code: "cross_loop_gaps_closed",
				status: "fail",
			}),
		);
	});

	it("fails when implemented recommendations have only blank evidence", () => {
		const repoRoot = makeTempRepo();
		writeIndex(repoRoot, {
			recommendations: Array.from({ length: 7 }, (_, index) => ({
				id: `recommendation-${(index + 1).toString()}`,
				description: `Recommendation ${(index + 1).toString()}`,
				closureState: "implemented",
				evidenceRefs: index === 0 ? [""] : ["   "],
			})),
		});

		const report = buildFeedbackLoopAudit({ repoRoot });

		expect(report.status).toBe("fail");
		expect(report.findings).toContainEqual(
			expect.objectContaining({
				code: "recommended_next_steps_closed",
				status: "fail",
			}),
		);
	});
});
