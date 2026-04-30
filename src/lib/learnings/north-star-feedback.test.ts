import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	NORTH_STAR_FEEDBACK_SCHEMA_VERSION,
	buildNorthStarFeedback,
} from "./north-star-feedback.js";
import type { LearningImportArtifact } from "./types.js";

describe("buildNorthStarFeedback", () => {
	const cleanup: string[] = [];
	afterEach(() => {
		for (const path of cleanup.splice(0))
			rmSync(path, { recursive: true, force: true });
	});

	it("counts promotion and gate metrics while preserving missing evidence", () => {
		const dir = mkdtempSync(join(tmpdir(), "north-star-feedback-"));
		cleanup.push(dir);
		mkdirSync(join(dir, ".harness/learnings"), { recursive: true });
		const source = join(dir, ".harness/learnings/coderabbit.local.json");
		const ledger = join(dir, ".harness/learnings/enforcement-status.json");
		const gate = join(dir, "gate.json");
		writeFileSync(source, JSON.stringify(artifact(), null, 2));
		writeFileSync(
			ledger,
			JSON.stringify(
				{
					schemaVersion: "learning-enforcement-status/v1",
					items: [
						{
							learningId: "coderabbit.coding-harness.docs-frontmatter",
							promotionStatus: "enforced",
							enforcedBy: ["src/lib/docs-surface/frontmatter-metadata-gate.ts"],
						},
					],
				},
				null,
				2,
			),
		);
		writeFileSync(
			gate,
			JSON.stringify({
				gate: "learnings-gate",
				status: "fail",
				findings: [
					{
						id: "learnings-gate.learning.coderabbit.coding-harness.docs-frontmatter",
						severity: "error",
						gate: "learnings-gate",
						message: "frontmatter",
						baseline: false,
					},
					{
						id: "learnings-gate.learning.coderabbit.coding-harness.validation",
						severity: "warning",
						gate: "learnings-gate",
						message: "validation",
						baseline: false,
					},
				],
			}),
		);

		const result = buildNorthStarFeedback({
			source,
			enforcementStatusPath: ledger,
			gateResultPath: gate,
			reviewThreadCount: 3,
			validationReruns: 1,
			generatedAt: "2026-04-30T00:00:00.000Z",
		});

		expect(result.schemaVersion).toBe(NORTH_STAR_FEEDBACK_SCHEMA_VERSION);
		expect(result.status).toBe("success");
		expect(result.metrics).toMatchObject({
			learningHits: 2,
			learningGateBlocks: 1,
			learningGateWarnings: 1,
			promotionCandidates: 1,
			promotedLearnings: 1,
			highUsageLearningsUnenforced: 1,
			reviewThreadCount: 3,
			validationReruns: 1,
		});
		expect(result.summary.insufficientEvidence).toEqual([]);
	});

	it("does not treat omitted optional evidence as zero", () => {
		const dir = mkdtempSync(join(tmpdir(), "north-star-feedback-missing-"));
		cleanup.push(dir);
		const source = join(dir, "coderabbit.local.json");
		writeFileSync(source, JSON.stringify(artifact(), null, 2));

		const result = buildNorthStarFeedback({
			source,
			enforcementStatusPath: join(dir, "missing-ledger.json"),
			generatedAt: "2026-04-30T00:00:00.000Z",
		});

		expect(result.status).toBe("success");
		expect(result.metrics.learningHits).toBeNull();
		expect(result.metrics.learningGateBlocks).toBeNull();
		expect(result.metrics.reviewThreadCount).toBeNull();
		expect(result.summary.insufficientEvidence).toEqual(
			expect.arrayContaining([
				"enforcementStatus",
				"gateResult",
				"reviewThreadCount",
				"validationReruns",
			]),
		);
	});
});

function artifact(): LearningImportArtifact {
	return {
		schemaVersion: "harness-learnings/v1",
		provider: "coderabbit-csv",
		repository: "coding-harness",
		source: {
			kind: "coderabbit_csv",
			uri: "file:///tmp/learnings.csv",
			live: false,
		},
		inputFingerprint: "abc123",
		items: [
			{
				id: "coderabbit.coding-harness.docs-frontmatter",
				provider: "coderabbit",
				source: {
					kind: "coderabbit_csv",
					uri: "file:///tmp/learnings.csv",
					row: 2,
					live: false,
				},
				repository: "coding-harness",
				file: "docs/policy.md",
				usage: 516,
				learning: "Frontmatter is metadata.",
				classification: "guardrail",
				enforcement: "error",
				promotionStatus: "candidate",
			},
			{
				id: "coderabbit.coding-harness.validation",
				provider: "coderabbit",
				source: {
					kind: "coderabbit_csv",
					uri: "file:///tmp/learnings.csv",
					row: 3,
					live: false,
				},
				repository: "coding-harness",
				usage: 47,
				learning: "Use pnpm test:ci for CI parity.",
				classification: "validation_contract",
				enforcement: "warning",
				promotionStatus: "candidate",
			},
		],
		warnings: [],
		summary: {
			totalRows: 2,
			imported: 2,
			skipped: 0,
			invalid: 0,
			warnings: 0,
			byClassification: {
				guardrail: 1,
				validation_contract: 1,
			},
			byEnforcement: {
				error: 1,
				warning: 1,
			},
		},
	};
}
