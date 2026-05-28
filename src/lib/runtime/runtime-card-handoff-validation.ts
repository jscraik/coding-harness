import {
	isRecord,
	toValidationError,
	validateEnum,
	validateNullableString,
	validateNumber,
	validateString,
	validateStringArray,
	type HeValidationError,
} from "../decision/validators.js";
import {
	RUNTIME_CARD_HANDOFF_SCHEMA_VERSION,
	VALID_RUNTIME_CARD_HANDOFF_EVIDENCE_USES,
	VALID_RUNTIME_CARD_HANDOFF_FRESHNESS,
	type RuntimeCardHandoff,
	type RuntimeCardHandoffValidationResult,
} from "./runtime-card-handoff-contract.js";
import { RUNTIME_CARD_SCHEMA_VERSION } from "./runtime-card.js";
import { RUNTIME_EVIDENCE_BUNDLE_SCHEMA_VERSION } from "./runtime-evidence-bundle.js";

function isUnsafeArtifactPath(value: string): boolean {
	const segments = value.split(/[\\/]+/u);
	return (
		value.trim().length === 0 ||
		value.startsWith("/") ||
		/^[A-Za-z]:[\\/]/u.test(value) ||
		segments.includes("..")
	);
}

function addError(
	errors: HeValidationError[],
	message: string,
	path?: string,
): void {
	errors.push(toValidationError(message, path));
}

function requireIsoTimestamp(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	validateString(value, field, errors);
	if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
		addError(errors, `${field} must be a valid timestamp`, field);
	}
}

function validateNonEmptyStringArray(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	validateStringArray(value, field, errors);
	if (Array.isArray(value) && value.length === 0) {
		addError(errors, `${field} must contain at least one entry`, field);
	}
}

function validateSha256(
	value: unknown,
	field: string,
	errors: HeValidationError[],
): void {
	validateString(value, field, errors);
	if (typeof value === "string" && !/^sha256:[a-f0-9]{64}$/u.test(value)) {
		addError(errors, `${field} must be a sha256:<hex> digest`, field);
	}
}

function validateArtifactRef(
	value: unknown,
	field: string,
	expectedSchemaVersion: string,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		addError(errors, `${field} must be an object`, field);
		return;
	}
	validateString(value.path, `${field}.path`, errors);
	if (typeof value.path === "string" && isUnsafeArtifactPath(value.path)) {
		addError(
			errors,
			`${field}.path must be a repository-relative artifact path`,
			`${field}.path`,
		);
	}
	if (value.schemaVersion !== expectedSchemaVersion) {
		addError(
			errors,
			`${field}.schemaVersion must be ${expectedSchemaVersion}`,
			`${field}.schemaVersion`,
		);
	}
	validateNumber(value.sizeBytes, `${field}.sizeBytes`, errors);
	if (typeof value.sizeBytes === "number" && value.sizeBytes < 1) {
		addError(
			errors,
			`${field}.sizeBytes must be greater than zero`,
			`${field}.sizeBytes`,
		);
	}
	validateSha256(value.sha256, `${field}.sha256`, errors);
	requireIsoTimestamp(value.generatedAt, `${field}.generatedAt`, errors);
	validateNullableString(value.headSha, `${field}.headSha`, errors);
	validateNonEmptyStringArray(value.sourceRefs, `${field}.sourceRefs`, errors);
	validateNonEmptyStringArray(
		value.provenanceRefs,
		`${field}.provenanceRefs`,
		errors,
	);
}

function validateRuntimeIdentity(
	value: unknown,
	errors: HeValidationError[],
): void {
	if (!isRecord(value)) {
		addError(errors, "runtimeIdentity must be an object", "runtimeIdentity");
		return;
	}
	validateNullableString(value.issueKey, "runtimeIdentity.issueKey", errors);
	validateNullableString(value.headSha, "runtimeIdentity.headSha", errors);
	requireIsoTimestamp(value.generatedAt, "runtimeIdentity.generatedAt", errors);
	validateString(value.provenanceRef, "runtimeIdentity.provenanceRef", errors);
	validateNonEmptyStringArray(
		value.sourceRefs,
		"runtimeIdentity.sourceRefs",
		errors,
	);
}

function validatePairing(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	const identity = value.runtimeIdentity;
	const runtimeCard = value.runtimeCard;
	const evidenceBundle = value.evidenceBundle;
	if (
		!isRecord(identity) ||
		!isRecord(runtimeCard) ||
		!isRecord(evidenceBundle)
	) {
		return;
	}
	if (value.issueKey !== identity.issueKey) {
		addError(
			errors,
			"issueKey must match runtimeIdentity.issueKey",
			"issueKey",
		);
	}
	if (value.headSha !== identity.headSha) {
		addError(errors, "headSha must match runtimeIdentity.headSha", "headSha");
	}
	if (runtimeCard.generatedAt !== identity.generatedAt) {
		addError(
			errors,
			"runtimeCard.generatedAt must match runtimeIdentity.generatedAt",
			"runtimeCard.generatedAt",
		);
	}
	if (runtimeCard.headSha !== identity.headSha) {
		addError(
			errors,
			"runtimeCard.headSha must match runtimeIdentity.headSha",
			"runtimeCard.headSha",
		);
	}
	if (evidenceBundle.generatedAt !== identity.generatedAt) {
		addError(
			errors,
			"evidenceBundle.generatedAt must match runtimeIdentity.generatedAt",
			"evidenceBundle.generatedAt",
		);
	}
	if (evidenceBundle.headSha !== identity.headSha) {
		addError(
			errors,
			"evidenceBundle.headSha must match runtimeIdentity.headSha",
			"evidenceBundle.headSha",
		);
	}
	if (
		Array.isArray(evidenceBundle.provenanceRefs) &&
		typeof identity.provenanceRef === "string" &&
		!evidenceBundle.provenanceRefs.includes(identity.provenanceRef)
	) {
		addError(
			errors,
			"evidenceBundle.provenanceRefs must include runtimeIdentity.provenanceRef",
			"evidenceBundle.provenanceRefs",
		);
	}
}

function validateExpiry(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	if (
		typeof value.generatedAt !== "string" ||
		typeof value.expiresAt !== "string"
	) {
		return;
	}
	const generatedAt = Date.parse(value.generatedAt);
	const expiresAt = Date.parse(value.expiresAt);
	if (
		!Number.isNaN(generatedAt) &&
		!Number.isNaN(expiresAt) &&
		expiresAt <= generatedAt
	) {
		addError(errors, "expiresAt must be later than generatedAt", "expiresAt");
	}
}

/** Validate a value against the runtime-card-handoff/v1 contract. */
export function validateRuntimeCardHandoff(
	value: unknown,
): RuntimeCardHandoffValidationResult {
	const errors: HeValidationError[] = [];
	if (!isRecord(value)) {
		return {
			valid: false,
			errors: [toValidationError("runtime-card handoff must be an object")],
		};
	}
	if (value.schemaVersion !== RUNTIME_CARD_HANDOFF_SCHEMA_VERSION) {
		addError(
			errors,
			`schemaVersion must be ${RUNTIME_CARD_HANDOFF_SCHEMA_VERSION}`,
			"schemaVersion",
		);
	}
	requireIsoTimestamp(value.generatedAt, "generatedAt", errors);
	requireIsoTimestamp(value.expiresAt, "expiresAt", errors);
	validateNullableString(value.issueKey, "issueKey", errors);
	validateNullableString(value.headSha, "headSha", errors);
	validateEnum(
		value.evidenceUse,
		"evidenceUse",
		VALID_RUNTIME_CARD_HANDOFF_EVIDENCE_USES,
		errors,
	);
	validateEnum(
		value.freshness,
		"freshness",
		VALID_RUNTIME_CARD_HANDOFF_FRESHNESS,
		errors,
	);
	validateRuntimeIdentity(value.runtimeIdentity, errors);
	validateArtifactRef(
		value.runtimeCard,
		"runtimeCard",
		RUNTIME_CARD_SCHEMA_VERSION,
		errors,
	);
	validateArtifactRef(
		value.evidenceBundle,
		"evidenceBundle",
		RUNTIME_EVIDENCE_BUNDLE_SCHEMA_VERSION,
		errors,
	);
	validateNonEmptyStringArray(value.sourceRefs, "sourceRefs", errors);
	validateNonEmptyStringArray(value.provenanceRefs, "provenanceRefs", errors);
	validateStringArray(value.blockers, "blockers", errors);
	validatePairing(value, errors);
	validateExpiry(value, errors);
	return { valid: errors.length === 0, errors };
}

/** Cast a validated runtime-card handoff candidate to RuntimeCardHandoff. */
export function asRuntimeCardHandoff(value: unknown): RuntimeCardHandoff {
	const validation = validateRuntimeCardHandoff(value);
	if (!validation.valid) {
		throw new Error(
			"runtime-card handoff failed validation: " +
				validation.errors.map((error) => error.code).join("; "),
		);
	}
	return value as RuntimeCardHandoff;
}
