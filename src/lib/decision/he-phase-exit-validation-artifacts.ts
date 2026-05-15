import type {
	HeEvidenceRef,
	HeGateFinding,
	HeGateResult,
	HeGateValidation,
	HePhase,
	HePhaseContext,
} from "./he-phase-exit-core.js";
import { createHeFixBugsGateResult } from "./he-phase-exit-adapters.js";

/** Local validation artifact outcome accepted by phase-exit ingestion. */
export type HeLocalValidationOutcome = "pass" | "fail" | "blocked";

/** Repo-owned command or check evidence that can drive phase-exit bug-fix state. */
export interface HeLocalValidationArtifact {
	/** Stable local artifact id unique within the ingestion input. */
	readonly id: string;
	/** Exact command or check name, as reported in validation evidence. */
	readonly command: string;
	/** Command or check outcome. */
	readonly outcome: HeLocalValidationOutcome;
	/** Failure or blocker reason when outcome is fail or blocked. */
	readonly reason?: string | null;
	/** Optional artifact path or reference; defaults to command evidence. */
	readonly ref?: string;
	/** Optional extra scope evidence associated with this command. */
	readonly scopeEvidence?: readonly string[];
}

/** Input for deriving phase context from local validation artifacts. */
export interface HeValidationArtifactPhaseContextInput {
	/** Current HE phase. */
	readonly phase: HePhase;
	/** Local validation artifacts inspected for this phase. */
	readonly artifacts: readonly HeLocalValidationArtifact[];
	/** Whether unresolved review feedback exists independently of validation. */
	readonly reviewFeedbackPresent?: boolean;
}

/** Input for converting local validation artifacts into he-fix-bugs evidence. */
export interface HeFixBugsValidationArtifactInput {
	/** Whether he-fix-bugs is required by the current phase contract. */
	readonly required?: boolean;
	/** Local validation artifacts inspected for this phase. */
	readonly artifacts: readonly HeLocalValidationArtifact[];
}

/**
 * Derive HE phase context from local validation artifacts.
 *
 * @param input - Phase and local validation artifacts inspected for the current slice
 * @returns A phase context with failingEvidencePresent derived from fail or blocked artifacts
 */
export function createPhaseContextFromValidationArtifacts(
	input: HeValidationArtifactPhaseContextInput,
): HePhaseContext {
	return {
		phase: input.phase,
		failingEvidencePresent: hasFailingValidationArtifact(input.artifacts),
		reviewFeedbackPresent: input.reviewFeedbackPresent ?? false,
	};
}

/**
 * Convert repo-owned validation command artifacts into an he-fix-bugs gate result.
 *
 * This is intentionally local and deterministic: no filesystem reads, no CLI
 * calls, and no external review services. Passing validation artifacts make
 * he-fix-bugs not applicable; failing or blocked validation artifacts become a
 * typed blocker that requires a later he-fix-bugs repair proof.
 *
 * @param input - Local validation artifacts from repo-owned commands or checks
 * @returns A normalized he-fix-bugs gate result suitable for phase-exit aggregation
 */
export function createHeFixBugsGateResultFromValidationArtifacts(
	input: HeFixBugsValidationArtifactInput,
): HeGateResult {
	const evidenceRefs = input.artifacts.map(validationEvidenceRef);
	const scopeEvidence = uniqueStrings(
		input.artifacts.flatMap((artifact) => [
			artifact.command,
			...(artifact.scopeEvidence ?? []),
		]),
	);
	const validation = input.artifacts.map(validationOutcome);
	const blocker = input.artifacts.find(
		(artifact) => artifact.outcome === "blocked",
	);
	const failure = input.artifacts.find(
		(artifact) => artifact.outcome === "fail",
	);
	const blockingArtifact = blocker ?? failure;
	const blockingArtifactIndex =
		blockingArtifact === undefined
			? -1
			: input.artifacts.indexOf(blockingArtifact);

	if (blockingArtifact) {
		const blockedReason = validationBlockerReason(blockingArtifact);
		return createHeFixBugsGateResult({
			required: input.required ?? true,
			status: "blocked",
			blockedReason,
			scopeEvidence,
			evidenceRefs,
			findings: [
				validationBlockingFinding(
					blockingArtifact,
					blockingArtifactIndex,
					blockedReason,
				),
			],
			validation,
		});
	}

	return createHeFixBugsGateResult({
		required: input.required ?? true,
		status: "not_applicable",
		reason: "No failing local validation artifacts are present.",
		scopeEvidence,
		evidenceRefs,
		validation,
	});
}

/**
 * Determine whether local validation artifacts contain failing evidence.
 *
 * @param artifacts - Local validation command or check artifacts
 * @returns true when any artifact outcome is fail or blocked
 */
export function hasFailingValidationArtifact(
	artifacts: readonly HeLocalValidationArtifact[],
): boolean {
	return artifacts.some((artifact) => artifact.outcome !== "pass");
}

function validationEvidenceRef(
	artifact: HeLocalValidationArtifact,
	index: number,
): HeEvidenceRef {
	return {
		id: validationEvidenceRefId(artifact, index),
		kind: "command",
		ref: artifact.ref ?? `command:${artifact.command}`,
		gateLocal: true,
	};
}

function validationOutcome(
	artifact: HeLocalValidationArtifact,
): HeGateValidation {
	return {
		command: artifact.command,
		outcome: artifact.outcome,
		reason: artifact.reason ?? null,
	};
}

function validationBlockingFinding(
	artifact: HeLocalValidationArtifact,
	index: number,
	blockedReason: string,
): HeGateFinding {
	return {
		id: `he_fix_bugs-validation-${artifact.id}`,
		severity: artifact.outcome === "blocked" ? "high" : "medium",
		status: "open",
		summary: blockedReason,
		evidenceRef: validationEvidenceRefId(artifact, index),
	};
}

function validationBlockerReason(artifact: HeLocalValidationArtifact): string {
	return (
		artifact.reason ??
		"Local validation artifact '" +
			artifact.command +
			"' reported " +
			artifact.outcome +
			"."
	);
}

function validationEvidenceRefId(
	artifact: HeLocalValidationArtifact,
	index: number,
): string {
	return `validation-${index.toString()}-${artifact.id}`;
}

function uniqueStrings(values: readonly string[]): string[] {
	return [...new Set(values.filter((value) => value.trim().length > 0))];
}
