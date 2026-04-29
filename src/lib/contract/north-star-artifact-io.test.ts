import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type DurableGuardrail,
	type OverrideAcknowledgement,
	listNorthStarDurableGuardrails,
	listNorthStarOverrideAcknowledgements,
	readNorthStarDurableGuardrail,
	readNorthStarOverrideAcknowledgement,
	resolveActiveOverrides,
	resolveGuardrailRecurrence,
	validateOverrideAcknowledgement,
	writeNorthStarDurableGuardrail,
	writeNorthStarOverrideAcknowledgement,
} from "./north-star-artifact-io.js";
import {
	createNorthStarGuardrailId,
	getNorthStarDurableGuardrailPath,
	getNorthStarOverrideAcknowledgementPath,
} from "./north-star-artifacts.js";
import type { OverrideReviewerRegistry } from "./types.js";

function mkdtemp(prefix: string): string {
	const dir = join(process.cwd(), "artifacts", prefix);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function cleanup(dir: string): void {
	rmSync(dir, { recursive: true, force: true });
}

describe("writeNorthStarDurableGuardrail / readNorthStarDurableGuardrail", () => {
	let root: string;
	beforeEach(() => {
		root = mkdtemp("ns-artifact-io-guardrail");
	});
	afterEach(() => cleanup(root));

	it("round-trips a guardrail artifact through canonical path", () => {
		const guardrail: DurableGuardrail = {
			schemaVersion: "north-star-durable-guardrail/v1",
			guardrailId: createNorthStarGuardrailId({
				failureClass: "drift_blocking",
				surfaceIds: ["surface-a"],
			}),
			failureClass: "drift_blocking",
			triggeredByFindingIds: ["finding-1"],
			recurrenceCount: 1,
			createdAtUtc: new Date().toISOString(),
			owner: "workflow",
			implementationTarget: "src/lib/fix.ts",
			status: "proposed",
		};

		const relPath = writeNorthStarDurableGuardrail(root, guardrail);
		expect(relPath).toBe(
			getNorthStarDurableGuardrailPath("drift_blocking", guardrail.guardrailId),
		);

		const read = readNorthStarDurableGuardrail(
			root,
			"drift_blocking",
			guardrail.guardrailId,
		);
		expect(read).toEqual(guardrail);
	});

	it("returns undefined when guardrail does not exist", () => {
		const result = readNorthStarDurableGuardrail(
			root,
			"drift_blocking",
			"nonexistent--guardrail",
		);
		expect(result).toBeUndefined();
	});
});

describe("writeNorthStarOverrideAcknowledgement / readNorthStarOverrideAcknowledgement", () => {
	let root: string;
	beforeEach(() => {
		root = mkdtemp("ns-artifact-io-override");
	});
	afterEach(() => cleanup(root));

	it("round-trips an override acknowledgement through canonical path", () => {
		const override: OverrideAcknowledgement = {
			schemaVersion: "north-star-override-acknowledgement/v1",
			overrideId: "override-2026-04-26-001",
			timestampUtc: new Date().toISOString(),
			actor: "jamie-craik",
			reason: "Emergency fix for production incident",
			linkedFindingIds: ["finding-1", "finding-2"],
			approvedUntilUtc: "2026-05-26T00:00:00.000Z",
			compensatingControls: ["peer-review-post-merge", "incident-retro"],
			signatureRef: "refs/reviewers/jamie-craik",
		};

		const relPath = writeNorthStarOverrideAcknowledgement(
			root,
			"2026-04-26",
			"override-2026-04-26-001",
			override,
		);
		expect(relPath).toBe(
			getNorthStarOverrideAcknowledgementPath(
				"2026-04-26",
				"override-2026-04-26-001",
			),
		);

		const read = readNorthStarOverrideAcknowledgement(
			root,
			"2026-04-26",
			"override-2026-04-26-001",
		);
		expect(read).toEqual(override);
	});

	it("returns undefined when override does not exist", () => {
		const result = readNorthStarOverrideAcknowledgement(
			root,
			"2026-04-26",
			"nonexistent",
		);
		expect(result).toBeUndefined();
	});
});

describe("resolveGuardrailRecurrence (SA10)", () => {
	let root: string;
	beforeEach(() => {
		root = mkdtemp("ns-artifact-io-recurrence");
	});
	afterEach(() => cleanup(root));

	it("returns exists:false when no guardrail is on disk", () => {
		const result = resolveGuardrailRecurrence(root, "drift_blocking", [
			"surface-a",
		]);
		expect(result.exists).toBe(false);
		expect(result.recurrenceCount).toBe(0);
		expect(result.guardrailId).toBe(
			createNorthStarGuardrailId({
				failureClass: "drift_blocking",
				surfaceIds: ["surface-a"],
			}),
		);
	});

	it("returns exists:true and current recurrence count when guardrail exists", () => {
		const guardrailId = createNorthStarGuardrailId({
			failureClass: "cadence_breach",
			surfaceIds: ["surface-b", "surface-c"],
		});
		const guardrail: DurableGuardrail = {
			schemaVersion: "north-star-durable-guardrail/v1",
			guardrailId,
			failureClass: "cadence_breach",
			triggeredByFindingIds: ["finding-1"],
			recurrenceCount: 3,
			createdAtUtc: new Date().toISOString(),
			owner: "workflow",
			implementationTarget: "src/lib/fix.ts",
			status: "implemented",
		};
		writeNorthStarDurableGuardrail(root, guardrail);

		const result = resolveGuardrailRecurrence(root, "cadence_breach", [
			"surface-b",
			"surface-c",
		]);
		expect(result.exists).toBe(true);
		expect(result.recurrenceCount).toBe(3);
		expect(result.guardrailId).toBe(guardrailId);
	});
});

describe("validateOverrideAcknowledgement (SA15)", () => {
	let root: string;
	beforeEach(() => {
		root = mkdtemp("ns-artifact-io-validate");
	});
	afterEach(() => cleanup(root));

	const registry: OverrideReviewerRegistry = {
		trustedReviewers: [
			{
				reviewerId: "jamie-craik",
				reviewerType: "user",
				signatureRef: "refs/reviewers/jamie-craik",
				displayName: "Jamie Craik",
				status: "active",
			},
		],
	};

	function writeValidOverride(props?: {
		approvedUntilUtc?: string;
		signatureRef?: string;
		linkedFindingIds?: string[];
	}): { date: string; overrideId: string } {
		const date = "2026-04-26";
		const overrideId = "ov-001";
		const override: OverrideAcknowledgement = {
			schemaVersion: "north-star-override-acknowledgement/v1",
			overrideId,
			timestampUtc: "2026-04-26T00:00:00.000Z",
			actor: "jamie-craik",
			reason: "test",
			linkedFindingIds: props?.linkedFindingIds ?? ["finding-1"],
			approvedUntilUtc: props?.approvedUntilUtc ?? "2026-12-31T00:00:00.000Z",
			compensatingControls: [],
			signatureRef: props?.signatureRef ?? "refs/reviewers/jamie-craik",
		};
		writeNorthStarOverrideAcknowledgement(root, date, overrideId, override);
		return { date, overrideId };
	}

	it("passes when override is valid and reviewer is active", () => {
		const { date, overrideId } = writeValidOverride();
		const result = validateOverrideAcknowledgement(root, date, overrideId, {
			registry,
			referenceDate: new Date("2026-04-26T00:00:00Z"),
			activeFindingIds: ["finding-1"],
		});
		expect(result.valid).toBe(true);
	});

	it("fails when artifact is missing", () => {
		const result = validateOverrideAcknowledgement(
			root,
			"2026-04-26",
			"missing",
			{ registry },
		);
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("not found");
	});

	it("fails when artifact JSON is invalid", () => {
		const date = "2026-04-26";
		const overrideId = "ov-invalid-json";
		const overridePath = join(
			root,
			".harness/overrides/north-star-alignment",
			date,
			overrideId,
			"override-acknowledgement.json",
		);
		mkdirSync(dirname(overridePath), { recursive: true });
		writeFileSync(overridePath, "{not-json", "utf-8");

		const result = validateOverrideAcknowledgement(root, date, overrideId, {
			registry,
		});

		expect(result.valid).toBe(false);
		expect(result.reason).toContain("not valid JSON");
	});

	it("fails when approval has expired", () => {
		const { date, overrideId } = writeValidOverride({
			approvedUntilUtc: "2026-01-01T00:00:00.000Z",
		});
		const result = validateOverrideAcknowledgement(root, date, overrideId, {
			registry,
			referenceDate: new Date("2026-04-26T00:00:00Z"),
		});
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("expired");
	});

	it("fails when linkedFindingIds is empty", () => {
		const { date, overrideId } = writeValidOverride({
			linkedFindingIds: [],
		});
		const result = validateOverrideAcknowledgement(root, date, overrideId, {
			registry,
		});
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("no linked finding IDs");
	});

	it("fails when linked findings are not active", () => {
		const { date, overrideId } = writeValidOverride();
		const result = validateOverrideAcknowledgement(root, date, overrideId, {
			registry,
			activeFindingIds: ["different-finding"],
		});
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("no longer active");
	});

	it("fails when signatureRef does not resolve to an active reviewer", () => {
		const { date, overrideId } = writeValidOverride({
			signatureRef: "refs/reviewers/unknown",
		});
		const result = validateOverrideAcknowledgement(root, date, overrideId, {
			registry,
		});
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("active trusted reviewer");
	});

	it("fails when signatureRef resolves to a revoked reviewer", () => {
		const revokedRegistry: OverrideReviewerRegistry = {
			trustedReviewers: [
				{
					reviewerId: "jamie-craik",
					reviewerType: "user",
					signatureRef: "refs/reviewers/jamie-craik",
					displayName: "Jamie Craik",
					status: "revoked",
				},
			],
		};
		const { date, overrideId } = writeValidOverride();
		const result = validateOverrideAcknowledgement(root, date, overrideId, {
			registry: revokedRegistry,
		});
		expect(result.valid).toBe(false);
		expect(result.reason).toContain("active trusted reviewer");
	});

	it("fails when schemaVersion is not the canonical override schema", () => {
		const date = "2026-04-26";
		const overrideId = "ov-wrong-schema";
		writeNorthStarOverrideAcknowledgement(root, date, overrideId, {
			schemaVersion: "north-star-durable-guardrail/v1" as OverrideAcknowledgement["schemaVersion"],
			overrideId,
			timestampUtc: "2026-04-26T00:00:00.000Z",
			actor: "jamie-craik",
			reason: "test",
			linkedFindingIds: ["finding-1"],
			approvedUntilUtc: "2026-12-31T00:00:00.000Z",
			compensatingControls: [],
			signatureRef: "refs/reviewers/jamie-craik",
		});

		const result = validateOverrideAcknowledgement(root, date, overrideId, {
			registry,
		});

		expect(result.valid).toBe(false);
		expect(result.reason).toContain("schemaVersion");
	});

	it("fails when actor does not match the reviewer referenced by signatureRef", () => {
		const date = "2026-04-26";
		const overrideId = "ov-actor-mismatch";
		writeNorthStarOverrideAcknowledgement(root, date, overrideId, {
			schemaVersion: "north-star-override-acknowledgement/v1",
			overrideId,
			timestampUtc: "2026-04-26T00:00:00.000Z",
			actor: "different-actor",
			reason: "test",
			linkedFindingIds: ["finding-1"],
			approvedUntilUtc: "2026-12-31T00:00:00.000Z",
			compensatingControls: [],
			signatureRef: "refs/reviewers/jamie-craik",
		});

		const result = validateOverrideAcknowledgement(root, date, overrideId, {
			registry,
		});

		expect(result.valid).toBe(false);
		expect(result.reason).toContain("actor must match");
	});
});

describe("listNorthStarOverrideAcknowledgements", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtemp("override-list-");
	});

	afterEach(() => {
		cleanup(root);
	});

	it("returns empty when override directory does not exist", () => {
		expect(listNorthStarOverrideAcknowledgements(root)).toEqual([]);
	});

	it("lists all override acknowledgements by date and overrideId", () => {
		const ack: OverrideAcknowledgement = {
			schemaVersion: "north-star-override-acknowledgement/v1",
			overrideId: "ovr-1",
			timestampUtc: new Date().toISOString(),
			actor: "jamie-craik",
			reason: "Test",
			linkedFindingIds: ["f1"],
			approvedUntilUtc: new Date(Date.now() + 86400000).toISOString(),
			compensatingControls: [],
			signatureRef: "refs/reviewers/jamie-craik",
		};
		writeNorthStarOverrideAcknowledgement(
			root,
			"2026-04-27",
			"override-1",
			ack,
		);
		writeNorthStarOverrideAcknowledgement(root, "2026-04-27", "override-2", {
			...ack,
			overrideId: "ovr-2",
		});
		writeNorthStarOverrideAcknowledgement(root, "2026-04-28", "override-3", {
			...ack,
			overrideId: "ovr-3",
		});

		const result = listNorthStarOverrideAcknowledgements(root);
		expect(result).toHaveLength(3);
		expect(result).toContainEqual({
			date: "2026-04-27",
			overrideId: "override-1",
		});
		expect(result).toContainEqual({
			date: "2026-04-27",
			overrideId: "override-2",
		});
		expect(result).toContainEqual({
			date: "2026-04-28",
			overrideId: "override-3",
		});
	});
});

describe("listNorthStarDurableGuardrails", () => {
	let root: string;

	beforeEach(() => {
		root = mkdtemp("guardrail-list-");
	});

	afterEach(() => {
		cleanup(root);
	});

	it("returns guardrails with repo-relative paths", () => {
		const guardrail: DurableGuardrail = {
			schemaVersion: "north-star-durable-guardrail/v1",
			guardrailId: createNorthStarGuardrailId({
				failureClass: "drift_blocking",
				surfaceIds: ["surface-a"],
			}),
			failureClass: "drift_blocking",
			triggeredByFindingIds: ["finding-1"],
			recurrenceCount: 1,
			createdAtUtc: new Date().toISOString(),
			owner: "workflow",
			implementationTarget: "src/lib/fix.ts",
			status: "proposed",
		};
		const classDir = join(
			root,
			".harness/guardrails/north-star",
			"drift_blocking",
		);
		mkdirSync(classDir, { recursive: true });
		writeFileSync(
			join(classDir, "guardrail.json"),
			`${JSON.stringify(guardrail, null, 2)}\n`,
		);

		const slashRoot = `${root}/`;
		const result = Array.from(listNorthStarDurableGuardrails(slashRoot));
		const [firstResult] = result;

		expect(result).toHaveLength(1);
		expect(firstResult).toBeDefined();
		if (!firstResult) {
			throw new Error("Expected at least one durable guardrail result");
		}
		expect(firstResult.path).toBe(
			".harness/guardrails/north-star/drift_blocking/guardrail.json",
		);
	});
});

describe("resolveActiveOverrides", () => {
	let root: string;
	const registry: OverrideReviewerRegistry = {
		trustedReviewers: [
			{
				reviewerId: "jamie-craik",
				reviewerType: "user",
				signatureRef: "refs/reviewers/jamie-craik",
				displayName: "Jamie Craik",
				status: "active",
			},
		],
	};

	function writeValidOverride(opts?: {
		linkedFindingIds?: string[];
		approvedUntilUtc?: string;
	}): { date: string; overrideId: string } {
		const date = "2026-04-27";
		const overrideId = `ovr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const ack: OverrideAcknowledgement = {
			schemaVersion: "north-star-override-acknowledgement/v1",
			overrideId,
			timestampUtc: new Date().toISOString(),
			actor: "jamie-craik",
			reason: "Test override",
			linkedFindingIds: opts?.linkedFindingIds ?? ["finding-1"],
			approvedUntilUtc:
				opts?.approvedUntilUtc ?? new Date(Date.now() + 86400000).toISOString(),
			compensatingControls: ["control-a"],
			signatureRef: "refs/reviewers/jamie-craik",
		};
		writeNorthStarOverrideAcknowledgement(root, date, overrideId, ack);
		return { date, overrideId };
	}

	beforeEach(() => {
		root = mkdtemp("active-overrides-");
	});

	afterEach(() => {
		cleanup(root);
	});

	it("returns empty set when no overrides exist", () => {
		const result = resolveActiveOverrides(root, registry);
		expect(result.size).toBe(0);
	});

	it("collects linked finding IDs from valid overrides", () => {
		writeValidOverride({ linkedFindingIds: ["finding-a", "finding-b"] });
		writeValidOverride({ linkedFindingIds: ["finding-c"] });

		const result = resolveActiveOverrides(root, registry);
		expect(result.has("finding-a")).toBe(true);
		expect(result.has("finding-b")).toBe(true);
		expect(result.has("finding-c")).toBe(true);
	});

	it("excludes expired overrides", () => {
		writeValidOverride({ linkedFindingIds: ["finding-active"] });
		writeValidOverride({
			linkedFindingIds: ["finding-expired"],
			approvedUntilUtc: new Date(Date.now() - 86400000).toISOString(),
		});

		const result = resolveActiveOverrides(root, registry);
		expect(result.has("finding-active")).toBe(true);
		expect(result.has("finding-expired")).toBe(false);
	});

	it("excludes overrides with inactive linked findings when activeFindingIds is provided", () => {
		writeValidOverride({ linkedFindingIds: ["finding-1", "finding-2"] });

		const result = resolveActiveOverrides(root, registry, {
			activeFindingIds: ["finding-1"],
		});
		expect(result.has("finding-1")).toBe(false);
		expect(result.has("finding-2")).toBe(false);
	});
});
