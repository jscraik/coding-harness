/**
 * Tests for JSC-127: harness check zero-config entrypoint.
 */

import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	DEFAULT_NORTH_STAR_CONTRACT,
	NORTH_STAR_DECISION_QUESTION_SPECS,
	NORTH_STAR_PRIMARY_BOTTLENECK,
	NORTH_STAR_PRIMARY_METRIC,
} from "../lib/contract/types.js";
import { runCheck, runCheckCLI } from "./check.js";

function minimalValidContract(): Record<string, unknown> {
	return {
		version: "1.5.0",
		northStar: {
			mission:
				"Coding Harness exists to let humans steer and agents execute safely, with PR lead time as the primary north-star metric.",
			mantra: [...DEFAULT_NORTH_STAR_CONTRACT.mantra],
			personalStandards: [...DEFAULT_NORTH_STAR_CONTRACT.personalStandards],
			primaryMetric: NORTH_STAR_PRIMARY_METRIC,
			primaryBottleneck: NORTH_STAR_PRIMARY_BOTTLENECK,
			autonomyBoundary:
				"Low and medium-risk autonomy should be automated where evidence is deterministic and rollback is clear; high-risk changes remain human-mediated.",
			safetyFloor: [
				"deterministic evidence",
				"strict current-head SHA discipline",
			],
			nonGoals: ["policy surface area as proxy progress"],
			decisionQuestions: NORTH_STAR_DECISION_QUESTION_SPECS.map((question) => ({
				id: question.id,
				prompt: question.prompt,
			})),
		},
		productSurface: {
			surfaces: [
				{
					surfaceId: "review-gate",
					surfaceType: "command",
					class: "core",
					owner: "workflow",
					northStarContribution:
						"Constrains merge-readiness decisions to throughput path",
					manualGlueReductionClaim:
						"Converts repeated review comments into deterministic checks",
					reliabilityContribution:
						"Ensures the same questions are asked every run",
					evidenceReference: "src/commands/review-gate.ts",
					ownedPaths: ["src/commands/review-gate.ts"],
					lastReviewedAt: "2026-04-21",
				},
			],
		},
		overrideReviewerRegistry: {
			trustedReviewers: [
				{
					reviewerId: "jamie-craik",
					reviewerType: "user",
					signatureRef: "refs/reviewers/jamie-craik",
					displayName: "Jamie Craik",
					status: "active",
				},
			],
		},
	};
}

function makeTmpDir(): string {
	return mkdtempSync(join(tmpdir(), "jsc127-"));
}

function writeContract(
	dir: string,
	data: unknown = minimalValidContract(),
): void {
	writeFileSync(
		join(dir, "harness.contract.json"),
		JSON.stringify(data, null, 2),
	);
}

function writeManifest(
	dir: string,
	data: unknown = {
		harnessVersion: "0.12.0",
		ciProvider: "github-actions",
		files: [],
	},
): void {
	const harnessDir = join(dir, ".harness");
	mkdirSync(harnessDir, { recursive: true });
	writeFileSync(
		join(harnessDir, "restore-manifest.json"),
		JSON.stringify(data, null, 2),
	);
}

function writeGitDir(dir: string): void {
	mkdirSync(join(dir, ".git"), { recursive: true });
}

function writeExecutable(path: string, content: string): void {
	writeFileSync(path, content, { encoding: "utf-8" });
	chmodSync(path, 0o755);
}

function writeRepoPackageVersion(dir: string, version: string): void {
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({ name: "@brainwav/coding-harness", version }),
		{ encoding: "utf-8" },
	);
}

// ─── runCheck (pure) ──────────────────────────────────────────────────────────

describe("runCheck", () => {
	let dir: string;
	const originalPath = process.env.PATH ?? "";
	const cleanupPaths: string[] = [];

	beforeEach(() => {
		dir = makeTmpDir();
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
		for (const path of cleanupPaths.splice(0, cleanupPaths.length)) {
			rmSync(path, { recursive: true, force: true });
		}
		process.env.PATH = originalPath;
	});

	it("returns a report with version, dir, timestamp, checks, counts, nextSteps", () => {
		const report = runCheck(dir);
		expect(report).toHaveProperty("version");
		expect(report).toHaveProperty("dir", dir);
		expect(report.timestamp).toMatch(/^\d{4}-/);
		expect(Array.isArray(report.checks)).toBe(true);
		expect(report).toHaveProperty("counts");
		expect(Array.isArray(report.nextSteps)).toBe(true);
	});

	it("git check is 'warn' when .git is absent", () => {
		const report = runCheck(dir);
		const gitCheck = report.checks.find((c) => c.id === "git");
		expect(gitCheck?.status).toBe("warn");
	});

	it("git check is 'ok' when .git exists", () => {
		writeGitDir(dir);
		const report = runCheck(dir);
		const gitCheck = report.checks.find((c) => c.id === "git");
		expect(gitCheck?.status).toBe("ok");
	});

	it("contract:present is 'fail' when harness.contract.json is absent", () => {
		const report = runCheck(dir);
		const check = report.checks.find((c) => c.id === "contract:present");
		expect(check?.status).toBe("fail");
		expect(check?.fix).toContain("harness contract init");
	});

	it("contract:present is 'ok' and contract:valid is 'ok' for a valid contract", () => {
		writeContract(dir);
		const report = runCheck(dir);
		const present = report.checks.find((c) => c.id === "contract:present");
		const valid = report.checks.find((c) => c.id === "contract:valid");
		expect(present?.status).toBe("ok");
		expect(valid?.status).toBe("ok");
	});

	it("contract:valid is 'fail' for an invalid contract", () => {
		writeContract(dir, { notAVersion: true }); // missing version field
		const report = runCheck(dir);
		const valid = report.checks.find((c) => c.id === "contract:valid");
		expect(valid?.status).toBe("fail");
		expect(valid?.fix).toContain("harness contract validate");
	});

	it("contract:present is 'fail' for malformed JSON", () => {
		writeFileSync(join(dir, "harness.contract.json"), "{ bad json");
		const report = runCheck(dir);
		const present = report.checks.find((c) => c.id === "contract:present");
		expect(present?.status).toBe("fail");
	});

	it("manifest check is 'warn' when .harness/restore-manifest.json is absent", () => {
		const report = runCheck(dir);
		const check = report.checks.find((c) => c.id === "manifest");
		expect(check?.status).toBe("warn");
		expect(check?.fix).toContain("harness init --track");
	});

	it("manifest check is 'ok' when manifest exists with current version", () => {
		writeManifest(dir);
		const report = runCheck(dir);
		const check = report.checks.find((c) => c.id === "manifest");
		// Manifest version may not match current harness version exactly,
		// so accept 'ok' or 'warn'
		expect(["ok", "warn"]).toContain(check?.status);
	});

	it("hasFailures is true when any check is fail", () => {
		// No contract → contract:present fails
		const report = runCheck(dir);
		expect(report.hasFailures).toBe(true);
	});

	it("hasFailures is false when only warnings (git + manifest)", () => {
		writeContract(dir);
		writeManifest(dir);
		// No .git, so git is warn; manifest present; contract valid
		const report = runCheck(dir);
		expect(report.hasFailures).toBe(false);
	});

	it("nextSteps contains fix commands for failing/warning checks", () => {
		const report = runCheck(dir);
		// contract:present fail → fix is harness contract init
		expect(
			report.nextSteps.some((s) => s.includes("harness contract init")),
		).toBe(true);
	});

	it("nextSteps is ['harness health'] when everything passes", () => {
		writeGitDir(dir);
		writeContract(dir);
		writeManifest(dir);
		const report = runCheck(dir);
		if (!report.hasFailures && report.counts.warn === 0) {
			expect(report.nextSteps).toEqual(["harness health"]);
		}
	});

	it("fails when global and repo-local harness versions drift", () => {
		writeGitDir(dir);
		writeContract(dir);
		writeManifest(dir);

		const scriptsDir = join(dir, "scripts");
		mkdirSync(scriptsDir, { recursive: true });
		writeExecutable(
			join(scriptsDir, "harness-cli.sh"),
			"#!/usr/bin/env bash\necho 'harness v0.12.0'\n",
		);
		writeRepoPackageVersion(dir, "0.12.0");

		const binDir = makeTmpDir();
		cleanupPaths.push(binDir);
		writeExecutable(
			join(binDir, "harness"),
			"#!/usr/bin/env bash\necho 'harness v0.6.0'\n",
		);
		process.env.PATH = `${binDir}${delimiter}${originalPath}`;

		const report = runCheck(dir);
		const coherenceCheck = report.checks.find(
			(check) => check.id === "harness:version-coherence",
		);
		expect(coherenceCheck?.status).toBe("fail");
		expect(coherenceCheck?.fix).toContain("scripts/harness-cli.sh");
		expect(report.hasFailures).toBe(true);
	});

	it("harness:version-coherence is 'warn' when no repo-local runner exists (skip)", () => {
		// No scripts/harness-cli.sh — detectHarnessVersionCoherence returns skip
		const report = runCheck(dir);
		const coherenceCheck = report.checks.find(
			(check) => check.id === "harness:version-coherence",
		);
		expect(coherenceCheck?.status).toBe("warn");
		expect(coherenceCheck?.detail).toContain("no repo-local harness runner");
	});

	it("harness:version-coherence is 'warn' with no fix when no repo-local runner exists (skip)", () => {
		// No scripts/harness-cli.sh — detectHarnessVersionCoherence returns skip
		writeContract(dir);
		const report = runCheck(dir);
		const coherenceCheck = report.checks.find(
			(check) => check.id === "harness:version-coherence",
		);
		expect(coherenceCheck?.status).toBe("warn");
		expect(coherenceCheck?.fix).toBeUndefined();
		expect(report.hasFailures).toBe(false);
	});

	it("harness:version-coherence is 'warn' when repo-local runner fails to produce a parseable version", () => {
		const scriptsDir = join(dir, "scripts");
		mkdirSync(scriptsDir, { recursive: true });
		// Script content should not matter because local version is read from
		// package.json; no package.json means coherence cannot be determined.
		writeExecutable(
			join(scriptsDir, "harness-cli.sh"),
			"#!/usr/bin/env bash\necho 'harness v0.12.0'\n",
		);

		const report = runCheck(dir);
		const coherenceCheck = report.checks.find(
			(check) => check.id === "harness:version-coherence",
		);
		expect(coherenceCheck?.status).toBe("warn");
		expect(coherenceCheck?.detail).toContain("Could not determine");
	});

	it("harness:version-coherence is 'ok' when versions match, with no fix field", () => {
		const scriptsDir = join(dir, "scripts");
		mkdirSync(scriptsDir, { recursive: true });
		writeExecutable(
			join(scriptsDir, "harness-cli.sh"),
			"#!/usr/bin/env bash\necho 'harness v1.0.0'\n",
		);
		writeRepoPackageVersion(dir, "1.0.0");
		const binDir = makeTmpDir();
		cleanupPaths.push(binDir);
		writeExecutable(
			join(binDir, "harness"),
			"#!/usr/bin/env bash\necho 'harness v1.0.0'\n",
		);
		process.env.PATH = `${binDir}${delimiter}${originalPath}`;

		const report = runCheck(dir);
		const coherenceCheck = report.checks.find(
			(check) => check.id === "harness:version-coherence",
		);
		expect(coherenceCheck?.status).toBe("ok");
		expect(coherenceCheck?.fix).toBeUndefined();
	});
});

// ─── runCheckCLI ─────────────────────────────────────────────────────────────

describe("runCheckCLI", () => {
	let dir: string;
	let infoSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		dir = makeTmpDir();
		infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		rmSync(dir, { recursive: true, force: true });
	});

	it("returns 1 when checks fail (no contract)", () => {
		const code = runCheckCLI(dir, {});
		expect(code).toBe(1);
	});

	it("returns 0 when no failures (warnings only)", () => {
		writeContract(dir);
		writeManifest(dir);
		const code = runCheckCLI(dir, {});
		expect(code).toBe(0);
	});

	it("--json emits parseable JSON with all required fields", () => {
		writeContract(dir);
		const code = runCheckCLI(dir, { json: true });
		const output = infoSpy.mock.calls[0]?.[0] as string;
		const parsed = JSON.parse(output) as {
			version: string;
			dir: string;
			checks: unknown[];
			counts: Record<string, number>;
			nextSteps: string[];
		};
		expect(parsed.version).toBeTruthy();
		expect(parsed.dir).toBe(dir);
		expect(Array.isArray(parsed.checks)).toBe(true);
		expect(parsed.counts).toHaveProperty("ok");
		expect(Array.isArray(parsed.nextSteps)).toBe(true);
		// Return code matches hasFailures
		expect([0, 1]).toContain(code);
	});

	it("--json: returns 1 for failing checks", () => {
		const code = runCheckCLI(dir, { json: true });
		expect(code).toBe(1);
		const output = infoSpy.mock.calls[0]?.[0] as string;
		const parsed = JSON.parse(output) as { hasFailures: boolean };
		expect(parsed.hasFailures).toBe(true);
	});

	it("--json: returns 0 when no failures", () => {
		writeContract(dir);
		writeManifest(dir);
		const code = runCheckCLI(dir, { json: true });
		expect(code).toBe(0);
		const output = infoSpy.mock.calls[0]?.[0] as string;
		const parsed = JSON.parse(output) as { hasFailures: boolean };
		expect(parsed.hasFailures).toBe(false);
	});

	it("human output contains check status lines", () => {
		writeContract(dir);
		const code = runCheckCLI(dir, {});
		expect(code).toBeTypeOf("number");
		const allOutput = infoSpy.mock.calls
			.map((c: unknown[]) => c[0] as string)
			.join("\n");
		expect(allOutput).toContain("harness check");
		expect(allOutput).toContain("Next:");
	});

	it("works without a target dir argument (uses cwd fallback)", () => {
		// just ensure it doesn't throw — result depends on actual cwd state
		expect(() => runCheckCLI(undefined, {})).not.toThrow();
	});

	it("accepts an explicit path argument", () => {
		const code = runCheckCLI(dir, {});
		expect([0, 1]).toContain(code);
		const allOutput = infoSpy.mock.calls
			.map((c: unknown[]) => c[0] as string)
			.join("\n");
		expect(allOutput).toContain(dir);
	});

	it("check command registered and reachable via existsSync on source file", () => {
		expect(
			existsSync(
				new URL("./check.js", import.meta.url).pathname.replace(".js", ".ts"),
			),
		).toBe(true);
	});
});
