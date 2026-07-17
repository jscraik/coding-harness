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

function readJson(path: string): Record<string, unknown> {
	return JSON.parse(readFileSync(join(repoRoot, path), "utf8")) as Record<
		string,
		unknown
	>;
}

function makeFixture(
	schemaVersion: string,
	examplePath: string,
	mutate: (example: Record<string, unknown>) => void,
): string {
	mkdirSync(join(repoRoot, ".cache"), { recursive: true });
	const root = mkdtempSync(join(repoRoot, ".cache/runtime-packet-semantic-"));
	tempRoots.push(root);
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
