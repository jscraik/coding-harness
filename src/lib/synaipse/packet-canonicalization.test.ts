import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gitEnvironmentForRepoRoot } from "../runtime/git-environment.js";
import { canonicalizeLegacyPacket } from "./packet-canonicalization.js";
import {
	PACKET_FAMILY_REGISTRY,
	projectLegacyPacket,
	validatePacketSource,
} from "./packet-consolidation.js";
import {
	decideSynaipseTransition,
	validateSynaipseTransition,
} from "./transition.js";

const OBSERVED_AT = "2026-07-15T10:00:00Z";
let canonicalRepoRoot: string;

function emittedPacket(...args: string[]): unknown {
	return JSON.parse(
		execFileSync(
			process.execPath,
			["scripts/write-agent-native-ratchet-report.cjs", ...args],
			{ encoding: "utf8" },
		),
	);
}

beforeAll(() => {
	const gitEnvironment = gitEnvironmentForRepoRoot();
	canonicalRepoRoot = mkdtempSync(
		resolve(tmpdir(), "packet-canonicalization-repo-"),
	);
	execFileSync("git", ["init", "--quiet"], {
		cwd: canonicalRepoRoot,
		env: gitEnvironment,
	});
	execFileSync("git", ["config", "user.email", "fixture@example.invalid"], {
		cwd: canonicalRepoRoot,
		env: gitEnvironment,
	});
	execFileSync("git", ["config", "user.name", "Canonical Fixture"], {
		cwd: canonicalRepoRoot,
		env: gitEnvironment,
	});
	writeFileSync(resolve(canonicalRepoRoot, "fixture.txt"), "fixture\n");
	execFileSync("git", ["add", "fixture.txt"], {
		cwd: canonicalRepoRoot,
		env: gitEnvironment,
	});
	execFileSync("git", ["commit", "--quiet", "-m", "fixture"], {
		cwd: canonicalRepoRoot,
		env: gitEnvironment,
	});
	execFileSync(
		"git",
		[
			"remote",
			"add",
			"origin",
			"https://github.com/jscraik/coding-harness.git",
		],
		{ cwd: canonicalRepoRoot, env: gitEnvironment },
	);
	const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: canonicalRepoRoot,
		env: gitEnvironment,
		encoding: "utf8",
	}).trim();
	execFileSync("git", ["update-ref", "refs/remotes/origin/main", headSha], {
		cwd: canonicalRepoRoot,
		env: gitEnvironment,
	});
});

afterAll(() => {
	rmSync(canonicalRepoRoot, { recursive: true, force: true });
});

describe("packet canonicalization", () => {
	it.each([
		["agent-native-ratchets/v1", ["--json"]],
		["session-distill/v1", ["--session-distill", "--json"]],
		["agent-rework/v1", ["--rework", "--json"]],
		["reviewer-decision/v1", ["--reviewer-decision", "--json"]],
		["governance-decision-surface/v1", ["--governance", "--json"]],
	] as const)("accepts and projects the packet emitted by the %s producer", (schemaVersion, args) => {
		const packet = emittedPacket(...args);
		const validation = validatePacketSource(schemaVersion, packet);
		const projection = projectLegacyPacket(schemaVersion, packet, OBSERVED_AT);
		const canonical = canonicalizeLegacyPacket(schemaVersion, packet, {
			repoRoot: canonicalRepoRoot,
			observedAt: OBSERVED_AT,
		});

		expect(validation).toEqual({ valid: true, errors: [] });
		expect(projection.valid).toBe(true);
		expect(projection.source.schemaVersion).toBe(schemaVersion);
		expect(projection.evidenceRefs.length).toBeGreaterThan(0);
		expect(canonical.status).toBe("complete");
		expect(canonical.valid).toBe(true);
		expect(canonical.record?.schemaVersion).toBe(
			PACKET_FAMILY_REGISTRY.find(
				(family) => family.schemaVersion === schemaVersion,
			)?.canonicalContract,
		);
	});

	it("accepts an abbreviated legacy session SHA while canonical state uses live full SHA identity", () => {
		const packet = emittedPacket("--session-distill", "--json");
		if (typeof packet !== "object" || packet === null)
			throw new TypeError("expected session distill packet object");
		Reflect.set(packet, "headSha", "1111111");
		const liveHeadSha = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: canonicalRepoRoot,
			encoding: "utf8",
		}).trim();

		expect(validatePacketSource("session-distill/v1", packet)).toEqual({
			valid: true,
			errors: [],
		});
		const canonical = canonicalizeLegacyPacket("session-distill/v1", packet, {
			repoRoot: canonicalRepoRoot,
			observedAt: OBSERVED_AT,
		});

		expect(canonical).toMatchObject({
			status: "complete",
			valid: true,
			record: {
				schemaVersion: "synaipse-state/v1",
				repository: { headSha: liveHeadSha },
			},
		});
		expect(liveHeadSha).toHaveLength(40);
		expect(liveHeadSha).not.toBe("1111111");
	});

	it.each([
		["needs_evidence", "needs_evidence"],
		["blocked", "object"],
		["defer", "defer"],
		["blocked", "blocked_external"],
	] as const)("keeps reviewer %s/%s authority-safe inside a complete canonical transition", (status, decision) => {
		const packet = emittedPacket("--reviewer-decision", "--json");
		if (typeof packet !== "object" || packet === null)
			throw new TypeError("expected reviewer packet object");
		Reflect.set(packet, "status", status);
		Reflect.set(packet, "decision", decision);
		const canonical = canonicalizeLegacyPacket("reviewer-decision/v1", packet, {
			repoRoot: canonicalRepoRoot,
			observedAt: OBSERVED_AT,
		});

		expect(canonical).toMatchObject({
			status: "complete",
			valid: true,
			record: {
				schemaVersion: "synaipse-transition/v1",
				authority: { owner: "codex", standing: false },
				vitalDecision: { required: false, question: null },
			},
		});
		if (canonical.record?.schemaVersion !== "synaipse-transition/v1")
			throw new TypeError("expected complete canonical transition");
		expect(validateSynaipseTransition(canonical.record)).toEqual({
			valid: true,
			errors: [],
		});
		expect(
			decideSynaipseTransition(canonical.record, {
				expectedSha: canonical.record.repositorySha,
				now: OBSERVED_AT,
			}),
		).toMatchObject({
			status: "blocked",
			blockers: ["standing_authority_required"],
		});
	});

	it.each([
		"accept",
		"accepted_risk",
	] as const)("rejects reviewer %s as transition authority even with caller-authored receipt evidence", (decision) => {
		const packet = emittedPacket("--reviewer-decision", "--json");
		if (typeof packet !== "object" || packet === null)
			throw new TypeError("expected reviewer packet object");
		Reflect.set(packet, "status", "pass");
		Reflect.set(packet, "decision", decision);
		Reflect.set(packet, "coverageReceipt", {
			schemaVersion: "reviewer-coverage-receipt/v1",
			status: "pass",
			blockerClass: null,
			reason: "fresh reviewer coverage passed",
			requestedRoles: 2,
			completedRoles: 2,
			blockedRoles: 0,
			missingArtifacts: 0,
			synthesisStatus: "pass",
			evidenceRefs: ["review-artifact:qa", "review-artifact:adversarial"],
		});
		const canonical = canonicalizeLegacyPacket("reviewer-decision/v1", packet, {
			repoRoot: canonicalRepoRoot,
			observedAt: OBSERVED_AT,
		});

		expect(canonical).toMatchObject({
			status: "complete",
			record: {
				authority: { owner: "codex", standing: false },
				vitalDecision: { required: false, question: null },
			},
		});
		if (canonical.record?.schemaVersion !== "synaipse-transition/v1")
			throw new TypeError("expected complete canonical transition");
		expect(
			decideSynaipseTransition(canonical.record, {
				expectedSha: canonical.record.repositorySha,
				now: OBSERVED_AT,
			}),
		).toMatchObject({
			status: "blocked",
			blockers: ["standing_authority_required"],
		});
	});
});
