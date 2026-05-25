import {
	EXTERNAL_STATE_SOURCES,
	EXTERNAL_STATE_SOURCE_STATUSES,
} from "./types.js";
import type { ExternalStateValidationError } from "./types.js";
import {
	EVIDENCE_USES,
	RECEIPT_FRESHNESS,
	RECEIPT_STATUSES,
	addExternalStateError,
	isEmptyArray,
	isExpiredAt,
	isRecord,
	requireBoolean,
	requireEnum,
	requireIsoTimestamp,
	requireNullableHeadSha,
	requirePositiveInteger,
	requireSafeNonEmptyString,
	validateStringArray,
} from "./validation-helpers.js";

/** Validate source-family completeness and each source snapshot. */
export function validateSources(
	value: unknown,
	snapshotHeadSha: unknown,
	snapshotGeneratedAt: unknown,
	errors: ExternalStateValidationError[],
): void {
	if (!Array.isArray(value)) {
		addExternalStateError(errors, "sources must be an array", "sources");
		return;
	}
	if (value.length === 0) {
		addExternalStateError(errors, "sources must not be empty", "sources");
		return;
	}
	validateSourceCompleteness(value, errors);
	for (const [index, source] of value.entries()) {
		validateSource(
			source,
			`sources.${index}`,
			snapshotHeadSha,
			snapshotGeneratedAt,
			errors,
		);
	}
}

function validateSourceCompleteness(
	value: unknown[],
	errors: ExternalStateValidationError[],
): void {
	const counts = new Map<string, number>();
	for (const source of value) {
		if (!isRecord(source) || typeof source.source !== "string") continue;
		counts.set(source.source, (counts.get(source.source) ?? 0) + 1);
	}
	for (const source of EXTERNAL_STATE_SOURCES) {
		const count = counts.get(source) ?? 0;
		if (count === 0) {
			addExternalStateError(
				errors,
				`missing required source ${source}`,
				"sources",
			);
		}
		if (count > 1) {
			addExternalStateError(errors, `duplicate source ${source}`, "sources");
		}
	}
}

function validateSource(
	value: unknown,
	path: string,
	snapshotHeadSha: unknown,
	snapshotGeneratedAt: unknown,
	errors: ExternalStateValidationError[],
): void {
	if (!isRecord(value)) {
		addExternalStateError(errors, `${path} must be an object`, path);
		return;
	}
	validateSourceShape(value, path, errors);
	validateSourceHeadSha(value, path, snapshotHeadSha, errors);
	validateSourceStaleness(value, path, errors);
	validateSourceExpiry(value, path, snapshotGeneratedAt, errors);
	validateSourceClaimSupport(value, path, errors);
}

function validateSourceShape(
	value: Record<string, unknown>,
	path: string,
	errors: ExternalStateValidationError[],
): void {
	requireEnum(value.source, EXTERNAL_STATE_SOURCES, `${path}.source`, errors);
	requireEnum(
		value.status,
		EXTERNAL_STATE_SOURCE_STATUSES,
		`${path}.status`,
		errors,
	);
	requireIsoTimestamp(value.fetchedAt, `${path}.fetchedAt`, errors);
	requirePositiveInteger(value.ttlSeconds, `${path}.ttlSeconds`, errors);
	requireNullableHeadSha(value.headSha, `${path}.headSha`, errors);
	requireBoolean(value.prHeadSensitive, `${path}.prHeadSensitive`, errors);
	requireEnum(value.evidenceUse, EVIDENCE_USES, `${path}.evidenceUse`, errors);
	requireSafeNonEmptyString(value.evidenceRef, `${path}.evidenceRef`, errors);
	requireEnum(value.freshness, RECEIPT_FRESHNESS, `${path}.freshness`, errors);
	requireEnum(
		value.resultStatus,
		RECEIPT_STATUSES,
		`${path}.resultStatus`,
		errors,
	);
	validateStringArray(value.staleReasons, `${path}.staleReasons`, errors);
}

function validateSourceHeadSha(
	value: Record<string, unknown>,
	path: string,
	snapshotHeadSha: unknown,
	errors: ExternalStateValidationError[],
): void {
	if (value.prHeadSensitive === true && value.headSha === null) {
		addExternalStateError(
			errors,
			"PR-head-sensitive sources require headSha",
			`${path}.headSha`,
		);
	}
	if (
		value.prHeadSensitive === true &&
		typeof value.headSha === "string" &&
		typeof snapshotHeadSha === "string" &&
		value.headSha !== snapshotHeadSha
	) {
		addExternalStateError(
			errors,
			"source headSha must match snapshot headSha",
			`${path}.headSha`,
		);
	}
}

function validateSourceStaleness(
	value: Record<string, unknown>,
	path: string,
	errors: ExternalStateValidationError[],
): void {
	const staleReasons = Array.isArray(value.staleReasons)
		? value.staleReasons
		: [];
	if (value.status === "stale" && isEmptyArray(value.staleReasons)) {
		addExternalStateError(
			errors,
			"stale sources require at least one stale reason",
			`${path}.staleReasons`,
		);
	}
	if (value.freshness === "stale" && value.status !== "stale") {
		addExternalStateError(
			errors,
			"stale freshness requires stale source status",
			`${path}.status`,
		);
	}
	if (staleReasons.length > 0 && value.status !== "stale") {
		addExternalStateError(
			errors,
			"sources with stale reasons must be marked stale",
			`${path}.status`,
		);
	}
}

function validateSourceExpiry(
	value: Record<string, unknown>,
	path: string,
	snapshotGeneratedAt: unknown,
	errors: ExternalStateValidationError[],
): void {
	if (!isExpiredAt(value.fetchedAt, value.ttlSeconds, snapshotGeneratedAt)) {
		return;
	}
	if (value.status !== "stale") {
		addExternalStateError(
			errors,
			"expired sources must be marked stale",
			`${path}.status`,
		);
	}
	if (value.freshness !== "stale") {
		addExternalStateError(
			errors,
			"expired sources must have stale freshness",
			`${path}.freshness`,
		);
	}
	if (isEmptyArray(value.staleReasons)) {
		addExternalStateError(
			errors,
			"expired sources require a stale reason",
			`${path}.staleReasons`,
		);
	}
}

function validateSourceClaimSupport(
	value: Record<string, unknown>,
	path: string,
	errors: ExternalStateValidationError[],
): void {
	if (
		value.evidenceUse === "claim_support" &&
		(value.status === "unavailable" ||
			value.status === "stale" ||
			value.status === "unknown")
	) {
		addExternalStateError(
			errors,
			"unavailable, stale, or unknown sources cannot be claim_support",
			`${path}.evidenceUse`,
		);
	}
	if (value.evidenceUse === "claim_support" && value.freshness !== "current") {
		addExternalStateError(
			errors,
			"claim-support sources require current freshness",
			`${path}.freshness`,
		);
	}
	if (value.evidenceUse === "claim_support" && value.resultStatus !== "pass") {
		addExternalStateError(
			errors,
			"claim-support sources require passing resultStatus",
			`${path}.resultStatus`,
		);
	}
}
