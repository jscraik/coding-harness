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
 * Builds a normalized gate result for the "simplify" phase from structured local evidence.
 *
 * @param input - Simplify skill evidence extracted into normalized adapter fields
 * @returns A normalized HeGateResult for the "simplify" gate
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
 * Produce a normalized gate result for the "he_fix_bugs" phase from structured bug-fix evidence.
 *
 * @param input - Bug-fix evidence and gate metadata used to build the gate result
 * @returns The normalized gate result for the "he_fix_bugs" gate
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
 * Constructs a normalized code-review gate result for phase-exit processing.
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
 * Create an autofix phase-exit gate result from structured autofix evidence.
 *
 * The returned result is normalized to the HeGateResult v1 shape and includes a payload
 * with a copied scopeEvidence array, a feedbackInventory array (defaults to empty),
 * and accountedItems (defaults to `input.accountedItems` or the feedbackInventory length).
 *
 * @param input - Structured autofix evidence and optional metadata
 * @returns The normalized `HeGateResult` for the `autofix` gate
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

/**
 * Constructs a normalized HeGateResult from a gate adapter input, enforcing presence of gate-local evidence and resolving status, findings, reason, and blockedReason.
 *
 * @param input - Builder input containing `gateId`, `defaultExecutionMode`, typed `payload`, and adapter fields (e.g., `evidenceRefs`, `status`, `findings`, `validation`, `actions`, `requiresHuman`, `safeToContinue`). If no gate-local evidence is present, a missing-gate result is returned with `reason` and `blockedReason` set to indicate the absence of gate-local evidence.
 * @returns The assembled `HeGateResult` with computed `status` and `executionMode`, normalized `payload`, shallow-copied `evidenceRefs`, normalized `findings` (with an added open blocker when appropriate), `actions`, `validation`, `requiresHuman`, `safeToContinue`, `reason`, and `blockedReason`.
 */
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

/**
 * Determine the gate status from adapter input according to priority rules.
 *
 * @param input - Adapter evidence and flags that influence status resolution
 * @returns The resolved gate status: `'not_applicable'`, `'blocked'`, `'fail'`, or `'pass'`
 */
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

/**
 * Check whether any evidence reference is marked as gate-local.
 *
 * @param evidenceRefs - Array of evidence references to inspect
 * @returns `true` if at least one entry has `gateLocal` set, `false` otherwise
 */
function hasGateLocalEvidence(evidenceRefs: readonly HeEvidenceRef[]): boolean {
	return evidenceRefs.some((ref) => ref.gateLocal);
}

/**
 * Ensure an open blocker finding is present when the gate status is `fail` or `blocked`.
 *
 * @param gateId - Identifier of the gate; used to build the generated finding's id and default summary.
 * @param status - Gate status to evaluate for blocker creation.
 * @param input - Adapter input whose existing `findings` and `evidenceRefs` are consulted when generating the blocker.
 * @returns The findings array: original findings with an adapter-generated open blocker appended if `status` is `"fail"` or `"blocked"` and no existing open finding is present; otherwise the original findings unchanged.
 */
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

/**
 * Finds the first finding with status "open".
 *
 * @param findings - The list of gate findings to search.
 * @returns The first finding whose `status` is `"open"`, or `undefined` if none exist.
 */
function firstOpenFinding(
	findings: readonly HeGateFinding[],
): HeGateFinding | undefined {
	return findings.find((finding) => finding.status === "open");
}

/**
 * Determine whether a gate status is considered safe to continue.
 *
 * @returns `true` if `status` is `"pass"` or `"not_applicable"`, `false` otherwise.
 */
function isSafeStatus(status: HeGateStatus): boolean {
	return status === "pass" || status === "not_applicable";
}
