import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
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
				version: "1.0.0",
				timestamp: "2026-04-30T00:00:00.000Z",
				status: "fail",
				findings: [
					{
						id: "learnings-gate.learning.coderabbit.coding-harness.docs-frontmatter",
						severity: "error",
						gate: "learnings-gate",
						message: "frontmatter",
						baseline: false,
						fix: {
							manual: "Keep frontmatter metadata out of prose sections.",
							suppressible: false,
						},
					},
					{
						id: "learnings-gate.learning.coderabbit.coding-harness.validation",
						severity: "warning",
						gate: "learnings-gate",
						message: "validation",
						baseline: false,
						fix: {
							manual: "Run the validation command selected by the learning.",
							suppressible: true,
						},
					},
				],
				summary: {
					errors: 1,
					warnings: 1,
					info: 0,
					total: 2,
				},
				reason: "Fixture gate result for north-star feedback tests.",
				action_now: ["Review learning gate findings."],
				action_later: [],
				evidence_ref: [
					"coderabbit_csv:/Users/jamiecraik/Downloads/learnings.csv#row=2",
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

	it("excludes terminal states from promotion metrics", () => {
		const dir = mkdtempSync(join(tmpdir(), "north-star-feedback-terminal-"));
		cleanup.push(dir);
		const source = join(dir, "coderabbit.local.json");
		const terminalArtifact = artifact();
		terminalArtifact.items.push(
			{
				...terminalArtifact.items[0]!,
				id: "coderabbit.coding-harness.rejected",
				usage: 250,
				promotionStatus: "rejected",
			},
			{
				...terminalArtifact.items[1]!,
				id: "coderabbit.coding-harness.non-goal",
				usage: 125,
				promotionStatus: "non_goal",
			},
		);
		writeFileSync(source, JSON.stringify(terminalArtifact, null, 2));

		const result = buildNorthStarFeedback({
			source,
			generatedAt: "2026-04-30T00:00:00.000Z",
		});

		expect(result.status).toBe("success");
		expect(result.metrics.promotionCandidates).toBe(2);
		expect(result.metrics.highUsageLearningsUnenforced).toBe(2);
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

	it("does not treat malformed gate findings as present evidence", () => {
		const dir = mkdtempSync(join(tmpdir(), "north-star-feedback-malformed-"));
		cleanup.push(dir);
		const source = join(dir, "coderabbit.local.json");
		const gate = join(dir, "gate.json");
		writeFileSync(source, JSON.stringify(artifact(), null, 2));
		writeFileSync(
			gate,
			JSON.stringify({
				gate: "learnings-gate",
				status: "pass",
				findings: {},
			}),
		);

		const result = buildNorthStarFeedback({
			source,
			gateResultPath: gate,
			generatedAt: "2026-04-30T00:00:00.000Z",
		});

		expect(result.metrics.learningHits).toBeNull();
		expect(result.summary.insufficientEvidence).toContain("gateResult");
	});

	it("rejects NaN minUsage", () => {
		const dir = mkdtempSync(join(tmpdir(), "north-star-feedback-nan-"));
		cleanup.push(dir);
		const source = join(dir, "coderabbit.local.json");
		writeFileSync(source, JSON.stringify(artifact(), null, 2));

		const result = buildNorthStarFeedback({
			source,
			minUsage: Number.NaN,
			generatedAt: "2026-04-30T00:00:00.000Z",
		});

		expect(result.status).toBe("error");
		expect(result.error?.code).toBe("north_star_feedback.invalid_min_usage");
		expect(result.error?.message).toContain("minUsage must be a finite");
	});

	it("rejects Infinity minUsage", () => {
		const dir = mkdtempSync(join(tmpdir(), "north-star-feedback-infinity-"));
		cleanup.push(dir);
		const source = join(dir, "coderabbit.local.json");
		writeFileSync(source, JSON.stringify(artifact(), null, 2));

		const result = buildNorthStarFeedback({
			source,
			minUsage: Number.POSITIVE_INFINITY,
			generatedAt: "2026-04-30T00:00:00.000Z",
		});

		expect(result.status).toBe("error");
		expect(result.error?.code).toBe("north_star_feedback.invalid_min_usage");
	});

	it("rejects negative minUsage", () => {
		const dir = mkdtempSync(join(tmpdir(), "north-star-feedback-negative-"));
		cleanup.push(dir);
		const source = join(dir, "coderabbit.local.json");
		writeFileSync(source, JSON.stringify(artifact(), null, 2));

		const result = buildNorthStarFeedback({
			source,
			minUsage: -1,
			generatedAt: "2026-04-30T00:00:00.000Z",
		});

		expect(result.status).toBe("error");
		expect(result.error?.code).toBe("north_star_feedback.invalid_min_usage");
	});

	it("allows explicit zero minUsage without applying the default threshold", () => {
		const dir = mkdtempSync(join(tmpdir(), "north-star-feedback-zero-"));
		cleanup.push(dir);
		const source = join(dir, "coderabbit.local.json");
		writeFileSync(source, JSON.stringify(artifact(), null, 2));

		const result = buildNorthStarFeedback({
			source,
			minUsage: 0,
			generatedAt: "2026-04-30T00:00:00.000Z",
		});

		expect(result.status).toBe("success");
		expect(result.minUsage).toBe(0);
	});

	it("rejects output paths that escape repoRoot with the write failure contract", () => {
		const dir = mkdtempSync(join(tmpdir(), "north-star-feedback-output-"));
		cleanup.push(dir);
		const source = join(dir, "coderabbit.local.json");
		const outsideTarget = join(dir, "..", "north-star-feedback.json");
		rmSync(outsideTarget, { force: true });
		cleanup.push(outsideTarget);
		writeFileSync(source, JSON.stringify(artifact(), null, 2));

		const result = buildNorthStarFeedback({
			source,
			output: "../north-star-feedback.json",
			repoRoot: dir,
			generatedAt: "2026-04-30T00:00:00.000Z",
		});

		expect(result.status).toBe("error");
		expect(result.error).toMatchObject({
			code: "north_star_feedback.write_failed",
			message:
				"Failed to write north-star feedback artifact: output must stay within repoRoot.",
		});
		expect(existsSync(outsideTarget)).toBe(false);
	});

	it("rejects output paths that escape repoRoot through symlinked ancestors", () => {
		const dir = mkdtempSync(join(tmpdir(), "north-star-feedback-symlink-"));
		const outsideDir = mkdtempSync(
			join(tmpdir(), "north-star-feedback-outside-"),
		);
		cleanup.push(dir, outsideDir);
		const source = join(dir, "coderabbit.local.json");
		writeFileSync(source, JSON.stringify(artifact(), null, 2));
		symlinkSync(outsideDir, join(dir, "artifacts"), "dir");

		const result = buildNorthStarFeedback({
			source,
			output: "artifacts/north-star-feedback.json",
			repoRoot: dir,
			generatedAt: "2026-04-30T00:00:00.000Z",
		});

		expect(result.status).toBe("error");
		expect(result.error).toMatchObject({
			code: "north_star_feedback.write_failed",
			message:
				"Failed to write north-star feedback artifact: output must stay within repoRoot.",
		});
		expect(existsSync(join(outsideDir, "north-star-feedback.json"))).toBe(
			false,
		);
	});

	it("rejects NaN reviewThreadCount", () => {
		const dir = mkdtempSync(join(tmpdir(), "north-star-feedback-nan-threads-"));
		cleanup.push(dir);
		const source = join(dir, "coderabbit.local.json");
		writeFileSync(source, JSON.stringify(artifact(), null, 2));

		const result = buildNorthStarFeedback({
			source,
			reviewThreadCount: Number.NaN,
			generatedAt: "2026-04-30T00:00:00.000Z",
		});

		expect(result.status).toBe("error");
		expect(result.error?.code).toBe(
			"north_star_feedback.invalid_review_thread_count",
		);
		expect(result.error?.message).toContain(
			"reviewThreadCount must be a finite",
		);
	});

	it("rejects negative reviewThreadCount", () => {
		const dir = mkdtempSync(
			join(tmpdir(), "north-star-feedback-negative-threads-"),
		);
		cleanup.push(dir);
		const source = join(dir, "coderabbit.local.json");
		writeFileSync(source, JSON.stringify(artifact(), null, 2));

		const result = buildNorthStarFeedback({
			source,
			reviewThreadCount: -1,
			generatedAt: "2026-04-30T00:00:00.000Z",
		});

		expect(result.status).toBe("error");
		expect(result.error?.code).toBe(
			"north_star_feedback.invalid_review_thread_count",
		);
	});

	it("rejects NaN validationReruns", () => {
		const dir = mkdtempSync(join(tmpdir(), "north-star-feedback-nan-reruns-"));
		cleanup.push(dir);
		const source = join(dir, "coderabbit.local.json");
		writeFileSync(source, JSON.stringify(artifact(), null, 2));

		const result = buildNorthStarFeedback({
			source,
			validationReruns: Number.NaN,
			generatedAt: "2026-04-30T00:00:00.000Z",
		});

		expect(result.status).toBe("error");
		expect(result.error?.code).toBe(
			"north_star_feedback.invalid_validation_reruns",
		);
		expect(result.error?.message).toContain(
			"validationReruns must be a finite",
		);
	});

	it("rejects negative validationReruns", () => {
		const dir = mkdtempSync(
			join(tmpdir(), "north-star-feedback-negative-reruns-"),
		);
		cleanup.push(dir);
		const source = join(dir, "coderabbit.local.json");
		writeFileSync(source, JSON.stringify(artifact(), null, 2));

		const result = buildNorthStarFeedback({
			source,
			validationReruns: -1,
			generatedAt: "2026-04-30T00:00:00.000Z",
		});

		expect(result.status).toBe("error");
		expect(result.error?.code).toBe(
			"north_star_feedback.invalid_validation_reruns",
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
