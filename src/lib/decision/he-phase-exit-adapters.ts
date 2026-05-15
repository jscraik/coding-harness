import {
	HE_GATE_RESULT_SCHEMA_VERSION,
	createMissingGateResult,
	type HeAutofixPayload,
	type HeCodeReviewPayload,
	type HeEvidenceRef,
	type HeFixBugsPayload,
	type HeGateAction,
	type HeGateExecutionMode,
	type HeGateFinding,
	type HeGateId,
	type HeGateResult,
	type HeGateStatus,
	type HeGateValidation,
	type HeSimplifyPayload,
	type HeTestingReviewerPayload,
} from "./he-phase-exit-core.js";

/** Common structured evidence accepted by phase-exit gate adapters. */
export interface HeGateEvidenceAdapterInput {
	/** Whether the gate is required by the current phase contract. */
	readonly required?: boolean;
	/** Gate status reported by the local artifact or review. Defaults to pass. */
	readonly status?: Exclude<HeGateStatus, "not_run">;
	/** How the source evidence was produced. Defaults to the gate-specific mode. */
	readonly executionMode?: HeGateExecutionMode;
	/** Scope proof, such as reviewed files, diff refs, artifacts, or command names. */
	readonly scopeEvidence: readonly string[];
	/** Gate-local evidence references proving the gate ran or was not applicable. */
	readonly evidenceRefs: readonly HeEvidenceRef[];
	/** Normalized findings extracted from the source artifact. */
	readonly findings?: readonly HeGateFinding[];
	/** Repair, acceptance, deferral, or blocker actions from the source artifact. */
	readonly actions?: readonly HeGateAction[];
	/** Validation command outcomes associated with this gate. */
	readonly validation?: readonly HeGateValidation[];
	/** Whether a human reviewer must decide before the phase may continue. */
	readonly requiresHuman?: boolean;
	/** Optional safe-to-continue override from the source artifact. */
	readonly safeToContinue?: boolean;
	/** Reason for not-applicable or non-passing gate states. */
	readonly reason?: string | null;
	/** Deterministic blocker reason for blocked gate states. */
	readonly blockedReason?: string | null;
}

/** Structured simplify skill evidence for HeGateResult/v1. */
export interface HeSimplifyEvidenceAdapterInput
	extends HeGateEvidenceAdapterInput {
	/** Whether the simplify review accounted for reuse opportunities. */
	readonly reuseReviewed: boolean;
	/** Whether the simplify review accounted for quality impact. */
	readonly qualityReviewed: boolean;
	/** Whether the simplify review accounted for implementation efficiency. */
	readonly efficiencyReviewed: boolean;
}

/** Structured testing-reviewer artifact evidence for HeGateResult/v1. */
export interface HeTestingReviewerEvidenceAdapterInput
	extends HeGateEvidenceAdapterInput {
	/** Whether the reviewer explicitly evaluated test adequacy. */
	readonly testAdequacyReviewed: boolean;
	/** Missing edge cases reported by the reviewer. */
	readonly missingEdgeCases?: readonly string[];
}

/** Structured he-fix-bugs evidence for HeGateResult/v1. */
export interface HeFixBugsEvidenceAdapterInput
	extends HeGateEvidenceAdapterInput {
	/** Failing evidence that made bug repair applicable. */
	readonly reproductionEvidence?: readonly string[];
	/** Root-cause summary from the bug-fix artifact. */
	readonly rootCause?: string | null;
	/** Regression protection evidence added or verified for the fix. */
	readonly regressionProtection?: readonly string[];
	/** Rollback note for the bug-fix change. */
	readonly rollbackNote?: string | null;
}

/** Structured he-code-review evidence for HeGateResult/v1. */
export interface HeCodeReviewEvidenceAdapterInput
	extends HeGateEvidenceAdapterInput {
	/** Whether the review artifact used findings-first ordering. */
	readonly findingsFirst: boolean;
	/** Whether findings include traceable file, line, command, or artifact evidence. */
	readonly traceabilityReviewed: boolean;
	/** Whether blocker ownership/classification was recorded. */
	readonly blockerClassification: boolean;
	/** Whether the review recorded a safe-to-continue classification. */
	readonly safeToContinueReviewed: boolean;
}

/** Structured autofix evidence for HeGateResult/v1. */
export interface HeAutofixEvidenceAdapterInput
	extends HeGateEvidenceAdapterInput {
	/** Review feedback items inventoried before the autofix pass. */
	readonly feedbackInventory?: readonly string[];
	/** Number of feedback inventory items accounted for. */
	readonly accountedItems?: number;
}

type GateBuildInput<TPayload> = HeGateEvidenceAdapterInput & {
	readonly gateId: HeGateId;
	readonly defaultExecutionMode: HeGateExecutionMode;
	readonly payload: TPayload;
};

/**
 * Build a simplify HeGateResult/v1 from structured local artifact evidence.
 *
 * @param input - Simplify skill evidence already extracted into structured fields
 * @returns A normalized gate result suitable for phase-exit aggregation
 */
export function createSimplifyGateResult(
	input: HeSimplifyEvidenceAdapterInput,
): HeGateResult {
	return buildGateResult({
		...input,
		gateId: "simplify",
		defaultExecutionMode: "direct_skill",
		payload: {
			scopeEvidence: [...input.scopeEvidence],
			reuseReviewed: input.reuseReviewed,
			qualityReviewed: input.qualityReviewed,
			efficiencyReviewed: input.efficiencyReviewed,
		} satisfies HeSimplifyPayload,
	});
}

/**
 * Build a testing-reviewer HeGateResult/v1 from structured subagent evidence.
 *
 * @param input - Testing-reviewer artifact evidence already extracted into structured fields
 * @returns A normalized gate result suitable for phase-exit aggregation
 */
export function createTestingReviewerGateResult(
	input: HeTestingReviewerEvidenceAdapterInput,
): HeGateResult {
	return buildGateResult({
		...input,
		gateId: "testing_reviewer",
		defaultExecutionMode: "subagent_proxy",
		payload: {
			scopeEvidence: [...input.scopeEvidence],
			testAdequacyReviewed: input.testAdequacyReviewed,
			missingEdgeCases: [...(input.missingEdgeCases ?? [])],
		} satisfies HeTestingReviewerPayload,
	});
}

/**
 * Build an he-fix-bugs HeGateResult/v1 from structured repair evidence.
 *
 * @param input - Bug-fix evidence already extracted into structured fields
 * @returns A normalized gate result suitable for phase-exit aggregation
 */
export function createHeFixBugsGateResult(
	input: HeFixBugsEvidenceAdapterInput,
): HeGateResult {
	return buildGateResult({
		...input,
		gateId: "he_fix_bugs",
		defaultExecutionMode: "direct_skill",
		payload: {
			scopeEvidence: [...input.scopeEvidence],
			reproductionEvidence: [...(input.reproductionEvidence ?? [])],
			rootCause: input.rootCause ?? null,
			regressionProtection: [...(input.regressionProtection ?? [])],
			rollbackNote: input.rollbackNote ?? null,
		} satisfies HeFixBugsPayload,
	});
}

/**
 * Build an he-code-review HeGateResult/v1 from structured review evidence.
 *
 * @param input - Review artifact evidence already extracted into structured fields
 * @returns A normalized gate result suitable for phase-exit aggregation
 */
export function createHeCodeReviewGateResult(
	input: HeCodeReviewEvidenceAdapterInput,
): HeGateResult {
	return buildGateResult({
		...input,
		gateId: "he_code_review",
		defaultExecutionMode: "direct_skill",
		payload: {
			scopeEvidence: [...input.scopeEvidence],
			findingsFirst: input.findingsFirst,
			traceabilityReviewed: input.traceabilityReviewed,
			blockerClassification: input.blockerClassification,
			safeToContinueReviewed: input.safeToContinueReviewed,
		} satisfies HeCodeReviewPayload,
	});
}

/**
 * Build an autofix HeGateResult/v1 from structured review-feedback evidence.
 *
 * @param input - Autofix artifact evidence already extracted into structured fields
 * @returns A normalized gate result suitable for phase-exit aggregation
 */
export function createAutofixGateResult(
	input: HeAutofixEvidenceAdapterInput,
): HeGateResult {
	const feedbackInventory = [...(input.feedbackInventory ?? [])];
	return buildGateResult({
		...input,
		gateId: "autofix",
		defaultExecutionMode: "direct_skill",
		payload: {
			scopeEvidence: [...input.scopeEvidence],
			feedbackInventory,
			accountedItems: input.accountedItems ?? feedbackInventory.length,
		} satisfies HeAutofixPayload,
	});
}

function buildGateResult<TPayload>({
	gateId,
	defaultExecutionMode,
	payload,
	...input
}: GateBuildInput<TPayload>): HeGateResult {
	if (!hasGateLocalEvidence(input.evidenceRefs)) {
		return {
			...createMissingGateResult(gateId, input.required ?? true),
			reason: `${gateId} gate has no gate-local evidence source`,
			blockedReason: `${gateId} gate has no gate-local evidence source`,
		};
	}

	const status = resolveStatus(input);
	const findings = ensureBlockingFinding(gateId, status, input);
	const blockedReason =
		status === "blocked"
			? (input.blockedReason ??
				input.reason ??
				firstOpenFinding(findings)?.summary ??
				`${gateId} gate is blocked`)
			: null;
	const reason =
		status === "not_applicable"
			? (input.reason ?? `${gateId} gate is not applicable to this phase`)
			: (input.reason ?? null);

	return {
		schemaVersion: HE_GATE_RESULT_SCHEMA_VERSION,
		gateId,
		required: input.required ?? true,
		executionMode:
			status === "not_applicable"
				? "not_applicable"
				: (input.executionMode ?? defaultExecutionMode),
		status,
		payload: payload as HeGateResult["payload"],
		evidenceRefs: input.evidenceRefs.map((ref) => ({ ...ref })),
		findings,
		actions: [...(input.actions ?? [])],
		validation: [...(input.validation ?? [])],
		requiresHuman: input.requiresHuman ?? false,
		safeToContinue: input.safeToContinue ?? isSafeStatus(status),
		reason,
		blockedReason,
	};
}

function resolveStatus(
	input: HeGateEvidenceAdapterInput,
): Exclude<HeGateStatus, "not_run"> {
	if (input.status === "not_applicable") return "not_applicable";
	if (input.status === "blocked") return "blocked";
	if (input.status === "fail") return "fail";
	if (input.safeToContinue === false) return "blocked";
	if (input.requiresHuman === true) return "blocked";
	if (input.validation?.some((entry) => entry.outcome === "blocked")) {
		return "blocked";
	}
	if (input.validation?.some((entry) => entry.outcome === "fail"))
		return "fail";
	return input.status ?? "pass";
}

function hasGateLocalEvidence(evidenceRefs: readonly HeEvidenceRef[]): boolean {
	return evidenceRefs.some((ref) => ref.gateLocal);
}

function ensureBlockingFinding(
	gateId: HeGateId,
	status: HeGateStatus,
	input: HeGateEvidenceAdapterInput,
): HeGateFinding[] {
	const findings = [...(input.findings ?? [])];
	if (!["fail", "blocked"].includes(status)) return findings;
	if (findings.some((finding) => finding.status === "open")) return findings;
	findings.push({
		id: `${gateId}-adapter-blocker`,
		severity: status === "blocked" ? "high" : "medium",
		status: "open",
		summary:
			input.blockedReason ??
			input.reason ??
			`${gateId} gate reported ${status}`,
		evidenceRef: input.evidenceRefs.find((ref) => ref.gateLocal)?.id ?? null,
	});
	return findings;
}

function firstOpenFinding(
	findings: readonly HeGateFinding[],
): HeGateFinding | undefined {
	return findings.find((finding) => finding.status === "open");
}

function isSafeStatus(status: HeGateStatus): boolean {
	return status === "pass" || status === "not_applicable";
}
