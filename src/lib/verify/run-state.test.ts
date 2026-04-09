import { existsSync, mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	RunStateError,
	pruneVerifyRuns,
	resolveVerifyRunPaths,
	writeVerifyGateResult,
	writeVerifyRunSummary,
} from "./run-state.js";

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

	it("prunes old runs while preserving the latest failed run", () => {
		const now = Date.now();
		const runStates: Array<{
			runId: string;
			status: "passed" | "failed" | "blocked";
			mtime: number;
		}> = [
			{ runId: "run-001", status: "passed", mtime: now - 1_000 },
			{ runId: "run-002", status: "passed", mtime: now - 2_000 },
			{ runId: "run-003", status: "failed", mtime: now - 3_000 },
			{ runId: "run-004", status: "failed", mtime: now - 4_000 },
		];

		for (const run of runStates) {
			writeVerifyRunSummary(repoRoot, run.runId, {
				runId: run.runId,
				overallStatus: run.status,
				failedGateId: run.status === "passed" ? null : "policy",
				freshVsResumed: "fresh",
				durationMs: 100,
			});
			const { runDir } = resolveVerifyRunPaths(repoRoot, run.runId);
			const timestamp = new Date(run.mtime);
			utimesSync(runDir, timestamp, timestamp);
		}

		const pruned = pruneVerifyRuns({
			repoRoot,
			keepCount: 1,
			protectLatestFailed: true,
		});

		expect(pruned.latestFailedRunId).toBe("run-003");
		expect(pruned.keptRunIds).toEqual(["run-001", "run-003"]);
		expect(pruned.deletedRunIds).toEqual(["run-002", "run-004"]);
		expect(existsSync(resolveVerifyRunPaths(repoRoot, "run-003").runDir)).toBe(
			true,
		);
		expect(existsSync(resolveVerifyRunPaths(repoRoot, "run-002").runDir)).toBe(
			false,
		);
	});
});
