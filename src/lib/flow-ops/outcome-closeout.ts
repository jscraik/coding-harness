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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function validateString(value: unknown, field: string, errors: string[]): void {
	if (!isNonEmptyString(value)) {
		errors.push(`${field} must be a non-empty string`);
	}
}

function validateOptionalString(
	value: unknown,
	field: string,
	errors: string[],
): void {
	if (value !== undefined && !isNonEmptyString(value)) {
		errors.push(`${field} must be a non-empty string when present`);
	}
}

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

function hasCompletionBlockingBlocker(value: unknown): boolean {
	if (!Array.isArray(value)) {
		return false;
	}
	return value.some(
		(blocker) => isRecord(blocker) && blocker.blocksCompletion === true,
	);
}

function hasNonManualSourceEvent(value: unknown): boolean {
	if (!Array.isArray(value)) {
		return false;
	}
	return value.some((event) => isRecord(event) && event.kind !== "manual");
}

function hasPassingProof(value: unknown): boolean {
	if (!Array.isArray(value)) {
		return false;
	}
	return value.some((proof) => isRecord(proof) && proof.status === "pass");
}

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
 * Determine whether a candidate value satisfies the outcome closeout contract.
 *
 * @param value - Candidate value to test
 * @returns true when value is a valid OutcomeCloseout
 */
export function isOutcomeCloseout(value: unknown): value is OutcomeCloseout {
	return validateOutcomeCloseout(value).valid;
}
