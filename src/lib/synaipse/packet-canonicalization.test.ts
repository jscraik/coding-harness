import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canonicalizeLegacyPacket } from "./packet-canonicalization.js";
import {
	PACKET_FAMILY_REGISTRY,
	projectLegacyPacket,
	validatePacketSource,
} from "./packet-consolidation.js";

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
	canonicalRepoRoot = mkdtempSync(
		resolve(tmpdir(), "packet-canonicalization-repo-"),
	);
	execFileSync("git", ["init", "--quiet"], { cwd: canonicalRepoRoot });
	execFileSync("git", ["config", "user.email", "fixture@example.invalid"], {
		cwd: canonicalRepoRoot,
	});
	execFileSync("git", ["config", "user.name", "Canonical Fixture"], {
		cwd: canonicalRepoRoot,
	});
	writeFileSync(resolve(canonicalRepoRoot, "fixture.txt"), "fixture\n");
	execFileSync("git", ["add", "fixture.txt"], { cwd: canonicalRepoRoot });
	execFileSync("git", ["commit", "--quiet", "-m", "fixture"], {
		cwd: canonicalRepoRoot,
	});
	execFileSync(
		"git",
		[
			"remote",
			"add",
			"origin",
			"https://github.com/jscraik/coding-harness.git",
		],
		{ cwd: canonicalRepoRoot },
	);
	const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: canonicalRepoRoot,
		encoding: "utf8",
	}).trim();
	execFileSync("git", ["update-ref", "refs/remotes/origin/main", headSha], {
		cwd: canonicalRepoRoot,
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
});
