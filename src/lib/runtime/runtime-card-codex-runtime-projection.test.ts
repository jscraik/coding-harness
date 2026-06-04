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
import { projectToolExposureToRuntimeCard } from "../tool-exposure/index.js";
import {
	buildLocalRuntimeCard,
	type RuntimeCardGitRunner,
} from "./local-runtime-card.js";
import {
	RUNTIME_EVIDENCE_BUNDLE_SCHEMA_VERSION,
	type RuntimeEvidenceBundle,
} from "./runtime-evidence-bundle.js";
import { validateRuntimeCard } from "./runtime-card.js";

const CODE = String.fromCharCode(96);

function codePath(path: string): string {
	return CODE + path + CODE;
}

function writeActiveArtifacts(repoRoot: string): void {
	const specPath =
		".harness/specs/2026-05-13-jsc-311-he-phase-exit-evidence-gates-spec.md";
	const planPath =
		".harness/plan/2026-05-13-JSC-311-he-phase-exit-evidence-gates-plan.md";
	mkdirSync(join(repoRoot, ".harness/specs"), { recursive: true });
	mkdirSync(join(repoRoot, ".harness/plan"), { recursive: true });
	writeFileSync(join(repoRoot, specPath), "# Spec\n");
	writeFileSync(join(repoRoot, planPath), "# Plan\n");
	writeFileSync(
		join(repoRoot, ".harness/active-artifacts.md"),
		[
			"# Active Harness Specs And Plans",
			"",
			"| Linear Key | Active Spec | Active Plan |",
			"| --- | --- | --- |",
			`| JSC-311 | ${codePath(specPath)} | ${codePath(planPath)} |`,
			"",
		].join("\n"),
	);
}

function gitRunner(): RuntimeCardGitRunner {
	return (args) => {
		if (args.join(" ") === "branch --show-current") {
			return "codex/jsc-311-phase-exit-next";
		}
		if (args.join(" ") === "rev-parse HEAD") return "a".repeat(40);
		if (args.join(" ") === "status --porcelain") return "";
		return undefined;
	};
}

function codexRuntimeEvidenceBundle(): RuntimeEvidenceBundle {
	return {
		schemaVersion: RUNTIME_EVIDENCE_BUNDLE_SCHEMA_VERSION,
		generatedAt: "2026-05-15T12:00:00.000Z",
		issueKey: "JSC-311",
		provenance: {
			kind: "codex_runtime",
			ref: "codex-runtime://turn-456",
			collectedAt: "2026-05-15T11:59:00.000Z",
		},
		sources: [
			{
				kind: "validation",
				ref: "command:pnpm test",
				freshness: "current",
				status: "usable",
				failureClass: null,
			},
			{
				kind: "review",
				ref: "artifact://reviews/codex-runtime.md",
				freshness: "current",
				status: "usable",
				failureClass: null,
			},
			{
				kind: "session",
				ref: "codex-runtime://turn-456",
				freshness: "current",
				status: "usable",
				failureClass: null,
			},
			{
				kind: "artifact",
				ref: "codex-stale-state://linear",
				freshness: "stale",
				status: "blocked",
				failureClass: "snapshot_ttl_expired",
			},
		],
		blockers: ["External Linear snapshot is stale."],
	};
}

function codexRuntimeEvidenceBundleWithContinuity(): RuntimeEvidenceBundle {
	return {
		...codexRuntimeEvidenceBundle(),
		sources: [
			...codexRuntimeEvidenceBundle().sources,
			{
				kind: "session",
				ref: "codex-runtime://thread-123",
				freshness: "current",
				status: "usable",
				failureClass: null,
			},
			{
				kind: "session",
				ref: "codex-runtime://turn-456",
				freshness: "current",
				status: "usable",
				failureClass: null,
			},
			{
				kind: "session",
				ref: "codex-runtime://trace-789",
				freshness: "current",
				status: "usable",
				failureClass: null,
			},
			{
				kind: "artifact",
				ref: "codex-runtime://goal/JSC-363",
				freshness: "current",
				status: "usable",
				failureClass: null,
			},
			{
				kind: "session",
				ref: "codex-runtime://message/client-abc",
				freshness: "current",
				status: "usable",
				failureClass: null,
			},
			{
				kind: "artifact",
				ref: "codex-runtime://queue/item-1",
				freshness: "current",
				status: "usable",
				failureClass: null,
			},
			{
				kind: "artifact",
				ref: "codex-runtime://approval/request-1",
				freshness: "current",
				status: "usable",
				failureClass: null,
			},
			{
				kind: "artifact",
				ref: "codex-runtime://heartbeat/automation-1",
				freshness: "current",
				status: "usable",
				failureClass: null,
			},
		],
		continuity: {
			threadRefs: ["codex-runtime://thread-123"],
			turnRefs: ["codex-runtime://turn-456"],
			traceRefs: ["codex-runtime://trace-789"],
			goalRefs: ["codex-runtime://goal/JSC-363"],
			clientMessageRefs: ["codex-runtime://message/client-abc"],
			queueRefs: ["codex-runtime://queue/item-1"],
			approvalRefs: ["codex-runtime://approval/request-1"],
			heartbeatRefs: ["codex-runtime://heartbeat/automation-1"],
		},
	};
}

function toolExposureProjection() {
	return projectToolExposureToRuntimeCard(
		JSON.parse(
			readFileSync(
				"contracts/examples/tool-exposure-snapshot.example.json",
				"utf8",
			),
		),
	);
}

describe("runtime-card Codex runtime projection", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs) {
			try {
				rmSync(dir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		}
		tempDirs.length = 0;
	});

	it("projects compact Codex runtime evidence without embedding raw packet bodies", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		tempDirs.push(repoRoot);
		writeActiveArtifacts(repoRoot);

		const card = buildLocalRuntimeCard({
			repoRoot,
			evidenceBundle: codexRuntimeEvidenceBundle(),
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});

		expect(validateRuntimeCard(card)).toEqual({ valid: true, errors: [] });
		expect(card.codexRuntime).toEqual({
			provenanceRef: "codex-runtime://turn-456",
			collectedAt: "2026-05-15T11:59:00.000Z",
			sourceCount: 4,
			blockedSourceCount: 1,
			blockerCount: 1,
			receiptRefs: [
				"command:pnpm test",
				"artifact://reviews/codex-runtime.md",
				"codex-runtime://turn-456",
				"codex-stale-state://linear",
			],
			validationRefs: ["command:pnpm test"],
			reviewRefs: ["artifact://reviews/codex-runtime.md"],
			sessionRefs: ["codex-runtime://turn-456"],
			environmentRefs: [],
			staleStateRefs: ["codex-stale-state://linear"],
		});
		expect(JSON.stringify(card)).not.toContain("rawEvents");
		expect(JSON.stringify(card)).not.toContain("fullReviewBody");
	});

	it("projects tool exposure into the compact Codex runtime-card surface", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		tempDirs.push(repoRoot);
		writeActiveArtifacts(repoRoot);

		const card = buildLocalRuntimeCard({
			repoRoot,
			evidenceBundle: {
				...codexRuntimeEvidenceBundle(),
				sources: [
					...codexRuntimeEvidenceBundle().sources,
					{
						kind: "artifact",
						ref: "tool-exposure://turn-456",
						freshness: "current",
						status: "usable",
						failureClass: null,
					},
				],
				toolExposure: toolExposureProjection(),
			},
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});

		expect(validateRuntimeCard(card)).toEqual({ valid: true, errors: [] });
		expect(card.codexRuntime?.toolExposure).toMatchObject({
			evidenceRef: "tool-exposure://turn-456",
			evidenceUse: "orientation",
			sandboxMode: "workspace-write",
			approvalPolicy: "auto_review",
			networkAccess: "restricted",
			blockedPermissionAttemptCount: 1,
			writableRootCount: 4,
			namesTruncated: false,
		});
		expect(JSON.stringify(card.codexRuntime?.toolExposure)).not.toContain(
			"/Users/",
		);
	});

	it("projects source-backed Codex continuity refs into the compact runtime-card surface", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		tempDirs.push(repoRoot);
		writeActiveArtifacts(repoRoot);

		const card = buildLocalRuntimeCard({
			repoRoot,
			evidenceBundle: codexRuntimeEvidenceBundleWithContinuity(),
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});

		expect(validateRuntimeCard(card)).toEqual({ valid: true, errors: [] });
		expect(card.codexRuntime?.continuity).toEqual({
			threadRefs: ["codex-runtime://thread-123"],
			turnRefs: ["codex-runtime://turn-456"],
			traceRefs: ["codex-runtime://trace-789"],
			goalRefs: ["codex-runtime://goal/JSC-363"],
			clientMessageRefs: ["codex-runtime://message/client-abc"],
			queueRefs: ["codex-runtime://queue/item-1"],
			approvalRefs: ["codex-runtime://approval/request-1"],
			heartbeatRefs: ["codex-runtime://heartbeat/automation-1"],
		});
		expect(card.codexRuntime?.receiptRefs).toEqual(
			expect.arrayContaining([
				"codex-runtime://thread-123",
				"codex-runtime://turn-456",
				"codex-runtime://trace-789",
				"codex-runtime://goal/JSC-363",
				"codex-runtime://message/client-abc",
				"codex-runtime://queue/item-1",
				"codex-runtime://approval/request-1",
				"codex-runtime://heartbeat/automation-1",
			]),
		);
		expect(JSON.stringify(card.codexRuntime?.continuity)).not.toContain(
			"rawEvents",
		);
	});

	it("rejects tool exposure projections that are not backed by card receipt refs", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		tempDirs.push(repoRoot);
		writeActiveArtifacts(repoRoot);
		const card = buildLocalRuntimeCard({
			repoRoot,
			evidenceBundle: codexRuntimeEvidenceBundle(),
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});
		const invalidCard = {
			...card,
			codexRuntime: {
				...card.codexRuntime,
				toolExposure: toolExposureProjection(),
			},
		};

		expect(validateRuntimeCard(invalidCard)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({
					path: "codexRuntime.toolExposure.evidenceRef",
				}),
			]),
		});
	});

	it("rejects blocked tool exposure counts without a matching runtime blocker", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		tempDirs.push(repoRoot);
		writeActiveArtifacts(repoRoot);
		const card = buildLocalRuntimeCard({
			repoRoot,
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});
		const invalidCard = {
			...card,
			sources: [
				{
					kind: "artifact",
					ref: "tool-exposure://turn-456",
					freshness: "current",
					status: "usable",
					failureClass: null,
				},
			],
			codexRuntime: {
				provenanceRef: "codex-runtime://turn-456",
				collectedAt: null,
				sourceCount: 1,
				blockedSourceCount: 0,
				blockerCount: 0,
				receiptRefs: ["tool-exposure://turn-456"],
				validationRefs: [],
				reviewRefs: [],
				sessionRefs: [],
				staleStateRefs: [],
				toolExposure: toolExposureProjection(),
			},
		};

		expect(validateRuntimeCard(invalidCard)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({ path: "codexRuntime.blockerCount" }),
			]),
		});
	});

	it("rejects runtime cards that embed raw event streams or full review bodies", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		tempDirs.push(repoRoot);
		writeActiveArtifacts(repoRoot);
		const card = buildLocalRuntimeCard({
			repoRoot,
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});
		const invalidCard = {
			...card,
			codexRuntime: {
				provenanceRef: "codex-runtime://turn-456",
				collectedAt: null,
				sourceCount: 1,
				blockedSourceCount: 0,
				blockerCount: 0,
				receiptRefs: ["codex-runtime://turn-456"],
				validationRefs: [],
				reviewRefs: [],
				sessionRefs: ["codex-runtime://turn-456"],
				staleStateRefs: [],
				rawEvents: [{ payload: "large transcript body" }],
				fullReviewBody: "complete review thread text",
			},
		};

		expect(validateRuntimeCard(invalidCard)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({ path: "codexRuntime.rawEvents" }),
				expect.objectContaining({ path: "codexRuntime.fullReviewBody" }),
			]),
		});
	});

	it("rejects continuity projections that are not backed by card receipt refs", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		tempDirs.push(repoRoot);
		writeActiveArtifacts(repoRoot);
		const card = buildLocalRuntimeCard({
			repoRoot,
			evidenceBundle: codexRuntimeEvidenceBundle(),
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});
		const invalidCard = {
			...card,
			codexRuntime: {
				...card.codexRuntime,
				continuity: codexRuntimeEvidenceBundleWithContinuity().continuity,
			},
		};

		expect(validateRuntimeCard(invalidCard)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({
					path: "codexRuntime.continuity.threadRefs.0",
				}),
				expect.objectContaining({
					path: "codexRuntime.continuity.clientMessageRefs.0",
				}),
			]),
		});
	});

	it("rejects unknown continuity fields and raw payload-like continuity refs", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		tempDirs.push(repoRoot);
		writeActiveArtifacts(repoRoot);
		const card = buildLocalRuntimeCard({
			repoRoot,
			evidenceBundle: codexRuntimeEvidenceBundle(),
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});
		const invalidCard = {
			...card,
			sources: [
				...card.sources,
				{
					kind: "session",
					ref: "codex-runtime://turn-456%20%7B%22schemaVersion%22%3A%22raw%22%7D",
					freshness: "current",
					status: "usable",
					failureClass: null,
				},
			],
			codexRuntime: {
				...card.codexRuntime,
				receiptRefs: [
					...(card.codexRuntime?.receiptRefs ?? []),
					"codex-runtime://turn-456%20%7B%22schemaVersion%22%3A%22raw%22%7D",
				],
				sourceCount: (card.codexRuntime?.sourceCount ?? 0) + 1,
				continuity: {
					...codexRuntimeEvidenceBundleWithContinuity().continuity,
					turnRefs: [
						"codex-runtime://turn-456%20%7B%22schemaVersion%22%3A%22raw%22%7D",
					],
					rawPacketRefs: ["codex-runtime://raw-packet"],
				},
			},
		};

		expect(validateRuntimeCard(invalidCard)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({
					path: "sources.6.ref",
				}),
				expect.objectContaining({
					path: "codexRuntime.receiptRefs.4",
				}),
				expect.objectContaining({
					path: "codexRuntime.continuity.rawPacketRefs",
				}),
				expect.objectContaining({
					path: "codexRuntime.continuity.turnRefs.0",
				}),
			]),
		});
	});

	it("rejects raw packet payloads tunneled through source and projection refs", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		tempDirs.push(repoRoot);
		writeActiveArtifacts(repoRoot);
		const card = buildLocalRuntimeCard({
			repoRoot,
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});
		const rawPayloadRef =
			'{"schemaVersion":"codex-runtime-evidence/v1","events":["raw"]}';
		const invalidCard = {
			...card,
			sources: [
				{
					kind: "session",
					ref: rawPayloadRef,
					freshness: "current",
					status: "usable",
					failureClass: null,
				},
			],
			codexRuntime: {
				provenanceRef: "codex-runtime://turn-456",
				collectedAt: null,
				sourceCount: 1,
				blockedSourceCount: 0,
				blockerCount: 0,
				receiptRefs: [rawPayloadRef],
				validationRefs: [],
				reviewRefs: [],
				sessionRefs: [rawPayloadRef],
				staleStateRefs: [],
			},
		};

		expect(validateRuntimeCard(invalidCard)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({ path: "sources.0.ref" }),
				expect.objectContaining({ path: "codexRuntime.receiptRefs.0" }),
				expect.objectContaining({ path: "codexRuntime.sessionRefs.0" }),
			]),
		});
	});

	it("rejects short prose bodies tunneled through source and projection refs", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		tempDirs.push(repoRoot);
		writeActiveArtifacts(repoRoot);
		const card = buildLocalRuntimeCard({
			repoRoot,
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});
		const proseRef = "Full review thread: reviewer says the PR is ready";
		const invalidCard = {
			...card,
			sources: [
				{
					kind: "review",
					ref: proseRef,
					freshness: "current",
					status: "usable",
					failureClass: null,
				},
			],
			codexRuntime: {
				provenanceRef: "codex-runtime://turn-456",
				collectedAt: null,
				sourceCount: 1,
				blockedSourceCount: 0,
				blockerCount: 0,
				receiptRefs: [proseRef],
				validationRefs: [],
				reviewRefs: [proseRef],
				sessionRefs: [],
				staleStateRefs: [],
			},
		};

		expect(validateRuntimeCard(invalidCard)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({ path: "sources.0.ref" }),
				expect.objectContaining({ path: "codexRuntime.receiptRefs.0" }),
				expect.objectContaining({ path: "codexRuntime.reviewRefs.0" }),
			]),
		});
	});

	it("rejects prose and JSON payloads hidden behind admitted ref prefixes", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		tempDirs.push(repoRoot);
		writeActiveArtifacts(repoRoot);
		const card = buildLocalRuntimeCard({
			repoRoot,
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});
		const prefixedProseRef = "./Full review thread body copied from a reviewer";
		const prefixedJsonRef =
			'codex-runtime://turn-456 {"schemaVersion":"codex-runtime-evidence/v1"}';
		const encodedProseRef =
			"./Full%20review%20thread%20body%20copied%20from%20reviewer";
		const encodedJsonRef =
			"codex-runtime://turn-456%20%7B%22schemaVersion%22%3A%22codex-runtime-evidence%2Fv1%22%7D";
		const doubleEncodedJsonRef =
			"codex-runtime://turn-456%2520%257B%2522schemaVersion%2522%253A%2522codex-runtime-evidence%252Fv1%2522%257D";
		const plusDelimitedProseRef =
			"./Full+review+thread+body+copied+from+reviewer";
		const hyphenDelimitedProseRef =
			"./Full-review-thread-body-copied-from-reviewer";
		const invalidCard = {
			...card,
			sources: [
				{
					kind: "review",
					ref: prefixedProseRef,
					freshness: "current",
					status: "usable",
					failureClass: null,
				},
			],
			codexRuntime: {
				provenanceRef: "codex-runtime://turn-456",
				collectedAt: null,
				sourceCount: 6,
				blockedSourceCount: 0,
				blockerCount: 0,
				receiptRefs: [
					prefixedProseRef,
					prefixedJsonRef,
					encodedProseRef,
					encodedJsonRef,
					doubleEncodedJsonRef,
					plusDelimitedProseRef,
					hyphenDelimitedProseRef,
				],
				validationRefs: [],
				reviewRefs: [
					prefixedProseRef,
					encodedProseRef,
					plusDelimitedProseRef,
					hyphenDelimitedProseRef,
				],
				sessionRefs: [prefixedJsonRef, encodedJsonRef, doubleEncodedJsonRef],
				staleStateRefs: [],
			},
		};

		expect(validateRuntimeCard(invalidCard)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({ path: "sources.0.ref" }),
				expect.objectContaining({ path: "codexRuntime.receiptRefs.0" }),
				expect.objectContaining({ path: "codexRuntime.receiptRefs.1" }),
				expect.objectContaining({ path: "codexRuntime.receiptRefs.2" }),
				expect.objectContaining({ path: "codexRuntime.receiptRefs.3" }),
				expect.objectContaining({ path: "codexRuntime.receiptRefs.4" }),
				expect.objectContaining({ path: "codexRuntime.receiptRefs.5" }),
				expect.objectContaining({ path: "codexRuntime.receiptRefs.6" }),
				expect.objectContaining({ path: "codexRuntime.reviewRefs.0" }),
				expect.objectContaining({ path: "codexRuntime.reviewRefs.1" }),
				expect.objectContaining({ path: "codexRuntime.reviewRefs.2" }),
				expect.objectContaining({ path: "codexRuntime.reviewRefs.3" }),
				expect.objectContaining({ path: "codexRuntime.sessionRefs.0" }),
				expect.objectContaining({ path: "codexRuntime.sessionRefs.1" }),
				expect.objectContaining({ path: "codexRuntime.sessionRefs.2" }),
			]),
		});
	});

	it("rejects Codex runtime projection counts that drift from projected source refs", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		tempDirs.push(repoRoot);
		writeActiveArtifacts(repoRoot);
		const card = buildLocalRuntimeCard({
			repoRoot,
			evidenceBundle: codexRuntimeEvidenceBundle(),
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});
		const invalidCard = {
			...card,
			codexRuntime: {
				...card.codexRuntime,
				sourceCount: 99,
			},
		};

		expect(validateRuntimeCard(invalidCard)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({ path: "codexRuntime.sourceCount" }),
			]),
		});
	});

	it("rejects blocked source counts that under-report receipt-backed source status", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		tempDirs.push(repoRoot);
		writeActiveArtifacts(repoRoot);
		const card = buildLocalRuntimeCard({
			repoRoot,
			evidenceBundle: codexRuntimeEvidenceBundle(),
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});
		const invalidCard = {
			...card,
			codexRuntime: {
				...card.codexRuntime,
				blockedSourceCount: 0,
			},
		};

		expect(validateRuntimeCard(invalidCard)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({
					path: "codexRuntime.blockedSourceCount",
				}),
			]),
		});
	});

	it("rejects inconsistent Codex runtime projection counts, refs, and fields", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-"));
		tempDirs.push(repoRoot);
		writeActiveArtifacts(repoRoot);
		const card = buildLocalRuntimeCard({
			repoRoot,
			now: new Date("2026-05-15T12:00:00.000Z"),
			git: gitRunner(),
		});
		const invalidCard = {
			...card,
			codexRuntime: {
				provenanceRef: "codex-runtime://turn-456",
				collectedAt: null,
				sourceCount: 1,
				blockedSourceCount: 2,
				blockerCount: 0,
				receiptRefs: ["codex-runtime://turn-456", "artifact://extra"],
				validationRefs: ["command:pnpm test"],
				reviewRefs: [],
				sessionRefs: ["codex-runtime://turn-456"],
				staleStateRefs: ["codex-stale-state://linear"],
				payload: { events: ["large raw packet body"] },
			},
		};

		expect(validateRuntimeCard(invalidCard)).toMatchObject({
			valid: false,
			errors: expect.arrayContaining([
				expect.objectContaining({
					path: "codexRuntime.blockedSourceCount",
				}),
				expect.objectContaining({
					path: "codexRuntime.blockerCount",
				}),
				expect.objectContaining({
					path: "codexRuntime.sourceCount",
				}),
				expect.objectContaining({
					path: "codexRuntime.payload",
				}),
				expect.objectContaining({
					path: "codexRuntime.validationRefs.0",
				}),
				expect.objectContaining({
					path: "codexRuntime.staleStateRefs.0",
				}),
			]),
		});
	});
});
