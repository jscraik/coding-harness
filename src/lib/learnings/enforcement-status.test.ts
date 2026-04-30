import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	LEARNING_ENFORCEMENT_STATUS_SCHEMA_VERSION,
	applyLearningEnforcementStatus,
	loadLearningEnforcementStatusLedger,
	writeLearningEnforcementStatusLedger,
} from "./enforcement-status.js";
import type { LearningItem } from "./types.js";

const learningItem: LearningItem = {
	id: "coderabbit.coding-harness.docs-frontmatter-machine-readable",
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
	learning: "YAML frontmatter fields are machine-readable metadata.",
	classification: "guardrail",
	enforcement: "error",
	promotionStatus: "candidate",
};

describe("learning enforcement-status ledger", () => {
	const cleanup: string[] = [];

	afterEach(() => {
		for (const path of cleanup.splice(0)) {
			rmSync(path, { recursive: true, force: true });
		}
	});

	it("loads a missing ledger as an empty non-blocking overlay", () => {
		const dir = mkdtempSync(join(tmpdir(), "learning-status-missing-"));
		cleanup.push(dir);

		const result = loadLearningEnforcementStatusLedger(
			".harness/learnings/enforcement-status.json",
			dir,
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.ledger).toEqual({
				schemaVersion: LEARNING_ENFORCEMENT_STATUS_SCHEMA_VERSION,
				items: [],
			});
			expect(result.fingerprint).toBe("");
		}
	});

	it("rejects unknown fields instead of preserving extension data", () => {
		const dir = mkdtempSync(join(tmpdir(), "learning-status-invalid-"));
		cleanup.push(dir);
		const ledgerPath = join(dir, ".harness/learnings/enforcement-status.json");
		mkdirSync(join(dir, ".harness/learnings"), { recursive: true });
		writeFileSync(
			ledgerPath,
			JSON.stringify({
				schemaVersion: LEARNING_ENFORCEMENT_STATUS_SCHEMA_VERSION,
				unknown: true,
				items: [],
			}),
			"utf-8",
		);

		const result = loadLearningEnforcementStatusLedger(
			".harness/learnings/enforcement-status.json",
			dir,
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.code).toBe("learnings.enforcement_status.invalid");
			expect(result.message).toContain("Unknown");
		}
	});

	it("merges ledger status and enforced paths onto imported learning items", () => {
		const result = applyLearningEnforcementStatus([learningItem], {
			schemaVersion: LEARNING_ENFORCEMENT_STATUS_SCHEMA_VERSION,
			items: [
				{
					learningId: learningItem.id,
					promotionStatus: "enforced",
					enforcedBy: [
						"src/lib/docs-surface/frontmatter-metadata-gate.test.ts",
						"src/lib/docs-surface/frontmatter-metadata-gate.ts",
					],
					reason: "Promoted to validator.",
				},
			],
		});

		expect(result[0]).toMatchObject({
			promotionStatus: "enforced",
			enforcedBy: [
				"src/lib/docs-surface/frontmatter-metadata-gate.test.ts",
				"src/lib/docs-surface/frontmatter-metadata-gate.ts",
			],
		});
	});

	it("writes atomically and rejects stale writes", () => {
		const dir = mkdtempSync(join(tmpdir(), "learning-status-write-"));
		cleanup.push(dir);
		const firstWrite = writeLearningEnforcementStatusLedger({
			repoRoot: dir,
			ledger: {
				schemaVersion: LEARNING_ENFORCEMENT_STATUS_SCHEMA_VERSION,
				items: [
					{
						learningId: learningItem.id,
						promotionStatus: "candidate",
					},
				],
			},
		});
		expect(firstWrite.ok).toBe(true);
		if (!firstWrite.ok) return;
		const ledgerPath = join(dir, ".harness/learnings/enforcement-status.json");
		expect(readFileSync(ledgerPath, "utf-8")).toContain(learningItem.id);
		writeFileSync(
			ledgerPath,
			JSON.stringify({
				schemaVersion: LEARNING_ENFORCEMENT_STATUS_SCHEMA_VERSION,
				items: [],
			}),
			"utf-8",
		);

		const staleWrite = writeLearningEnforcementStatusLedger({
			repoRoot: dir,
			expectedFingerprint: firstWrite.fingerprint,
			ledger: {
				schemaVersion: LEARNING_ENFORCEMENT_STATUS_SCHEMA_VERSION,
				items: [
					{
						learningId: learningItem.id,
						promotionStatus: "enforced",
						enforcedBy: ["src/lib/learnings/enforcement-status.test.ts"],
					},
				],
			},
		});

		expect(staleWrite.ok).toBe(false);
		if (!staleWrite.ok) {
			expect(staleWrite.code).toBe("learnings.enforcement_status.stale_write");
		}
	});

	it("returns a structured error when the ledger cannot be read", () => {
		const dir = mkdtempSync(join(tmpdir(), "learning-status-unreadable-"));
		cleanup.push(dir);
		mkdirSync(join(dir, ".harness/learnings/enforcement-status.json"), {
			recursive: true,
		});

		const result = loadLearningEnforcementStatusLedger(
			".harness/learnings/enforcement-status.json",
			dir,
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.code).toBe("learnings.enforcement_status.read_failed");
		}
	});
});
