import {
	type HeValidationError,
	isRecord,
	toValidationError,
	validateEnum,
	validateNullableString,
	validateString,
	validateStringArray,
} from "../decision/validators.js";
import {
	rejectRawRuntimeCardEmbeddings,
	validateCodexRuntimeSourceProjection,
	validateOptionalCodexRuntimeProjection,
} from "./runtime-card-codex-runtime-validation.js";
import { validateRuntimeCardReference } from "./runtime-card-reference-validation.js";
import {
	validateRuntimeCardAttemptLedger,
	validateRuntimeCardRecoveryEvent,
} from "./runtime-card-recovery-validation.js";
import type {
	RuntimeCardArtifactStatus,
	RuntimeCardFreshness,
	RuntimeCardLifecycleState,
	RuntimeCardPhaseExitStatus,
	RuntimeCardSourceKind,
	RuntimeCardSourceStatus,
	RuntimeCardValidationResult,
} from "./runtime-card.js";

const EXPECTED_RUNTIME_CARD_SCHEMA_VERSION = "runtime-card/v1" as const;

const VALID_LIFECYCLES: readonly RuntimeCardLifecycleState[] = [
	"planned",
	"active",
	"implemented",
	"locally_validated",
	"review_pending",
	"ci_blocked",
	"merge_ready",
	"merged",
	"closeout_pending",
	"reconciled",
	"closed",
	"stale",
	"superseded",
	"blocked",
	"unknown",
];

const VALID_FRESHNESS: readonly RuntimeCardFreshness[] = [
	"current",
	"stale",
	"missing",
	"unknown",
];

const VALID_SOURCE_STATUSES: readonly RuntimeCardSourceStatus[] = [
	"usable",
	"empty",
	"invalid",
	"blocked",
];

const VALID_SOURCE_KINDS: readonly RuntimeCardSourceKind[] = [
	"git",
	"pr",
	"linear",
	"artifact",
	"validation",
	"review",
	"session",
	"phase_exit",
];

const VALID_ARTIFACT_STATUSES: readonly RuntimeCardArtifactStatus[] = [
	"current",
	"stale",
	"missing",
	"superseded",
	"unknown",
];

const VALID_PHASE_EXIT_STATUSES: readonly RuntimeCardPhaseExitStatus[] = [
	"pass",
	"fail",
	"blocked",
	"not_run",
	"unknown",
];

function validateNullableBoolean(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (value !== null && typeof value !== "boolean") {
		errors.push(toValidationError(`${field} must be a boolean or null`, field));
	}
}

function validateNullableNumber(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (
		value !== null &&
		(typeof value !== "number" || !Number.isInteger(value) || value < 0)
	) {
		errors.push(
			toValidationError(
				`${field} must be a non-negative integer or null`,
				field,
			),
		);
	}
}

function validateOptionalNullableString(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	if (value === undefined) return;
	validateNullableString(value, field, errors);
}

function validateBranchState(
	value: unknown,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError("branch must be an object", "branch"));
		return;
	}
	validateNullableString(value.name, "branch.name", errors);
	validateNullableBoolean(value.clean, "branch.clean", errors);
	validateNullableString(value.ref, "branch.ref", errors);
}

function validatePullRequestState(
	value: unknown,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(
			toValidationError("pullRequest must be an object", "pullRequest"),
		);
		return;
	}
	validateNullableNumber(value.number, "pullRequest.number", errors);
	validateNullableString(value.state, "pullRequest.state", errors);
	validateNullableBoolean(value.isDraft, "pullRequest.isDraft", errors);
	validateNullableString(
		value.mergeStateStatus,
		"pullRequest.mergeStateStatus",
		errors,
	);
	validateNullableString(value.url, "pullRequest.url", errors);
}

function validateArtifactsState(
	value: unknown,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError("artifacts must be an object", "artifacts"));
		return;
	}
	validateNullableString(value.activeSpec, "artifacts.activeSpec", errors);
	validateNullableString(value.activePlan, "artifacts.activePlan", errors);
	validateEnum(
		value.status,
		"artifacts.status",
		VALID_ARTIFACT_STATUSES,
		errors,
	);
	validateStringArray(value.staleRefs, "artifacts.staleRefs", errors);
}

function validateLinearState(
	value: unknown,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError("linear must be an object", "linear"));
		return;
	}
	validateNullableString(value.issueKey, "linear.issueKey", errors);
	validateEnum(value.freshness, "linear.freshness", VALID_FRESHNESS, errors);
	validateOptionalNullableString(value.status, "linear.status", errors);
	validateOptionalNullableString(value.statusType, "linear.statusType", errors);
	validateOptionalNullableString(value.url, "linear.url", errors);
	validateNullableString(value.actionRequired, "linear.actionRequired", errors);
}

function validatePhaseExitState(
	value: unknown,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		errors.push(toValidationError("phaseExit must be an object", "phaseExit"));
		return;
	}
	validateEnum(
		value.status,
		"phaseExit.status",
		VALID_PHASE_EXIT_STATUSES,
		errors,
	);
	validateNullableString(value.reason, "phaseExit.reason", errors);
}

function validateSources(value: unknown, errors: HeValidationError[]): void {
	if (!Array.isArray(value)) {
		errors.push(toValidationError("sources must be an array", "sources"));
		return;
	}
	for (const [index, source] of value.entries()) {
		const field = `sources.${String(index)}`;
		if (!isRecord(source)) {
			errors.push(toValidationError(`${field} must be an object`, field));
			continue;
		}
		validateEnum(source.kind, `${field}.kind`, VALID_SOURCE_KINDS, errors);
		validateRuntimeCardReference(source.ref, `${field}.ref`, errors);
		validateEnum(
			source.freshness,
			`${field}.freshness`,
			VALID_FRESHNESS,
			errors,
		);
		validateEnum(
			source.status,
			`${field}.status`,
			VALID_SOURCE_STATUSES,
			errors,
		);
		validateNullableString(
			source.failureClass,
			`${field}.failureClass`,
			errors,
		);
	}
}

/** Validate an unknown value as a runtime-card/v1 artifact. */
export function validateRuntimeCard(
	value: unknown,
): RuntimeCardValidationResult {
	const errors: HeValidationError[] = [];
	if (!isRecord(value)) {
		return {
			valid: false,
			errors: [toValidationError("runtime card must be an object")],
		};
	}
	rejectRawRuntimeCardEmbeddings(value, errors);

	if (value.schemaVersion !== EXPECTED_RUNTIME_CARD_SCHEMA_VERSION) {
		errors.push(
			toValidationError(
				`schemaVersion must be ${EXPECTED_RUNTIME_CARD_SCHEMA_VERSION}`,
				"schemaVersion",
			),
		);
	}
	validateString(value.generatedAt, "generatedAt", errors);
	validateNullableString(value.issueKey, "issueKey", errors);
	validateEnum(value.lifecycle, "lifecycle", VALID_LIFECYCLES, errors);
	validateString(value.summary, "summary", errors);
	validateString(value.nextSafeAction, "nextSafeAction", errors);
	validateBranchState(value.branch, errors);
	validatePullRequestState(value.pullRequest, errors);
	validateArtifactsState(value.artifacts, errors);
	validateLinearState(value.linear, errors);
	validatePhaseExitState(value.phaseExit, errors);
	validateSources(value.sources, errors);
	validateOptionalCodexRuntimeProjection(value.codexRuntime, errors);
	validateCodexRuntimeSourceProjection(
		value.codexRuntime,
		value.sources,
		errors,
	);
	validateStringArray(value.blockers, "blockers", errors);
	validateRuntimeCardAttemptLedger(value.attemptLedger, errors);
	validateRuntimeCardRecoveryEvent(value.recoveryEvent, errors);

	return { valid: errors.length === 0, errors };
}
