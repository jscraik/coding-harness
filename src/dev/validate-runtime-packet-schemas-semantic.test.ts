import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { validatePacketSource } from "../lib/synaipse/packet-consolidation.js";

const repoRoot = process.cwd();
const validatorPath = join(
	repoRoot,
	"scripts/validate-runtime-packet-schemas.cjs",
);
const tempRoots: string[] = [];
const FULL_ENVELOPE_COMPACT_FIELD_CASES = [
	["producer", "next"],
	["phase", "orient"],
	["cockpitLane", "orient"],
	["objective", "Complete the next task."],
	["requiredEvidence", []],
	["stopConditions", []],
	["humanEscalation", null],
	["followUpCommands", []],
	["hiddenPlumbing", []],
	["safeToRun", true],
	["requiresHuman", false],
	["requiresNetwork", false],
	["writesFiles", false],
	["evidenceRef", ["git status --short"]],
	["failureClass", null],
	["retry", "safe"],
	["riskTier", "low"],
	["meta", {}],
] as const;

function readJson(path: string): Record<string, unknown> {
	return JSON.parse(readFileSync(join(repoRoot, path), "utf8")) as Record<
		string,
		unknown
	>;
}

function createTempRoot(prefix: string): string {
	mkdirSync(join(repoRoot, ".cache"), { recursive: true });
	const root = mkdtempSync(join(repoRoot, `.cache/${prefix}`));
	tempRoots.push(root);
	return root;
}

function makeFixture(
	schemaVersion: string,
	examplePath: string,
	mutate: (example: Record<string, unknown>) => void,
): string {
	const root = createTempRoot("runtime-packet-semantic-");
	const example = readJson(examplePath);
	mutate(example);
	const fixturePath = join(root, "invalid.example.json");
	writeFileSync(fixturePath, JSON.stringify(example, null, 2));
	const manifest = readJson(
		"contracts/runtime-packet-schemas.manifest.json",
	) as {
		packets: Record<string, unknown>[];
	};
	const patched = {
		...manifest,
		packets: manifest.packets.map((entry) =>
			entry.schemaVersion === schemaVersion
				? { ...entry, examplePath: fixturePath }
				: entry,
		),
	};
	const patchedManifestPath = join(root, "manifest.json");
	writeFileSync(patchedManifestPath, JSON.stringify(patched, null, 2));
	return patchedManifestPath;
}

function runValidator(manifest: string) {
	return spawnSync(process.execPath, [validatorPath, "--manifest", manifest], {
		cwd: repoRoot,
		encoding: "utf8",
	});
}

function compactHarnessDecision(
	example: Record<string, unknown>,
): Record<string, unknown> {
	for (const [field] of FULL_ENVELOPE_COMPACT_FIELD_CASES) {
		delete example[field];
	}
	return {
		...example,
		warnings: [],
		executionBoundary: {
			safeToRun: true,
			requiresHuman: false,
			requiresNetwork: false,
			writesFiles: false,
		},
		claimsBoundary: "Local routing only.",
	};
}

/** Mutate evidence references only after proving the canonical fixture boundary. */
function setValidatedReviewerEvidenceRefs(
	packet: Record<string, unknown>,
	evidenceRefs: string[],
): void {
	const validation = validatePacketSource("reviewer-decision/v1", packet);
	if (!validation.valid) {
		throw new TypeError(
			`Invalid reviewer-decision fixture: ${validation.errors.join("; ")}`,
		);
	}
	const receipt = Reflect.get(packet, "coverageReceipt");
	if (
		typeof receipt !== "object" ||
		receipt === null ||
		Array.isArray(receipt)
	) {
		throw new TypeError(
			"Reviewer-decision fixture requires a coverage receipt",
		);
	}
	Reflect.set(receipt, "evidenceRefs", evidenceRefs);
}

describe("validate-runtime-packet-schemas semantic branches", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0))
			rmSync(root, { recursive: true, force: true });
	});

	it("rejects an invalid if/then conditional example", () => {
		const result = runValidator(
			makeFixture(
				"synaipse-transition/v1",
				"contracts/examples/synaipse-transition.example.json",
				(example) => {
					example.vitalDecision = { required: true, question: null };
				},
			),
		);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain(
			"vitalDecision.question must be type string",
		);
	});

	it("enforces supported not schemas for public packet examples", () => {
		const root = createTempRoot("runtime-packet-schema-not-");
		const schema = {
			...readJson("contracts/evidence-receipt.schema.json"),
			not: { required: ["schemaVersion"] },
		};
		const schemaPath = join(root, "evidence-receipt-not.schema.json");
		writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
		const manifest = readJson(
			"contracts/runtime-packet-schemas.manifest.json",
		) as { packets: Record<string, unknown>[] };
		const manifestPath = join(root, "manifest.json");
		writeFileSync(
			manifestPath,
			JSON.stringify(
				{
					...manifest,
					packets: manifest.packets.map((entry) =>
						entry.schemaVersion === "evidence-receipt/v1"
							? { ...entry, schemaPath }
							: entry,
					),
				},
				null,
				2,
			),
		);

		const result = runValidator(manifestPath);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("must not match schema");
	});

	it("accepts a compact projection at the harness-decision schema boundary", () => {
		const result = runValidator(
			makeFixture(
				"harness-decision/v1",
				"contracts/examples/harness-decision.example.json",
				(example) => Object.assign(example, compactHarnessDecision(example)),
			),
		);
		expect(result.status).toBe(0);
	});

	it.each(
		FULL_ENVELOPE_COMPACT_FIELD_CASES,
	)("rejects compact projections with full-envelope field %s", (field, value) => {
		const result = runValidator(
			makeFixture(
				"harness-decision/v1",
				"contracts/examples/harness-decision.example.json",
				(example) => {
					Object.assign(example, compactHarnessDecision(example));
					example[field] = value;
				},
			),
		);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("must match at least one anyOf schema");
	});

	it.each([
		["a command is not safe", "harness check --json", false],
		["a missing command is safe", null, true],
	] as const)("rejects compact projections when %s", (_label, nextCommand, safeToRun) => {
		const result = runValidator(
			makeFixture(
				"harness-decision/v1",
				"contracts/examples/harness-decision.example.json",
				(example) => {
					const compact = compactHarnessDecision(example);
					const executionBoundary = compact.executionBoundary as Record<
						string,
						unknown
					>;
					Object.assign(example, compact, {
						nextCommand,
						executionBoundary: {
							...executionBoundary,
							safeToRun,
						},
					});
				},
			),
		);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("must match at least one anyOf schema");
	});

	it("rejects whitespace-only compact next commands at the schema boundary", () => {
		const result = runValidator(
			makeFixture(
				"harness-decision/v1",
				"contracts/examples/harness-decision.example.json",
				(example) => {
					Object.assign(example, compactHarnessDecision(example), {
						nextCommand: "   ",
					});
				},
			),
		);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("must match pattern \\\\S");
	});

	it("rejects whitespace-only compact claims boundaries at the schema boundary", () => {
		const result = runValidator(
			makeFixture(
				"harness-decision/v1",
				"contracts/examples/harness-decision.example.json",
				(example) => {
					Object.assign(example, compactHarnessDecision(example), {
						claimsBoundary: "   ",
					});
				},
			),
		);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("must match pattern \\\\S");
	});

	it("rejects whitespace-only compact warnings at the schema boundary", () => {
		const result = runValidator(
			makeFixture(
				"harness-decision/v1",
				"contracts/examples/harness-decision.example.json",
				(example) => {
					Object.assign(example, compactHarnessDecision(example), {
						warnings: ["   "],
					});
				},
			),
		);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("must match pattern \\\\S");
	});

	it.each([
		["warnings", []],
		[
			"executionBoundary",
			{
				safeToRun: true,
				requiresHuman: false,
				requiresNetwork: false,
				writesFiles: false,
			},
		],
		["claimsBoundary", "Local routing only."],
	] as const)("rejects full envelopes with compact-only field %s", (field, value) => {
		const result = runValidator(
			makeFixture(
				"harness-decision/v1",
				"contracts/examples/harness-decision.example.json",
				(example) => {
					example[field] = value;
				},
			),
		);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("must match at least one anyOf schema");
	});

	it("requires reviewer coverage evidence for a passing decision", () => {
		const result = runValidator(
			makeFixture(
				"reviewer-decision/v1",
				"contracts/examples/reviewer-decision.example.json",
				(example) => {
					example.status = "pass";
					example.decision = "accept";
					example.outcomes = ["accept"];
					delete example.coverageReceipt;
				},
			),
		);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("must match at least one anyOf schema");
	});

	it.each([
		["an empty list", []],
		["an empty item", [""]],
		["a whitespace-only item", ["   "]],
	] as const)("rejects %s in passing reviewer evidence references", (_label, evidenceRefs) => {
		const result = runValidator(
			makeFixture(
				"reviewer-decision/v1",
				"contracts/examples/reviewer-decision.example.json",
				(example) => {
					example.status = "pass";
					example.decision = "accept";
					example.outcomes = ["accept"];
					setValidatedReviewerEvidenceRefs(example, [...evidenceRefs]);
				},
			),
		);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain(
			evidenceRefs.length === 0
				? "must match at least one anyOf schema"
				: "must match pattern \\\\S",
		);
	});

	it("rejects contradictory current-SHA evidence through the manifest", () => {
		const result = runValidator(
			makeFixture(
				"synaipse-transition/v1",
				"contracts/examples/synaipse-transition.example.json",
				(example) => {
					example.repositorySha = "different-repository-sha";
				},
			),
		);
		expect(result.status).toBe(1);
		const output = JSON.parse(result.stdout) as { errors: string[] };
		expect(output.errors).toContainEqual(
			expect.stringContaining(
				'"path":"repositorySha","message":"must match evidence.currentSha"',
			),
		);
	});

	it.each([
		[
			"evidence refs",
			(example: Record<string, unknown>) => {
				const evidence = example.evidence as Record<string, unknown>;
				evidence.refs = ["   "];
			},
		],
		[
			"recovery evidence refs",
			(example: Record<string, unknown>) => {
				example.recovery = {
					fromBlocker: "stale_sha",
					refreshedSha: example.repositorySha,
					evidenceRefs: ["   "],
				};
			},
		],
	])("rejects blank %s at the schema boundary", (_label, mutate) => {
		const result = runValidator(
			makeFixture(
				"synaipse-transition/v1",
				"contracts/examples/synaipse-transition.example.json",
				mutate,
			),
		);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("must match pattern \\\\S");
	});

	it("rejects an invalid contains example and normalized date", () => {
		const result = runValidator(
			makeFixture(
				"synaipse-improvement-case/v1",
				"contracts/examples/synaipse-improvement-case.example.json",
				(example) => {
					example.observedAt = "2026-02-30T12:00:00Z";
					example.candidates = [
						{
							mechanism: "validator",
							disposition: "rejected",
							rationale: "no",
						},
					];
				},
			),
		);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain(
			"observedAt must be an RFC3339 date-time string",
		);
		expect(result.stdout).toContain(
			"candidates must contain at least 1 matching items",
		);
	});

	it("rejects blank sibling inventory entries at the schema boundary", () => {
		const result = runValidator(
			makeFixture(
				"synaipse-improvement-case/v1",
				"contracts/examples/synaipse-improvement-case.example.json",
				(example) => {
					example.siblingInventory = ["   "];
				},
			),
		);
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("must match pattern \\\\S");
	});
});
