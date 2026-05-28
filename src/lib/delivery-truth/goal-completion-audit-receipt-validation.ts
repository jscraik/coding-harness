import type { PrCloseoutClaimStatus } from "../pr-closeout/types.js";
import {
	type GoalCompletionAuditBlockerCode,
	GOAL_COMPLETION_AUDIT_RECEIPT_SCHEMA_VERSION,
	GOAL_COMPLETION_OBJECTIVE_CANONICALIZATION_VERSION,
} from "./goal-completion-audit-receipt.js";

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const SAFE_POINTER_PATTERN = /^[A-Za-z0-9#][A-Za-z0-9._:/#@+-]{0,511}$/u;
const HEX_SHA_PATTERN = /^[a-f0-9]{7,64}$/u;
const ISO_TIMESTAMP_PATTERN =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const STATUS_ORDER: Record<PrCloseoutClaimStatus, number> = {
	pass: 0,
	not_applicable: 0,
	fail: 1,
	blocked: 2,
	unknown: 3,
};
const VALID_BLOCKER_CODES = new Set<GoalCompletionAuditBlockerCode>([
	"missing_objective_identity",
	"objective_source_head_mismatch",
	"objective_source_hash_mismatch",
	"missing_required_requirement",
	"requirement_not_passed",
	"requirement_evidence_not_current",
	"unresolved_blocker",
	"repeated_blocker_threshold_met",
	"missing_blocker_history",
	"invalid_receipt",
]);

/** Single fail-closed validation error for GoalCompletionAuditReceipt/v1. */
export interface GoalCompletionAuditValidationError {
	code: string;
	path: string;
	severity: "error";
}

/** Validation result for agent-operable receipt checks. */
export interface GoalCompletionAuditValidationResult {
	valid: boolean;
	errors: GoalCompletionAuditValidationError[];
}

/** Validate the receipt shape and fail-closed invariants that do not require live filesystem access. */
export function validateGoalCompletionAuditReceipt(
	value: unknown,
): GoalCompletionAuditValidationResult {
	const errors: GoalCompletionAuditValidationError[] = [];
	if (!isRecord(value)) {
		addError(errors, "receipt must be an object", "receipt");
		return { valid: false, errors };
	}
	requireLiteral(
		value.schemaVersion,
		GOAL_COMPLETION_AUDIT_RECEIPT_SCHEMA_VERSION,
		"schemaVersion",
		errors,
	);
	requireIsoTimestamp(value.generatedAt, "generatedAt", errors);
	requireSafeString(value.producer, "producer", errors);
	requireLiteral(
		value.runtimeStatus,
		"not_yet_emitted",
		"runtimeStatus",
		errors,
	);
	requireLiteral(value.evidenceUse, "audit_trail", "evidenceUse", errors);
	requireHeadSha(value.headSha, "headSha", errors);
	validateObjectiveIdentity(value.objectiveIdentity, value.headSha, errors);
	validateRequirements(value.requirements, errors);
	validateBlockers(value.blockers, errors);
	validateVerdict(value.verdict, errors);
	requireSafeStringArray(value.sourceRefs, "sourceRefs", errors);
	requireSafeDescription(value.blockedBy, "blockedBy", errors);
	return { valid: errors.length === 0, errors };
}

function validateObjectiveIdentity(
	value: unknown,
	headSha: unknown,
	errors: GoalCompletionAuditValidationError[],
): void {
	if (!isRecord(value)) {
		addError(
			errors,
			"objectiveIdentity must be an object",
			"objectiveIdentity",
		);
		return;
	}
	requireSafeString(
		value.objectiveRef,
		"objectiveIdentity.objectiveRef",
		errors,
	);
	requireSafeString(
		value.objectiveSourcePath,
		"objectiveIdentity.objectiveSourcePath",
		errors,
	);
	requireSafeString(
		value.objectivePointer,
		"objectiveIdentity.objectivePointer",
		errors,
	);
	requireHeadSha(
		value.objectiveSourceHeadSha,
		"objectiveIdentity.objectiveSourceHeadSha",
		errors,
	);
	requireSha256(
		value.objectiveSourceSha256,
		"objectiveIdentity.objectiveSourceSha256",
		errors,
	);
	requireSha256(value.objectiveHash, "objectiveIdentity.objectiveHash", errors);
	requireLiteral(
		value.hashAlgorithm,
		"sha256",
		"objectiveIdentity.hashAlgorithm",
		errors,
	);
	requireLiteral(
		value.canonicalizationVersion,
		GOAL_COMPLETION_OBJECTIVE_CANONICALIZATION_VERSION,
		"objectiveIdentity.canonicalizationVersion",
		errors,
	);
	if (
		typeof value.objectiveHash === "string" &&
		typeof value.objectiveSourceSha256 === "string" &&
		value.objectiveHash !== value.objectiveSourceSha256
	) {
		addError(
			errors,
			"objectiveHash must match objectiveSourceSha256",
			"objectiveIdentity.objectiveHash",
		);
	}
	if (
		typeof value.objectiveSourceHeadSha === "string" &&
		typeof headSha === "string" &&
		value.objectiveSourceHeadSha !== headSha
	) {
		addError(
			errors,
			"objectiveSourceHeadSha must match receipt headSha",
			"objectiveIdentity.objectiveSourceHeadSha",
		);
	}
}

function validateRequirements(
	value: unknown,
	errors: GoalCompletionAuditValidationError[],
): void {
	if (!Array.isArray(value) || value.length === 0) {
		addError(errors, "requirements must be a non-empty array", "requirements");
		return;
	}
	const ids = new Set<string>();
	let hasRequired = false;
	value.forEach((requirement, index) => {
		const path = `requirements[${index}]`;
		if (!isRecord(requirement)) {
			addError(errors, "requirement must be an object", path);
			return;
		}
		requireSafeString(requirement.id, `${path}.id`, errors);
		if (typeof requirement.id === "string") {
			if (ids.has(requirement.id)) {
				addError(errors, "requirement id must be unique", `${path}.id`);
			}
			ids.add(requirement.id);
		}
		requireSafeDescription(
			requirement.description,
			`${path}.description`,
			errors,
		);
		if (typeof requirement.required !== "boolean") {
			addError(errors, "required must be boolean", `${path}.required`);
		}
		hasRequired ||= requirement.required === true;
		requireStatus(requirement.status, `${path}.status`, errors);
		requireFreshness(requirement.freshness, `${path}.freshness`, errors);
		requireSafeStringArray(
			requirement.evidenceRefs,
			`${path}.evidenceRefs`,
			errors,
		);
		requireSafeStringArray(
			requirement.blockerRefs,
			`${path}.blockerRefs`,
			errors,
		);
		if (requirement.verdictRef !== null) {
			requireSafeString(requirement.verdictRef, `${path}.verdictRef`, errors);
		}
	});
	if (!hasRequired) {
		addError(
			errors,
			"at least one requirement must be required",
			"requirements",
		);
	}
}

function validateBlockers(
	value: unknown,
	errors: GoalCompletionAuditValidationError[],
): void {
	if (!Array.isArray(value)) {
		addError(errors, "blockers must be an array", "blockers");
		return;
	}
	const ids = new Set<string>();
	value.forEach((blocker, index) => {
		const path = `blockers[${index}]`;
		if (!isRecord(blocker)) {
			addError(errors, "blocker must be an object", path);
			return;
		}
		requireSafeString(blocker.id, `${path}.id`, errors);
		if (typeof blocker.id === "string") {
			if (ids.has(blocker.id)) {
				addError(errors, "blocker id must be unique", `${path}.id`);
			}
			ids.add(blocker.id);
		}
		requireSafeString(blocker.stableKey, `${path}.stableKey`, errors);
		requireBlockerClass(blocker.blockerClass, `${path}.blockerClass`, errors);
		requireSafeString(blocker.owner, `${path}.owner`, errors);
		requireSafeDescription(blocker.nextAction, `${path}.nextAction`, errors);
		requireSafeStringArray(
			blocker.evidenceRefs,
			`${path}.evidenceRefs`,
			errors,
		);
		const consecutiveGoalTurns = blocker.consecutiveGoalTurns;
		if (
			typeof consecutiveGoalTurns !== "number" ||
			!Number.isInteger(consecutiveGoalTurns) ||
			consecutiveGoalTurns < 1
		) {
			addError(
				errors,
				"consecutiveGoalTurns must be a positive integer",
				`${path}.consecutiveGoalTurns`,
			);
		}
		requireIsoTimestamp(
			blocker.firstObservedAt,
			`${path}.firstObservedAt`,
			errors,
		);
		requireIsoTimestamp(
			blocker.latestObservedAt,
			`${path}.latestObservedAt`,
			errors,
		);
	});
}

function validateVerdict(
	value: unknown,
	errors: GoalCompletionAuditValidationError[],
): void {
	if (!isRecord(value)) {
		addError(errors, "verdict must be an object", "verdict");
		return;
	}
	requireStatus(value.status, "verdict.status", errors);
	requireFreshness(value.freshness, "verdict.freshness", errors);
	if (typeof value.readyForDoneClaim !== "boolean") {
		addError(
			errors,
			"readyForDoneClaim must be boolean",
			"verdict.readyForDoneClaim",
		);
	}
	if (
		!["complete", "continue", "blocked"].includes(
			String(value.goalStatusRecommendation),
		)
	) {
		addError(
			errors,
			"goalStatusRecommendation must be complete, continue, or blocked",
			"verdict.goalStatusRecommendation",
		);
	}
	if (value.blockerCode !== null) {
		requireBlockerCode(value.blockerCode, "verdict.blockerCode", errors);
	}
	if (value.blockerClass !== null) {
		requireBlockerClass(value.blockerClass, "verdict.blockerClass", errors);
	}
	requireSafeStringArray(value.blockerRefs, "verdict.blockerRefs", errors);
	requireSafeStringArray(value.evidenceRefs, "verdict.evidenceRefs", errors);
	requireIsoTimestamp(value.verifiedAt, "verdict.verifiedAt", errors);
	if (value.readyForDoneClaim === true && value.status !== "pass") {
		addError(
			errors,
			"readyForDoneClaim requires pass status",
			"verdict.readyForDoneClaim",
		);
	}
	if (
		value.readyForDoneClaim === true &&
		value.goalStatusRecommendation !== "complete"
	) {
		addError(
			errors,
			"readyForDoneClaim requires complete recommendation",
			"verdict.goalStatusRecommendation",
		);
	}
}

function requireStatus(
	value: unknown,
	path: string,
	errors: GoalCompletionAuditValidationError[],
): void {
	if (!Object.hasOwn(STATUS_ORDER, String(value))) {
		addError(errors, `${path} must be a closeout claim status`, path);
	}
}

function requireFreshness(
	value: unknown,
	path: string,
	errors: GoalCompletionAuditValidationError[],
): void {
	if (
		!["current", "stale", "missing", "unknown", "not_applicable"].includes(
			String(value),
		)
	) {
		addError(errors, `${path} must be an evidence freshness value`, path);
	}
}

function requireBlockerClass(
	value: unknown,
	path: string,
	errors: GoalCompletionAuditValidationError[],
): void {
	if (!validBlockerClasses().includes(String(value))) {
		addError(errors, `${path} must be a blocker classification`, path);
	}
}

function requireBlockerCode(
	value: unknown,
	path: string,
	errors: GoalCompletionAuditValidationError[],
): void {
	if (
		typeof value !== "string" ||
		!VALID_BLOCKER_CODES.has(value as GoalCompletionAuditBlockerCode)
	) {
		addError(errors, `${path} must be a goal completion blocker code`, path);
	}
}

function validBlockerClasses(): string[] {
	return [
		"introduced",
		"pre_existing",
		"unrelated_dirty_worktree",
		"external_service",
		"needs_jamie_decision",
		"unknown",
	];
}

function requireLiteral(
	value: unknown,
	expected: unknown,
	path: string,
	errors: GoalCompletionAuditValidationError[],
): void {
	if (value !== expected) {
		addError(errors, `${path} must be ${String(expected)}`, path);
	}
}

function requireIsoTimestamp(
	value: unknown,
	path: string,
	errors: GoalCompletionAuditValidationError[],
): void {
	if (
		typeof value !== "string" ||
		!ISO_TIMESTAMP_PATTERN.test(value) ||
		Number.isNaN(Date.parse(value))
	) {
		addError(errors, `${path} must be an ISO timestamp`, path);
	}
}

function requireHeadSha(
	value: unknown,
	path: string,
	errors: GoalCompletionAuditValidationError[],
): void {
	if (typeof value !== "string" || !HEX_SHA_PATTERN.test(value)) {
		addError(errors, `${path} must be a git head SHA`, path);
	}
}

function requireSha256(
	value: unknown,
	path: string,
	errors: GoalCompletionAuditValidationError[],
): void {
	if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
		addError(errors, `${path} must be a sha256:<hex> value`, path);
	}
}

function requireSafeString(
	value: unknown,
	path: string,
	errors: GoalCompletionAuditValidationError[],
): void {
	if (typeof value !== "string" || !safePointer(value)) {
		addError(errors, `${path} must be a safe non-empty pointer`, path);
	}
}

function requireSafeDescription(
	value: unknown,
	path: string,
	errors: GoalCompletionAuditValidationError[],
): void {
	if (
		typeof value !== "string" ||
		value.trim() === "" ||
		/[\r\n]/u.test(value) ||
		value.length > 512
	) {
		addError(errors, `${path} must be a bounded single-line string`, path);
	}
}

function requireSafeStringArray(
	value: unknown,
	path: string,
	errors: GoalCompletionAuditValidationError[],
): void {
	if (!Array.isArray(value)) {
		addError(errors, `${path} must be an array`, path);
		return;
	}
	value.forEach((entry, index) => {
		requireSafeString(entry, `${path}[${index}]`, errors);
	});
}

function safePointer(value: string): boolean {
	return SAFE_POINTER_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addError(
	errors: GoalCompletionAuditValidationError[],
	code: string,
	path: string,
): void {
	errors.push({ code, path, severity: "error" });
}
