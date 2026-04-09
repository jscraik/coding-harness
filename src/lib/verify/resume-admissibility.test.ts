import { mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	evaluateResumeAdmissibility,
	findLatestAdmissibleRun,
} from "./resume-admissibility.js";
import {
	resolveVerifyRunPaths,
	writeVerifyGateResult,
	writeVerifyRunMetadata,
	writeVerifyRunSummary,
} from "./run-state.js";

const ORDERED_GATES = ["preflight", "lint", "policy", "test"];

describe("resume admissibility", () => {
	let repoRoot = "";

	beforeEach(() => {
		repoRoot = mkdtempSync(join(tmpdir(), "harness-resume-admissibility-"));
	});

	afterEach(() => {
		if (repoRoot) {
			rmSync(repoRoot, { recursive: true, force: true });
		}
	});

	function seedRun(
		runId: string,
		contractVersion: string,
		mtimeOffsetMs: number,
	): void {
		writeVerifyRunMetadata(repoRoot, {
			runId,
			mode: "fresh",
			sourceRunId: null,
			status: "failed",
			startedAt: "2026-04-09T09:00:00.000Z",
			finishedAt: "2026-04-09T09:01:00.000Z",
			resumeFromGateId: "policy",
			repoRoot,
			providerClass: "circleci",
			schemaVersion: "required-checks/v2",
			contractVersion,
			lane: {
				fastMode: false,
				changedOnly: false,
				strictMode: true,
			},
			identityTupleHash: "tuple-abc",
		});
		writeVerifyRunSummary(repoRoot, runId, {
			runId,
			overallStatus: "failed",
			failedGateId: "policy",
			freshVsResumed: "fresh",
			durationMs: 60_000,
		});

		writeVerifyGateResult(repoRoot, runId, {
			runId,
			gateId: "preflight",
			executionClass: "serial_guarded",
			attempt: 1,
			status: "passed",
			failureClass: "contract_policy",
			startedAt: "2026-04-09T09:00:01.000Z",
			finishedAt: "2026-04-09T09:00:10.000Z",
			nextAction: "continue",
			exitCode: 0,
		});
		writeVerifyGateResult(repoRoot, runId, {
			runId,
			gateId: "lint",
			executionClass: "read_only_parallel",
			attempt: 1,
			status: "passed",
			failureClass: "transient_infra",
			startedAt: "2026-04-09T09:00:11.000Z",
			finishedAt: "2026-04-09T09:00:20.000Z",
			nextAction: "continue",
			exitCode: 0,
		});
		writeVerifyGateResult(repoRoot, runId, {
			runId,
			gateId: "policy",
			executionClass: "serial_guarded",
			attempt: 1,
			status: "failed",
			failureClass: "contract_policy",
			startedAt: "2026-04-09T09:00:21.000Z",
			finishedAt: "2026-04-09T09:00:30.000Z",
			nextAction: "fix and resume",
			exitCode: 1,
		});

		const runDir = resolveVerifyRunPaths(repoRoot, runId).runDir;
		const timestamp = new Date(Date.now() - mtimeOffsetMs);
		utimesSync(runDir, timestamp, timestamp);
	}

	it("allows resume when compatibility checks pass", () => {
		seedRun("run-resume-001", "contract-v1", 2_000);

		const result = evaluateResumeAdmissibility({
			runId: "run-resume-001",
			resumeFromGateId: "policy",
			orderedGateIds: ORDERED_GATES,
			expectation: {
				repoRoot,
				providerClass: "circleci",
				schemaVersion: "required-checks/v2",
				contractVersion: "contract-v1",
				lane: {
					fastMode: false,
					changedOnly: false,
					strictMode: true,
				},
				identityTupleHash: "tuple-abc",
			},
		});

		expect(result.admissible).toBe(true);
		expect(result.code).toBe("OK");
		expect(result.reusableGateIds).toEqual(["preflight", "lint"]);
	});

	it("blocks resume when contract versions differ", () => {
		seedRun("run-resume-002", "contract-v1", 2_000);

		const result = evaluateResumeAdmissibility({
			runId: "run-resume-002",
			resumeFromGateId: "policy",
			orderedGateIds: ORDERED_GATES,
			expectation: {
				repoRoot,
				providerClass: "circleci",
				schemaVersion: "required-checks/v2",
				contractVersion: "contract-v2",
				lane: {
					fastMode: false,
					changedOnly: false,
					strictMode: true,
				},
				identityTupleHash: "tuple-abc",
			},
		});

		expect(result.admissible).toBe(false);
		expect(result.code).toBe("CONTRACT_VERSION_MISMATCH");
		expect(result.reason).toContain("contractVersion");
	});

	it("selects the newest compatible run when scanning history", () => {
		seedRun("run-resume-010", "contract-v0", 1_000);
		seedRun("run-resume-009", "contract-v1", 3_000);

		const result = findLatestAdmissibleRun({
			repoRoot,
			resumeFromGateId: "policy",
			orderedGateIds: ORDERED_GATES,
			expectation: {
				providerClass: "circleci",
				schemaVersion: "required-checks/v2",
				contractVersion: "contract-v1",
				lane: {
					fastMode: false,
					changedOnly: false,
					strictMode: true,
				},
				identityTupleHash: "tuple-abc",
			},
		});

		expect(result.admissible).toBe(true);
		expect(result.runId).toBe("run-resume-009");
		expect(result.reusableGateIds).toEqual(["preflight", "lint"]);
	});
});
