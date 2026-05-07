import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	FLEET_PLAN_SCHEMA_VERSION,
	buildFleetRemediationPlan,
	runFleetPlanCLI,
} from "./fleet-plan.js";

describe("fleet-plan", () => {
	it("builds an agent-native plan with safe dry-run commands", () => {
		const plan = buildFleetRemediationPlan({
			matrixArtifact: "artifacts/harness-upgrade-matrix-dev.json",
			generatedAt: "2026-05-06T12:00:00.000Z",
			matrix: {
				results: [
					{
						repo: "/repo/ready",
						updateMode: "tracked-update",
						trackedManifest: true,
						missingFleetContractSurfaces: [],
						legacyGreptilePaths: [],
						errors: [],
						exitCode: 0,
					},
					{
						repo: "/repo/untracked",
						updateMode: "adoption-preview",
						trackedManifest: false,
						missingFleetContractSurfaces: [
							{ group: "coderabbit", path: ".coderabbit.yaml" },
							{ group: "codestyle", path: "CODESTYLE.md" },
						],
						legacyGreptilePaths: [],
						errors: [
							"fleet contract missing coderabbit surface .coderabbit.yaml",
						],
						exitCode: 0,
					},
					{
						repo: "/repo/gha",
						updateMode: "tracked-update",
						trackedManifest: true,
						missingFleetContractSurfaces: [
							{ group: "circleci", path: ".circleci/config.yml" },
						],
						legacyGreptilePaths: [],
						errors: [
							"fleet contract missing circleci surface .circleci/config.yml",
						],
						exitCode: 0,
					},
					{
						repo: "/repo/greptile",
						updateMode: "tracked-update",
						trackedManifest: true,
						missingFleetContractSurfaces: [],
						legacyGreptilePaths: [".greptile"],
						errors: ["legacy Greptile artifact still present: .greptile"],
						exitCode: 0,
					},
					{
						repo: "/repo/coderabbit",
						updateMode: "tracked-update",
						trackedManifest: true,
						missingFleetContractSurfaces: [
							{ group: "coderabbit", path: ".coderabbit.yaml" },
						],
						legacyGreptilePaths: [],
						errors: [
							"fleet contract missing coderabbit surface .coderabbit.yaml",
						],
						exitCode: 0,
					},
					{
						repo: "/repo/stale-codestyle",
						updateMode: "tracked-update",
						trackedManifest: true,
						missingFleetContractSurfaces: [],
						legacyGreptilePaths: [],
						codestyleParityFailures: [
							{
								path: "codestyle/17-testing.md",
								reason: "hash-mismatch",
							},
						],
						errors: [
							"codestyle parity mismatch: codestyle/17-testing.md (hash-mismatch)",
						],
						exitCode: 0,
					},
				],
			},
		});

		expect(plan.schemaVersion).toBe(FLEET_PLAN_SCHEMA_VERSION);
		expect(plan.liveUpgradeReady).toBe(false);
		expect(plan.safeToRun).toBe(true);
		expect(plan.nextCommandArgv).toEqual([
			"harness",
			"init",
			"/repo/untracked",
			"--dry-run",
			"--json",
		]);
		expect(plan.summary).toMatchObject({
			repoCount: 6,
			ready: 1,
			needsAdoption: 1,
			needsCircleCiMigration: 1,
			needsCodeRabbitSetup: 1,
			needsCodestyleInstall: 0,
			needsCodestyleRefresh: 1,
			needsGreptileCleanup: 1,
			blocked: 0,
		});
		expect(plan.findingCounts).toMatchObject({
			notHarnessTracked: 1,
			missingCircleCi: 1,
			missingCodeRabbit: 2,
			missingCodestyle: 1,
			staleCodestyle: 1,
			legacyGreptile: 1,
		});
		expect(plan.liveUpgradeBlockedBecause).toEqual(
			expect.arrayContaining([
				"1 repo needs harness adoption before live upgrade",
				"1 repo is missing CircleCI governance surfaces",
				"2 repos are missing CodeRabbit review surfaces",
				"1 repo is missing CODESTYLE surfaces",
				"1 repo has CODESTYLE parity failures",
				"1 repo still contains legacy Greptile artifacts",
			]),
		);
		expect(
			plan.firstSafeWave.map((command) => command.nextCommandArgv),
		).toEqual([
			["harness", "init", "/repo/untracked", "--dry-run", "--json"],
			[
				"harness",
				"ci-migrate",
				"prepare",
				"/repo/gha",
				"--provider",
				"circleci",
				"--dry-run",
				"--json",
			],
			[
				"harness",
				"init",
				"/repo/coderabbit",
				"--update",
				"--dry-run",
				"--json",
			],
			[
				"harness",
				"init",
				"/repo/stale-codestyle",
				"--update",
				"--dry-run",
				"--json",
			],
			["harness", "eject", "/repo/greptile", "--dry-run", "--json"],
		]);
		expect(plan.repos[1]).toMatchObject({
			status: "needs-adoption",
			safeToRun: true,
			nextCommandArgv: [
				"harness",
				"init",
				"/repo/untracked",
				"--dry-run",
				"--json",
			],
			requiresApprovalBeforeMutation: true,
			writesFiles: false,
			blockingReasons: [
				"repo-not-harness-tracked",
				"missing-coderabbit",
				"missing-codestyle",
			],
		});
		expect(plan.repos[2]).toMatchObject({
			status: "needs-circleci-migration",
			risk: "medium",
			nextCommandArgv: [
				"harness",
				"ci-migrate",
				"prepare",
				"/repo/gha",
				"--provider",
				"circleci",
				"--dry-run",
				"--json",
			],
		});
		expect(plan.repos[3]).toMatchObject({
			status: "needs-greptile-cleanup",
			nextCommandArgv: [
				"harness",
				"eject",
				"/repo/greptile",
				"--dry-run",
				"--json",
			],
		});
		expect(plan.repos[4]).toMatchObject({
			status: "needs-coderabbit-setup",
			nextCommandArgv: [
				"harness",
				"init",
				"/repo/coderabbit",
				"--update",
				"--dry-run",
				"--json",
			],
			blockingReasons: ["missing-coderabbit"],
		});
		expect(plan.repos[5]).toMatchObject({
			status: "needs-codestyle-refresh",
			nextCommandArgv: [
				"harness",
				"init",
				"/repo/stale-codestyle",
				"--update",
				"--dry-run",
				"--json",
			],
			blockingReasons: ["stale-codestyle"],
			evidence: {
				codestyleParityFailures: ["codestyle/17-testing.md"],
			},
		});
	});

	it("blocks command recommendation when dry-run safety is not established", () => {
		const plan = buildFleetRemediationPlan({
			matrixArtifact: "matrix.json",
			generatedAt: "2026-05-06T12:00:00.000Z",
			matrix: {
				results: [
					{
						repo: "/repo/mutated",
						trackedManifest: true,
						missingFleetContractSurfaces: [],
						legacyGreptilePaths: [],
						errors: ["git status changed during dry-run"],
						statusChangedByDryRun: true,
						exitCode: 0,
					},
				],
			},
		});

		expect(plan.safeToRun).toBe(false);
		expect(plan.nextCommandArgv).toBeNull();
		expect(plan.repos[0]).toMatchObject({
			status: "blocked",
			safeToRun: false,
			risk: "high",
			blockingReasons: ["dry-run-mutated-repository"],
		});
	});

	it("recommends codestyle install when tracked repos omit codestyle surfaces", () => {
		const plan = buildFleetRemediationPlan({
			matrixArtifact: "matrix.json",
			generatedAt: "2026-05-06T12:00:00.000Z",
			matrix: {
				results: [
					{
						repo: "/repo/missing-codestyle",
						trackedManifest: true,
						missingFleetContractSurfaces: [
							{ group: "codestyle", path: "CODESTYLE.md" },
							{ group: "codestyle", path: "codestyle/CHECKSUMS.sha256" },
						],
						legacyGreptilePaths: [],
						errors: ["fleet contract missing codestyle surface CODESTYLE.md"],
						exitCode: 0,
					},
				],
			},
		});

		expect(plan.safeToRun).toBe(true);
		expect(plan.repos[0]).toMatchObject({
			status: "needs-codestyle-install",
			nextCommandArgv: [
				"harness",
				"init",
				"/repo/missing-codestyle",
				"--update",
				"--dry-run",
				"--json",
			],
			blockingReasons: ["missing-codestyle"],
		});
		expect(plan.summary).toMatchObject({
			needsCodestyleInstall: 1,
			needsCodestyleRefresh: 0,
		});
	});

	it("counts missing CODESTYLE parity entries as install blockers", () => {
		const plan = buildFleetRemediationPlan({
			matrixArtifact: "matrix.json",
			generatedAt: "2026-05-06T12:00:00.000Z",
			matrix: {
				results: [
					{
						repo: "/repo/missing-codestyle-parity",
						trackedManifest: true,
						missingFleetContractSurfaces: [],
						legacyGreptilePaths: [],
						codestyleParityFailures: [
							{
								path: "CODESTYLE.md",
								reason: "missing",
							},
						],
						errors: ["codestyle parity mismatch: CODESTYLE.md (missing)"],
						exitCode: 0,
					},
				],
			},
		});

		expect(plan.repos[0]).toMatchObject({
			status: "needs-codestyle-install",
			blockingReasons: ["missing-codestyle", "stale-codestyle"],
		});
		expect(plan.findingCounts).toMatchObject({
			missingCodestyle: 1,
			staleCodestyle: 1,
		});
	});

	it("blocks empty matrix artifacts instead of reporting live-upgrade readiness", () => {
		const plan = buildFleetRemediationPlan({
			matrixArtifact: "empty-matrix.json",
			generatedAt: "2026-05-06T12:00:00.000Z",
			matrix: { results: [] },
		});

		expect(plan.liveUpgradeReady).toBe(false);
		expect(plan.safeToRun).toBe(false);
		expect(plan.nextCommandArgv).toBeNull();
		expect(plan.liveUpgradeBlockedBecause).toEqual([
			"matrix artifact contained no repository results",
		]);
	});

	it("shell-quotes display commands while keeping argv machine-safe", () => {
		const plan = buildFleetRemediationPlan({
			matrixArtifact: "matrix.json",
			generatedAt: "2026-05-06T12:00:00.000Z",
			matrix: {
				results: [
					{
						repo: "/repo/$(bad)",
						trackedManifest: false,
						missingFleetContractSurfaces: [],
						legacyGreptilePaths: [],
						errors: [],
						exitCode: 0,
					},
				],
			},
		});

		expect(plan.repos[0]?.nextCommand).toBe(
			"harness init '/repo/$(bad)' --dry-run --json",
		);
		expect(plan.repos[0]?.nextCommandArgv).toEqual([
			"harness",
			"init",
			"/repo/$(bad)",
			"--dry-run",
			"--json",
		]);
	});
});

describe("runFleetPlanCLI", () => {
	let tempDir: string;
	let stdout: ReturnType<typeof vi.spyOn>;
	let stderr: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-fleet-plan-"));
		stdout = vi.spyOn(console, "info").mockImplementation(() => undefined);
		stderr = vi.spyOn(console, "error").mockImplementation(() => undefined);
	});

	afterEach(() => {
		stdout.mockRestore();
		stderr.mockRestore();
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("emits JSON from a matrix artifact", () => {
		mkdirSync(join(tempDir, "artifacts"), { recursive: true });
		const artifact = join(tempDir, "artifacts/matrix.json");
		writeFileSync(
			artifact,
			JSON.stringify({
				results: [
					{
						repo: "/repo/ready",
						trackedManifest: true,
						missingFleetContractSurfaces: [],
						legacyGreptilePaths: [],
						errors: [],
					},
				],
			}),
		);

		const exitCode = runFleetPlanCLI(["--from", artifact, "--json"]);

		expect(exitCode).toBe(0);
		const output = JSON.parse(stdout.mock.calls[0]?.[0] as string) as {
			schemaVersion: string;
			repos: Array<{ repo: string; status: string }>;
		};
		expect(output.schemaVersion).toBe(FLEET_PLAN_SCHEMA_VERSION);
		expect(output.repos).toEqual([
			expect.objectContaining({ repo: "/repo/ready", status: "ready" }),
		]);
	});

	it("returns usage error when --from is missing", () => {
		expect(runFleetPlanCLI(["--json"])).toBe(2);
		expect(stderr).toHaveBeenCalledWith("--from is required");
	});
});
