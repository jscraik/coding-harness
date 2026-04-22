import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	AGENT_RUN_EVENT_SCHEMA_VERSION,
	AGENT_RUN_MANIFEST_SCHEMA_VERSION,
	type AgentRunEvent,
	type AgentRunManifest,
	CANONICAL_EVENTS_FILE,
	CANONICAL_MANIFEST_FILE,
	LEGACY_EVENTS_FILE,
	LEGACY_MANIFEST_FILE,
	RunRecordError,
	appendCanonicalEvent,
	computeEventHash,
	loadRunRecordBundle,
	resolveRunRecordPaths,
	writeCanonicalManifest,
} from "./run-records.js";

describe("run-records", () => {
	const testRoot = join(process.cwd(), "artifacts/test/run-records");

	beforeEach(() => {
		rmSync(testRoot, { recursive: true, force: true });
		mkdirSync(testRoot, { recursive: true });
	});

	afterEach(() => {
		rmSync(testRoot, { recursive: true, force: true });
	});

	function makeManifest(runId: string): AgentRunManifest {
		return {
			schemaVersion: AGENT_RUN_MANIFEST_SCHEMA_VERSION,
			runId,
			command: "pilot-evaluate",
			startedAt: "2026-03-09T10:00:00.000Z",
			finishedAt: "2026-03-09T10:00:01.000Z",
			durationMs: 1000,
			repo: {
				repository: "jscraik/coding-harness",
				branch: "codex/test-cp1",
				headSha: "a".repeat(40),
			},
			contract: {
				path: "harness.contract.json",
				hash: "b".repeat(64),
			},
			policyContext: {
				mode: "manual",
				safetyPosture: "strict",
				effectivePolicySource: "process-policy",
			},
			outcome: "success",
			exit: {
				code: 0,
				classification: "ok",
			},
			artifactRefs: [
				{
					type: "result",
					path: "artifacts/pilot/result.json",
					checksum: "c".repeat(64),
				},
			],
			preconditions: {
				authz: "passed",
				workspaceClean: true,
			},
			provenance: {
				repoContractHash: "d".repeat(64),
				processPolicyHash: "e".repeat(64),
			},
		};
	}

	function makeEvent(runId: string, eventId: string): AgentRunEvent {
		return {
			schemaVersion: AGENT_RUN_EVENT_SCHEMA_VERSION,
			runId,
			eventId,
			timestamp: "2026-03-09T10:00:00.000Z",
			eventType: "phase",
			status: "started",
			severity: "info",
			payload: {
				phase: "preflight",
			},
		};
	}

	it("writes canonical manifest and event stream, then loads bundle", () => {
		const runId = "run-cp1-happy";
		const manifest = makeManifest(runId);
		const firstEvent = makeEvent(runId, "evt-1");
		const secondEvent = {
			...makeEvent(runId, "evt-2"),
			status: "completed" as const,
			payload: { phase: "complete" },
		};

		const writtenManifest = writeCanonicalManifest({
			manifest,
			baseDir: testRoot,
		});
		expect(writtenManifest.checksum).toHaveLength(64);

		const firstAppend = appendCanonicalEvent({
			event: firstEvent,
			baseDir: testRoot,
		});
		expect(firstAppend.eventHash).toHaveLength(64);

		const secondAppend = appendCanonicalEvent({
			event: secondEvent,
			baseDir: testRoot,
		});
		expect(secondAppend.eventHash).toHaveLength(64);

		const bundle = loadRunRecordBundle({
			runId,
			baseDir: testRoot,
		});

		expect(bundle.manifest.runId).toBe(runId);
		expect(bundle.events).toHaveLength(2);
		expect(bundle.source.usedLegacyManifest).toBe(false);
		expect(bundle.source.usedLegacyEvents).toBe(false);
		expect(bundle.source.manifestPath.endsWith(CANONICAL_MANIFEST_FILE)).toBe(
			true,
		);
		expect(bundle.source.eventsPath.endsWith(CANONICAL_EVENTS_FILE)).toBe(true);
		expect(bundle.events[1]?.prevEventHash).toBe(bundle.events[0]?.eventHash);
	});

	it("prefers canonical files over legacy when both exist", () => {
		const runId = "run-cp1-discovery";
		const paths = resolveRunRecordPaths({ runId, baseDir: testRoot });
		mkdirSync(paths.runDir, { recursive: true });

		const canonicalManifest = makeManifest(runId);
		const legacyManifest = {
			...makeManifest(runId),
			command: "legacy-command",
		};

		writeFileSync(
			paths.manifestPath,
			JSON.stringify(canonicalManifest, null, 2),
			"utf-8",
		);
		writeFileSync(
			paths.legacyManifestPath,
			JSON.stringify(legacyManifest, null, 2),
			"utf-8",
		);

		const canonicalEvent = makeEvent(runId, "evt-canonical");
		const canonicalEventWithHash = {
			...canonicalEvent,
			eventHash: computeEventHash(canonicalEvent),
		};
		const legacyEvent = makeEvent(runId, "evt-legacy");
		const legacyEventWithHash = {
			...legacyEvent,
			eventHash: computeEventHash(legacyEvent),
		};

		writeFileSync(
			paths.eventsPath,
			`${JSON.stringify(canonicalEventWithHash)}\n`,
			"utf-8",
		);
		writeFileSync(
			paths.legacyEventsPath,
			`${JSON.stringify(legacyEventWithHash)}\n`,
			"utf-8",
		);

		const bundle = loadRunRecordBundle({ runId, baseDir: testRoot });

		expect(bundle.manifest.command).toBe("pilot-evaluate");
		expect(bundle.events[0]?.eventId).toBe("evt-canonical");
		expect(bundle.source.manifestPath.endsWith(CANONICAL_MANIFEST_FILE)).toBe(
			true,
		);
		expect(bundle.source.eventsPath.endsWith(CANONICAL_EVENTS_FILE)).toBe(true);
	});

	it("falls back to legacy files when canonical files are absent", () => {
		const runId = "run-cp1-legacy-fallback";
		const paths = resolveRunRecordPaths({ runId, baseDir: testRoot });
		mkdirSync(paths.runDir, { recursive: true });

		const manifest = makeManifest(runId);
		writeFileSync(
			paths.legacyManifestPath,
			JSON.stringify(manifest, null, 2),
			"utf-8",
		);

		const event = makeEvent(runId, "evt-legacy-only");
		const eventWithHash = { ...event, eventHash: computeEventHash(event) };
		writeFileSync(
			paths.legacyEventsPath,
			`${JSON.stringify(eventWithHash)}\n`,
			"utf-8",
		);

		const bundle = loadRunRecordBundle({ runId, baseDir: testRoot });
		expect(bundle.source.usedLegacyManifest).toBe(true);
		expect(bundle.source.usedLegacyEvents).toBe(true);
		expect(bundle.source.manifestPath.endsWith(LEGACY_MANIFEST_FILE)).toBe(
			true,
		);
		expect(bundle.source.eventsPath.endsWith(LEGACY_EVENTS_FILE)).toBe(true);
	});

	it("fails closed when canonical manifest is partial even if legacy manifest exists", () => {
		const runId = "run-cp1-partial-manifest";
		const paths = resolveRunRecordPaths({ runId, baseDir: testRoot });
		mkdirSync(paths.runDir, { recursive: true });

		writeFileSync(
			paths.manifestPath,
			'{"schemaVersion":"agent-run-manifest/v1"',
			"utf-8",
		);
		writeFileSync(
			paths.legacyManifestPath,
			JSON.stringify(makeManifest(runId), null, 2),
			"utf-8",
		);

		const event = makeEvent(runId, "evt-1");
		const eventWithHash = { ...event, eventHash: computeEventHash(event) };
		writeFileSync(
			paths.eventsPath,
			`${JSON.stringify(eventWithHash)}\n`,
			"utf-8",
		);

		expect(() =>
			loadRunRecordBundle({
				runId,
				baseDir: testRoot,
			}),
		).toThrow(RunRecordError);
	});

	it("rejects manifests with sensitive key names", () => {
		const runId = "run-cp1-sensitive";
		const manifest = makeManifest(runId);
		manifest.preconditions = {
			apiToken: "should-not-be-persisted",
		};

		expect(() =>
			writeCanonicalManifest({
				manifest,
				baseDir: testRoot,
			}),
		).toThrow(/sensitive keys/i);
	});

	it("rejects manifests without dual provenance hashes", () => {
		const runId = "run-cp1-missing-provenance";
		const manifest = makeManifest(runId);
		manifest.provenance = {
			repoContractHash: "d".repeat(64),
			processPolicyHash: "",
		};

		expect(() =>
			writeCanonicalManifest({
				manifest,
				baseDir: testRoot,
			}),
		).toThrow(/processPolicyHash/i);
	});

	it("enforces event hash-chain continuity", () => {
		const runId = "run-cp1-hash-chain";
		const manifest = makeManifest(runId);
		writeCanonicalManifest({ manifest, baseDir: testRoot });

		appendCanonicalEvent({
			event: makeEvent(runId, "evt-1"),
			baseDir: testRoot,
		});

		expect(() =>
			appendCanonicalEvent({
				event: {
					...makeEvent(runId, "evt-2"),
					prevEventHash: "f".repeat(64),
				},
				baseDir: testRoot,
			}),
		).toThrow(/prevEventHash/i);
	});

	it("fails when event JSONL contains malformed lines", () => {
		const runId = "run-cp1-partial-event";
		const paths = resolveRunRecordPaths({ runId, baseDir: testRoot });
		mkdirSync(paths.runDir, { recursive: true });

		writeFileSync(
			paths.manifestPath,
			JSON.stringify(makeManifest(runId), null, 2),
			"utf-8",
		);
		writeFileSync(
			paths.eventsPath,
			'{"schemaVersion":"agent-run-event/v1"\n',
			"utf-8",
		);

		expect(() =>
			loadRunRecordBundle({
				runId,
				baseDir: testRoot,
			}),
		).toThrow(/Invalid event JSONL/i);
	});

	it("allows the explicit unknown repo headSha sentinel", () => {
		const runId = "run-cp1-unknown-head-sha";
		const manifest = makeManifest(runId);
		manifest.repo.headSha = "unknown";

		expect(() =>
			writeCanonicalManifest({
				manifest,
				baseDir: testRoot,
			}),
		).not.toThrow();
	});

	it("rejects abbreviated repo SHA values in canonical manifests", () => {
		const runId = "run-cp1-abbreviated-head-sha";
		const manifest = makeManifest(runId);
		manifest.repo.headSha = "abc1234";

		expect(() =>
			writeCanonicalManifest({
				manifest,
				baseDir: testRoot,
			}),
		).toThrow(/repo\.headSha must be a 40-character lowercase hex SHA/i);
	});

	it("rejects invalid ancestryBaseSha values in canonical manifests", () => {
		const runId = "run-cp1-invalid-ancestry-base-sha";
		const invalidValues = [
			"abc1234",
			"A123456789abcdef0123456789abcdef01234567",
			"zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
		];

		for (const ancestryBaseSha of invalidValues) {
			const manifest = makeManifest(runId);
			manifest.repo.ancestryBaseSha = ancestryBaseSha;
			expect(() =>
				writeCanonicalManifest({
					manifest,
					baseDir: testRoot,
				}),
			).toThrow(
				/repo\.ancestryBaseSha must be a 40-character lowercase hex SHA/i,
			);
		}
	});

	it("accepts a canonical ancestryBaseSha value in canonical manifests", () => {
		const runId = "run-cp1-valid-ancestry-base-sha";
		const manifest = makeManifest(runId);
		manifest.repo.ancestryBaseSha = "b".repeat(40);

		expect(() =>
			writeCanonicalManifest({
				manifest,
				baseDir: testRoot,
			}),
		).not.toThrow();
	});

	it("rejects manifests with unsupported enum values or extra properties", () => {
		const manifest = {
			...makeManifest("run-cp1-invalid-manifest"),
			outcome: "maybe",
			exit: {
				code: 0,
				classification: "ok",
				extra: true,
			},
		} as unknown as AgentRunManifest;

		expect(() =>
			writeCanonicalManifest({
				manifest,
				baseDir: testRoot,
			}),
		).toThrow(/allowed schema values|unsupported properties/i);
	});

	it("rejects events with unsupported enum values or extra properties", () => {
		const runId = "run-cp1-invalid-event";
		writeCanonicalManifest({
			manifest: makeManifest(runId),
			baseDir: testRoot,
		});

		const event = {
			...makeEvent(runId, "evt-invalid"),
			eventType: "mystery",
			extra: true,
		} as unknown as AgentRunEvent;

		expect(() =>
			appendCanonicalEvent({
				event,
				baseDir: testRoot,
			}),
		).toThrow(/allowed schema values|unsupported properties/i);
	});

	it("rejects bundle loads when manifest runId does not match the requested runId", () => {
		const runId = "run-cp1-requested";
		const paths = resolveRunRecordPaths({ runId, baseDir: testRoot });
		mkdirSync(paths.runDir, { recursive: true });
		const actualManifest = makeManifest("run-cp1-other");
		const actualEvent = makeEvent("run-cp1-other", "evt-1");
		const actualEventWithHash = {
			...actualEvent,
			eventHash: computeEventHash(actualEvent),
		};

		writeFileSync(
			paths.manifestPath,
			JSON.stringify(actualManifest, null, 2),
			"utf-8",
		);
		writeFileSync(
			paths.eventsPath,
			`${JSON.stringify(actualEventWithHash)}\n`,
			"utf-8",
		);

		expect(() =>
			loadRunRecordBundle({
				runId,
				baseDir: testRoot,
			}),
		).toThrow(/Manifest runId mismatch/i);
	});

	it("rejects bundle loads when event runId does not match the manifest runId", () => {
		const runId = "run-cp1-event-mismatch";
		const paths = resolveRunRecordPaths({ runId, baseDir: testRoot });
		mkdirSync(paths.runDir, { recursive: true });
		const manifest = makeManifest(runId);
		const foreignEvent = makeEvent("run-cp1-foreign", "evt-foreign");
		const foreignEventWithHash = {
			...foreignEvent,
			eventHash: computeEventHash(foreignEvent),
		};

		writeFileSync(
			paths.manifestPath,
			JSON.stringify(manifest, null, 2),
			"utf-8",
		);
		writeFileSync(
			paths.eventsPath,
			`${JSON.stringify(foreignEventWithHash)}\n`,
			"utf-8",
		);

		expect(() =>
			loadRunRecordBundle({
				runId,
				baseDir: testRoot,
			}),
		).toThrow(/Event runId mismatch/i);
	});
});
