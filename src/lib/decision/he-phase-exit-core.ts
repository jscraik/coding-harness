import {
	type HeValidationError,
	isRecord,
	validateBoolean,
	validateEnum,
	validateNullableString,
	validateNumber,
	validateString,
	validateStringArray,
} from "./validators.js";

/** Re-export HeValidationError for external consumers. */
export type { HeValidationError } from "./validators.js";

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
	errors: HeValidationError[];
}

/**
 * Convert a validation error message string to a structured HeValidationError.
 *
 * @param message - The human-readable validation error message
 * @param path - Optional field path that failed validation
 * @param gate - Optional gate identifier for gate-specific errors
 * @returns A structured validation error with code derived from the message
 */
function toValidationError(
	message: string,
	path?: string,
	gate?: string,
): HeValidationError {
	const error: HeValidationError = {
		code: message,
		severity: "error",
	};
	if (path !== undefined) {
		error.path = path;
	}
	if (gate !== undefined) {
		error.gate = gate;
	}
	return error;
}

type PayloadValidator = (
	payload: Record<string, unknown>,
	result: HeGateResult,
	context: HePhaseContext | null,
	errors: HeValidationError[],
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
				errors.push(
					toValidationError(
						"simplify must account for reuse, quality, and efficiency",
						"payload",
						"simplify",
					),
				);
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
				errors.push(
					toValidationError(
						"testing_reviewer must evaluate test adequacy",
						"payload.testAdequacyReviewed",
						"testing_reviewer",
					),
				);
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
				errors.push(
					toValidationError(
						"he_fix_bugs must not run without failing evidence",
						"executionMode",
						"he_fix_bugs",
					),
				);
			}
			if (
				context.failingEvidencePresent &&
				result.status === "not_applicable"
			) {
				errors.push(
					toValidationError(
						"he_fix_bugs cannot be not_applicable with failing evidence",
						"status",
						"he_fix_bugs",
					),
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
					toValidationError(
						"he_fix_bugs pass requires reproduction, root cause, regression protection, and rollback note",
						"payload",
						"he_fix_bugs",
					),
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
					toValidationError(
						"he_code_review must prove findings-first traceable blocker and safe-to-continue review",
						"payload",
						"he_code_review",
					),
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
				errors.push(
					toValidationError(
						"autofix must not run without review feedback",
						"executionMode",
						"autofix",
					),
				);
			}
			if (context.reviewFeedbackPresent && result.status === "not_applicable") {
				errors.push(
					toValidationError(
						"autofix cannot be not_applicable with review feedback",
						"status",
						"autofix",
					),
				);
			}
			if (
				context.reviewFeedbackPresent &&
				result.status === "pass" &&
				(!hasEntries(payload.feedbackInventory) ||
					payload.accountedItems !== payload.feedbackInventory.length)
			) {
				errors.push(
					toValidationError(
						"autofix pass requires review-feedback inventory with full accounting",
						"payload",
						"autofix",
					),
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

/**
 * Determines whether a value is an array containing one or more non-empty strings.
 *
 * @returns `true` if `value` is an array of at least one string where each string has non-whitespace characters after trimming, `false` otherwise.
 */
function hasEntries(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every((entry) => typeof entry === "string" && entry.trim().length > 0)
	);
}

/**
 * Determines whether a gate result represents an executed gate.
 *
 * @param result - The gate result to evaluate
 * @returns `true` if `result.status` is not `"not_applicable"` or `"not_run"`, `false` otherwise.
 */
function isExecuted(result: HeGateResult): boolean {
	return !["not_applicable", "not_run"].includes(result.status);
}

/**
 * Validate and parse an untrusted value expected to contain evidence references.
 *
 * Appends human-readable messages to `errors` for structural and field-level problems:
 * - when the top-level value is not an array,
 * - when an entry is not an object,
 * - when `id`, `kind`, or `ref` are not strings,
 * - when `gateLocal` is not a boolean,
 * - when an `id` is duplicated,
 * - when an entry's `kind` matches a `route-decision` pattern (treated as context, not gate evidence).
 *
 * @param value - The untrusted input to validate and parse
 * @param errors - Collector for validation error messages; messages are appended in-place
 * @returns The validated evidence reference entries; returns an empty array when the top-level value is not an array
 */
function validateEvidenceRefs(
	value: unknown,
	errors: HeValidationError[],
): HeEvidenceRef[] {
	if (!Array.isArray(value)) {
		errors.push(
			toValidationError("evidenceRefs must be an array", "evidenceRefs"),
		);
		return [];
	}
	const ids = new Set<string>();
	const refs: HeEvidenceRef[] = [];
	for (const [index, entry] of value.entries()) {
		if (!isRecord(entry)) {
			errors.push(
				toValidationError(
					`evidenceRefs[${index}] must be an object`,
					`evidenceRefs[${index}]`,
				),
			);
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
				errors.push(
					toValidationError(
						`evidenceRefs[${index}].id must be unique`,
						`evidenceRefs[${index}].id`,
					),
				);
			ids.add(entry.id);
		}
		if (
			typeof entry.kind === "string" &&
			/^route[-_]?decision(\/v\d+)?$/i.test(entry.kind.trim())
		) {
			errors.push(
				toValidationError(
					"route-decision refs are context, not gate evidence",
					`evidenceRefs[${index}].kind`,
				),
			);
		}
		refs.push(entry as unknown as HeEvidenceRef);
	}
	return refs;
}

/**
 * Validate an input as an array of gate findings and produce a typed findings list.
 *
 * @param value - The unknown input to validate as a findings array.
 * @param errors - Mutable array that will be appended with human-readable validation errors.
 * @returns An array of `HeGateFinding` objects parsed from `value`; returns an empty array if `value` is not an array or entries are structurally invalid.
 */
function validateFindings(
	value: unknown,
	errors: HeValidationError[],
): HeGateFinding[] {
	if (!Array.isArray(value)) {
		errors.push(toValidationError("findings must be an array", "findings"));
		return [];
	}
	const findings: HeGateFinding[] = [];
	for (const [index, entry] of value.entries()) {
		if (!isRecord(entry)) {
			errors.push(
				toValidationError(
					`findings[${index}] must be an object`,
					`findings[${index}]`,
				),
			);
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

/**
 * Validate that `value` represents an array of action records and append any validation errors to `errors`.
 *
 * Each action is expected to be an object with the following fields:
 * - `id` (string)
 * - `status` (one of `"fixed"`, `"deferred"`, `"blocked"`, `"accepted"`)
 * - `summary` (string)
 * - `evidenceRefs` (string array)
 *
 * @param value - The value to validate as an array of action records
 * @param errors - Accumulator array; any validation error messages are pushed into this array
 */
function validateActions(value: unknown, errors: HeValidationError[]): void {
	if (!Array.isArray(value)) {
		errors.push(toValidationError("actions must be an array", "actions"));
		return;
	}
	for (const [index, entry] of value.entries()) {
		if (!isRecord(entry)) {
			errors.push(
				toValidationError(
					`actions[${index}] must be an object`,
					`actions[${index}]`,
				),
			);
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

/**
 * Validates a gate result `validation` field and appends human-readable error messages.
 *
 * Ensures `value` is an array of objects where each entry has a string `command`,
 * an `outcome` equal to `"pass"`, `"fail"`, or `"blocked"`, and a nullable string `reason`.
 *
 * @param value - The unknown value to validate as the `validation` array
 * @param errors - Accumulator array; validation error messages will be pushed into this array
 */
function validateGateValidation(
	value: unknown,
	errors: HeValidationError[],
): void {
	if (!Array.isArray(value)) {
		errors.push(toValidationError("validation must be an array", "validation"));
		return;
	}
	for (const [index, entry] of value.entries()) {
		if (!isRecord(entry)) {
			errors.push(
				toValidationError(
					`validation[${index}] must be an object`,
					`validation[${index}]`,
				),
			);
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

/**
 * Validate a phase-scoped context and record any field validation errors.
 *
 * Validates `phase`, `failingEvidencePresent`, and `reviewFeedbackPresent`, pushing human-readable messages into `errors`. Returns `null` only when the top-level `value` is not an object.
 *
 * @param value - The input to validate as a phase context
 * @param errors - Mutable array that receives validation error messages
 * @returns The validated `HePhaseContext`, or `null` if `value` is not an object
 */
function validatePhaseContext(
	value: unknown,
	errors: HeValidationError[],
): HePhaseContext | null {
	if (!isRecord(value)) {
		errors.push(
			toValidationError("phaseContext must be an object", "phaseContext"),
		);
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

/**
 * Validate and normalize a raw gate result record.
 *
 * Performs structural checks, runs gate-specific payload validation when available, and enforces cross-field consistency, appending human-readable messages to `errors`.
 *
 * @param value - The raw input to validate and normalize
 * @param context - Phase-scoped context used by gate-specific payload validators; may be `null`
 * @param errors - Mutable array that will receive validation error messages
 * @returns The normalized `HeGateResult` when the top-level input is an object, `null` if the top-level input is not an object
 */
function gateResultFromRecord(
	value: unknown,
	context: HePhaseContext | null,
	errors: HeValidationError[],
): HeGateResult | null {
	if (!isRecord(value)) {
		errors.push(toValidationError("gate result must be an object"));
		return null;
	}
	if (value.schemaVersion !== HE_GATE_RESULT_SCHEMA_VERSION)
		errors.push(
			toValidationError(
				"schemaVersion must be he-gate-result/v1",
				"schemaVersion",
			),
		);
	const gateIdValid = validateEnum(value.gateId, "gateId", HE_GATE_IDS, errors);
	validateBoolean(value.required, "required", errors);
	validateEnum(value.executionMode, "executionMode", EXECUTION_MODES, errors);
	validateEnum(value.status, "status", STATUSES, errors);
	if (!isRecord(value.payload))
		errors.push(toValidationError("payload must be an object", "payload"));
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

/**
 * Validate cross-field consistency of a single gate result and append any discovered error messages to `errors`.
 *
 * Performs checks for executionMode/status alignment; requires at least one gate-local evidence ref when status is `pass`, `fail`, `blocked`, or `not_applicable`; rejects `validation_only` as proof for skill-backed gate outcomes; requires an open finding when status is `fail` or `blocked`; requires a non-null `blockedReason` when status is `blocked`; requires matching `executionMode` and a non-empty `reason` for `not_applicable` and `not_run`; and ensures every finding `evidenceRef` (when non-null) references an existing `evidenceRefs.id`.
 *
 * @param result - The normalized gate result to validate
 * @param evidenceRefs - The evidence references declared on the gate result
 * @param errors - Mutable array that will receive human-readable error messages for each violated rule
 */
function validateGateConsistency(
	result: HeGateResult,
	evidenceRefs: HeEvidenceRef[],
	errors: HeValidationError[],
): void {
	if (
		["pass", "fail", "blocked"].includes(result.status) &&
		["not_applicable", "not_run"].includes(result.executionMode)
	) {
		errors.push(
			toValidationError(
				"pass, fail, and blocked gates cannot have not_applicable or not_run executionMode",
				"executionMode",
				result.gateId,
			),
		);
	}
	if (
		["pass", "fail", "blocked"].includes(result.status) &&
		result.executionMode === "validation_only"
	) {
		errors.push(
			toValidationError(
				"validation_only gates cannot satisfy pass, fail, or blocked skill-gate evidence",
				"executionMode",
				result.gateId,
			),
		);
	}
	if (
		["pass", "fail", "blocked", "not_applicable"].includes(result.status) &&
		!evidenceRefs.some((ref) => ref.gateLocal)
	) {
		errors.push(
			toValidationError(
				result.status === "not_applicable"
					? "not_applicable gates require at least one gate-local evidence ref"
					: "pass, fail, and blocked gates require at least one gate-local evidence ref",
				"evidenceRefs",
				result.gateId,
			),
		);
	}
	if (
		["fail", "blocked"].includes(result.status) &&
		!result.findings.some((finding) => finding.status === "open")
	)
		errors.push(
			toValidationError(
				"failed or blocked gates require an open finding",
				"findings",
				result.gateId,
			),
		);
	if (
		result.status === "blocked" &&
		(typeof result.blockedReason !== "string" ||
			result.blockedReason.trim().length === 0)
	) {
		errors.push(
			toValidationError(
				"blocked gates require blockedReason",
				"blockedReason",
				result.gateId,
			),
		);
	}
	if (
		result.status === "not_applicable" &&
		result.executionMode !== "not_applicable"
	)
		errors.push(
			toValidationError(
				"not_applicable gates require not_applicable executionMode",
				"executionMode",
				result.gateId,
			),
		);
	if (
		result.status === "not_applicable" &&
		(typeof result.reason !== "string" || result.reason.trim().length === 0)
	)
		errors.push(
			toValidationError(
				"not_applicable gates require reason",
				"reason",
				result.gateId,
			),
		);
	if (result.status === "not_run" && result.executionMode !== "not_run")
		errors.push(
			toValidationError(
				"not_run gates require not_run executionMode",
				"executionMode",
				result.gateId,
			),
		);
	if (
		result.status === "not_run" &&
		(typeof result.reason !== "string" || result.reason.trim().length === 0)
	)
		errors.push(
			toValidationError(
				"not_run gates require reason",
				"reason",
				result.gateId,
			),
		);
	const evidenceRefIds = new Set(evidenceRefs.map((ref) => ref.id));
	for (const finding of result.findings) {
		if (
			finding.evidenceRef !== null &&
			!evidenceRefIds.has(finding.evidenceRef)
		) {
			errors.push(
				toValidationError(
					`unknown evidenceRefs.id: ${finding.evidenceRef}`,
					"findings.evidenceRef",
					result.gateId,
				),
			);
		}
	}
}

/**
 * Validate an arbitrary value against the HeGateResult contract and collect any validation errors.
 *
 * @param value - The value to validate as a gate result
 * @returns `valid` is `true` when the value conforms to the HeGateResult schema; `errors` lists validation failures otherwise
 */
export function validateHeGateResult(value: unknown): HeValidationResult {
	const errors: HeValidationError[] = [];
	gateResultFromRecord(value, null, errors);
	return { valid: errors.length === 0, errors };
}

/**
 * Validate that a value conforms to the HePhaseExitInput contract.
 *
 * Performs structural and semantic checks for `phaseContext`, `requiredGates`, `optionalGates`, and `gates`, including uniqueness of gate IDs, that gates are configured as required or optional, and that each provided gate result itself is valid.
 *
 * @param value - The unknown input to validate
 * @returns An object with `valid` set to `true` when `value` satisfies the HePhaseExitInput contract, and `errors` containing human-readable validation messages otherwise.
 */
export function validateHePhaseExitInput(value: unknown): HeValidationResult {
	const errors: HeValidationError[] = [];
	if (!isRecord(value))
		return {
			valid: false,
			errors: [toValidationError("phase-exit input must be an object")],
		};
	const context = validatePhaseContext(value.phaseContext, errors);
	validateGateIdArray(value.requiredGates, "requiredGates", errors);
	validateGateIdArray(value.optionalGates, "optionalGates", errors);
	if (!Array.isArray(value.gates)) {
		errors.push(toValidationError("gates must be an array", "gates"));
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
	if (
		context?.failingEvidencePresent === true &&
		!required.has("he_fix_bugs")
	) {
		errors.push(
			toValidationError(
				"phaseContext.failingEvidencePresent requires he_fix_bugs in requiredGates",
				"requiredGates",
			),
		);
	}
	if (context?.reviewFeedbackPresent === true && !required.has("autofix")) {
		errors.push(
			toValidationError(
				"phaseContext.reviewFeedbackPresent requires autofix in requiredGates",
				"requiredGates",
			),
		);
	}
	for (const gateId of required) {
		if (optional.has(gateId)) {
			errors.push(
				toValidationError(
					"gate cannot be both required and optional",
					"requiredGates",
				),
			);
		}
	}
	const seen = new Set<HeGateId>();
	for (const [index, candidate] of value.gates.entries()) {
		const before = errors.length;
		const result = gateResultFromRecord(candidate, context, errors);
		if (!result || errors.length > before) continue;
		if (seen.has(result.gateId))
			errors.push(
				toValidationError(
					`gates[${index}].gateId must be unique`,
					`gates[${index}].gateId`,
				),
			);
		seen.add(result.gateId);
		if (!required.has(result.gateId) && !optional.has(result.gateId))
			errors.push(
				toValidationError(
					`gates[${index}].gateId must be configured`,
					`gates[${index}].gateId`,
				),
			);
		if (required.has(result.gateId) && result.required !== true)
			errors.push(
				toValidationError(
					`gates[${index}].required must match requiredGates`,
					`gates[${index}].required`,
				),
			);
		if (optional.has(result.gateId) && result.required !== false)
			errors.push(
				toValidationError(
					`gates[${index}].required must match optionalGates`,
					`gates[${index}].required`,
				),
			);
	}
	return { valid: errors.length === 0, errors };
}

/**
 * Builds a phase-exit decision from configured HE gate results, synthesizing missing required gates and applying fail-closed rules.
 *
 * @param input - Phase context plus lists of required/optional gate IDs and the provided gate results used to compute the decision
 * @returns A `HePhaseExit` decision containing `recommendation`, `commitAllowed`, `exitAllowed`, `blockers`, `warnings`, and `gates`. If the input fails validation, returns a fail-closed decision where `blockers` contains the validation errors and missing required gates are synthesized into the `gates` list.
 */
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
		.map(gateIssueReason);
	const warnings = gates
		.filter((gate) => !requiredGateSet.has(gate.gateId))
		.filter(
			(gate) =>
				!gate.safeToContinue ||
				!["pass", "not_applicable"].includes(gate.status),
		)
		.map(gateIssueReason);
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

/**
 * Validate an arbitrary value as a HePhaseExit/v1 decision.
 *
 * Performs structural and cross-field validation of phaseContext, recommendation,
 * commitAllowed, exitAllowed, blockers, warnings, and gates according to the
 * HePhaseExit/v1 contract and returns descriptive error messages for any violations.
 *
 * @returns `valid: true` when the value conforms to the HePhaseExit/v1 contract; `valid: false` and `errors` with diagnostic messages otherwise.
 */
export function validateHePhaseExit(value: unknown): HeValidationResult {
	const errors: HeValidationError[] = [];
	if (!isRecord(value))
		return {
			valid: false,
			errors: [toValidationError("phase exit must be an object")],
		};
	if (value.schemaVersion !== HE_PHASE_EXIT_SCHEMA_VERSION)
		errors.push(
			toValidationError(
				"schemaVersion must be he-phase-exit/v1",
				"schemaVersion",
			),
		);
	validatePhaseContext(value.phaseContext, errors);
	validateEnum(value.recommendation, "recommendation", RECOMMENDATIONS, errors);
	validateBoolean(value.commitAllowed, "commitAllowed", errors);
	validateBoolean(value.exitAllowed, "exitAllowed", errors);
	validateStringArray(value.blockers, "blockers", errors);
	validateStringArray(value.warnings, "warnings", errors);
	const validatedGates: HeGateResult[] = [];
	if (!Array.isArray(value.gates))
		errors.push(toValidationError("gates must be an array", "gates"));
	else {
		const seenGateIds = new Set<HeGateId>();
		for (const [index, gate] of value.gates.entries()) {
			const before = errors.length;
			const parsedGate = gateResultFromRecord(
				gate,
				value.phaseContext as HePhaseContext,
				errors,
			);
			if (!parsedGate || errors.length > before) continue;
			if (seenGateIds.has(parsedGate.gateId))
				errors.push(
					toValidationError(
						`gates[${index}].gateId must be unique`,
						`gates[${index}].gateId`,
					),
				);
			seenGateIds.add(parsedGate.gateId);
			validatedGates.push(parsedGate);
		}
	}
	const blockingRequiredGates = validatedGates.filter(
		(gate) =>
			gate.required &&
			(!gate.safeToContinue ||
				!["pass", "not_applicable"].includes(gate.status)),
	);
	if (
		value.recommendation === "commit_blocked" &&
		value.phaseContext &&
		isRecord(value.phaseContext) &&
		value.phaseContext.phase !== "closeout"
	)
		errors.push(
			toValidationError(
				"commit_blocked recommendation is only valid during closeout",
				"recommendation",
			),
		);
	if (
		value.commitAllowed === true &&
		value.phaseContext &&
		isRecord(value.phaseContext) &&
		value.phaseContext.phase !== "closeout"
	)
		errors.push(
			toValidationError(
				"commitAllowed can only be true during closeout",
				"commitAllowed",
			),
		);
	if (value.commitAllowed === true && value.recommendation !== "continue")
		errors.push(
			toValidationError(
				"commitAllowed requires continue recommendation",
				"commitAllowed",
			),
		);
	if (value.commitAllowed === true && blockingRequiredGates.length > 0)
		errors.push(
			toValidationError(
				"commitAllowed requires passing required gates",
				"commitAllowed",
			),
		);
	if (
		(value.recommendation === "commit_blocked" ||
			value.recommendation === "stop") &&
		Array.isArray(value.blockers) &&
		value.blockers.length === 0
	)
		errors.push(
			toValidationError(
				"blocking recommendations require blocker evidence",
				"blockers",
			),
		);
	if (
		value.commitAllowed === true &&
		isRecord(value.phaseContext) &&
		Array.isArray(value.blockers) &&
		value.blockers.length > 0
	)
		errors.push(
			toValidationError("commitAllowed requires no blockers", "commitAllowed"),
		);
	if (
		value.exitAllowed === true &&
		(value.recommendation !== "continue" ||
			!Array.isArray(value.blockers) ||
			value.blockers.length > 0 ||
			blockingRequiredGates.length > 0)
	) {
		errors.push(
			toValidationError(
				"exitAllowed requires continue recommendation with no blockers and passing required gates",
				"exitAllowed",
			),
		);
	}
	if (value.recommendation === "continue" && blockingRequiredGates.length > 0)
		errors.push(
			toValidationError(
				"continue recommendation requires passing required gates",
				"recommendation",
			),
		);
	if (
		value.recommendation === "human_review_required" &&
		Array.isArray(value.blockers) &&
		value.blockers.length === 0
	)
		errors.push(
			toValidationError(
				"human_review_required requires correlated blocker evidence",
				"recommendation",
			),
		);
	if (
		value.recommendation === "human_review_required" &&
		!validatedGates.some((gate) => gate.requiresHuman)
	)
		errors.push(
			toValidationError(
				"human_review_required requires human gate evidence",
				"recommendation",
			),
		);
	return { valid: errors.length === 0, errors };
}

function gateIssueReason(gate: HeGateResult): string {
	if (gate.blockedReason) return gate.blockedReason;
	return gate.safeToContinue
		? `${gate.gateId} did not pass`
		: `${gate.gateId} is not safe to continue`;
}

/**
 * Produce a deterministic `HeGateResult` representing a missing (not-run) gate used to fail-closed during aggregation.
 *
 * @param gateId - The gate identifier to synthesize
 * @param required - Whether the synthesized gate should be marked as required (defaults to `true`)
 * @returns A `HeGateResult` with `executionMode` and `status` set to `"not_run"`, an open high-severity finding indicating the gate has not run, `safeToContinue` set to `false`, and `reason`/`blockedReason` describing that the gate has not run
 */
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

/**
 * Validates that `value` is an array of unique `HeGateId` entries and appends any errors.
 *
 * If `value` is not an array, an error is added for `field`. Each element is validated
 * against the known `HE_GATE_IDS` enum (via `validateEnum`); elements that fail validation
 * produce errors and are not considered for uniqueness. Duplicate entries produce a
 * `${field}[index] must be unique` error.
 *
 * @param value - The unknown value to validate as an array of gate IDs
 * @param field - The field name used when constructing error messages
 * @param errors - Mutable array to which validation error messages are appended
 */
function validateGateIdArray(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (!Array.isArray(value)) {
		errors.push(toValidationError(`${field} must be an array`, field));
		return;
	}
	const seen = new Set<HeGateId>();
	for (const [index, entry] of value.entries()) {
		if (validateEnum(entry, `${field}[${index}]`, HE_GATE_IDS, errors)) {
			if (seen.has(entry))
				errors.push(
					toValidationError(
						`${field}[${index}] must be unique`,
						`${field}[${index}]`,
					),
				);
			seen.add(entry);
		}
	}
}

/**
 * Choose a phase-exit recommendation based on the phase context, identified blockers, and gate results.
 *
 * @param context - Phase context used to distinguish closeout behavior
 * @param blockers - Array of blocker messages
 * @param gates - Gate results; used to detect gates that require human review and their blocked reasons
 * @returns `human_review_required` if any gate requires human review and a blocker matches that gate (exact `blockedReason` match or a blocker containing the `gateId`); `continue` if there are no blockers; otherwise `commit_blocked` when `context.phase === "closeout"`, or `stop` for other phases.
 */
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

/**
 * Produce a fail-closed HePhaseExit used when phase-exit input validation fails.
 *
 * The returned object preserves the provided `phaseContext` and `gates`, sets
 * `blockers` to the supplied `errors`, leaves `warnings` empty, and disables
 * commits and exits.
 *
 * @param input - Partial phase-exit input containing `phaseContext` and `gates` to mirror into the result
 * @param errors - Validation error messages to include as `blockers`
 * @returns A `HePhaseExit` where `recommendation` is `"commit_blocked"` if `phaseContext.phase === "closeout"`; otherwise `"stop"`. `commitAllowed` and `exitAllowed` are `false`. `blockers` contains `errors`, `warnings` is empty, and `gates` are copied from `input.gates`.
 */
function invalidExit(
	input: Pick<HePhaseExitInput, "phaseContext" | "gates">,
	errors: HeValidationError[],
): HePhaseExit {
	return {
		schemaVersion: HE_PHASE_EXIT_SCHEMA_VERSION,
		phaseContext: input.phaseContext,
		recommendation:
			input.phaseContext.phase === "closeout" ? "commit_blocked" : "stop",
		commitAllowed: false,
		exitAllowed: false,
		blockers: errors.map((e) => e.code),
		warnings: [],
		gates: input.gates,
	};
}

/**
 * Normalize an unknown value into a valid HePhaseContext, using safe defaults.
 *
 * @param input - The raw input that may contain a `phaseContext` object.
 * @returns A normalized `HePhaseContext`. If `input` or `input.phaseContext` is not an object, or `phase` is not one of `"route" | "lifecycle" | "closeout"`, returns a fallback context with `phase` set to `"closeout"`. Boolean fields are coerced: only strict `true` becomes `true`, everything else becomes `false`.
 */
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

/**
 * Extracts an array of gate-result objects from an object's `gates` property.
 *
 * @param input - The value to sanitize; expected to be an object with a `gates` array.
 * @returns An array of `HeGateResult`-shaped objects taken from `input.gates`. Returns an empty array if `input` is not an object or `input.gates` is not an array.
 */
function sanitizeGateArray(input: unknown): HeGateResult[] {
	if (!isRecord(input) || !Array.isArray(input.gates)) return [];
	return input.gates.filter(isRecord) as unknown as HeGateResult[];
}

/**
 * Create a fallback phase context for the specified phase with default boolean flags.
 *
 * @param phase - The phase to use in the fallback context
 * @returns A `HePhaseContext` whose `phase` is `phase` and both `failingEvidencePresent` and `reviewFeedbackPresent` are `false`
 */
function fallbackPhaseContext(phase: HePhase): HePhaseContext {
	return {
		phase,
		failingEvidencePresent: false,
		reviewFeedbackPresent: false,
	};
}
