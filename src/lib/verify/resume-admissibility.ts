import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	RunStateError,
	type VerifyLaneConfig,
	type VerifyRunMetadata,
	type VerifyRunSummary,
	listVerifyRunIds,
	loadVerifyGateResult,
	loadVerifyRunMetadata,
	loadVerifyRunSummary,
	resolveVerifyRunPaths,
} from "./run-state.js";

export type ResumeAdmissibilityCode =
	| "OK"
	| "RUN_NOT_FOUND"
	| "RUN_JSON_MISSING"
	| "SUMMARY_MISSING"
	| "RUN_INCOMPLETE"
	| "REPO_ROOT_MISMATCH"
	| "PROVIDER_CLASS_MISMATCH"
	| "SCHEMA_VERSION_MISMATCH"
	| "CONTRACT_VERSION_MISMATCH"
	| "LANE_MISMATCH"
	| "IDENTITY_TUPLE_MISMATCH"
	| "RESUME_GATE_UNKNOWN"
	| "RESUME_GATE_RESULT_MISSING"
	| "PRIOR_GATE_RESULT_MISSING"
	| "PRIOR_GATE_NOT_PASSED"
	| "PARSE_ERROR"
	| "IO_ERROR";

export interface ResumeAdmissibilityExpectation {
	repoRoot: string;
	providerClass: string;
	schemaVersion: string;
	contractVersion: string;
	lane: VerifyLaneConfig;
	identityTupleHash?: string;
}

export interface ResumeAdmissibilityInput {
	runId: string;
	resumeFromGateId: string;
	orderedGateIds: string[];
	expectation: ResumeAdmissibilityExpectation;
}

export interface ResumeAdmissibilityResult {
	admissible: boolean;
	code: ResumeAdmissibilityCode;
	reason: string;
	runId?: string;
	reusableGateIds?: string[];
}

/**
 * Checks whether two lane configurations have identical `fastMode`, `changedOnly`, and `strictMode` settings.
 *
 * @param expected - The expected lane configuration to compare against
 * @param actual - The actual lane configuration being validated
 * @returns `true` if all three settings match, `false` otherwise
 */
function laneMatches(
	expected: VerifyLaneConfig,
	actual: VerifyLaneConfig,
): boolean {
	return (
		expected.fastMode === actual.fastMode &&
		expected.changedOnly === actual.changedOnly &&
		expected.strictMode === actual.strictMode
	);
}

/**
 * Determines whether resuming verification from a specific gate in a prior run is allowed given expectations and gate ordering.
 *
 * @param input - Inputs specifying the target `runId`, the `resumeFromGateId`, the ordered list of gate IDs to validate, and an `expectation` describing required run properties (repo root, provider class, versions, lane config, optional identity tuple hash).
 * @returns An object describing admissibility. If `admissible` is `true`, the result has `runId` and `reusableGateIds` (prior gates confirmed reusable). If `admissible` is `false`, `code` and `reason` identify the failure (missing files, I/O or parse errors, run state issues, expectation mismatches, or prior gate failures).
 */
export function evaluateResumeAdmissibility(
	input: ResumeAdmissibilityInput,
): ResumeAdmissibilityResult {
	const gateIndex = input.orderedGateIds.indexOf(input.resumeFromGateId);
	if (gateIndex < 0) {
		return {
			admissible: false,
			code: "RESUME_GATE_UNKNOWN",
			reason: `Unknown resume gate: ${input.resumeFromGateId}`,
		};
	}

	const runPaths = resolveVerifyRunPaths(
		input.expectation.repoRoot,
		input.runId,
	);
	if (!existsSync(runPaths.runDir)) {
		return {
			admissible: false,
			code: "RUN_NOT_FOUND",
			reason: `Run directory not found: ${input.runId}`,
		};
	}
	if (!existsSync(runPaths.runPath)) {
		return {
			admissible: false,
			code: "RUN_JSON_MISSING",
			reason: `Missing run.json for ${input.runId}`,
		};
	}
	if (!existsSync(runPaths.summaryPath)) {
		return {
			admissible: false,
			code: "SUMMARY_MISSING",
			reason: `Missing summary.json for ${input.runId}`,
		};
	}
	if (!existsSync(join(runPaths.gatesDir, `${input.resumeFromGateId}.json`))) {
		return {
			admissible: false,
			code: "RESUME_GATE_RESULT_MISSING",
			reason: `Missing gate result for resume gate ${input.resumeFromGateId}`,
		};
	}

	let metadata: VerifyRunMetadata;
	try {
		metadata = loadVerifyRunMetadata(input.expectation.repoRoot, input.runId);
	} catch (error) {
		if (error instanceof RunStateError) {
			return {
				admissible: false,
				code: error.code === "E_IO" ? "IO_ERROR" : "PARSE_ERROR",
				reason: error.message,
			};
		}
		throw error;
	}

	let summary: VerifyRunSummary;
	try {
		summary = loadVerifyRunSummary(input.expectation.repoRoot, input.runId);
	} catch (error) {
		if (error instanceof RunStateError) {
			return {
				admissible: false,
				code: error.code === "E_IO" ? "IO_ERROR" : "PARSE_ERROR",
				reason: error.message,
			};
		}
		throw error;
	}

	if (metadata.status === "running") {
		return {
			admissible: false,
			code: "RUN_INCOMPLETE",
			reason: `Run ${input.runId} is still running`,
		};
	}
	if (summary.overallStatus === "passed") {
		return {
			admissible: false,
			code: "RUN_INCOMPLETE",
			reason: `Run ${input.runId} already passed; no resume anchor`,
		};
	}

	if (metadata.repoRoot !== input.expectation.repoRoot) {
		return {
			admissible: false,
			code: "REPO_ROOT_MISMATCH",
			reason: "Resume blocked: repoRoot mismatch",
		};
	}
	if (metadata.providerClass !== input.expectation.providerClass) {
		return {
			admissible: false,
			code: "PROVIDER_CLASS_MISMATCH",
			reason: "Resume blocked: providerClass mismatch",
		};
	}
	if (metadata.schemaVersion !== input.expectation.schemaVersion) {
		return {
			admissible: false,
			code: "SCHEMA_VERSION_MISMATCH",
			reason: "Resume blocked: schemaVersion mismatch",
		};
	}
	if (metadata.contractVersion !== input.expectation.contractVersion) {
		return {
			admissible: false,
			code: "CONTRACT_VERSION_MISMATCH",
			reason: "Resume blocked: contractVersion mismatch",
		};
	}
	if (!laneMatches(input.expectation.lane, metadata.lane)) {
		return {
			admissible: false,
			code: "LANE_MISMATCH",
			reason: "Resume blocked: lane configuration mismatch",
		};
	}
	if (
		input.expectation.identityTupleHash &&
		metadata.identityTupleHash !== input.expectation.identityTupleHash
	) {
		return {
			admissible: false,
			code: "IDENTITY_TUPLE_MISMATCH",
			reason: "Resume blocked: identity tuple mismatch",
		};
	}

	const reusableGateIds: string[] = [];
	for (let index = 0; index < gateIndex; index += 1) {
		const gateId = input.orderedGateIds[index];
		if (!gateId) {
			continue;
		}
		const gatePath = join(runPaths.gatesDir, `${gateId}.json`);
		if (!existsSync(gatePath)) {
			return {
				admissible: false,
				code: "PRIOR_GATE_RESULT_MISSING",
				reason: `Resume blocked: missing prior gate result for ${gateId}`,
			};
		}
		try {
			const gateResult = loadVerifyGateResult(
				input.expectation.repoRoot,
				input.runId,
				gateId,
			);
			if (gateResult.status !== "passed") {
				return {
					admissible: false,
					code: "PRIOR_GATE_NOT_PASSED",
					reason: `Resume blocked: prior gate ${gateId} is ${gateResult.status}`,
				};
			}
		} catch (error) {
			if (error instanceof RunStateError) {
				return {
					admissible: false,
					code:
						error.code === "E_IO" ? "PRIOR_GATE_RESULT_MISSING" : "PARSE_ERROR",
					reason: error.message,
				};
			}
			throw error;
		}
		reusableGateIds.push(gateId);
	}

	return {
		admissible: true,
		code: "OK",
		reason: "Resume admissible",
		runId: input.runId,
		reusableGateIds,
	};
}

export interface FindLatestAdmissibleRunInput {
	repoRoot: string;
	resumeFromGateId: string;
	orderedGateIds: string[];
	expectation: Omit<ResumeAdmissibilityExpectation, "repoRoot">;
}

export interface FindLatestAdmissibleRunResult {
	admissible: boolean;
	code: ResumeAdmissibilityCode;
	reason: string;
	runId?: string;
	reusableGateIds?: string[];
}

/**
 * Selects the first verification run in the repository that is admissible to resume from the specified gate.
 *
 * @param input - Parameters for the search: `repoRoot` to list candidate runs, `resumeFromGateId` and `orderedGateIds` that define the resume anchor and gate ordering, and an `expectation` describing the required run identity.
 * @returns A `FindLatestAdmissibleRunResult` describing the search outcome. If a compatible run is found, the result has `admissible: true`, `code: "OK"`, includes the matching `runId` and `reusableGateIds`. If no candidates exist, the result has `admissible: false`, `code: "RUN_NOT_FOUND"`, and `reason` explains that no run-state directory was found. If candidates were checked but none match, the result has `admissible: false`, `code: "RUN_NOT_FOUND"`, and `reason` indicates no compatible prior run was found.
 */
export function findLatestAdmissibleRun(
	input: FindLatestAdmissibleRunInput,
): FindLatestAdmissibleRunResult {
	const candidateRunIds = listVerifyRunIds(input.repoRoot);
	if (candidateRunIds.length === 0) {
		return {
			admissible: false,
			code: "RUN_NOT_FOUND",
			reason: "No run-state directory found",
		};
	}

	for (const runId of candidateRunIds) {
		const result = evaluateResumeAdmissibility({
			runId,
			resumeFromGateId: input.resumeFromGateId,
			orderedGateIds: input.orderedGateIds,
			expectation: {
				repoRoot: input.repoRoot,
				providerClass: input.expectation.providerClass,
				schemaVersion: input.expectation.schemaVersion,
				contractVersion: input.expectation.contractVersion,
				lane: input.expectation.lane,
				...(input.expectation.identityTupleHash
					? { identityTupleHash: input.expectation.identityTupleHash }
					: {}),
			},
		});
		if (result.admissible) {
			return result;
		}
	}

	return {
		admissible: false,
		code: "RUN_NOT_FOUND",
		reason: "No compatible prior run found",
	};
}
