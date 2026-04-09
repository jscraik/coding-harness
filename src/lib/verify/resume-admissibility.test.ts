import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
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

	it("rejects resume when the requested gate is not the failed or blocked anchor", () => {
		seedRun("run-resume-001b", "contract-v1", 2_000);

		const result = evaluateResumeAdmissibility({
			runId: "run-resume-001b",
			resumeFromGateId: "lint",
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

		expect(result.admissible).toBe(false);
		expect(result.code).toBe("RESUME_GATE_RESULT_INVALID");
		expect(result.reason).toContain("cannot resume from passed gate lint");
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

	it("rejects when resumeFromGateId is not in orderedGateIds", () => {
		seedRun("run-resume-003", "contract-v1", 2_000);

		const result = evaluateResumeAdmissibility({
			runId: "run-resume-003",
			resumeFromGateId: "nonexistent-gate",
			orderedGateIds: ORDERED_GATES,
			expectation: {
				repoRoot,
				providerClass: "circleci",
				schemaVersion: "required-checks/v2",
				contractVersion: "contract-v1",
				lane: { fastMode: false, changedOnly: false, strictMode: true },
				identityTupleHash: "tuple-abc",
			},
		});

		expect(result.admissible).toBe(false);
		expect(result.code).toBe("RESUME_GATE_UNKNOWN");
		expect(result.reason).toContain("nonexistent-gate");
	});

	it("rejects when the run directory does not exist", () => {
		const result = evaluateResumeAdmissibility({
			runId: "run-nonexistent-99",
			resumeFromGateId: "policy",
			orderedGateIds: ORDERED_GATES,
			expectation: {
				repoRoot,
				providerClass: "circleci",
				schemaVersion: "required-checks/v2",
				contractVersion: "contract-v1",
				lane: { fastMode: false, changedOnly: false, strictMode: true },
			},
		});

		expect(result.admissible).toBe(false);
		expect(result.code).toBe("RUN_NOT_FOUND");
	});

	it("rejects when run.json is missing from the run directory", () => {
		const runId = "run-resume-004";
		// Create the run directory and summary but not run.json
		const runDir = join(repoRoot, ".harness/runs", runId);
		mkdirSync(runDir, { recursive: true });
		writeFileSync(
			join(runDir, "summary.json"),
			JSON.stringify({
				runId,
				overallStatus: "failed",
				failedGateId: "policy",
				freshVsResumed: "fresh",
				durationMs: 1000,
			}),
			"utf-8",
		);

		const result = evaluateResumeAdmissibility({
			runId,
			resumeFromGateId: "policy",
			orderedGateIds: ORDERED_GATES,
			expectation: {
				repoRoot,
				providerClass: "circleci",
				schemaVersion: "required-checks/v2",
				contractVersion: "contract-v1",
				lane: { fastMode: false, changedOnly: false, strictMode: true },
			},
		});

		expect(result.admissible).toBe(false);
		expect(result.code).toBe("RUN_JSON_MISSING");
	});

	it("rejects when summary.json is missing from the run directory", () => {
		const runId = "run-resume-005";
		// Write run metadata but no summary or gate files
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
			contractVersion: "contract-v1",
			lane: { fastMode: false, changedOnly: false, strictMode: true },
		});
		// Write the gate result for the resume gate (policy) so that check passes
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

		const result = evaluateResumeAdmissibility({
			runId,
			resumeFromGateId: "policy",
			orderedGateIds: ORDERED_GATES,
			expectation: {
				repoRoot,
				providerClass: "circleci",
				schemaVersion: "required-checks/v2",
				contractVersion: "contract-v1",
				lane: { fastMode: false, changedOnly: false, strictMode: true },
			},
		});

		expect(result.admissible).toBe(false);
		expect(result.code).toBe("SUMMARY_MISSING");
	});

	it("rejects when provider class does not match", () => {
		seedRun("run-resume-006", "contract-v1", 2_000);

		const result = evaluateResumeAdmissibility({
			runId: "run-resume-006",
			resumeFromGateId: "policy",
			orderedGateIds: ORDERED_GATES,
			expectation: {
				repoRoot,
				providerClass: "github-actions",
				schemaVersion: "required-checks/v2",
				contractVersion: "contract-v1",
				lane: { fastMode: false, changedOnly: false, strictMode: true },
				identityTupleHash: "tuple-abc",
			},
		});

		expect(result.admissible).toBe(false);
		expect(result.code).toBe("PROVIDER_CLASS_MISMATCH");
	});

	it("rejects when schema version does not match", () => {
		seedRun("run-resume-007", "contract-v1", 2_000);

		const result = evaluateResumeAdmissibility({
			runId: "run-resume-007",
			resumeFromGateId: "policy",
			orderedGateIds: ORDERED_GATES,
			expectation: {
				repoRoot,
				providerClass: "circleci",
				schemaVersion: "required-checks/v3",
				contractVersion: "contract-v1",
				lane: { fastMode: false, changedOnly: false, strictMode: true },
				identityTupleHash: "tuple-abc",
			},
		});

		expect(result.admissible).toBe(false);
		expect(result.code).toBe("SCHEMA_VERSION_MISMATCH");
	});

	it("rejects when lane configuration does not match", () => {
		seedRun("run-resume-008", "contract-v1", 2_000);

		const result = evaluateResumeAdmissibility({
			runId: "run-resume-008",
			resumeFromGateId: "policy",
			orderedGateIds: ORDERED_GATES,
			expectation: {
				repoRoot,
				providerClass: "circleci",
				schemaVersion: "required-checks/v2",
				contractVersion: "contract-v1",
				// fastMode differs from what was seeded (false)
				lane: { fastMode: true, changedOnly: false, strictMode: true },
				identityTupleHash: "tuple-abc",
			},
		});

		expect(result.admissible).toBe(false);
		expect(result.code).toBe("LANE_MISMATCH");
	});

	it("rejects when identity tuple hash does not match", () => {
		seedRun("run-resume-011", "contract-v1", 2_000);

		const result = evaluateResumeAdmissibility({
			runId: "run-resume-011",
			resumeFromGateId: "policy",
			orderedGateIds: ORDERED_GATES,
			expectation: {
				repoRoot,
				providerClass: "circleci",
				schemaVersion: "required-checks/v2",
				contractVersion: "contract-v1",
				lane: { fastMode: false, changedOnly: false, strictMode: true },
				identityTupleHash: "different-hash",
			},
		});

		expect(result.admissible).toBe(false);
		expect(result.code).toBe("IDENTITY_TUPLE_MISMATCH");
	});

	it("allows resume when no identityTupleHash expectation is provided", () => {
		seedRun("run-resume-012", "contract-v1", 2_000);

		const result = evaluateResumeAdmissibility({
			runId: "run-resume-012",
			resumeFromGateId: "policy",
			orderedGateIds: ORDERED_GATES,
			expectation: {
				repoRoot,
				providerClass: "circleci",
				schemaVersion: "required-checks/v2",
				contractVersion: "contract-v1",
				lane: { fastMode: false, changedOnly: false, strictMode: true },
				// no identityTupleHash — should not block
			},
		});

		expect(result.admissible).toBe(true);
		expect(result.code).toBe("OK");
	});

	it("rejects when resumeFromGateId gate result is missing from disk", () => {
		// Seed the run but do NOT write the gate result for the resume gate
		const runId = "run-resume-013";
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
			contractVersion: "contract-v1",
			lane: { fastMode: false, changedOnly: false, strictMode: true },
		});
		writeVerifyRunSummary(repoRoot, runId, {
			runId,
			overallStatus: "failed",
			failedGateId: "policy",
			freshVsResumed: "fresh",
			durationMs: 1000,
		});
		// Only write a prior gate, not the resume target gate itself
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
		// Note: no policy.json gate result file written

		const result = evaluateResumeAdmissibility({
			runId,
			resumeFromGateId: "policy",
			orderedGateIds: ORDERED_GATES,
			expectation: {
				repoRoot,
				providerClass: "circleci",
				schemaVersion: "required-checks/v2",
				contractVersion: "contract-v1",
				lane: { fastMode: false, changedOnly: false, strictMode: true },
			},
		});

		expect(result.admissible).toBe(false);
		expect(result.code).toBe("RESUME_GATE_RESULT_MISSING");
	});

	it("rejects when a prior gate result has status failed", () => {
		const runId = "run-resume-014";
		writeVerifyRunMetadata(repoRoot, {
			runId,
			mode: "fresh",
			sourceRunId: null,
			status: "failed",
			startedAt: "2026-04-09T09:00:00.000Z",
			finishedAt: "2026-04-09T09:01:00.000Z",
			resumeFromGateId: "lint",
			repoRoot,
			providerClass: "circleci",
			schemaVersion: "required-checks/v2",
			contractVersion: "contract-v1",
			lane: { fastMode: false, changedOnly: false, strictMode: true },
		});
		writeVerifyRunSummary(repoRoot, runId, {
			runId,
			overallStatus: "failed",
			failedGateId: "lint",
			freshVsResumed: "fresh",
			durationMs: 1000,
		});
		// Write preflight as failed (prior to resume gate lint)
		writeVerifyGateResult(repoRoot, runId, {
			runId,
			gateId: "preflight",
			executionClass: "serial_guarded",
			attempt: 1,
			status: "failed",
			failureClass: "contract_policy",
			startedAt: "2026-04-09T09:00:01.000Z",
			finishedAt: "2026-04-09T09:00:10.000Z",
			nextAction: "fix preflight",
			exitCode: 1,
		});
		// Write the resume gate itself (lint) so RESUME_GATE_RESULT_MISSING is not triggered
		writeVerifyGateResult(repoRoot, runId, {
			runId,
			gateId: "lint",
			executionClass: "read_only_parallel",
			attempt: 1,
			status: "failed",
			failureClass: "transient_infra",
			startedAt: "2026-04-09T09:00:11.000Z",
			finishedAt: "2026-04-09T09:00:20.000Z",
			nextAction: "fix lint",
			exitCode: 1,
		});

		const result = evaluateResumeAdmissibility({
			runId,
			resumeFromGateId: "lint",
			orderedGateIds: ORDERED_GATES,
			expectation: {
				repoRoot,
				providerClass: "circleci",
				schemaVersion: "required-checks/v2",
				contractVersion: "contract-v1",
				lane: { fastMode: false, changedOnly: false, strictMode: true },
			},
		});

		expect(result.admissible).toBe(false);
		expect(result.code).toBe("PRIOR_GATE_NOT_PASSED");
		expect(result.reason).toContain("preflight");
	});

	it("returns RUN_NOT_FOUND when no runs exist at all for findLatestAdmissibleRun", () => {
		const result = findLatestAdmissibleRun({
			repoRoot,
			resumeFromGateId: "policy",
			orderedGateIds: ORDERED_GATES,
			expectation: {
				providerClass: "circleci",
				schemaVersion: "required-checks/v2",
				contractVersion: "contract-v1",
				lane: { fastMode: false, changedOnly: false, strictMode: true },
			},
		});

		expect(result.admissible).toBe(false);
		expect(result.code).toBe("RUN_NOT_FOUND");
	});

	it("returns RUN_NOT_FOUND when no compatible run matches in findLatestAdmissibleRun", () => {
		// Seed with wrong contract version
		seedRun("run-resume-015", "contract-v0", 2_000);

		const result = findLatestAdmissibleRun({
			repoRoot,
			resumeFromGateId: "policy",
			orderedGateIds: ORDERED_GATES,
			expectation: {
				providerClass: "circleci",
				schemaVersion: "required-checks/v2",
				contractVersion: "contract-v1",
				lane: { fastMode: false, changedOnly: false, strictMode: true },
			},
		});

		expect(result.admissible).toBe(false);
		expect(result.code).toBe("RUN_NOT_FOUND");
		expect(result.reason).toContain("No compatible");
	});
});
