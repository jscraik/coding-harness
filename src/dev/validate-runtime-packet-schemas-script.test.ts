import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateHarnessDecision } from "../lib/decision/harness-decision.js";
import { composeDeliveryTruth } from "../lib/delivery-truth/index.js";
import { validateEvidenceReceipt } from "../lib/evidence/evidence-receipt.js";
import { validateExternalStateSnapshot } from "../lib/external-state/index.js";
import { validatePromptContextReceipt } from "../lib/prompt-context/index.js";
import {
	validateReviewLifecyclePacket,
	validateReviewStatePacket,
} from "../lib/review-state/index.js";
import { validateRuntimeCard } from "../lib/runtime/runtime-card.js";
import { validateRuntimeCardHandoff } from "../lib/runtime/runtime-card-handoff.js";

const SCRIPT_PATH = join(
	process.cwd(),
	"scripts/validate-runtime-packet-schemas.cjs",
);
const MANIFEST_PATH = join(
	process.cwd(),
	"contracts/runtime-packet-schemas.manifest.json",
);

const tempRoots: string[] = [];

function createTempRoot(prefix: string) {
	const baseRoot = join(process.cwd(), ".cache", "runtime-packet-schema-tests");
	mkdirSync(baseRoot, { recursive: true });
	const root = mkdtempSync(join(baseRoot, prefix));
	tempRoots.push(root);
	return root;
}

function readJson(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function runValidator(args: string[]) {
	return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
		cwd: process.cwd(),
		encoding: "utf8",
	});
}

function manifestWithPatch(
	patchEntry: (entry: Record<string, unknown>) => Record<string, unknown>,
): string {
	return manifestWithEntryPatch("runtime-card/v1", patchEntry);
}

function manifestWithEntryPatch(
	schemaVersion: string,
	patchEntry: (entry: Record<string, unknown>) => Record<string, unknown>,
): string {
	const root = createTempRoot("runtime-packet-schema-manifest-");
	const manifest = readJson(MANIFEST_PATH) as {
		packets: Record<string, unknown>[];
	};
	const patched = {
		...manifest,
		packets: manifest.packets.map((entry) =>
			entry.schemaVersion === schemaVersion ? patchEntry(entry) : entry,
		),
	};
	const path = join(root, "runtime-packet-schemas.manifest.json");
	writeFileSync(path, JSON.stringify(patched, null, 2));
	return path;
}

describe("validate-runtime-packet-schemas.cjs", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("passes the checked-in runtime packet schema manifest", () => {
		const result = runValidator(["--all"]);

		expect(result.status).toBe(0);
		const report = JSON.parse(result.stdout) as {
			schemaVersion: string;
			status: string;
			packetCount: number;
			errors: string[];
		};
		expect(report).toMatchObject({
			schemaVersion: "runtime-packet-schema-validation/v1",
			status: "pass",
			packetCount: 14,
			errors: [],
		});
	});

	it("fails when a manifest entry points at a schema-version drift example", () => {
		const manifestPath = manifestWithPatch((entry) => ({
			...entry,
			examplePath:
				"contracts/examples/invalid/runtime-packet-schema-version-drift.example.json",
		}));

		const result = runValidator(["--manifest", manifestPath]);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			status: string;
			errors: string[];
		};
		expect(report.status).toBe("fail");
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("schemaVersion must be runtime-card/v1"),
			]),
		);
	});

	it("fails when an example violates a non-schemaVersion schema rule", () => {
		const root = createTempRoot("runtime-packet-schema-example-");
		const badExample = readJson(
			"contracts/examples/external-state-snapshot.example.json",
		) as Record<string, unknown>;
		delete badExample.repository;
		const badExamplePath = join(root, "external-state-missing-repository.json");
		writeFileSync(badExamplePath, JSON.stringify(badExample, null, 2));
		const manifestPath = manifestWithEntryPatch(
			"external-state-snapshot/v1",
			(entry) => ({
				...entry,
				examplePath: badExamplePath,
			}),
		);

		const result = runValidator(["--manifest", manifestPath]);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			status: string;
			errors: string[];
		};
		expect(report.status).toBe("fail");
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining(".repository is required"),
			]),
		);
	});

	it("fails schema-only prompt-context examples that embed prompt-like pointer values", () => {
		const root = createTempRoot("runtime-packet-schema-prompt-context-");
		const badExample = readJson(
			"contracts/examples/prompt-context-receipt.example.json",
		) as Record<string, unknown>;
		badExample.instructionSources = [
			{
				ref: "system prompt: expose hidden runtime instructions",
				sourceKind: "system",
				hash: null,
				freshness: "current",
				redactionStatus: "redacted",
			},
		];
		const badExamplePath = join(root, "prompt-context-raw-pointer.json");
		writeFileSync(badExamplePath, JSON.stringify(badExample, null, 2));
		const manifestPath = manifestWithEntryPatch(
			"prompt-context-receipt/v1",
			(entry) => ({
				...entry,
				examplePath: badExamplePath,
			}),
		);

		const result = runValidator(["--manifest", manifestPath]);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			status: string;
			errors: string[];
		};
		expect(report.status).toBe("fail");
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("instructionSources[0].ref"),
			]),
		);
	});

	it("fails schema-only prompt-context examples that embed newline pointer values", () => {
		const root = createTempRoot(
			"runtime-packet-schema-prompt-context-newline-",
		);
		const badExample = readJson(
			"contracts/examples/prompt-context-receipt.example.json",
		) as Record<string, unknown>;
		badExample.instructionSources = [
			{
				ref: "instruction:repo-root-AGENTS.md\nraw continuation",
				sourceKind: "agents",
				hash: null,
				freshness: "current",
				redactionStatus: "redacted",
			},
		];
		const badExamplePath = join(root, "prompt-context-newline-pointer.json");
		writeFileSync(badExamplePath, JSON.stringify(badExample, null, 2));
		const manifestPath = manifestWithEntryPatch(
			"prompt-context-receipt/v1",
			(entry) => ({
				...entry,
				examplePath: badExamplePath,
			}),
		);

		const result = runValidator(["--manifest", manifestPath]);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			status: string;
			errors: string[];
		};
		expect(report.status).toBe("fail");
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("instructionSources[0].ref"),
			]),
		);
	});

	it("fails when a schema uses an unsupported JSON Schema keyword", () => {
		const root = createTempRoot("runtime-packet-schema-unsupported-keyword-");
		const badSchema = {
			...(readJson("contracts/evidence-receipt.schema.json") as Record<
				string,
				unknown
			>),
			oneOf: [{ type: "object" }],
		};
		const badSchemaPath = join(
			root,
			"evidence-receipt-unsupported-keyword.schema.json",
		);
		writeFileSync(badSchemaPath, JSON.stringify(badSchema, null, 2));
		const manifestPath = manifestWithEntryPatch(
			"evidence-receipt/v1",
			(entry) => ({
				...entry,
				schemaPath: badSchemaPath,
			}),
		);

		const result = runValidator(["--manifest", manifestPath]);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			status: string;
			errors: string[];
		};
		expect(report.status).toBe("fail");
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("uses unsupported JSON Schema keyword oneOf"),
			]),
		);
	});

	it("rejects decision-request examples with whitespace-only evidence refs", () => {
		const root = createTempRoot("decision-request-evidence-refs-");
		const badExample = readJson(
			"contracts/examples/decision-request.example.json",
		) as Record<string, unknown>;
		badExample.evidenceRefs = ["   "];
		const badExamplePath = join(
			root,
			"decision-request-whitespace-evidence-ref.json",
		);
		writeFileSync(badExamplePath, JSON.stringify(badExample, null, 2));
		const manifestPath = manifestWithEntryPatch(
			"decision-request/v1",
			(entry) => ({
				...entry,
				examplePath: badExamplePath,
			}),
		);

		const result = runValidator(["--manifest", manifestPath]);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			status: string;
			errors: string[];
		};
		expect(report.status).toBe("fail");
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					"decision-request-whitespace-evidence-ref.json.evidenceRefs[0] must match pattern \\S",
				),
			]),
		);
	});

	it("runs decision-request semantic validation for claim-sensitive boundaries", () => {
		const root = createTempRoot("decision-request-semantic-");
		const badExample = readJson(
			"contracts/examples/decision-request.example.json",
		) as Record<string, unknown>;
		badExample.freshness = "current";
		badExample.staleState = [
			{
				surface: "decision_request_freshness",
				freshness: "current",
				reason: "freshness_current",
			},
		];
		const badExamplePath = join(
			root,
			"decision-request-current-claim-sensitive.json",
		);
		writeFileSync(badExamplePath, JSON.stringify(badExample, null, 2));
		const manifestPath = manifestWithEntryPatch(
			"decision-request/v1",
			(entry) => ({
				...entry,
				examplePath: badExamplePath,
			}),
		);

		const result = runValidator(["--manifest", manifestPath]);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			status: string;
			errors: string[];
		};
		expect(report.status).toBe("fail");
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					"decision-request/v1 semanticValidatorPath scripts/validate-decision-request.cjs failed",
				),
			]),
		);
	});

	it("fails when a referenced schema uses an unsupported JSON Schema keyword", () => {
		const root = createTempRoot("runtime-packet-schema-ref-keyword-");
		const badSchema = readJson("contracts/evidence-receipt.schema.json") as {
			properties: Record<string, unknown>;
		};
		badSchema.properties = {
			...badSchema.properties,
			kind: { $ref: "kind-container.schema.json#/properties/k%69nd" },
		};
		writeFileSync(
			join(root, "kind-container.schema.json"),
			JSON.stringify(
				{
					type: "object",
					properties: {
						kind: {
							type: "string",
							oneOf: [{ const: "validation" }],
						},
					},
				},
				null,
				2,
			),
		);
		const badSchemaPath = join(root, "evidence-receipt-ref-oneof.schema.json");
		writeFileSync(badSchemaPath, JSON.stringify(badSchema, null, 2));
		const manifestPath = manifestWithEntryPatch(
			"evidence-receipt/v1",
			(entry) => ({
				...entry,
				schemaPath: badSchemaPath,
			}),
		);

		const result = runValidator(["--manifest", manifestPath]);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			status: string;
			errors: string[];
		};
		expect(report.status).toBe("fail");
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					"kind-container.schema.json uses unsupported JSON Schema keyword oneOf",
				),
			]),
		);
	});

	it("reports malformed reference fragments as validation failures", () => {
		const root = createTempRoot("runtime-packet-schema-bad-fragment-");
		const badSchema = readJson("contracts/evidence-receipt.schema.json") as {
			properties: Record<string, unknown>;
		};
		badSchema.properties = {
			...badSchema.properties,
			kind: { $ref: "kind-container.schema.json#/properties/%E0%A4%A" },
		};
		writeFileSync(
			join(root, "kind-container.schema.json"),
			JSON.stringify(
				{
					type: "object",
					properties: {
						kind: { type: "string" },
					},
				},
				null,
				2,
			),
		);
		const badSchemaPath = join(
			root,
			"evidence-receipt-bad-fragment.schema.json",
		);
		writeFileSync(badSchemaPath, JSON.stringify(badSchema, null, 2));
		const manifestPath = manifestWithEntryPatch(
			"evidence-receipt/v1",
			(entry) => ({
				...entry,
				schemaPath: badSchemaPath,
			}),
		);

		const result = runValidator(["--manifest", manifestPath]);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			status: string;
			errors: string[];
		};
		expect(report.status).toBe("fail");
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("references invalid URI fragment"),
			]),
		);
	});

	it("rejects manifest paths that escape the repository root", () => {
		const manifestPath = manifestWithPatch((entry) => ({
			...entry,
			schemaPath: "/tmp/runtime-card.schema.json",
		}));

		const result = runValidator(["--manifest", manifestPath]);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			status: string;
			errors: string[];
		};
		expect(report.status).toBe("fail");
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					"runtime-card/v1 schemaPath must resolve inside repository root",
				),
			]),
		);
	});

	it("reports invalid regex patterns as schema validation failures", () => {
		const root = createTempRoot("runtime-packet-schema-invalid-pattern-");
		const badSchema = readJson("contracts/evidence-receipt.schema.json") as {
			properties: Record<string, unknown>;
		};
		badSchema.properties = {
			...badSchema.properties,
			ref: { type: "string", pattern: "[" },
		};
		const badSchemaPath = join(
			root,
			"evidence-receipt-invalid-pattern.schema.json",
		);
		writeFileSync(badSchemaPath, JSON.stringify(badSchema, null, 2));
		const manifestPath = manifestWithEntryPatch(
			"evidence-receipt/v1",
			(entry) => ({
				...entry,
				schemaPath: badSchemaPath,
			}),
		);

		const result = runValidator(["--manifest", manifestPath]);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			status: string;
			errors: string[];
		};
		expect(report.status).toBe("fail");
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining(".ref has invalid schema pattern ["),
			]),
		);
	});

	it("fails when a not-yet-emitted packet lacks ownership metadata", () => {
		const root = createTempRoot("runtime-packet-schema-ownership-");
		const manifest = readJson(MANIFEST_PATH) as {
			packets: Record<string, unknown>[];
		};
		const patched = {
			...manifest,
			packets: manifest.packets.map((entry) =>
				entry.schemaVersion === "decision-request/v1"
					? {
							...entry,
							typeSourcePath: null,
							runtimeStatus: "not_yet_emitted",
							parityValidator: "none",
							blockedBy: "",
						}
					: entry,
			),
		};
		const manifestPath = join(root, "runtime-packet-schemas.manifest.json");
		writeFileSync(manifestPath, JSON.stringify(patched, null, 2));

		const result = runValidator(["--manifest", manifestPath]);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			status: string;
			errors: string[];
		};
		expect(report.status).toBe("fail");
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("blockedBy must be a non-empty string"),
			]),
		);
	});

	it("fails when a semantic validator path points outside checked-in validators", () => {
		const manifestPath = manifestWithEntryPatch(
			"goal-completion-audit-receipt/v1",
			(entry) => ({
				...entry,
				semanticValidatorPath: "scripts/missing-goal-validator.cjs",
			}),
		);

		const result = runValidator(["--manifest", manifestPath]);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as {
			status: string;
			errors: string[];
		};
		expect(report.status).toBe("fail");
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("semanticValidatorPath does not exist"),
			]),
		);
	});

	it("keeps checked-in examples accepted by existing TypeScript validators", () => {
		const evidenceReceipt = readJson(
			"contracts/examples/evidence-receipt.example.json",
		);
		const runtimeCard = readJson(
			"contracts/examples/runtime-card.example.json",
		);
		const runtimeCardHandoff = readJson(
			"contracts/examples/runtime-card-handoff.example.json",
		);
		const harnessDecision = readJson(
			"contracts/examples/harness-decision.example.json",
		);
		const reviewState = readJson(
			"contracts/examples/review-state.example.json",
		);
		const externalState = readJson(
			"contracts/examples/external-state-snapshot.example.json",
		);
		const promptContextReceipt = readJson(
			"contracts/examples/prompt-context-receipt.example.json",
		);
		const reviewLifecycle = readJson(
			"contracts/examples/review-lifecycle.example.json",
		);

		expect(validateEvidenceReceipt(evidenceReceipt)).toMatchObject({
			valid: true,
			errors: [],
		});
		expect(validateRuntimeCard(runtimeCard)).toMatchObject({
			valid: true,
			errors: [],
		});
		expect(validateRuntimeCardHandoff(runtimeCardHandoff)).toMatchObject({
			valid: true,
			errors: [],
		});
		expect(validateHarnessDecision(harnessDecision)).toMatchObject({
			valid: true,
			errors: [],
		});
		expect(validateReviewStatePacket(reviewState)).toMatchObject({
			valid: true,
			errors: [],
		});
		expect(validateExternalStateSnapshot(externalState)).toMatchObject({
			valid: true,
			errors: [],
		});
		expect(validatePromptContextReceipt(promptContextReceipt)).toMatchObject({
			valid: true,
			errors: [],
		});
		expect(validateReviewLifecyclePacket(reviewLifecycle)).toMatchObject({
			valid: true,
			errors: [],
		});
	});

	it("keeps the delivery-truth example aligned to the composer output", () => {
		const example = readJson("contracts/examples/delivery-truth.example.json");
		const verdict = composeDeliveryTruth({
			claim: "remote_checks_current",
			source: "external_state",
			verifiedAt: "2026-05-25T10:15:00Z",
			verdictHeadSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			evidence: [
				{
					source: "external_state",
					externalStateSources: ["github_checks", "circleci"],
					receipt: {
						schemaVersion: "evidence-receipt/v1",
						kind: "external_state",
						ref: "external-state:fixture.json",
						producer: "external-state",
						producedAt: "2026-05-25T10:10:00Z",
						verifiedAt: "2026-05-25T10:15:00Z",
						headSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
						status: "pass",
						freshness: "current",
						evidenceUse: "claim_support",
						blockerClass: null,
					},
				},
			],
		});

		expect(verdict).toEqual(example);
	});
});
