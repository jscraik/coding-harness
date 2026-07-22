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
import { validateActionReviewReceipt } from "../lib/action-review/index.js";
import { validateArtifactRuntimeSurface } from "../lib/artifact-runtime-surface/index.js";
import { validateSteeringApplicationReceipt } from "../lib/steering-queue/index.js";
import { validateReplayPacket } from "../lib/replay/replay-packet.js";
import { manifestWithExamplePatch } from "./runtime-packet-schema-test-helpers.js";

const SCRIPT_PATH = join(
	process.cwd(),
	"scripts/validate-runtime-packet-schemas.cjs",
);
const MANIFEST_PATH = join(
	process.cwd(),
	"contracts/runtime-packet-schemas.manifest.json",
);
const REPLAY_VALIDATOR_PATH = join(
	process.cwd(),
	"scripts/validate-replay-packet.cjs",
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

function runReplayValidator(packetPath: string) {
	return spawnSync(
		process.execPath,
		[REPLAY_VALIDATOR_PATH, packetPath, "--repo-root", process.cwd()],
		{
			cwd: process.cwd(),
			encoding: "utf8",
		},
	);
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

	it.each([
		{
			name: "a provider failure without a logical context ID",
			mutate: (failure: Record<string, unknown>) => {
				delete failure.contextId;
			},
			expected:
				"meta.synaipseContextFailures.failures[0].contextId is required",
		},
		{
			name: "a catalog failure with a logical context ID",
			mutate: (failure: Record<string, unknown>) => {
				failure.code = "missing_context_catalog";
				failure.requirement = "required";
			},
			expected:
				"meta.synaipseContextFailures.failures[0].contextId must equal schema const",
		},
		{
			name: "a catalog failure without an explicit null context ID",
			mutate: (failure: Record<string, unknown>) => {
				failure.code = "missing_context_catalog";
				failure.requirement = "required";
				failure.recovery = "admit_context_catalog";
				failure.stopCondition =
					"Stop until missing_context_catalog is resolved.";
				failure.freshness = {
					status: "unknown",
					observedAt: "2026-07-20T00:00:00Z",
				};
				delete failure.contextId;
			},
			expected:
				"meta.synaipseContextFailures.failures[0].contextId is required",
		},
		{
			name: "a failure owned by an arbitrary authority",
			mutate: (failure: Record<string, unknown>) => {
				failure.owner = "project-pm";
			},
			expected:
				"meta.synaipseContextFailures.failures[0].owner must equal schema const",
		},
		{
			name: "an optional missing-required-context failure",
			mutate: (failure: Record<string, unknown>) => {
				failure.code = "missing_required_context";
				failure.requirement = "optional";
			},
			expected:
				"meta.synaipseContextFailures.failures[0].requirement must equal schema const",
		},
		{
			name: "a stale-context failure with current freshness",
			mutate: (failure: Record<string, unknown>) => {
				failure.code = "stale_context_digest";
			},
			expected:
				"meta.synaipseContextFailures.failures[0].freshness.status must equal schema const",
		},
		{
			name: "a provider failure with stale freshness",
			mutate: (failure: Record<string, unknown>) => {
				failure.freshness = {
					status: "stale",
					observedAt: "2026-07-20T00:00:00Z",
				};
			},
			expected:
				"meta.synaipseContextFailures.failures[0].freshness.status must equal schema const",
		},
	])("rejects $name at the public JSON Schema boundary", ({
		mutate,
		expected,
	}) => {
		const manifestPath = manifestWithExamplePatch(
			createTempRoot("harness-decision-structural-"),
			"harness-decision/v1",
			(example) => {
				const meta = example.meta as Record<string, unknown>;
				const envelope = meta.synaipseContextFailures as Record<
					string,
					unknown
				>;
				const failures = envelope.failures as Record<string, unknown>[];
				mutate(failures[0] as Record<string, unknown>);
				return example;
			},
		);
		const result = runValidator(["--manifest", manifestPath]);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as { errors: string[] };
		expect(report.errors.join("\n")).toContain(expected);
	});

	it("rejects duplicate logical context identities through the declared semantic validator", () => {
		const manifestPath = manifestWithExamplePatch(
			createTempRoot("harness-decision-duplicate-"),
			"harness-decision/v1",
			(example) => {
				const meta = example.meta as Record<string, unknown>;
				const envelope = meta.synaipseContextFailures as Record<
					string,
					unknown
				>;
				const failures = envelope.failures as Record<string, unknown>[];
				const first = failures[0] as Record<string, unknown>;
				failures.push({
					...first,
					code: "context_access_denied",
					recovery: "restore_context_access",
					stopCondition: "Stop until context access is restored.",
				});
				return example;
			},
		);
		const result = runValidator(["--manifest", manifestPath]);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as { errors: string[] };
		expect(report.errors.join("\n")).toContain(
			"semanticValidatorPath scripts/validate-harness-decision-semantics.cjs",
		);
		expect(report.errors.join("\n")).toContain(
			"duplicates logical failure identity",
		);
	});

	it.each([
		{
			name: "a recovery valid in the vocabulary but wrong for the code",
			mutate: (failure: Record<string, unknown>) => {
				failure.recovery = "request_authorized_projection";
			},
			expected: "recovery must equal restore_context_provider",
		},
		{
			name: "a noncanonical stop condition",
			mutate: (failure: Record<string, unknown>) => {
				failure.stopCondition = "Stop until an operator approves.";
			},
			expected:
				"stopCondition must equal Continue with explicit context unknown until provider_unavailable is resolved.",
		},
	])("rejects $name through the declared semantic validator", ({
		mutate,
		expected,
	}) => {
		const manifestPath = manifestWithExamplePatch(
			createTempRoot("harness-decision-semantic-"),
			"harness-decision/v1",
			(example) => {
				const meta = example.meta as Record<string, unknown>;
				const envelope = meta.synaipseContextFailures as Record<
					string,
					unknown
				>;
				const failures = envelope.failures as Record<string, unknown>[];
				mutate(failures[0] as Record<string, unknown>);
				return example;
			},
		);
		const result = runValidator(["--manifest", manifestPath]);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as { errors: string[] };
		expect(report.errors.join("\n")).toContain(expected);
	});
	it("rejects harness-native ratchets that claim Codex or delivery truth", () => {
		const root = createTempRoot("agent-native-boundary-claims-");
		const packet = readJson(
			"contracts/examples/agent-native-ratchets.example.json",
		) as Record<string, unknown>;
		const ratchets = packet.ratchets as Array<Record<string, unknown>>;
		packet.ratchets = [
			{
				...ratchets[0],
				mayClaim: ["repo_orientation", "codex_context_current"],
				mustNotClaim: [
					"codex_context_current",
					"codex_session_truth",
					"connector_snapshot_current",
					"sidecar_export_current",
				],
			},
			...ratchets.slice(1),
		];
		const packetPath = join(root, "agent-native-ratchets.json");
		writeFileSync(packetPath, JSON.stringify(packet, null, 2));
		const manifestPath = manifestWithEntryPatch(
			"agent-native-ratchets/v1",
			(entry) => ({
				...entry,
				examplePath: packetPath,
			}),
		);

		const result = runValidator(["--manifest", manifestPath]);
		const report = JSON.parse(result.stdout) as { errors: string[] };

		expect(result.status).toBe(1);
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					"mustNotClaim must include cross-authority claims",
				),
				expect.stringContaining("mayClaim must not overlap mustNotClaim"),
			]),
		);
	});
	it("rejects non-harness authority in harness-native advisory packets", () => {
		const root = createTempRoot("session-distill-native-authority-");
		const packet = readJson(
			"contracts/examples/session-distill.example.json",
		) as Record<string, unknown>;
		packet.nativeAuthority = "codex";
		packet.mayClaim = ["repo_handoff_orientation", "codex_context_current"];
		packet.mustNotClaim = ["ci_passed"];
		const packetPath = join(root, "session-distill-non-harness.json");
		writeFileSync(packetPath, JSON.stringify(packet, null, 2));
		const manifestPath = manifestWithEntryPatch(
			"session-distill/v1",
			(entry) => ({
				...entry,
				examplePath: packetPath,
			}),
		);

		const result = runValidator(["--manifest", manifestPath]);
		const report = JSON.parse(result.stdout) as { errors: string[] };

		expect(result.status).toBe(1);
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("nativeAuthority must be harness"),
				expect.stringContaining(
					"mustNotClaim must include cross-authority claims",
				),
			]),
		);
	});
	it("rejects top-level packet sourceKind values that contradict the packet kind", () => {
		const root = createTempRoot("session-distill-source-kind-");
		const packet = readJson(
			"contracts/examples/session-distill.example.json",
		) as Record<string, unknown>;
		packet.sourceKind = "repo_artifact";
		const packetPath = join(root, "session-distill-wrong-source-kind.json");
		writeFileSync(packetPath, JSON.stringify(packet, null, 2));
		const manifestPath = manifestWithEntryPatch(
			"session-distill/v1",
			(entry) => ({
				...entry,
				examplePath: packetPath,
			}),
		);

		const result = runValidator(["--manifest", manifestPath]);
		const report = JSON.parse(result.stdout) as { errors: string[] };

		expect(result.status).toBe(1);
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("sourceKind must equal schema const"),
				expect.stringContaining("sourceKind must be repo_worktree"),
			]),
		);
	});
	it("rejects ratchet sourceKind values that contradict the ratchet id", () => {
		const root = createTempRoot("agent-native-ratchet-source-kind-");
		const packet = readJson(
			"contracts/examples/agent-native-ratchets.example.json",
		) as Record<string, unknown>;
		const ratchets = packet.ratchets as Array<Record<string, unknown>>;
		packet.ratchets = [
			{
				...ratchets[0],
				sourceKind: "repo_artifact",
			},
			...ratchets.slice(1),
		];
		const packetPath = join(root, "agent-native-ratchet-source-kind.json");
		writeFileSync(packetPath, JSON.stringify(packet, null, 2));
		const manifestPath = manifestWithEntryPatch(
			"agent-native-ratchets/v1",
			(entry) => ({
				...entry,
				examplePath: packetPath,
			}),
		);

		const result = runValidator(["--manifest", manifestPath]);
		const report = JSON.parse(result.stdout) as { errors: string[] };

		expect(result.status).toBe(1);
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("ratchets[0].sourceKind must be repo_contract"),
			]),
		);
	});
	it("rejects unknown agent-native claim tokens at the schema boundary", () => {
		const root = createTempRoot("agent-native-unknown-claim-");
		const packet = readJson(
			"contracts/examples/agent-native-ratchets.example.json",
		) as Record<string, unknown>;
		const ratchets = packet.ratchets as Array<Record<string, unknown>>;
		packet.ratchets = [
			{
				...ratchets[0],
				mayClaim: ["repo_orientation", "review_resolved"],
			},
			...ratchets.slice(1),
		];
		const packetPath = join(root, "agent-native-unknown-claim.json");
		writeFileSync(packetPath, JSON.stringify(packet, null, 2));
		const manifestPath = manifestWithEntryPatch(
			"agent-native-ratchets/v1",
			(entry) => ({
				...entry,
				examplePath: packetPath,
			}),
		);

		const result = runValidator(["--manifest", manifestPath]);
		const report = JSON.parse(result.stdout) as { errors: string[] };

		expect(result.status).toBe(1);
		expect(report.errors.join("\n")).toContain(
			"mayClaim[1] must be one of schema enum values",
		);
	});
	it("keeps ReplayPacket/v1 examples aligned with the TypeScript validator", () => {
		const packet = readJson("contracts/examples/replay-packet.example.json");

		expect(validateReplayPacket(packet, { repoRoot: process.cwd() })).toEqual({
			status: "pass",
			errors: [],
		});
	});
	it("keeps ReplayPacket/v1 semantic validators aligned on replay kind failures", () => {
		const root = createTempRoot("replay-packet-invalid-kind-");
		const packet = {
			...(readJson("contracts/examples/replay-packet.example.json") as Record<
				string,
				unknown
			>),
			replayKind: "session_replay_seed_typo",
		};
		const packetPath = join(root, "packet.json");
		writeFileSync(packetPath, JSON.stringify(packet, null, 2));

		expect(
			validateReplayPacket(packet, { repoRoot: process.cwd() }),
		).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([expect.stringContaining("replayKind")]),
		});
		const scriptResult = runReplayValidator(packetPath);
		expect(scriptResult.status).toBe(1);
		expect(scriptResult.stdout).toContain("replayKind");
	});
	it("keeps ReplayPacket/v1 schema validation aligned on hook provenance ref kinds", () => {
		const root = createTempRoot("replay-packet-invalid-hook-ref-kind-");
		const packet = readJson(
			"contracts/examples/replay-packet.example.json",
		) as Record<string, unknown>;
		const hookProvenance = packet.hookProvenance as Array<
			Record<string, unknown>
		>;
		const hook = hookProvenance[0] as Record<string, unknown>;
		packet.hookProvenance = [
			{
				...hook,
				hookRef: {
					...(hook.hookRef as Record<string, unknown>),
					refKind: "repo_file",
				},
				inputRef: {
					...(hook.inputRef as Record<string, unknown>),
					refKind: "hook_output",
				},
			},
		];
		const packetPath = join(root, "packet.json");
		writeFileSync(packetPath, JSON.stringify(packet, null, 2));
		const manifestPath = manifestWithEntryPatch("replay-packet/v1", (entry) => {
			const { semanticValidatorPath: _semanticValidatorPath, ...rest } = entry;
			return {
				...rest,
				examplePath: packetPath,
			};
		});

		const result = runValidator(["--manifest", manifestPath]);
		const report = JSON.parse(result.stdout) as { errors: string[] };

		expect(result.status).toBe(1);
		expect(report.errors).toEqual(
			expect.arrayContaining([
				expect.stringContaining("hookProvenance[0].hookRef.refKind"),
				expect.stringContaining("hookProvenance[0].inputRef.refKind"),
			]),
		);
	});
	it("keeps ReplayPacket/v1 semantic validators aligned on produced artifact ref kinds", () => {
		const root = createTempRoot("replay-packet-invalid-produced-artifact-ref-");
		const packet = readJson(
			"contracts/examples/replay-packet.example.json",
		) as Record<string, unknown>;
		const hookProvenance = packet.hookProvenance as Array<
			Record<string, unknown>
		>;
		const hook = hookProvenance[0] as Record<string, unknown>;
		const producedArtifactRefs = hook.producedArtifactRefs as Array<
			Record<string, unknown>
		>;
		packet.hookProvenance = [
			{
				...hook,
				producedArtifactRefs: [
					{
						...producedArtifactRefs[0],
						refKind: "repo_file",
					},
				],
			},
		];
		const packetPath = join(root, "packet.json");
		writeFileSync(packetPath, JSON.stringify(packet, null, 2));

		expect(
			validateReplayPacket(packet, { repoRoot: process.cwd() }),
		).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([
				expect.stringContaining(
					"hookProvenance[0].producedArtifactRefs[0].refKind",
				),
			]),
		});
		const scriptResult = runReplayValidator(packetPath);
		expect(scriptResult.status).toBe(1);
		expect(scriptResult.stdout).toContain(
			"hookProvenance[0].producedArtifactRefs[0].refKind",
		);
	});
	it("keeps ReplayPacket/v1 semantic validators aligned on stale orientation contradictions", () => {
		const root = createTempRoot("replay-packet-stale-orientation-");
		const packet = {
			...(readJson("contracts/examples/replay-packet.example.json") as Record<
				string,
				unknown
			>),
			evidenceUse: "orientation",
			freshness: "stale",
			staleState: [
				{
					surface: "replay:fixture",
					freshness: "stale",
					reason: "orientation contradiction fixture",
				},
			],
		};
		const packetPath = join(root, "packet.json");
		writeFileSync(packetPath, JSON.stringify(packet, null, 2));

		expect(
			validateReplayPacket(packet, { repoRoot: process.cwd() }),
		).toMatchObject({
			status: "fail",
			errors: expect.arrayContaining([
				expect.stringContaining("freshness: orientation requires current"),
				expect.stringContaining(
					"orientation packets must not carry stale state",
				),
			]),
		});
		const scriptResult = runReplayValidator(packetPath);
		expect(scriptResult.status).toBe(1);
		expect(scriptResult.stdout).toContain(
			"freshness: orientation requires current",
		);
		expect(scriptResult.stdout).toContain(
			"orientation packets must not carry stale state",
		);
	});

	it("keeps ArtifactRuntimeSurface/v1 examples aligned with the TypeScript validator", () => {
		const packet = readJson(
			"contracts/examples/artifact-runtime-surface.example.json",
		);

		expect(validateArtifactRuntimeSurface(packet)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("keeps ActionReviewReceipt/v1 examples aligned with the TypeScript validator", () => {
		const packet = readJson(
			"contracts/examples/action-review-receipt.example.json",
		);

		expect(validateActionReviewReceipt(packet)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("keeps SteeringApplicationReceipt/v1 examples aligned with the TypeScript validator", () => {
		const packet = readJson(
			"contracts/examples/steering-application-receipt.example.json",
		);

		expect(validateSteeringApplicationReceipt(packet)).toEqual({
			valid: true,
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

	it("fails agent-native ratchet examples with inconsistent aggregate status", () => {
		const root = createTempRoot("agent-native-ratchets-status-");
		const badExample = readJson(
			"contracts/examples/agent-native-ratchets.example.json",
		) as Record<string, unknown>;
		const ratchets = badExample.ratchets as Array<Record<string, unknown>>;
		badExample.ratchets = [
			{
				...ratchets[0],
				status: "needs_attention",
			},
			...ratchets.slice(1),
		];
		badExample.status = "pass";
		const badExamplePath = join(root, "agent-native-ratchets-status.json");
		writeFileSync(badExamplePath, JSON.stringify(badExample, null, 2));
		const manifestPath = manifestWithEntryPatch(
			"agent-native-ratchets/v1",
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
					"status must be needs_attention when derived from ratchets[].status",
				),
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

	it.each([
		"if",
		"then",
		"contains",
	])("fails when an unsupported keyword is nested under %s", (branch) => {
		const badSchema = {
			...(readJson("contracts/evidence-receipt.schema.json") as Record<
				string,
				unknown
			>),
			[branch]: { oneOf: [{ type: "object" }] },
		};
		const badSchemaPath = join(
			createTempRoot(`runtime-packet-schema-nested-${branch}-keyword-`),
			`evidence-receipt-nested-${branch}-keyword.schema.json`,
		);
		writeFileSync(badSchemaPath, JSON.stringify(badSchema, null, 2));
		const result = runValidator([
			"--manifest",
			manifestWithEntryPatch("evidence-receipt/v1", (entry) => ({
				...entry,
				schemaPath: badSchemaPath,
			})),
		]);
		expect(result.status).toBe(1);
		expect(JSON.parse(result.stdout)).toMatchObject({
			errors: [
				expect.stringContaining(
					`.${branch} uses unsupported JSON Schema keyword oneOf`,
				),
			],
		});
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

	it("rejects date-time examples without an RFC3339 timezone", () => {
		const root = createTempRoot("runtime-packet-schema-date-time-");
		const badExample = readJson(
			"contracts/examples/action-review-receipt.example.json",
		) as Record<string, unknown>;
		badExample.generatedAt = "2026-05-27";
		const badExamplePath = join(
			root,
			"action-review-date-only-generated-at.json",
		);
		writeFileSync(badExamplePath, JSON.stringify(badExample, null, 2));
		const manifestPath = manifestWithEntryPatch(
			"action-review-receipt/v1",
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
					"action-review-date-only-generated-at.json.generatedAt must be an RFC3339 date-time string",
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
});
