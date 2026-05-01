import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEARNING_ENFORCEMENT_STATUS_SCHEMA_VERSION } from "./enforcement-status.js";
import { buildLearningPromotionCandidates } from "./promote.js";
import { LEARNING_ARTIFACT_SCHEMA_VERSION } from "./types.js";

const sourceRef = {
	kind: "coderabbit_csv" as const,
	uri: "file:///tmp/learnings.csv",
	row: 2,
	live: false as const,
};

function writeArtifact(dir: string): string {
	const artifactPath = join(dir, ".harness/learnings/coderabbit.local.json");
	mkdirSync(join(dir, ".harness/learnings"), { recursive: true });
	writeFileSync(
		artifactPath,
		JSON.stringify(
			{
				schemaVersion: LEARNING_ARTIFACT_SCHEMA_VERSION,
				provider: "coderabbit-csv",
				repository: "coding-harness",
				source: {
					kind: "coderabbit_csv",
					uri: "file:///tmp/learnings.csv",
					live: false,
				},
				inputFingerprint: "fingerprint",
				items: [
					{
						id: "coderabbit.coding-harness.docs-frontmatter-machine-readable",
						provider: "coderabbit",
						source: sourceRef,
						repository: "coding-harness",
						file: "docs/ai-assistant-security-policy.md",
						usage: 516,
						learning: "YAML frontmatter fields are machine-readable metadata.",
						classification: "guardrail",
						enforcement: "error",
						promotionStatus: "candidate",
					},
					{
						id: "coderabbit.coding-harness.scripts-generated-runtime-mirrors",
						provider: "coderabbit",
						source: { ...sourceRef, row: 3 },
						repository: "coding-harness",
						usage: 45,
						learning:
							"Generated runtime mirrors should be fixed at the generator.",
						targetPatterns: ["scripts/**"],
						classification: "generated_artifact",
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
					byClassification: { guardrail: 1, generated_artifact: 1 },
					byEnforcement: { error: 1, warning: 1 },
				},
			},
			null,
			2,
		),
		"utf-8",
	);
	return artifactPath;
}

function writeLedger(dir: string): string {
	const ledgerPath = join(dir, ".harness/learnings/enforcement-status.json");
	mkdirSync(join(dir, ".harness/learnings"), { recursive: true });
	writeFileSync(
		ledgerPath,
		JSON.stringify(
			{
				schemaVersion: LEARNING_ENFORCEMENT_STATUS_SCHEMA_VERSION,
				items: [
					{
						learningId:
							"coderabbit.coding-harness.docs-frontmatter-machine-readable",
						promotionStatus: "enforced",
						enforcedBy: [
							"src/lib/docs-surface/frontmatter-metadata-gate.ts",
							"src/lib/docs-surface/frontmatter-metadata-gate.test.ts",
						],
						reason:
							"High-usage frontmatter metadata learning promoted to validator.",
					},
				],
			},
			null,
			2,
		),
		"utf-8",
	);
	return ledgerPath;
}

describe("buildLearningPromotionCandidates", () => {
	it("excludes enforced learnings by default using the ledger overlay", () => {
		const dir = mkdtempSync(join(tmpdir(), "learnings-promote-"));
		const source = writeArtifact(dir);
		const enforcementStatusPath = writeLedger(dir);

		const result = buildLearningPromotionCandidates({
			source,
			enforcementStatusPath,
			minUsage: 25,
			repoRoot: dir,
		});

		expect(result.status).toBe("success");
		expect(result.summary).toMatchObject({
			total: 2,
			eligible: 1,
			excluded: 1,
			belowThreshold: 0,
			enforcedExcluded: 1,
			explicitlyDeferred: 0,
			enforced: 1,
		});
		expect(result.promotionCandidates).toHaveLength(1);
		expect(result.promotionCandidates[0]).toMatchObject({
			id: "coderabbit.coding-harness.scripts-generated-runtime-mirrors",
			promotionStatus: "candidate",
		});
	});

	it("includes enforced learnings with concrete enforcedBy paths when requested", () => {
		const dir = mkdtempSync(join(tmpdir(), "learnings-promote-"));
		const source = writeArtifact(dir);
		const enforcementStatusPath = writeLedger(dir);

		const result = buildLearningPromotionCandidates({
			source,
			enforcementStatusPath,
			minUsage: 25,
			repoRoot: dir,
			includeEnforced: true,
		});

		expect(result.status).toBe("success");
		expect(result.promotionCandidates[0]).toMatchObject({
			id: "coderabbit.coding-harness.docs-frontmatter-machine-readable",
			promotionStatus: "enforced",
			recommendedTarget: "docs-gate",
			enforcedBy: expect.arrayContaining([
				"src/lib/docs-surface/frontmatter-metadata-gate.ts",
				"src/lib/docs-surface/frontmatter-metadata-gate.test.ts",
			]),
		});
	});

	it("excludes deferred learnings from promotion even when above threshold", () => {
		const dir = mkdtempSync(join(tmpdir(), "learnings-promote-"));
		const source = writeArtifact(dir);
		const enforcementStatusPath = join(
			dir,
			".harness/learnings/enforcement-status.json",
		);
		writeFileSync(
			enforcementStatusPath,
			JSON.stringify(
				{
					schemaVersion: LEARNING_ENFORCEMENT_STATUS_SCHEMA_VERSION,
					items: [
						{
							learningId:
								"coderabbit.coding-harness.scripts-generated-runtime-mirrors",
							promotionStatus: "deferred",
							reason: "Waiting for generator ownership decision.",
						},
					],
				},
				null,
				2,
			),
			"utf-8",
		);

		const result = buildLearningPromotionCandidates({
			source,
			enforcementStatusPath,
			minUsage: 25,
			repoRoot: dir,
		});

		expect(result.status).toBe("success");
		expect(result.summary.explicitlyDeferred).toBe(1);
		expect(
			result.promotionCandidates.map((candidate) => candidate.id),
		).not.toContain(
			"coderabbit.coding-harness.scripts-generated-runtime-mirrors",
		);
	});

	it("excludes terminal promotion states from promotion candidates", () => {
		const dir = mkdtempSync(join(tmpdir(), "learnings-promote-"));
		const source = writeArtifact(dir);
		const enforcementStatusPath = join(
			dir,
			".harness/learnings/enforcement-status.json",
		);
		writeFileSync(
			enforcementStatusPath,
			JSON.stringify(
				{
					schemaVersion: LEARNING_ENFORCEMENT_STATUS_SCHEMA_VERSION,
					items: [
						{
							learningId:
								"coderabbit.coding-harness.scripts-generated-runtime-mirrors",
							promotionStatus: "rejected",
							reason: "Rejected after review.",
						},
						{
							learningId:
								"coderabbit.coding-harness.docs-frontmatter-machine-readable",
							promotionStatus: "non_goal",
							reason: "Intentionally out of scope.",
						},
					],
				},
				null,
				2,
			),
			"utf-8",
		);

		const result = buildLearningPromotionCandidates({
			source,
			enforcementStatusPath,
			minUsage: 25,
			repoRoot: dir,
		});

		expect(result.status).toBe("success");
		expect(result.promotionCandidates).toHaveLength(0);
	});

	it("rejects invalid direct minUsage values before reading artifacts", () => {
		for (const minUsage of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
			const result = buildLearningPromotionCandidates({ minUsage });

			expect(result.status).toBe("error");
			expect(result.error?.code).toBe("learnings.min_usage_invalid");
		}
	});
});
