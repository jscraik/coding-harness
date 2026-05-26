import { validateEvidenceReceipt } from "../evidence/evidence-receipt.js";
import { validateSources } from "./source-validation.js";
import { EXTERNAL_STATE_SNAPSHOT_SCHEMA_VERSION } from "./types.js";
import type {
	ExternalStateValidationError,
	ExternalStateValidationResult,
} from "./types.js";
import {
	EVIDENCE_USES,
	addExternalStateError,
	isEmptyArray,
	isExpiredAt,
	isRecord,
	requireBoolean,
	requireEnum,
	requireIsoTimestamp,
	requireLiteral,
	requireNullableHeadSha,
	requirePositiveInteger,
	requireSafeNonEmptyString,
	validateStringArray,
} from "./validation-helpers.js";

/** Validate an arbitrary value against the external-state-snapshot/v1 contract. */
export function validateExternalStateSnapshot(
	value: unknown,
): ExternalStateValidationResult {
	const errors: ExternalStateValidationError[] = [];
	if (!isRecord(value)) {
		addExternalStateError(errors, "snapshot must be an object", "snapshot");
		return { valid: false, errors };
	}

	requireLiteral(
		value.schemaVersion,
		EXTERNAL_STATE_SNAPSHOT_SCHEMA_VERSION,
		"schemaVersion",
		errors,
	);
	requireIsoTimestamp(value.generatedAt, "generatedAt", errors);
	requireSafeNonEmptyString(value.repository, "repository", errors);
	requirePositiveInteger(value.prNumber, "prNumber", errors);
	requireIsoTimestamp(value.fetchedAt, "fetchedAt", errors);
	requirePositiveInteger(value.ttlSeconds, "ttlSeconds", errors);
	requireNullableHeadSha(value.headSha, "headSha", errors);
	validateFetchProof(value, errors);
	requireEnum(value.evidenceUse, EVIDENCE_USES, "evidenceUse", errors);
	requireBoolean(value.stale, "stale", errors);
	validateStringArray(value.staleReasons, "staleReasons", errors);
	validateSources(value.sources, value.headSha, value.generatedAt, errors);
	validateSnapshotStaleness(value, errors);

	return { valid: errors.length === 0, errors };
}

function validateFetchProof(
	value: Record<string, unknown>,
	errors: ExternalStateValidationError[],
): void {
	requireSafeNonEmptyString(value.fetchReceiptRef, "fetchReceiptRef", errors);
	requireSha256(value.fetchedArtifactHash, "fetchedArtifactHash", errors);
	requireSafeNonEmptyString(value.verifierIdentity, "verifierIdentity", errors);

	const receipt = value.fetchReceipt;
	const validation = validateEvidenceReceipt(receipt);
	for (const error of validation.errors) {
		addExternalStateError(errors, error.code, `fetchReceipt.${error.path}`);
	}
	if (!isRecord(receipt)) return;

	if (receipt.kind !== "external_state") {
		addExternalStateError(
			errors,
			"external-state fetch receipt kind must be external_state",
			"fetchReceipt.kind",
		);
	}
	if (
		typeof receipt.ref !== "string" ||
		!receipt.ref.startsWith("external-state:")
	) {
		addExternalStateError(
			errors,
			"external-state fetch receipt ref must start with external-state:",
			"fetchReceipt.ref",
		);
	}
	if (
		typeof value.fetchReceiptRef === "string" &&
		receipt.ref !== value.fetchReceiptRef
	) {
		addExternalStateError(
			errors,
			"fetchReceiptRef must match fetchReceipt.ref",
			"fetchReceiptRef",
		);
	}
	if (
		typeof value.fetchedArtifactHash === "string" &&
		receipt.checksum !== value.fetchedArtifactHash
	) {
		addExternalStateError(
			errors,
			"fetchedArtifactHash must match fetchReceipt.checksum",
			"fetchedArtifactHash",
		);
	}
	if (
		typeof value.verifierIdentity === "string" &&
		receipt.producer !== value.verifierIdentity
	) {
		addExternalStateError(
			errors,
			"verifierIdentity must match fetchReceipt.producer",
			"verifierIdentity",
		);
	}
	if (typeof value.headSha === "string" && receipt.headSha !== value.headSha) {
		addExternalStateError(
			errors,
			"fetchReceipt headSha must match snapshot headSha",
			"fetchReceipt.headSha",
		);
	}
	if (receipt.status !== "pass") {
		addExternalStateError(
			errors,
			"external-state fetch receipt must pass",
			"fetchReceipt.status",
		);
	}
	if (receipt.freshness !== "current") {
		addExternalStateError(
			errors,
			"external-state fetch receipt must be current",
			"fetchReceipt.freshness",
		);
	}
	if (receipt.evidenceUse !== "claim_support") {
		addExternalStateError(
			errors,
			"external-state fetch receipt must be claim_support",
			"fetchReceipt.evidenceUse",
		);
	}
	if (typeof receipt.sizeBytes !== "number" || receipt.sizeBytes <= 0) {
		addExternalStateError(
			errors,
			"external-state fetch receipt requires sizeBytes greater than zero",
			"fetchReceipt.sizeBytes",
		);
	}
}

function requireSha256(
	value: unknown,
	path: string,
	errors: ExternalStateValidationError[],
): void {
	requireSafeNonEmptyString(value, path, errors);
	if (typeof value === "string" && !/^[a-f0-9]{64}$/u.test(value)) {
		addExternalStateError(errors, `${path} must be a SHA-256 hex digest`, path);
	}
}

function validateSnapshotStaleness(
	value: Record<string, unknown>,
	errors: ExternalStateValidationError[],
): void {
	const expired = isExpiredAt(
		value.fetchedAt,
		value.ttlSeconds,
		value.generatedAt,
	);
	if (value.stale === true && isEmptyArray(value.staleReasons)) {
		addExternalStateError(
			errors,
			"stale snapshots require at least one stale reason",
			"staleReasons",
		);
	}
	if (expired && value.stale !== true) {
		addExternalStateError(
			errors,
			"expired snapshots must be marked stale",
			"stale",
		);
	}
	if (expired && isEmptyArray(value.staleReasons)) {
		addExternalStateError(
			errors,
			"expired snapshots require a stale reason",
			"staleReasons",
		);
	}
}
