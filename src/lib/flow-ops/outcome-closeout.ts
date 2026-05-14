import type { ValidationFailureClassification } from "../validation/failure-classifier.js";

/** Schema version for machine-readable outcome closeout packets. */
export const OUTCOME_CLOSEOUT_SCHEMA_VERSION = "outcome-closeout/v1" as const;

/** Terminal outcome labels for a task-level closeout packet. */
export type OutcomeCloseoutStatus =
	| "complete"
	| "partial"
	| "blocked"
	| "handoff"
	| "advisory_only";

/** Structured event families that may feed an outcome closeout. */
export type OutcomeCloseoutSourceKind =
	| "pr_readiness"
	| "evidence_artifact"
	| "validation_failure"
	| "manual";

/** Coarse status emitted by a structured closeout source event. */
export type OutcomeCloseoutSourceStatus =
	| "pass"
	| "fail"
	| "blocked"
	| "missing"
	| "unknown";

/** Validation or proof status recorded in the closeout. */
export type OutcomeCloseoutProofStatus = "pass" | "fail" | "blocked";

/** Owner category for follow-up work handed off by the closeout. */
export type OutcomeCloseoutHandoffOwner = "human" | "agent" | "external";

/** Blocker classes that can constrain a closeout claim. */
export type OutcomeCloseoutBlockerClassification =
	| ValidationFailureClassification
	| "missing_artifact"
	| "pr_not_ready"
	| "review_blocked"
	| "handoff_required"
	| "unknown_blocker";

/** Machine-readable event used as an input to the closeout. */
export interface OutcomeCloseoutSourceEvent {
	/** Source event family. */
	kind: OutcomeCloseoutSourceKind;
	/** Stable event, artifact, command, or classifier reference. */
	ref: string;
	/** Source-reported status. */
	status: OutcomeCloseoutSourceStatus;
	/** Short factual summary of the source event. */
	summary: string;
}

/** Work item changed by the task and backed by source events. */
export interface OutcomeCloseoutChangedItem {
	/** Short summary of what changed. */
	summary: string;
	/** Optional repo-relative path or artifact path. */
	path?: string;
	/** References to source events that support this changed item. */
	sourceRefs: string[];
}

/** Proof item that verifies, blocks, or qualifies a closeout claim. */
export interface OutcomeCloseoutProofItem {
	/** Short summary of the proof result. */
	summary: string;
	/** Exact command when the proof came from command execution. */
	command?: string;
	/** Proof outcome. */
	status: OutcomeCloseoutProofStatus;
	/** References to source events that support this proof item. */
	sourceRefs: string[];
	/** Optional artifacts, logs, or report paths for the proof. */
	artifactRefs?: string[];
}

/** Blocker that prevents or qualifies a completion claim. */
export interface OutcomeCloseoutBlocker {
	/** Machine-readable blocker class. */
	classification: OutcomeCloseoutBlockerClassification;
	/** Short factual blocker summary. */
	summary: string;
	/** Whether this blocker prevents claiming the task complete. */
	blocksCompletion: boolean;
	/** References to source events that support this blocker. */
	sourceRefs: string[];
}

/** Explicit follow-up handed to another owner. */
export interface OutcomeCloseoutHandoff {
	/** Owner category responsible for the next action. */
	owner: OutcomeCloseoutHandoffOwner;
	/** Short factual handoff summary. */
	summary: string;
	/** Concrete next action for the owner. */
	nextAction: string;
	/** References to source events that support this handoff. */
	sourceRefs: string[];
}

/** Claim boundary that names what must not be asserted as complete. */
export interface OutcomeCloseoutClaimBoundary {
	/** Claim that is out of bounds for this closeout. */
	claim: string;
	/** Reason the claim is not supported. */
	reason: string;
	/** References to source events that support this boundary. */
	sourceRefs: string[];
}

/** Versioned task outcome closeout payload built from structured source events. */
export interface OutcomeCloseout {
	/** Schema version for the closeout payload. */
	schemaVersion: typeof OUTCOME_CLOSEOUT_SCHEMA_VERSION;
	/** Stable task, issue, or slice identifier. */
	taskId: string;
	/** Terminal closeout outcome. */
	outcome: OutcomeCloseoutStatus;
	/** Machine-readable source events used to build the closeout. */
	sourceEvents: OutcomeCloseoutSourceEvent[];
	/** Changed items supported by source events. */
	changed: OutcomeCloseoutChangedItem[];
	/** Proof items supported by source events. */
	provedBy: OutcomeCloseoutProofItem[];
	/** Blockers supported by source events. */
	blockers: OutcomeCloseoutBlocker[];
	/** Handoffs supported by source events. */
	handedOff: OutcomeCloseoutHandoff[];
	/** Explicit boundaries for claims that must not be made. */
	claimBoundaries: OutcomeCloseoutClaimBoundary[];
	/** Concrete next action for the next human or agent. */
	nextAction: string;
}

/** Validation result for a candidate {@link OutcomeCloseout}. */
export interface OutcomeCloseoutValidationResult {
	/** Whether the candidate satisfies the closeout contract. */
	valid: boolean;
	/** Validation errors, empty when valid. */
	errors: string[];
}

const VALID_OUTCOMES: readonly OutcomeCloseoutStatus[] = [
	"complete",
	"partial",
	"blocked",
	"handoff",
	"advisory_only",
];

const VALID_SOURCE_KINDS: readonly OutcomeCloseoutSourceKind[] = [
	"pr_readiness",
	"evidence_artifact",
	"validation_failure",
	"manual",
];

const VALID_SOURCE_STATUSES: readonly OutcomeCloseoutSourceStatus[] = [
	"pass",
	"fail",
	"blocked",
	"missing",
	"unknown",
];

const VALID_PROOF_STATUSES: readonly OutcomeCloseoutProofStatus[] = [
	"pass",
	"fail",
	"blocked",
];

const VALID_HANDOFF_OWNERS: readonly OutcomeCloseoutHandoffOwner[] = [
	"human",
	"agent",
	"external",
];

const VALID_BLOCKER_CLASSES: readonly OutcomeCloseoutBlockerClassification[] = [
	"passed",
	"introduced_regression",
	"pre_existing_drift",
	"environment_tooling_failure",
	"unrelated_dirty_worktree",
	"missing_credential",
	"expected_fixture_stderr",
	"unknown_failure",
	"missing_artifact",
	"pr_not_ready",
	"review_blocked",
	"handoff_required",
	"unknown_blocker",
];

/**
 * Determines whether a value is a plain object (an object that is not `null` and not an array).
 *
 * @returns `true` if `value` is a non-null, non-array object, `false` otherwise.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Determines whether a value is a non-empty string.
 *
 * @returns `true` if `value` is a string containing at least one non-whitespace character, `false` otherwise.
 */
function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validate that a value is a non-empty string and append an error message when it is not.
 *
 * @param value - The value to validate
 * @param field - The human-readable field name used in the appended error message
 * @param errors - The array to which the function will push an error string if validation fails
 */
function validateString(value: unknown, field: string, errors: string[]): void {
	if (!isNonEmptyString(value)) {
		errors.push(`${field} must be a non-empty string`);
	}
}

/**
 * Validate that a value, when present, is a non-empty string and record an error if not.
 *
 * @param value - The value to validate; validation runs only if `value` is not `undefined`
 * @param field - Human-readable field name used in the pushed error message
 * @param errors - Array to which a descriptive error string will be appended on validation failure
 */
function validateOptionalString(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (value !== undefined && !isNonEmptyString(value)) {
		errors.push(`${field} must be a non-empty string when present`);
	}
}

/**
 * Adds a validation error if the provided value is not one of the allowed values.
 *
 * @param value - The value to validate against the allowed values
 * @param field - The display name of the field used in the error message
 * @param validValues - Readonly array of permitted string values
 * @param errors - Mutable array of error messages; a new message is pushed when validation fails
 */
function validateEnum<T extends string>(
	value: unknown,
	field: string,
	validValues: readonly T[],
	errors: string[],
): void {
	if (!validValues.includes(value as T)) {
		errors.push(`${field} must be one of ${validValues.join(", ")}`);
	}
}

/**
 * Validate that a value is an array of non-empty strings and record the first violation.
 *
 * If `value` is not an array, appends "`<field> must be a string array`" to `errors`.
 * If any element is not a non-empty string, appends "`<field> entries must be non-empty strings`" to `errors`.
 * Validation stops after the first detected error.
 *
 * @param value - The value to validate
 * @param field - The label used in generated error messages
 * @param errors - Collector array that will be mutated with at most one error message
 */
function validateStringArray(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (!Array.isArray(value)) {
		errors.push(`${field} must be a string array`);
		return;
	}
	for (const entry of value) {
		if (!isNonEmptyString(entry)) {
			errors.push(`${field} entries must be non-empty strings`);
			return;
		}
	}
}

/**
 * Validates that `value` is an array of non-empty strings representing source references and that it contains at least one entry; appends human-readable error messages to `errors` when validation fails.
 *
 * @param value - The value to validate as a source reference array
 * @param field - The name of the field used in generated error messages
 * @param errors - An array to which validation error strings will be appended
 */
function validateSourceRefs(
	value: unknown,
	field: string,
	errors: string[],
): void {
	validateStringArray(value, field, errors);
	if (Array.isArray(value) && value.length === 0) {
		errors.push(`${field} must include at least one source reference`);
	}
}

/**
 * Ensures a value is an array and applies a per-element validator to each entry.
 *
 * If `value` is not an array, an error is appended to `errors` using `field`.
 *
 * @param value - The value to validate as an array of entries
 * @param field - The name of the field used to build error messages
 * @param validateEntry - Callback invoked for each array element with the element, its indexed field name, and the shared `errors` array
 * @param errors - Accumulator for validation error messages
 */
function validateObjectArray(
	value: unknown,
	field: string,
	validateEntry: (entry: unknown, field: string, errors: string[]) => void,
	errors: string[],
): void {
	if (!Array.isArray(value)) {
		errors.push(`${field} must be an array`);
		return;
	}
	value.forEach((entry, index) => {
		validateEntry(entry, `${field}[${index}]`, errors);
	});
}

/**
 * Validates that `value` is a well-formed OutcomeCloseout source event and appends any validation messages to `errors`.
 *
 * @param value - The value to validate as a source event
 * @param field - The field path used as a prefix in generated error messages
 * @param errors - Array to which validation error strings will be appended
 */
function validateSourceEvent(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (!isRecord(value)) {
		errors.push(`${field} must be an object`);
		return;
	}
	validateEnum(value.kind, `${field}.kind`, VALID_SOURCE_KINDS, errors);
	validateString(value.ref, `${field}.ref`, errors);
	validateEnum(value.status, `${field}.status`, VALID_SOURCE_STATUSES, errors);
	validateString(value.summary, `${field}.summary`, errors);
}

/**
 * Validates a changed-item object and appends any validation errors to `errors`.
 *
 * Ensures `value` is an object, that `summary` is a non-empty string, that `path`
 * (if present) is a non-empty string, and that `sourceRefs` is an array of
 * non-empty strings referencing source events.
 *
 * @param value - The value to validate as a changed item
 * @param field - The field path used when reporting errors (prefixed to error messages)
 * @param errors - Array to which validation error messages will be appended
 */
function validateChangedItem(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (!isRecord(value)) {
		errors.push(`${field} must be an object`);
		return;
	}
	validateString(value.summary, `${field}.summary`, errors);
	validateOptionalString(value.path, `${field}.path`, errors);
	validateSourceRefs(value.sourceRefs, `${field}.sourceRefs`, errors);
}

/**
 * Validates a proof item object and appends any validation errors to `errors`.
 *
 * Ensures `value` is an object with a non-empty `summary`, an optional non-empty `command`,
 * a `status` included in `VALID_PROOF_STATUSES`, and a `sourceRefs` array of non-empty strings.
 * If present, `artifactRefs` must be an array of non-empty strings. If `value` is not an object
 * a single error `${field} must be an object` is appended and validation stops.
 *
 * @param value - The value to validate as a proof item
 * @param field - Field path prefix used when reporting errors (e.g., `"provedBy[0]"`)
 * @param errors - Mutable array that will receive error messages for any validation failures
 */
function validateProofItem(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (!isRecord(value)) {
		errors.push(`${field} must be an object`);
		return;
	}
	validateString(value.summary, `${field}.summary`, errors);
	validateOptionalString(value.command, `${field}.command`, errors);
	validateEnum(value.status, `${field}.status`, VALID_PROOF_STATUSES, errors);
	validateSourceRefs(value.sourceRefs, `${field}.sourceRefs`, errors);
	if (value.artifactRefs !== undefined) {
		validateStringArray(value.artifactRefs, `${field}.artifactRefs`, errors);
	}
}

/**
 * Validates a blocker entry and appends any validation errors to the provided errors array.
 *
 * Ensures `value` is an object and validates these fields (using `field` as the error-path prefix):
 * - `classification` is one of the allowed blocker classifications
 * - `summary` is a non-empty string
 * - `blocksCompletion` is a boolean
 * - `sourceRefs` is an array of non-empty strings
 *
 * @param value - The candidate blocker value to validate
 * @param field - The dotted field path used when reporting errors
 * @param errors - Mutable array that will receive error messages for any validation failures
 */
function validateBlocker(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (!isRecord(value)) {
		errors.push(`${field} must be an object`);
		return;
	}
	validateEnum(
		value.classification,
		`${field}.classification`,
		VALID_BLOCKER_CLASSES,
		errors,
	);
	validateString(value.summary, `${field}.summary`, errors);
	if (typeof value.blocksCompletion !== "boolean") {
		errors.push(`${field}.blocksCompletion must be a boolean`);
	}
	validateSourceRefs(value.sourceRefs, `${field}.sourceRefs`, errors);
}

/**
 * Validates a handoff entry object and appends any validation errors to the provided errors array.
 *
 * Validates that `value` is an object and that the following fields are present and valid: `owner` (one of the allowed handoff owners), `summary` (non-empty string), `nextAction` (non-empty string), and `sourceRefs` (array of non-empty strings referencing source events).
 *
 * @param value - The value to validate as an OutcomeCloseout handoff entry
 * @param field - The field path prefix used when recording error messages
 * @param errors - The array to which validation error messages will be pushed
 */
function validateHandoff(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (!isRecord(value)) {
		errors.push(`${field} must be an object`);
		return;
	}
	validateEnum(value.owner, `${field}.owner`, VALID_HANDOFF_OWNERS, errors);
	validateString(value.summary, `${field}.summary`, errors);
	validateString(value.nextAction, `${field}.nextAction`, errors);
	validateSourceRefs(value.sourceRefs, `${field}.sourceRefs`, errors);
}

/**
 * Validates that `value` is a ClaimBoundary-like object and appends any validation errors to `errors`.
 *
 * Ensures `value` is an object, that `claim` and `reason` are non-empty strings, and that `sourceRefs`
 * is an array containing at least one non-empty string. Errors use `field` as the message prefix.
 *
 * @param value - The value to validate as a ClaimBoundary
 * @param field - The dot-qualified field name to use in generated error messages
 * @param errors - The array to which validation error messages will be appended
 */
function validateClaimBoundary(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (!isRecord(value)) {
		errors.push(`${field} must be an object`);
		return;
	}
	validateString(value.claim, `${field}.claim`, errors);
	validateString(value.reason, `${field}.reason`, errors);
	validateSourceRefs(value.sourceRefs, `${field}.sourceRefs`, errors);
}

/**
 * Checks whether an input contains any blocker object that blocks completion.
 *
 * @param value - The value to inspect; expected to be an array of blocker-like objects
 * @returns `true` if `value` is an array containing at least one object with `blocksCompletion === true`, `false` otherwise
 */
function hasCompletionBlockingBlocker(value: unknown): boolean {
	if (!Array.isArray(value)) {
		return false;
	}
	return value.some(
		(blocker) => isRecord(blocker) && blocker.blocksCompletion === true,
	);
}

/**
 * Determine whether the provided value is an array that contains at least one source event whose `kind` is not `"manual"`.
 *
 * @param value - The value to inspect (expected to be an array of potential source event objects)
 * @returns `true` if at least one array element is an object with a `kind` property not equal to `"manual"`, `false` otherwise.
 */
function hasNonManualSourceEvent(value: unknown): boolean {
	if (!Array.isArray(value)) {
		return false;
	}
	return value.some((event) => isRecord(event) && event.kind !== "manual");
}

/**
 * Determines whether the provided value contains at least one proof item with status `"pass"`.
 *
 * @param value - The value to inspect; expected to be an array of proof-like objects.
 * @returns `true` if at least one array element is an object whose `status` is `"pass"`, `false` otherwise.
 */
function hasPassingProof(value: unknown): boolean {
	if (!Array.isArray(value)) {
		return false;
	}
	return value.some((proof) => isRecord(proof) && proof.status === "pass");
}

/**
 * Determines whether the provided value contains any proof item with status "fail" or "blocked".
 *
 * @param value - The value to inspect; expected to be an array of proof items (objects may include a `status` property)
 * @returns `true` if any entry is an object whose `status` is `"fail"` or `"blocked"`, `false` otherwise
 */
function hasNonPassingProof(value: unknown): boolean {
	if (!Array.isArray(value)) {
		return false;
	}
	return value.some(
		(proof) =>
			isRecord(proof) &&
			(proof.status === "fail" || proof.status === "blocked"),
	);
}

/**
 * Collects all non-empty `ref` strings from an array of source-event-like objects.
 *
 * @param value - The value to inspect; expected to be an array whose elements may be objects with a `ref` string property
 * @returns A set containing each non-empty `ref` value found (duplicates removed)
 */
function sourceEventRefs(value: unknown): Set<string> {
	const refs = new Set<string>();
	if (!Array.isArray(value)) {
		return refs;
	}
	for (const event of value) {
		if (isRecord(event) && isNonEmptyString(event.ref)) {
			refs.add(event.ref);
		}
	}
	return refs;
}

/**
 * Adds an error for each non-empty string in `value` that is not present in `validRefs`.
 *
 * Validates only when `value` is an array; for each entry that is a non-empty string and not found
 * in `validRefs`, an error message of the form "`<field> contains unknown source reference <ref>`"
 * is appended to `errors`.
 *
 * @param value - The value to validate (expected to be an array of reference strings)
 * @param field - The name of the field used in generated error messages
 * @param validRefs - Set of allowed reference strings
 * @param errors - Mutable array to which validation error messages are appended
 */
function validateSourceRefMembership(
	value: unknown,
	field: string,
	validRefs: ReadonlySet<string>,
	errors: string[],
): void {
	if (!Array.isArray(value)) {
		return;
	}
	for (const ref of value) {
		if (isNonEmptyString(ref) && !validRefs.has(ref)) {
			errors.push(`${field} contains unknown source reference ${ref}`);
		}
	}
}

/**
 * Ensures that any `sourceRefs` used by closeout sub-entries reference `ref` values declared in `value.sourceEvents`.
 *
 * Iterates the `changed`, `provedBy`, `blockers`, `handedOff`, and `claimBoundaries` arrays (when present) and appends error messages to `errors` for any `sourceRefs` that are missing or not listed in `value.sourceEvents`.
 *
 * @param value - The closeout-like object containing `sourceEvents` and optional sub-entry arrays to validate
 * @param errors - Mutable array that will receive error strings for any invalid or unknown `sourceRefs`
 */
function validateReferencedSourceEvents(
	value: Record<string, unknown>,
	errors: string[],
): void {
	const validRefs = sourceEventRefs(value.sourceEvents);
	for (const [field, entries] of [
		["changed", value.changed],
		["provedBy", value.provedBy],
		["blockers", value.blockers],
		["handedOff", value.handedOff],
		["claimBoundaries", value.claimBoundaries],
	] as const) {
		if (!Array.isArray(entries)) {
			continue;
		}
		entries.forEach((entry, index) => {
			if (isRecord(entry)) {
				validateSourceRefMembership(
					entry.sourceRefs,
					`${field}[${index}].sourceRefs`,
					validRefs,
					errors,
				);
			}
		});
	}
}

/**
 * Validate an unknown value against the outcome-closeout/v1 contract.
 *
 * @param value - Candidate value to validate
 * @returns Validation result with explicit contract errors
 */
export function validateOutcomeCloseout(
	value: unknown,
): OutcomeCloseoutValidationResult {
	const errors: string[] = [];
	if (!isRecord(value)) {
		return { valid: false, errors: ["closeout must be an object"] };
	}

	if (value.schemaVersion !== OUTCOME_CLOSEOUT_SCHEMA_VERSION) {
		errors.push(`schemaVersion must be ${OUTCOME_CLOSEOUT_SCHEMA_VERSION}`);
	}
	validateString(value.taskId, "taskId", errors);
	validateEnum(value.outcome, "outcome", VALID_OUTCOMES, errors);
	validateObjectArray(
		value.sourceEvents,
		"sourceEvents",
		validateSourceEvent,
		errors,
	);
	validateObjectArray(value.changed, "changed", validateChangedItem, errors);
	validateObjectArray(value.provedBy, "provedBy", validateProofItem, errors);
	validateObjectArray(value.blockers, "blockers", validateBlocker, errors);
	validateObjectArray(value.handedOff, "handedOff", validateHandoff, errors);
	validateObjectArray(
		value.claimBoundaries,
		"claimBoundaries",
		validateClaimBoundary,
		errors,
	);
	validateString(value.nextAction, "nextAction", errors);

	if (Array.isArray(value.sourceEvents) && value.sourceEvents.length === 0) {
		errors.push(
			"sourceEvents must include at least one structured source event",
		);
	}
	if (
		Array.isArray(value.sourceEvents) &&
		!hasNonManualSourceEvent(value.sourceEvents)
	) {
		errors.push(
			"sourceEvents must include at least one non-manual source event",
		);
	}
	validateReferencedSourceEvents(value, errors);
	if (value.outcome === "complete") {
		if (Array.isArray(value.changed) && value.changed.length === 0) {
			errors.push("complete outcome requires at least one changed item");
		}
		if (Array.isArray(value.provedBy) && value.provedBy.length === 0) {
			errors.push("complete outcome requires at least one proof item");
		}
		if (!hasPassingProof(value.provedBy)) {
			errors.push("complete outcome requires at least one passing proof item");
		}
		if (hasNonPassingProof(value.provedBy)) {
			errors.push("complete outcome cannot include failed or blocked proof");
		}
		if (hasCompletionBlockingBlocker(value.blockers)) {
			errors.push(
				"complete outcome cannot include completion-blocking blockers",
			);
		}
	}
	if (
		value.outcome === "blocked" &&
		Array.isArray(value.blockers) &&
		value.blockers.length === 0
	) {
		errors.push("blocked outcome requires at least one blocker");
	}
	if (
	if (value.outcome === "handoff") {
		if (Array.isArray(value.handedOff) && value.handedOff.length === 0) {
			errors.push("handoff outcome requires at least one handoff");
		}
		if (
			Array.isArray(value.claimBoundaries) &&
			value.claimBoundaries.length === 0
		) {
			errors.push("handoff outcome requires at least one claim boundary");
		}
	}

	return { valid: errors.length === 0, errors };
}

/**
 * Determines whether a value conforms to the OutcomeCloseout schema.
 *
 * @param value - Candidate value to test
 * @returns `true` if the value is a valid `OutcomeCloseout`, `false` otherwise.
 */
export function isOutcomeCloseout(value: unknown): value is OutcomeCloseout {
	return validateOutcomeCloseout(value).valid;
}
