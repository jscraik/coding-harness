import {
	isRecord,
	validateBoolean,
	validateEnum,
	validateNullableString,
	validateNumber,
	validateString,
	validateStringArray,
} from "./validators.js";

/** Schema version for a single Harness Engineering phase-exit gate result. */
export const HE_GATE_RESULT_SCHEMA_VERSION = "he-gate-result/v1" as const;

/** Schema version for aggregated Harness Engineering phase-exit decisions. */
export const HE_PHASE_EXIT_SCHEMA_VERSION = "he-phase-exit/v1" as const;

/** Stable gate identifiers modelled from HE closeout skills and reviewers. */
export const HE_GATE_IDS = [
	"simplify",
	"testing_reviewer",
	"he_fix_bugs",
	"he_code_review",
	"autofix",
] as const;

/** Stable gate identifier for HE closeout evidence. */
export type HeGateId = (typeof HE_GATE_IDS)[number];

/** Gate execution mode. */
export type HeGateExecutionMode =
	| "direct_skill"
	| "subagent_proxy"
	| "manual_review"
	| "validation_only"
	| "not_applicable"
	| "not_run";

/** Gate status. */
export type HeGateStatus =
	| "pass"
	| "fail"
	| "blocked"
	| "not_applicable"
	| "not_run";

/** HE lifecycle phase. */
export type HePhase = "route" | "lifecycle" | "closeout";

/** HE phase-exit recommendation. */
export type HePhaseExitRecommendation =
	| "continue"
	| "stop"
	| "commit_blocked"
	| "human_review_required";

/** A compact reference to evidence without embedding long logs or secrets. */
export interface HeEvidenceRef {
	/** Stable local identifier unique within the gate result. */
	id: string;
	/** Evidence kind, for example command, artifact, skill, subagent, or review. */
	kind: string;
	/** Human-readable evidence reference. */
	ref: string;
	/** Whether this evidence is gate-local proof rather than route context. */
	gateLocal: boolean;
}

/** Normalized review or validation finding. */
export interface HeGateFinding {
	/** Stable finding identifier. */
	id: string;
	/** Finding severity. */
	severity: "low" | "medium" | "high";
	/** Finding status. */
	status: "open" | "fixed" | "skipped" | "false_positive";
	/** Finding summary. */
	summary: string;
	/** Optional file-and-line evidence. */
	evidenceRef: string | null;
}

/** Concrete repair or follow-up action performed for a gate. */
export interface HeGateAction {
	/** Stable action identifier. */
	id: string;
	/** Action status. */
	status: "fixed" | "deferred" | "blocked" | "accepted";
	/** Action summary. */
	summary: string;
	/** Evidence references proving or explaining the action. */
	evidenceRefs: string[];
}

/** Validation command or check reported by a gate. */
export interface HeGateValidation {
	/** Exact command or check name. */
	command: string;
	/** Validation outcome. */
	outcome: "pass" | "fail" | "blocked";
	/** Optional blocker or failure reason. */
	reason: string | null;
}

/** Common payload carried by every gate-specific payload. */
export interface HeGatePayloadBase {
	/** Scope evidence that proves which files, diff, or issue the gate evaluated. */
	scopeEvidence: string[];
}

/** Simplify gate payload modelled from the simplify skill. */
export interface HeSimplifyPayload extends HeGatePayloadBase {
	/** Whether reuse review was accounted for. */
	reuseReviewed: boolean;
	/** Whether quality review was accounted for. */
	qualityReviewed: boolean;
	/** Whether efficiency review was accounted for. */
	efficiencyReviewed: boolean;
}

/** Testing reviewer payload modelled from the testing-reviewer subagent. */
export interface HeTestingReviewerPayload extends HeGatePayloadBase {
	/** Whether test adequacy was evaluated independently from bug repair. */
	testAdequacyReviewed: boolean;
	/** Missing edge cases identified by the reviewer. */
	missingEdgeCases: string[];
}

/** Bug-fix payload modelled from the he-fix-bugs skill. */
export interface HeFixBugsPayload extends HeGatePayloadBase {
	/** Failing evidence that made bug fixing applicable. */
	reproductionEvidence: string[];
	/** Root-cause summary, when applicable. */
	rootCause: string | null;
	/** Regression protection evidence, when applicable. */
	regressionProtection: string[];
	/** Rollback note for the bug fix, when applicable. */
	rollbackNote: string | null;
}

/** Code-review payload modelled from the he-code-review skill. */
export interface HeCodeReviewPayload extends HeGatePayloadBase {
	/** Whether the output used findings-first review ordering. */
	findingsFirst: boolean;
	/** Whether findings include traceable evidence. */
	traceabilityReviewed: boolean;
	/** Whether blocker classification was performed. */
	blockerClassification: boolean;
	/** Whether the review included an explicit safe-to-continue classification. */
	safeToContinueReviewed: boolean;
}

/** Autofix payload modelled from the autofix skill. */
export interface HeAutofixPayload extends HeGatePayloadBase {
	/** Review-feedback inventory gathered before fixes. */
	feedbackInventory: string[];
	/** Number of inventory items accounted for as fixed, reviewed, deferred, stale, blocked, or false positive. */
	accountedItems: number;
}

/** Gate-specific payload union. */
export type HeGatePayload =
	| HeSimplifyPayload
	| HeTestingReviewerPayload
	| HeFixBugsPayload
	| HeCodeReviewPayload
	| HeAutofixPayload;

/** One normalized gate result. */
export interface HeGateResult {
	/** Gate result schema version. */
	schemaVersion: typeof HE_GATE_RESULT_SCHEMA_VERSION;
	/** Stable gate id. */
	gateId: HeGateId;
	/** Whether this gate is required by the current phase configuration. */
	required: boolean;
	/** How the gate was executed. */
	executionMode: HeGateExecutionMode;
	/** Gate status. */
	status: HeGateStatus;
	/** Gate-specific payload. */
	payload: HeGatePayload;
	/** Compact evidence references. */
	evidenceRefs: HeEvidenceRef[];
	/** Normalized findings. */
	findings: HeGateFinding[];
	/** Actions taken or accepted by the gate. */
	actions: HeGateAction[];
	/** Validation entries with exact command text or check names. */
	validation: HeGateValidation[];
	/** Whether human review is required before continuing. */
	requiresHuman: boolean;
	/** Whether this gate evidence permits the next phase. */
	safeToContinue: boolean;
	/** Required explanation for skipped or unrun gate states. */
	reason: string | null;
	/** Deterministic blocker reason when blocked. */
	blockedReason: string | null;
}

/** Phase context used to validate conditional gates. */
export interface HePhaseContext {
	/** Current HE phase. */
	phase: HePhase;
	/** Whether failing command, test, lint, or review evidence is present. */
	failingEvidencePresent: boolean;
	/** Whether unresolved review feedback exists in scope. */
	reviewFeedbackPresent: boolean;
}

/** Aggregation input for HE phase-exit decisions. */
export interface HePhaseExitInput {
	/** Phase context. */
	phaseContext: HePhaseContext;
	/** Gate ids required before the phase may exit. */
	requiredGates: HeGateId[];
	/** Optional gate ids that can warn but cannot alone block required exit. */
	optionalGates: HeGateId[];
	/** Gate results collected for this phase. */
	gates: HeGateResult[];
}

/** Machine-readable HE phase-exit decision. */
export interface HePhaseExit {
	/** Phase-exit schema version. */
	schemaVersion: typeof HE_PHASE_EXIT_SCHEMA_VERSION;
	/** Phase context copied from the input. */
	phaseContext: HePhaseContext;
	/** Aggregated recommendation. */
	recommendation: HePhaseExitRecommendation;
	/** Whether local commit is allowed by configured gate evidence. */
	commitAllowed: boolean;
	/** Whether phase exit is allowed by configured gate evidence. */
	exitAllowed: boolean;
	/** Required gates that are not passing or not safe to continue. */
	blockers: string[];
	/** Non-blocking optional-gate warnings. */
	warnings: string[];
	/** Normalized gate results, including synthesized missing required gates. */
	gates: HeGateResult[];
}

/** Runtime validation result for HE gate and phase-exit contracts. */
export interface HeValidationResult {
	/** Whether the candidate satisfies the requested contract. */
	valid: boolean;
	/** Validation errors, empty when valid. */
	errors: string[];
}

type PayloadValidator = (
	payload: Record<string, unknown>,
	result: HeGateResult,
	context: HePhaseContext | null,
	errors: string[],
) => void;
type GateSpec = {
	validatePayload: PayloadValidator;
	missingPayload: () => HeGatePayload;
};

const GATE_SPECS: Record<HeGateId, GateSpec> = {
	simplify: {
		validatePayload(payload, _result, _context, errors) {
			validateStringArray(
				payload.scopeEvidence,
				"payload.scopeEvidence",
				errors,
			);
			validateBoolean(payload.reuseReviewed, "payload.reuseReviewed", errors);
			validateBoolean(
				payload.qualityReviewed,
				"payload.qualityReviewed",
				errors,
			);
			validateBoolean(
				payload.efficiencyReviewed,
				"payload.efficiencyReviewed",
				errors,
			);
			if (
				payload.reuseReviewed !== true ||
				payload.qualityReviewed !== true ||
				payload.efficiencyReviewed !== true
			) {
				errors.push("simplify must account for reuse, quality, and efficiency");
			}
		},
		missingPayload: () => ({
			scopeEvidence: [],
			reuseReviewed: false,
			qualityReviewed: false,
			efficiencyReviewed: false,
		}),
	},
	testing_reviewer: {
		validatePayload(payload, _result, _context, errors) {
			validateStringArray(
				payload.scopeEvidence,
				"payload.scopeEvidence",
				errors,
			);
			validateBoolean(
				payload.testAdequacyReviewed,
				"payload.testAdequacyReviewed",
				errors,
			);
			validateStringArray(
				payload.missingEdgeCases,
				"payload.missingEdgeCases",
				errors,
			);
			if (payload.testAdequacyReviewed !== true) {
				errors.push("testing_reviewer must evaluate test adequacy");
			}
		},
		missingPayload: () => ({
			scopeEvidence: [],
			testAdequacyReviewed: false,
			missingEdgeCases: [],
		}),
	},
	he_fix_bugs: {
		validatePayload(payload, result, context, errors) {
			validateStringArray(
				payload.scopeEvidence,
				"payload.scopeEvidence",
				errors,
			);
			validateStringArray(
				payload.reproductionEvidence,
				"payload.reproductionEvidence",
				errors,
			);
			validateNullableString(payload.rootCause, "payload.rootCause", errors);
			validateStringArray(
				payload.regressionProtection,
				"payload.regressionProtection",
				errors,
			);
			validateNullableString(
				payload.rollbackNote,
				"payload.rollbackNote",
				errors,
			);
			if (!context) return;
			if (!context.failingEvidencePresent && isExecuted(result)) {
				errors.push("he_fix_bugs must not run without failing evidence");
			}
			if (
				context.failingEvidencePresent &&
				result.status === "not_applicable"
			) {
				errors.push(
					"he_fix_bugs cannot be not_applicable with failing evidence",
				);
			}
			if (
				context.failingEvidencePresent &&
				result.status === "pass" &&
				(!hasEntries(payload.reproductionEvidence) ||
					typeof payload.rootCause !== "string" ||
					!hasEntries(payload.regressionProtection) ||
					typeof payload.rollbackNote !== "string")
			) {
				errors.push(
					"he_fix_bugs pass requires reproduction, root cause, regression protection, and rollback note",
				);
			}
		},
		missingPayload: () => ({
			scopeEvidence: [],
			reproductionEvidence: [],
			rootCause: null,
			regressionProtection: [],
			rollbackNote: null,
		}),
	},
	he_code_review: {
		validatePayload(payload, _result, _context, errors) {
			validateStringArray(
				payload.scopeEvidence,
				"payload.scopeEvidence",
				errors,
			);
			validateBoolean(payload.findingsFirst, "payload.findingsFirst", errors);
			validateBoolean(
				payload.traceabilityReviewed,
				"payload.traceabilityReviewed",
				errors,
			);
			validateBoolean(
				payload.blockerClassification,
				"payload.blockerClassification",
				errors,
			);
			validateBoolean(
				payload.safeToContinueReviewed,
				"payload.safeToContinueReviewed",
				errors,
			);
			if (
				payload.findingsFirst !== true ||
				payload.traceabilityReviewed !== true ||
				payload.blockerClassification !== true ||
				payload.safeToContinueReviewed !== true
			) {
				errors.push(
					"he_code_review must prove findings-first traceable blocker and safe-to-continue review",
				);
			}
		},
		missingPayload: () => ({
			scopeEvidence: [],
			findingsFirst: false,
			traceabilityReviewed: false,
			blockerClassification: false,
			safeToContinueReviewed: false,
		}),
	},
	autofix: {
		validatePayload(payload, result, context, errors) {
			validateStringArray(
				payload.scopeEvidence,
				"payload.scopeEvidence",
				errors,
			);
			validateStringArray(
				payload.feedbackInventory,
				"payload.feedbackInventory",
				errors,
			);
			validateNumber(payload.accountedItems, "payload.accountedItems", errors);
			if (!context) return;
			if (!context.reviewFeedbackPresent && isExecuted(result)) {
				errors.push("autofix must not run without review feedback");
			}
			if (context.reviewFeedbackPresent && result.status === "not_applicable") {
				errors.push("autofix cannot be not_applicable with review feedback");
			}
			if (
				context.reviewFeedbackPresent &&
				result.status === "pass" &&
				(!hasEntries(payload.feedbackInventory) ||
					payload.accountedItems !== payload.feedbackInventory.length)
			) {
				errors.push(
					"autofix pass requires review-feedback inventory with full accounting",
				);
			}
		},
		missingPayload: () => ({
			scopeEvidence: [],
			feedbackInventory: [],
			accountedItems: 0,
		}),
	},
};

const EXECUTION_MODES: readonly HeGateExecutionMode[] = [
	"direct_skill",
	"subagent_proxy",
	"manual_review",
	"validation_only",
	"not_applicable",
	"not_run",
];
const STATUSES: readonly HeGateStatus[] = [
	"pass",
	"fail",
	"blocked",
	"not_applicable",
	"not_run",
];
const PHASES: readonly HePhase[] = ["route", "lifecycle", "closeout"];
const RECOMMENDATIONS: readonly HePhaseExitRecommendation[] = [
	"continue",
	"stop",
	"commit_blocked",
	"human_review_required",
];

function hasEntries(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every((entry) => typeof entry === "string" && entry.trim().length > 0)
	);
}

function isExecuted(result: HeGateResult): boolean {
	return !["not_applicable", "not_run"].includes(result.status);
}

function validateEvidenceRefs(
	value: unknown,
	errors: string[],
): HeEvidenceRef[] {
	if (!Array.isArray(value)) {
		errors.push("evidenceRefs must be an array");
		return [];
	}
	const ids = new Set<string>();
	const refs: HeEvidenceRef[] = [];
	for (const [index, entry] of value.entries()) {
		if (!isRecord(entry)) {
			errors.push(`evidenceRefs[${index}] must be an object`);
			continue;
		}
		validateString(entry.id, `evidenceRefs[${index}].id`, errors);
		validateString(entry.kind, `evidenceRefs[${index}].kind`, errors);
		validateString(entry.ref, `evidenceRefs[${index}].ref`, errors);
		validateBoolean(
			entry.gateLocal,
			`evidenceRefs[${index}].gateLocal`,
			errors,
		);
		if (typeof entry.id === "string") {
			if (ids.has(entry.id))
				errors.push(`evidenceRefs[${index}].id must be unique`);
			ids.add(entry.id);
		}
		if (entry.kind === "route-decision") {
			errors.push("route-decision refs are context, not gate evidence");
		}
		refs.push(entry as unknown as HeEvidenceRef);
	}
	return refs;
}

function validateFindings(value: unknown, errors: string[]): HeGateFinding[] {
	if (!Array.isArray(value)) {
		errors.push("findings must be an array");
		return [];
	}
	const findings: HeGateFinding[] = [];
	for (const [index, entry] of value.entries()) {
		if (!isRecord(entry)) {
			errors.push(`findings[${index}] must be an object`);
			continue;
		}
		validateString(entry.id, `findings[${index}].id`, errors);
		validateEnum(
			entry.severity,
			`findings[${index}].severity`,
			["low", "medium", "high"],
			errors,
		);
		validateEnum(
			entry.status,
			`findings[${index}].status`,
			["open", "fixed", "skipped", "false_positive"],
			errors,
		);
		validateString(entry.summary, `findings[${index}].summary`, errors);
		validateNullableString(
			entry.evidenceRef,
			`findings[${index}].evidenceRef`,
			errors,
		);
		findings.push(entry as unknown as HeGateFinding);
	}
	return findings;
}

function validateActions(value: unknown, errors: string[]): void {
	if (!Array.isArray(value)) {
		errors.push("actions must be an array");
		return;
	}
	for (const [index, entry] of value.entries()) {
		if (!isRecord(entry)) {
			errors.push(`actions[${index}] must be an object`);
			continue;
		}
		validateString(entry.id, `actions[${index}].id`, errors);
		validateEnum(
			entry.status,
			`actions[${index}].status`,
			["fixed", "deferred", "blocked", "accepted"],
			errors,
		);
		validateString(entry.summary, `actions[${index}].summary`, errors);
		validateStringArray(
			entry.evidenceRefs,
			`actions[${index}].evidenceRefs`,
			errors,
		);
	}
}

function validateGateValidation(value: unknown, errors: string[]): void {
	if (!Array.isArray(value)) {
		errors.push("validation must be an array");
		return;
	}
	for (const [index, entry] of value.entries()) {
		if (!isRecord(entry)) {
			errors.push(`validation[${index}] must be an object`);
			continue;
		}
		validateString(entry.command, `validation[${index}].command`, errors);
		validateEnum(
			entry.outcome,
			`validation[${index}].outcome`,
			["pass", "fail", "blocked"],
			errors,
		);
		validateNullableString(entry.reason, `validation[${index}].reason`, errors);
	}
}

function validatePhaseContext(
	value: unknown,
	errors: string[],
): HePhaseContext | null {
	if (!isRecord(value)) {
		errors.push("phaseContext must be an object");
		return null;
	}
	validateEnum(value.phase, "phaseContext.phase", PHASES, errors);
	validateBoolean(
		value.failingEvidencePresent,
		"phaseContext.failingEvidencePresent",
		errors,
	);
	validateBoolean(
		value.reviewFeedbackPresent,
		"phaseContext.reviewFeedbackPresent",
		errors,
	);
	return value as unknown as HePhaseContext;
}

function gateResultFromRecord(
	value: unknown,
	context: HePhaseContext | null,
	errors: string[],
): HeGateResult | null {
	if (!isRecord(value)) {
		errors.push("gate result must be an object");
		return null;
	}
	if (value.schemaVersion !== HE_GATE_RESULT_SCHEMA_VERSION)
		errors.push("schemaVersion must be he-gate-result/v1");
	const gateIdValid = validateEnum(value.gateId, "gateId", HE_GATE_IDS, errors);
	validateBoolean(value.required, "required", errors);
	validateEnum(value.executionMode, "executionMode", EXECUTION_MODES, errors);
	validateEnum(value.status, "status", STATUSES, errors);
	if (!isRecord(value.payload)) errors.push("payload must be an object");
	const evidenceRefs = validateEvidenceRefs(value.evidenceRefs, errors);
	const findings = validateFindings(value.findings, errors);
	validateActions(value.actions, errors);
	validateGateValidation(value.validation, errors);
	validateBoolean(value.requiresHuman, "requiresHuman", errors);
	validateBoolean(value.safeToContinue, "safeToContinue", errors);
	validateNullableString(value.reason, "reason", errors);
	validateNullableString(value.blockedReason, "blockedReason", errors);
	const result = { ...value, findings } as unknown as HeGateResult;
	if (gateIdValid && isRecord(value.payload))
		GATE_SPECS[value.gateId as HeGateId].validatePayload(
			value.payload,
			result,
			context,
			errors,
		);
	validateGateConsistency(result, evidenceRefs, errors);
	return result;
}

function validateGateConsistency(
	result: HeGateResult,
	evidenceRefs: HeEvidenceRef[],
	errors: string[],
): void {
	if (
		["pass", "fail", "blocked"].includes(result.status) &&
		!evidenceRefs.some((ref) => ref.gateLocal)
	)
		errors.push(
			"pass, fail, and blocked gates require at least one gate-local evidence ref",
		);
	if (
		["fail", "blocked"].includes(result.status) &&
		!result.findings.some((finding) => finding.status === "open")
	)
		errors.push("failed or blocked gates require an open finding");
	if (result.status === "blocked" && result.blockedReason === null)
		errors.push("blocked gates require blockedReason");
	if (
		result.status === "not_applicable" &&
		result.executionMode !== "not_applicable"
	)
		errors.push("not_applicable gates require not_applicable executionMode");
	if (
		result.status === "not_applicable" &&
		(typeof result.reason !== "string" || result.reason.trim().length === 0)
	)
		errors.push("not_applicable gates require reason");
	if (result.status === "not_run" && result.executionMode !== "not_run")
		errors.push("not_run gates require not_run executionMode");
	if (
		result.status === "not_run" &&
		(typeof result.reason !== "string" || result.reason.trim().length === 0)
	)
		errors.push("not_run gates require reason");
	const evidenceRefIds = new Set(evidenceRefs.map((ref) => ref.id));
	for (const finding of result.findings) {
		if (
			finding.evidenceRef !== null &&
			!evidenceRefIds.has(finding.evidenceRef)
		) {
			errors.push(`unknown evidenceRefs.id: ${finding.evidenceRef}`);
		}
	}
}

/** Validate an unknown value as a HeGateResult/v1. */
export function validateHeGateResult(value: unknown): HeValidationResult {
	const errors: string[] = [];
	gateResultFromRecord(value, null, errors);
	return { valid: errors.length === 0, errors };
}

/** Validate an unknown value as HePhaseExitInput. */
export function validateHePhaseExitInput(value: unknown): HeValidationResult {
	const errors: string[] = [];
	if (!isRecord(value))
		return { valid: false, errors: ["phase-exit input must be an object"] };
	const context = validatePhaseContext(value.phaseContext, errors);
	validateGateIdArray(value.requiredGates, "requiredGates", errors);
	validateGateIdArray(value.optionalGates, "optionalGates", errors);
	if (!Array.isArray(value.gates)) {
		errors.push("gates must be an array");
		return { valid: false, errors };
	}
	const requiredList = Array.isArray(value.requiredGates)
		? value.requiredGates
		: [];
	const optionalList = Array.isArray(value.optionalGates)
		? value.optionalGates
		: [];
	const required = new Set(requiredList as HeGateId[]);
	const optional = new Set(optionalList as HeGateId[]);
	for (const gateId of required) {
		if (optional.has(gateId)) {
			errors.push("gate cannot be both required and optional");
		}
	}
	const seen = new Set<HeGateId>();
	for (const [index, candidate] of value.gates.entries()) {
		const before = errors.length;
		const result = gateResultFromRecord(candidate, context, errors);
		if (!result || errors.length > before) continue;
		if (seen.has(result.gateId))
			errors.push(`gates[${index}].gateId must be unique`);
		seen.add(result.gateId);
		if (!required.has(result.gateId) && !optional.has(result.gateId))
			errors.push(`gates[${index}].gateId must be configured`);
		if (required.has(result.gateId) && result.required !== true)
			errors.push(`gates[${index}].required must match requiredGates`);
		if (optional.has(result.gateId) && result.required !== false)
			errors.push(`gates[${index}].required must match optionalGates`);
	}
	return { valid: errors.length === 0, errors };
}

/** Aggregate configured HE gate evidence into a fail-closed phase-exit decision. */
export function aggregateHePhaseExit(input: HePhaseExitInput): HePhaseExit {
	const inputValidation = validateHePhaseExitInput(input);
	if (!inputValidation.valid)
		return invalidExit(
			{
				phaseContext: sanitizePhaseContext(input),
				gates: sanitizeGateArray(input),
			},
			inputValidation.errors,
		);

	const gatesById = new Map(input.gates.map((gate) => [gate.gateId, gate]));
	const requiredGateSet = new Set(input.requiredGates);
	const gates = [
		...input.gates,
		...input.requiredGates
			.filter((gateId) => !gatesById.has(gateId))
			.map((gateId) => createMissingGateResult(gateId, true)),
	];
	const blockers = gates
		.filter((gate) => requiredGateSet.has(gate.gateId))
		.filter(
			(gate) =>
				!gate.safeToContinue ||
				!["pass", "not_applicable"].includes(gate.status),
		)
		.map((gate) => gate.blockedReason ?? `${gate.gateId} did not pass`);
	const warnings = gates
		.filter((gate) => !requiredGateSet.has(gate.gateId))
		.filter((gate) => !["pass", "not_applicable"].includes(gate.status))
		.map((gate) => gate.blockedReason ?? `${gate.gateId} did not pass`);
	const recommendation = chooseRecommendation(
		input.phaseContext,
		blockers,
		gates,
	);
	return {
		schemaVersion: HE_PHASE_EXIT_SCHEMA_VERSION,
		phaseContext: input.phaseContext,
		recommendation,
		commitAllowed:
			input.phaseContext.phase === "closeout" &&
			recommendation === "continue" &&
			blockers.length === 0,
		exitAllowed: recommendation === "continue" && blockers.length === 0,
		blockers,
		warnings,
		gates,
	};
}

/** Validate an unknown value as a HePhaseExit/v1 decision. */
export function validateHePhaseExit(value: unknown): HeValidationResult {
	const errors: string[] = [];
	if (!isRecord(value))
		return { valid: false, errors: ["phase exit must be an object"] };
	if (value.schemaVersion !== HE_PHASE_EXIT_SCHEMA_VERSION)
		errors.push("schemaVersion must be he-phase-exit/v1");
	validatePhaseContext(value.phaseContext, errors);
	validateEnum(value.recommendation, "recommendation", RECOMMENDATIONS, errors);
	validateBoolean(value.commitAllowed, "commitAllowed", errors);
	validateBoolean(value.exitAllowed, "exitAllowed", errors);
	validateStringArray(value.blockers, "blockers", errors);
	validateStringArray(value.warnings, "warnings", errors);
	if (!Array.isArray(value.gates)) errors.push("gates must be an array");
	else
		for (const gate of value.gates)
			gateResultFromRecord(gate, value.phaseContext as HePhaseContext, errors);
	if (
		value.recommendation === "commit_blocked" &&
		value.phaseContext &&
		isRecord(value.phaseContext) &&
		value.phaseContext.phase !== "closeout"
	)
		errors.push("commit_blocked recommendation is only valid during closeout");
	if (
		value.commitAllowed === true &&
		value.phaseContext &&
		isRecord(value.phaseContext) &&
		value.phaseContext.phase !== "closeout"
	)
		errors.push("commitAllowed can only be true during closeout");
	if (value.commitAllowed === true && value.recommendation !== "continue")
		errors.push("commitAllowed requires continue recommendation");
	if (
		value.exitAllowed === true &&
		(value.recommendation !== "continue" ||
			!Array.isArray(value.blockers) ||
			value.blockers.length > 0)
	) {
		errors.push("exitAllowed requires continue recommendation with no blockers");
	}
	if (
		value.recommendation === "human_review_required" &&
		Array.isArray(value.blockers) &&
		value.blockers.length === 0
	)
		errors.push("human_review_required requires correlated blocker evidence");
	return { valid: errors.length === 0, errors };
}

/** Create a deterministic missing-gate result for fail-closed aggregation. */
export function createMissingGateResult(
	gateId: HeGateId,
	required = true,
): HeGateResult {
	return {
		schemaVersion: HE_GATE_RESULT_SCHEMA_VERSION,
		gateId,
		required,
		executionMode: "not_run",
		status: "not_run",
		payload: GATE_SPECS[gateId].missingPayload(),
		evidenceRefs: [],
		findings: [
			{
				id: `${gateId}-missing`,
				severity: "high",
				status: "open",
				summary: `${gateId} gate has not run`,
				evidenceRef: null,
			},
		],
		actions: [],
		validation: [],
		requiresHuman: false,
		safeToContinue: false,
		reason: `${gateId} gate has not run`,
		blockedReason: `${gateId} gate has not run`,
	};
}

function validateGateIdArray(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (!Array.isArray(value)) {
		errors.push(`${field} must be an array`);
		return;
	}
	const seen = new Set<HeGateId>();
	for (const [index, entry] of value.entries()) {
		if (validateEnum(entry, `${field}[${index}]`, HE_GATE_IDS, errors)) {
			if (seen.has(entry)) errors.push(`${field}[${index}] must be unique`);
			seen.add(entry);
		}
	}
}

function chooseRecommendation(
	context: HePhaseContext,
	blockers: string[],
	gates: HeGateResult[],
): HePhaseExitRecommendation {
	if (
		gates.some(
			(gate) =>
				gate.requiresHuman &&
				blockers.some(
					(blocker) =>
						blocker === gate.blockedReason || blocker.includes(gate.gateId),
				),
		)
	)
		return "human_review_required";
	if (blockers.length === 0) return "continue";
	return context.phase === "closeout" ? "commit_blocked" : "stop";
}

function invalidExit(
	input: Pick<HePhaseExitInput, "phaseContext" | "gates">,
	errors: string[],
): HePhaseExit {
	return {
		schemaVersion: HE_PHASE_EXIT_SCHEMA_VERSION,
		phaseContext: input.phaseContext,
		recommendation:
			input.phaseContext.phase === "closeout" ? "commit_blocked" : "stop",
		commitAllowed: false,
		exitAllowed: false,
		blockers: errors,
		warnings: [],
		gates: input.gates,
	};
}

function sanitizePhaseContext(input: unknown): HePhaseContext {
	if (!isRecord(input)) return fallbackPhaseContext("closeout");
	if (!isRecord(input.phaseContext)) return fallbackPhaseContext("closeout");
	const phase = input.phaseContext.phase;
	return {
		phase:
			phase === "route" || phase === "lifecycle" || phase === "closeout"
				? phase
				: "closeout",
		failingEvidencePresent: input.phaseContext.failingEvidencePresent === true,
		reviewFeedbackPresent: input.phaseContext.reviewFeedbackPresent === true,
	};
}

function sanitizeGateArray(input: unknown): HeGateResult[] {
	if (!isRecord(input) || !Array.isArray(input.gates)) return [];
	return input.gates.filter(isRecord) as unknown as HeGateResult[];
}

function fallbackPhaseContext(phase: HePhase): HePhaseContext {
	return {
		phase,
		failingEvidencePresent: false,
		reviewFeedbackPresent: false,
	};
}
