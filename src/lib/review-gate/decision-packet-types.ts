import type {
	ReviewDecisionState,
	ReviewGateErrorCode,
	ReviewGateOptions,
	ReviewGateOutput,
	ReviewPRClosureStatus,
} from "./types.js";

/** Invocation metadata and terminal result used to emit review-gate artifacts. */
export type ReviewGateArtifactInput = {
	options: ReviewGateOptions;
	effectiveCheckName?: string;
	startedAt: string;
	finishedAt: string;
	exitCode: number;
	result:
		| { ok: true; output: ReviewGateOutput }
		| { ok: false; error: { code: ReviewGateErrorCode; message: string } };
};

/** Normalized merge-readiness decision projected from a review-gate result. */
export type DecisionClassification = {
	state: ReviewDecisionState;
	prClosureStatus: ReviewPRClosureStatus;
	requiresHumanDecision: boolean;
};

/** Paths and checksums for artifacts linked from the review-gate run record. */
export type ReviewGateRunRecordArtifacts = {
	decisionPacketPath: string;
	decisionPacketChecksum: string;
	alignmentDecisionPath: string;
	alignmentDecisionChecksum: string;
};
