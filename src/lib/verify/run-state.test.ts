import { existsSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	RunStateError,
	deriveIdentityTupleHash,
	listVerifyRunIds,
	loadVerifyGateResult,
	loadVerifyRunMetadata,
	loadVerifyRunSummary,
	pruneVerifyRuns,
	resolveVerifyRunPaths,
	writeVerifyGateResult,
	writeVerifyRunMetadata,
	writeVerifyRunSummary,
} from "./run-state.js";

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

describe("verify run-state", () => {
	let repoRoot = "";

	beforeEach(() => {
		repoRoot = mkdtempSync(join(tmpdir(), "harness-verify-run-state-"));
	});

	afterEach(() => {
		if (repoRoot) {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("keeps duplicate gate writes idempotent for the same key", () => {
		const result = {
			runId: "run-gate-001",
			gateId: "lint",
			executionClass: "serial_guarded" as const,
			attempt: 1,
			status: "passed" as const,
			failureClass: "contract_policy" as const,
			startedAt: "2026-04-09T12:00:00.000Z",
			finishedAt: "2026-04-09T12:00:02.000Z",
			nextAction: "continue",
			exitCode: 0,
		};

		const first = writeVerifyGateResult(repoRoot, "run-gate-001", result);
		expect(first.written).toBe(true);
		expect(first.idempotent).toBe(false);

		const second = writeVerifyGateResult(repoRoot, "run-gate-001", result);
		expect(second.written).toBe(false);
		expect(second.idempotent).toBe(true);

		expect(() =>
			writeVerifyGateResult(repoRoot, "run-gate-001", {
				...result,
				status: "failed",
				failureClass: "internal_unknown",
				nextAction: "rerun",
				exitCode: 1,
			}),
		).toThrowError(RunStateError);
	});

	it("prunes old runs while preserving the latest failed run", async () => {
		const runStates: Array<{
			runId: string;
			status: "passed" | "failed" | "blocked";
		}> = [
			{ runId: "run-001", status: "passed" },
			{ runId: "run-002", status: "passed" },
			{ runId: "run-003", status: "failed" },
			{ runId: "run-004", status: "failed" },
		];

		for (const run of runStates) {
			writeVerifyRunSummary(repoRoot, run.runId, {
				runId: run.runId,
				overallStatus: run.status,
				failedGateId: run.status === "passed" ? null : "policy",
				freshVsResumed: "fresh",
				durationMs: 100,
			});
			await delay(5);
		}
		// Rewrite an older run's summary to verify ordering follows child-file mtime.
		writeVerifyRunSummary(repoRoot, "run-001", {
			runId: "run-001",
			overallStatus: "passed",
			failedGateId: null,
			freshVsResumed: "fresh",
			durationMs: 100,
		});

		const pruned = pruneVerifyRuns({
			repoRoot,
			keepCount: 1,
			protectLatestFailed: true,
		});

		expect(pruned.latestFailedRunId).toBe("run-004");
		expect([...pruned.keptRunIds].sort()).toEqual(["run-001", "run-004"]);
		expect([...pruned.deletedRunIds].sort()).toEqual(["run-002", "run-003"]);
		expect(existsSync(resolveVerifyRunPaths(repoRoot, "run-004").runDir)).toBe(
			true,
		);
		expect(existsSync(resolveVerifyRunPaths(repoRoot, "run-003").runDir)).toBe(
			false,
		);
	});

	it("rejects writing summary when summary.runId does not match target runId", () => {
		expect(() =>
			writeVerifyRunSummary(repoRoot, "run-expected", {
				runId: "run-other",
				overallStatus: "failed",
				failedGateId: "policy-gate",
				freshVsResumed: "fresh",
				durationMs: 10,
			}),
		).toThrow(RunStateError);
	});
});

describe("verify run-state — path resolution", () => {
	let repoRoot = "";

	beforeEach(() => {
		repoRoot = mkdtempSync(join(tmpdir(), "harness-run-state-paths-"));
	});

	afterEach(() => {
		if (repoRoot) {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("resolves canonical paths for a valid run id", () => {
		const paths = resolveVerifyRunPaths(repoRoot, "run-abc-123");
		expect(paths.runsDir).toContain(".harness/runs");
		expect(paths.runDir).toContain("run-abc-123");
		expect(paths.runPath).toContain("run.json");
		expect(paths.summaryPath).toContain("summary.json");
		expect(paths.gatesDir).toContain("gates");
	});

	it("throws RunStateError with E_VALIDATION for invalid run id", () => {
		expect(() => resolveVerifyRunPaths(repoRoot, "ab")).toThrow(RunStateError);
		expect(() => resolveVerifyRunPaths(repoRoot, "")).toThrow(RunStateError);
		expect(() => resolveVerifyRunPaths(repoRoot, "run/../../bad")).toThrow();
	});

	it("throws RunStateError with E_VALIDATION for gate id that starts with non-alphanumeric", () => {
		expect(() =>
			writeVerifyGateResult(repoRoot, "run-gate-bad", {
				runId: "run-gate-bad",
				gateId: "-bad-gate",
				executionClass: "serial_guarded",
				attempt: 1,
				status: "passed",
				failureClass: "contract_policy",
				startedAt: "2026-04-09T12:00:00.000Z",
				finishedAt: "2026-04-09T12:00:01.000Z",
				nextAction: "continue",
				exitCode: 0,
			}),
		).toThrow(RunStateError);
	});

	it("throws RunStateError when gate attempt is zero or negative", () => {
		expect(() =>
			writeVerifyGateResult(repoRoot, "run-gate-inv", {
				runId: "run-gate-inv",
				gateId: "lint",
				executionClass: "serial_guarded",
				attempt: 0,
				status: "passed",
				failureClass: "contract_policy",
				startedAt: "2026-04-09T12:00:00.000Z",
				finishedAt: "2026-04-09T12:00:01.000Z",
				nextAction: "continue",
				exitCode: 0,
			}),
		).toThrow(RunStateError);
	});

	it("throws RunStateError when gate runId does not match target runId", () => {
		expect(() =>
			writeVerifyGateResult(repoRoot, "run-gate-mismatch", {
				runId: "different-run-id",
				gateId: "lint",
				executionClass: "serial_guarded",
				attempt: 1,
				status: "passed",
				failureClass: "contract_policy",
				startedAt: "2026-04-09T12:00:00.000Z",
				finishedAt: "2026-04-09T12:00:01.000Z",
				nextAction: "continue",
				exitCode: 0,
			}),
		).toThrow(RunStateError);
	});
});

describe("verify run-state — load functions", () => {
	let repoRoot = "";

	beforeEach(() => {
		repoRoot = mkdtempSync(join(tmpdir(), "harness-run-state-load-"));
	});

	afterEach(() => {
		if (repoRoot) {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	const baseMetadata = {
		runId: "run-load-001",
		mode: "fresh" as const,
		sourceRunId: null,
		status: "failed" as const,
		startedAt: "2026-04-09T09:00:00.000Z",
		finishedAt: "2026-04-09T09:01:00.000Z",
		resumeFromGateId: null,
		repoRoot: "",
		providerClass: "circleci",
		schemaVersion: "required-checks/v2",
		contractVersion: "contract-v1",
		lane: { fastMode: false, changedOnly: false, strictMode: true },
	};

	it("writes and loads run metadata round-trip", () => {
		const metadata = { ...baseMetadata, repoRoot };
		writeVerifyRunMetadata(repoRoot, metadata);
		const loaded = loadVerifyRunMetadata(repoRoot, metadata.runId);

		expect(loaded.runId).toBe(metadata.runId);
		expect(loaded.mode).toBe("fresh");
		expect(loaded.status).toBe("failed");
		expect(loaded.providerClass).toBe("circleci");
		expect(loaded.contractVersion).toBe("contract-v1");
		expect(loaded.lane).toEqual({
			fastMode: false,
			changedOnly: false,
			strictMode: true,
		});
	});

	it("throws RunStateError E_IO when run.json does not exist", () => {
		expect(() => loadVerifyRunMetadata(repoRoot, "run-does-not-exist")).toThrow(
			RunStateError,
		);
	});

	it("writes and loads run summary round-trip", () => {
		const runId = "run-load-002";
		const summary = {
			runId,
			overallStatus: "failed" as const,
			failedGateId: "lint",
			freshVsResumed: "fresh" as const,
			durationMs: 5000,
		};
		writeVerifyRunSummary(repoRoot, runId, summary);
		const loaded = loadVerifyRunSummary(repoRoot, runId);

		expect(loaded.runId).toBe(runId);
		expect(loaded.overallStatus).toBe("failed");
		expect(loaded.failedGateId).toBe("lint");
		expect(loaded.durationMs).toBe(5000);
	});

	it("throws RunStateError E_IO when summary.json does not exist", () => {
		expect(() => loadVerifyRunSummary(repoRoot, "run-does-not-exist")).toThrow(
			RunStateError,
		);
	});

	it("writes and loads gate result round-trip", () => {
		const runId = "run-load-003";
		const gateResult = {
			runId,
			gateId: "lint",
			executionClass: "read_only_parallel" as const,
			attempt: 1,
			status: "passed" as const,
			failureClass: "transient_infra" as const,
			startedAt: "2026-04-09T09:00:01.000Z",
			finishedAt: "2026-04-09T09:00:05.000Z",
			nextAction: "continue",
			exitCode: 0,
		};
		writeVerifyGateResult(repoRoot, runId, gateResult);
		const loaded = loadVerifyGateResult(repoRoot, runId, "lint");

		expect(loaded.gateId).toBe("lint");
		expect(loaded.status).toBe("passed");
		expect(loaded.attempt).toBe(1);
	});

	it("throws RunStateError E_IO when gate result does not exist", () => {
		expect(() =>
			loadVerifyGateResult(repoRoot, "run-does-not-exist", "lint"),
		).toThrow(RunStateError);
	});

	it("listVerifyRunIds returns ids sorted by newest first", () => {
		const now = Date.now();
		const ids = ["run-list-001", "run-list-002", "run-list-003"];
		for (const [index, id] of ids.entries()) {
			writeVerifyRunSummary(repoRoot, id, {
				runId: id,
				overallStatus: "passed",
				failedGateId: null,
				freshVsResumed: "fresh",
				durationMs: 100,
			});
			const { runDir, runPath, summaryPath } = resolveVerifyRunPaths(
				repoRoot,
				id,
			);
			const mtime = new Date(now - index * 1000);
			utimesSync(runDir, mtime, mtime);
			if (existsSync(runPath)) {
				utimesSync(runPath, mtime, mtime);
			}
			utimesSync(summaryPath, mtime, mtime);
		}

		const result = listVerifyRunIds(repoRoot);
		// Should be ordered newest first: run-list-001, run-list-002, run-list-003
		expect(result[0]).toBe("run-list-001");
		expect(result[1]).toBe("run-list-002");
		expect(result[2]).toBe("run-list-003");
	});

	it("listVerifyRunIds returns empty array when no runs directory exists", () => {
		const freshRoot = mkdtempSync(join(tmpdir(), "harness-empty-runs-"));
		try {
			expect(listVerifyRunIds(freshRoot)).toEqual([]);
		} finally {
			rmSync(freshRoot, { recursive: true, force: true });
		}
	});
});

describe("verify run-state — pruning edge cases", () => {
	let repoRoot = "";

	beforeEach(() => {
		repoRoot = mkdtempSync(join(tmpdir(), "harness-run-state-prune-"));
	});

	afterEach(() => {
		if (repoRoot) {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	it("returns empty arrays when fewer runs than keepCount", () => {
		writeVerifyRunSummary(repoRoot, "run-one", {
			runId: "run-one",
			overallStatus: "passed",
			failedGateId: null,
			freshVsResumed: "fresh",
			durationMs: 100,
		});

		const result = pruneVerifyRuns({ repoRoot, keepCount: 10 });
		expect(result.deletedRunIds).toHaveLength(0);
		expect(result.keptRunIds).toHaveLength(1);
		expect(result.latestFailedRunId).toBeNull();
	});

	it("throws RunStateError for keepCount of zero", () => {
		expect(() => pruneVerifyRuns({ repoRoot, keepCount: 0 })).toThrow(
			RunStateError,
		);
	});

	it("respects protectLatestFailed=false by not preserving extra failed run", () => {
		const now = Date.now();
		const runs = [
			{ runId: "run-k01", status: "passed" as const, offset: 1_000 },
			{ runId: "run-k02", status: "failed" as const, offset: 2_000 },
		];
		for (const run of runs) {
			writeVerifyRunSummary(repoRoot, run.runId, {
				runId: run.runId,
				overallStatus: run.status,
				failedGateId: run.status === "failed" ? "lint" : null,
				freshVsResumed: "fresh",
				durationMs: 100,
			});
			const { runDir } = resolveVerifyRunPaths(repoRoot, run.runId);
			const mtime = new Date(now - run.offset);
			utimesSync(runDir, mtime, mtime);
		}

		const result = pruneVerifyRuns({
			repoRoot,
			keepCount: 1,
			protectLatestFailed: false,
		});

		// With protectLatestFailed=false, only keepCount=1 run is kept
		expect(result.keptRunIds).toHaveLength(1);
		expect(result.deletedRunIds).toHaveLength(1);
		expect(result.latestFailedRunId).toBeNull();
	});
});

describe("verify run-state — deriveIdentityTupleHash", () => {
	it("produces consistent hash for the same entries in any order", () => {
		const entries = [
			{
				gateId: "lint",
				provider: "circleci",
				externalIdPattern: "^lint$",
				githubCheckName: "pr-pipeline",
			},
			{
				gateId: "policy",
				provider: "circleci",
				externalIdPattern: "^policy$",
				githubCheckName: null,
			},
		];

		const hash1 = deriveIdentityTupleHash(entries);
		const hash2 = deriveIdentityTupleHash([...entries].reverse());

		expect(hash1).toBe(hash2);
		expect(typeof hash1).toBe("string");
		expect(hash1).toHaveLength(16);
	});

	it("produces different hashes for different entries", () => {
		const hashA = deriveIdentityTupleHash([
			{
				gateId: "lint",
				provider: "circleci",
				externalIdPattern: "^lint$",
				githubCheckName: null,
			},
		]);
		const hashB = deriveIdentityTupleHash([
			{
				gateId: "typecheck",
				provider: "circleci",
				externalIdPattern: "^typecheck$",
				githubCheckName: null,
			},
		]);

		expect(hashA).not.toBe(hashB);
	});

	it("treats null and empty string githubCheckName equivalently", () => {
		const hashNull = deriveIdentityTupleHash([
			{
				gateId: "gate",
				provider: "circleci",
				externalIdPattern: "^gate$",
				githubCheckName: null,
			},
		]);
		const hashEmpty = deriveIdentityTupleHash([
			{
				gateId: "gate",
				provider: "circleci",
				externalIdPattern: "^gate$",
				githubCheckName: "",
			},
		]);

		expect(hashNull).toBe(hashEmpty);
	});
});
