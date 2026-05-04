import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEARNING_ENFORCEMENT_STATUS_SCHEMA_VERSION } from "./enforcement-status.js";
import { buildEvalSeedPack } from "./eval-seed.js";
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
						id: "coderabbit.coding-harness.eval-seed-generated-artifact",
						provider: "coderabbit",
						source: sourceRef,
						repository: "coding-harness",
						file: "scripts/run-harness-evals.mjs",
						usage: 41,
						learning:
							"Generated runtime mirrors should be fixed at the generator rather than patched by hand.",
						targetPatterns: ["scripts/**"],
						classification: "generated_artifact",
						enforcement: "warning",
						promotionStatus: "candidate",
					},
					{
						id: "coderabbit.coding-harness.unmatched-docs-noise",
						provider: "coderabbit",
						source: { ...sourceRef, row: 3 },
						repository: "coding-harness",
						file: "docs/unused.md",
						usage: 77,
						learning:
							"Unmatched docs noise should not become a seed for this file set.",
						classification: "guardrail",
						enforcement: "warning",
						promotionStatus: "candidate",
					},
					{
						id: "coderabbit.coding-harness.circleci-red-job-remediation",
						provider: "coderabbit",
						source: { ...sourceRef, row: 5 },
						repository: "coding-harness",
						file: "scripts/run-harness-evals.mjs",
						usage: 52,
						learning:
							"CircleCI red job remediation should be captured from the exact failing job output before merge.",
						targetPatterns: ["scripts/**"],
						classification: "validation_contract",
						enforcement: "warning",
						promotionStatus: "candidate",
					},
					{
						id: "coderabbit.coding-harness.low-signal-validation",
						provider: "coderabbit",
						source: { ...sourceRef, row: 4 },
						repository: "coding-harness",
						file: "scripts/run-harness-evals.mjs",
						usage: 2,
						learning:
							"Low-signal repetition should stay below the eval-seed threshold.",
						classification: "validation_contract",
						enforcement: "warning",
						promotionStatus: "candidate",
					},
				],
				warnings: [],
				summary: {
					totalRows: 4,
					imported: 4,
					skipped: 0,
					invalid: 0,
					warnings: 0,
					byClassification: {
						generated_artifact: 1,
						guardrail: 1,
						validation_contract: 2,
					},
					byEnforcement: { warning: 4 },
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
				items: [],
			},
			null,
			2,
		),
		"utf-8",
	);
	return ledgerPath;
}

describe("buildEvalSeedPack", () => {
	it("turns repeated matched learnings into deterministic eval-seed candidates", () => {
		const dir = mkdtempSync(join(tmpdir(), "eval-seed-pack-"));
		const source = writeArtifact(dir);
		const enforcementStatusPath = writeLedger(dir);
		const output = "artifacts/evals/eval-seed-pack.json";

		const result = buildEvalSeedPack({
			source,
			enforcementStatusPath,
			repoRoot: dir,
			files: ["scripts/run-harness-evals.mjs"],
			minUsage: 25,
			output,
			generatedAt: "2026-05-04T08:00:00.000Z",
		});

		expect(result.status).toBe("success");
		expect(result.outputPath).toBe(join(dir, output));
		expect(result.summary).toMatchObject({
			applicableLearnings: 3,
			promotionCandidates: 3,
			seedCandidates: 2,
			byRemediationSource: {
				ci: 1,
				generated_artifact: 1,
			},
			byFailureClass: {
				ci_failure: 1,
				generated_artifact_drift: 1,
			},
		});
		expect(result.candidates).toHaveLength(2);
		expect(result.candidates[0]).toMatchObject({
			id: "coderabbit.coding-harness.circleci-red-job-remediation",
			remediationSource: "ci",
			failureClass: "ci_failure",
			matchedFiles: ["scripts/run-harness-evals.mjs"],
			evidenceRef: ["coderabbit_csv:file:///tmp/learnings.csv#row=5"],
		});
		expect(result.candidates[1]).toMatchObject({
			id: "coderabbit.coding-harness.eval-seed-generated-artifact",
			recommendedTarget: "artifact-gate",
			recommendedTest: "src/lib/learnings/promote.test.ts",
			remediationSource: "generated_artifact",
			failureClass: "generated_artifact_drift",
			matchedFiles: ["scripts/run-harness-evals.mjs"],
			evidenceRef: ["coderabbit_csv:file:///tmp/learnings.csv#row=2"],
			validationCommands: expect.arrayContaining([
				"pnpm check",
				"pnpm test:deep",
			]),
		});
	});

	it("rejects invalid minUsage before reading artifacts", () => {
		const result = buildEvalSeedPack({
			files: ["scripts/run-harness-evals.mjs"],
			minUsage: -1,
		});

		expect(result.status).toBe("error");
		expect(result.error?.code).toBe("eval_seed.invalid_min_usage");
	});
});
