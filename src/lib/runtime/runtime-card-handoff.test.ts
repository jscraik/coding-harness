import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import type { RuntimeCard } from "./runtime-card.js";
import {
	buildRuntimeCardHandoff,
	validateRuntimeCardHandoff,
} from "./runtime-card-handoff.js";
import { buildRuntimeEvidenceBundleFromCard } from "./runtime-evidence-producer.js";

function fixtureRuntimeCard(): RuntimeCard {
	return JSON.parse(
		readFileSync("contracts/examples/runtime-card.example.json", "utf8"),
	) as RuntimeCard;
}

function writeJson(repoRoot: string, path: string, value: unknown): void {
	const absolutePath = join(repoRoot, path);
	mkdirSync(dirname(absolutePath), { recursive: true });
	writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
}

describe("runtime-card-handoff/v1", () => {
	it("binds a runtime card to its produced evidence bundle", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-handoff-"));
		const runtimeCardPath = ".harness/runtime/JSC-311-card.json";
		const evidenceBundlePath = ".harness/runtime/JSC-311-evidence.json";
		const runtimeCard = fixtureRuntimeCard();
		const evidenceBundle = buildRuntimeEvidenceBundleFromCard(runtimeCard, {
			provenanceRef: `artifact:${evidenceBundlePath}`,
			generatedAt: runtimeCard.generatedAt,
		});
		writeJson(repoRoot, runtimeCardPath, runtimeCard);
		writeJson(repoRoot, evidenceBundlePath, evidenceBundle);

		const handoff = buildRuntimeCardHandoff({
			repoRoot,
			runtimeCardPath,
			evidenceBundlePath,
			runtimeCard,
			evidenceBundle,
			generatedAt: runtimeCard.generatedAt,
		});

		expect(validateRuntimeCardHandoff(handoff)).toEqual({
			valid: true,
			errors: [],
		});
		expect(handoff).toMatchObject({
			schemaVersion: "runtime-card-handoff/v1",
			evidenceUse: "orientation",
			issueKey: "JSC-311",
			headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			runtimeIdentity: {
				generatedAt: runtimeCard.generatedAt,
				provenanceRef: `artifact:${evidenceBundlePath}`,
			},
		});
		expect(handoff.runtimeCard.sha256).toMatch(/^sha256:[a-f0-9]{64}$/u);
		expect(handoff.evidenceBundle.sha256).toMatch(/^sha256:[a-f0-9]{64}$/u);
		expect(handoff.sourceRefs).toContain("git:status");
		expect(handoff.provenanceRefs).toEqual([
			`artifact:${runtimeCardPath}`,
			`artifact:${evidenceBundlePath}`,
		]);
	});

	it("rejects same-head artifacts from different runtime generations", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-handoff-"));
		const runtimeCardPath = ".harness/runtime/JSC-311-card.json";
		const evidenceBundlePath = ".harness/runtime/JSC-311-evidence.json";
		const runtimeCard = fixtureRuntimeCard();
		const evidenceBundle = {
			...buildRuntimeEvidenceBundleFromCard(runtimeCard, {
				provenanceRef: `artifact:${evidenceBundlePath}`,
				generatedAt: "2026-05-15T12:01:00.000Z",
			}),
		};
		writeJson(repoRoot, runtimeCardPath, runtimeCard);
		writeJson(repoRoot, evidenceBundlePath, evidenceBundle);

		expect(() =>
			buildRuntimeCardHandoff({
				repoRoot,
				runtimeCardPath,
				evidenceBundlePath,
				runtimeCard,
				evidenceBundle,
				generatedAt: runtimeCard.generatedAt,
			}),
		).toThrow(
			"runtime-card handoff requires runtime-card and evidence bundle generatedAt values to match",
		);
	});

	it("rejects evidence bundles whose provenance does not identify --evidence-out", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-handoff-"));
		const runtimeCardPath = ".harness/runtime/JSC-311-card.json";
		const evidenceBundlePath = ".harness/runtime/JSC-311-evidence.json";
		const runtimeCard = fixtureRuntimeCard();
		const evidenceBundle = buildRuntimeEvidenceBundleFromCard(runtimeCard, {
			provenanceRef: "artifact:.harness/runtime/other-evidence.json",
			generatedAt: runtimeCard.generatedAt,
		});
		writeJson(repoRoot, runtimeCardPath, runtimeCard);
		writeJson(repoRoot, evidenceBundlePath, evidenceBundle);

		expect(() =>
			buildRuntimeCardHandoff({
				repoRoot,
				runtimeCardPath,
				evidenceBundlePath,
				runtimeCard,
				evidenceBundle,
				generatedAt: runtimeCard.generatedAt,
			}),
		).toThrow(
			"runtime-card handoff requires evidence provenance ref to match --evidence-out",
		);
	});

	it("does not admit claim-support evidence use", () => {
		const example = JSON.parse(
			readFileSync(
				"contracts/examples/runtime-card-handoff.example.json",
				"utf8",
			),
		) as Record<string, unknown>;
		example.evidenceUse = "claim_support";

		const validation = validateRuntimeCardHandoff(example);

		expect(validation.valid).toBe(false);
		expect(validation.errors.map((error) => error.code)).toContain(
			"evidenceUse must be one of orientation, audit_trail",
		);
	});

	it("rejects artifact refs that are not repository-relative paths", () => {
		const example = JSON.parse(
			readFileSync(
				"contracts/examples/runtime-card-handoff.example.json",
				"utf8",
			),
		) as Record<string, unknown>;
		example.runtimeCard = {
			...(example.runtimeCard as Record<string, unknown>),
			path: "../outside-card.json",
		};

		const validation = validateRuntimeCardHandoff(example);

		expect(validation.valid).toBe(false);
		expect(validation.errors.map((error) => error.code)).toContain(
			"runtimeCard.path must be a repository-relative artifact path",
		);
	});

	it("rejects forged artifact schema families", () => {
		const example = JSON.parse(
			readFileSync(
				"contracts/examples/runtime-card-handoff.example.json",
				"utf8",
			),
		) as Record<string, unknown>;
		example.runtimeCard = {
			...(example.runtimeCard as Record<string, unknown>),
			schemaVersion: "review-state/v1",
		};
		example.evidenceBundle = {
			...(example.evidenceBundle as Record<string, unknown>),
			schemaVersion: "delivery-truth/v1",
		};

		const validation = validateRuntimeCardHandoff(example);

		expect(validation.valid).toBe(false);
		expect(validation.errors.map((error) => error.code)).toEqual(
			expect.arrayContaining([
				"runtimeCard.schemaVersion must be runtime-card/v1",
				"evidenceBundle.schemaVersion must be runtime-evidence-bundle/v1",
			]),
		);
	});

	it("rejects artifact head SHAs that do not match the runtime identity", () => {
		const example = JSON.parse(
			readFileSync(
				"contracts/examples/runtime-card-handoff.example.json",
				"utf8",
			),
		) as Record<string, unknown>;
		example.runtimeCard = {
			...(example.runtimeCard as Record<string, unknown>),
			headSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		};
		example.evidenceBundle = {
			...(example.evidenceBundle as Record<string, unknown>),
			headSha: "cccccccccccccccccccccccccccccccccccccccc",
		};

		const validation = validateRuntimeCardHandoff(example);

		expect(validation.valid).toBe(false);
		expect(validation.errors.map((error) => error.code)).toEqual(
			expect.arrayContaining([
				"runtimeCard.headSha must match runtimeIdentity.headSha",
				"evidenceBundle.headSha must match runtimeIdentity.headSha",
			]),
		);
	});
});
