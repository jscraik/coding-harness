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
 * Create a HePhaseContext for a phase based on provided local validation artifacts.
 *
 * If `input.reviewFeedbackPresent` is omitted, `reviewFeedbackPresent` will be `false`.
 *
 * @param input - Phase and local validation artifacts used to derive the context
 * @returns A phase context where `failingEvidencePresent` is `true` if any artifact's outcome is not `"pass"`, `false` otherwise
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
 * Builds an HeGateResult for the he-fix-bugs gate from local validation artifacts.
 *
 * When any artifact has outcome `blocked` or `fail`, the result has status `blocked`
 * and includes a single finding for the first such artifact along with `blockedReason`,
 * `scopeEvidence`, `evidenceRefs`, and per-artifact `validation`. When no failing or
 * blocking artifacts exist, the result has status `not_applicable` with a human-readable
 * `reason` and the same scope/evidence/validation data.
 *
 * @param input - Local validation artifacts and an optional `required` flag used to build the gate result
 * @returns A HeGateResult reflecting either a `blocked` gate (with `blockedReason`, `findings`, and validation data)
 *          or a `not_applicable` gate (with a `reason` and validation data)
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
 * Check whether any local validation artifact has failed or is blocked.
 *
 * @param artifacts - The list of local validation artifacts to inspect
 * @returns `true` if any artifact has outcome `'fail'` or `'blocked'`, `false` otherwise
 */
export function hasFailingValidationArtifact(
	artifacts: readonly HeLocalValidationArtifact[],
): boolean {
	return artifacts.some((artifact) => artifact.outcome !== "pass");
}

/**
 * Create an evidence reference for a local validation artifact to include in gate results.
 *
 * @param artifact - The local validation artifact to reference.
 * @param index - The artifact's index used to form a stable evidence id.
 * @returns An evidence reference whose `id` is derived from the artifact and `index`, whose `ref` is `artifact.ref` if present or `command:<command>` otherwise, and marked as local gate evidence.
 */
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

/**
 * Converts a local validation artifact into a gate validation record.
 *
 * @returns The gate validation record with `command`, `outcome`, and `reason` (or `null` when the artifact has no reason)
 */
function validationOutcome(
	artifact: HeLocalValidationArtifact,
): HeGateValidation {
	return {
		command: artifact.command,
		outcome: artifact.outcome,
		reason: artifact.reason ?? null,
	};
}

/**
 * Creates a gate finding for a single local validation artifact that caused blocking or failure.
 *
 * @param artifact - The local validation artifact that produced the finding
 * @param index - The artifact's index within the input artifacts array (used to derive the evidence reference id)
 * @param blockedReason - Human-readable reason to use as the finding summary
 * @returns A `HeGateFinding` whose `id` is `he_fix_bugs-validation-<artifact.id>`, `severity` is `"high"` for `"blocked"` outcomes or `"medium"` otherwise, `status` is `"open"`, `summary` is the provided `blockedReason`, and `evidenceRef` references the artifact's evidence id
 */
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

/**
 * Derives a human-readable blocker reason from a local validation artifact.
 *
 * @param artifact - The local validation artifact to derive the reason from
 * @returns The artifact's `reason` if present; otherwise a synthesized message
 *          `Local validation artifact '<command>' reported <outcome>.`
 */
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

/**
 * Constructs a stable evidence reference id for a validation artifact.
 *
 * @param artifact - The local validation artifact to reference
 * @param index - Zero-based index of the artifact within the input list
 * @returns The evidence reference id in the form `validation-<index>-<artifact.id>`
 */
function validationEvidenceRefId(
	artifact: HeLocalValidationArtifact,
	index: number,
): string {
	return `validation-${index.toString()}-${artifact.id}`;
}

/**
 * Return unique, non-empty strings from the input while preserving first-seen order.
 *
 * @param values - Input strings to filter and deduplicate
 * @returns The input strings whose trimmed length is greater than zero, with duplicates removed while keeping the first occurrence
 */
function uniqueStrings(values: readonly string[]): string[] {
	return [...new Set(values.filter((value) => value.trim().length > 0))];
}
