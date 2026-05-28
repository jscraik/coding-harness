import {
	ARTIFACT_KEYS,
	DISALLOWED_RAW_KEYS,
	HEAD_SHA_PATTERN,
	ISO_TIMESTAMP_PATTERN,
	SAFE_POINTER_PATTERN,
	SHA256_PATTERN,
	STALE_PRECONDITION_KEYS,
	STEERING_QUEUE_STALE_KINDS,
	SUMMARY_KEYS,
} from "./constants.js";
import { summarizeSteeringQueue } from "./builder.js";
import type {
	SteeringQueueItem,
	SteeringQueueValidationError,
} from "./types.js";

/** Validate artifact identities referenced by a steering queue item. */
export function validateArtifactArray(
	value: unknown,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (!Array.isArray(value)) {
		addError(errors, "invalid_artifacts", path, "must be an array");
		return;
	}
	for (const [index, artifact] of value.entries()) {
		validateArtifact(artifact, `${path}[${index}]`, errors);
	}
}

/** Validate stale-precondition entries for an evaluated steering item. */
export function validateStalePreconditions(
	value: unknown,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (!Array.isArray(value)) {
		addError(errors, "invalid_stale_preconditions", path, "must be an array");
		return;
	}
	for (const [index, preconditionValue] of value.entries()) {
		validateStalePrecondition(preconditionValue, `${path}[${index}]`, errors);
	}
}

/** Validate packet summary counts against the evaluated item list. */
export function validateSummary(
	value: Record<string, unknown>,
	errors: SteeringQueueValidationError[],
) {
	if (!isRecord(value.summary)) {
		addError(errors, "invalid_summary", "summary", "must be an object");
		return;
	}
	requireAllowedKeys(value.summary, SUMMARY_KEYS, "summary", errors);
	for (const key of SUMMARY_KEYS) {
		if (!Number.isInteger(value.summary[key])) {
			addError(
				errors,
				"invalid_summary_count",
				`summary.${key}`,
				"must be an integer",
			);
		}
	}
	if (!Array.isArray(value.items)) return;
	const expected = summarizeSteeringQueue(value.items as SteeringQueueItem[]);
	for (const [key, count] of Object.entries(expected)) {
		if (value.summary[key] !== count) {
			addError(
				errors,
				"summary_mismatch",
				`summary.${key}`,
				`must equal ${count}`,
			);
		}
	}
}

/** Reject raw prompt, transcript, secret, token, credential, or password fields. */
export function validateNoRawKeys(
	value: unknown,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (Array.isArray(value)) {
		value.forEach((entry, index) => {
			validateNoRawKeys(entry, `${path}[${index}]`, errors);
		});
		return;
	}
	if (!isRecord(value)) return;
	for (const [key, entry] of Object.entries(value)) {
		if (
			DISALLOWED_RAW_KEYS.has(key) ||
			/(?:secret|token|credential|password|prompt|transcript)/iu.test(key)
		) {
			addError(
				errors,
				"raw_or_sensitive_field",
				`${path}.${key}`,
				"is not allowed",
			);
		}
		validateNoRawKeys(entry, `${path}.${key}`, errors);
	}
}

/** Reject object keys outside an explicit packet contract allowlist. */
export function requireAllowedKeys(
	value: Record<string, unknown>,
	allowed: ReadonlySet<string>,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) {
			addError(errors, "unknown_key", `${path}.${key}`, "is not allowed");
		}
	}
}

/** Require a field to equal an exact string literal. */
export function requireLiteral(
	value: unknown,
	expected: string,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (value !== expected) {
		addError(errors, "invalid_literal", path, `must be ${expected}`);
	}
}

/** Require a string field to be one of an allowed enum set. */
export function requireEnum(
	value: unknown,
	allowed: readonly string[],
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (typeof value !== "string" || !allowed.includes(value)) {
		addError(errors, "invalid_enum", path, "is not a recognized value");
	}
}

/** Require a field to be a non-empty safe pointer string. */
export function requireSafePointer(
	value: unknown,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (typeof value !== "string" || !SAFE_POINTER_PATTERN.test(value)) {
		addError(
			errors,
			"invalid_pointer",
			path,
			"must be a safe non-empty pointer",
		);
	}
}

/** Require a field to be null or a non-empty safe pointer string. */
export function requireNullableSafePointer(
	value: unknown,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (value !== null) requireSafePointer(value, path, errors);
}

/** Require an array whose entries are safe pointer strings. */
export function requirePointerArray(
	value: unknown,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (!Array.isArray(value)) {
		addError(errors, "invalid_pointer_array", path, "must be an array");
		return;
	}
	value.forEach((entry, index) => {
		requireSafePointer(entry, `${path}[${index}]`, errors);
	});
}

/** Require an ISO UTC timestamp string. */
export function requireIso(
	value: unknown,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (
		typeof value !== "string" ||
		!ISO_TIMESTAMP_PATTERN.test(value) ||
		Number.isNaN(Date.parse(value))
	) {
		addError(errors, "invalid_timestamp", path, "must be an ISO UTC timestamp");
	}
}

/** Require a field to be null or an ISO UTC timestamp string. */
export function requireNullableIso(
	value: unknown,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (value !== null) requireIso(value, path, errors);
}

/** Require a git head SHA string. */
export function requireHeadSha(
	value: unknown,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (typeof value !== "string" || !HEAD_SHA_PATTERN.test(value)) {
		addError(errors, "invalid_head_sha", path, "must be a git head SHA");
	}
}

/** Require a sha256-prefixed digest string. */
export function requireSha256(
	value: unknown,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
		addError(errors, "invalid_sha256", path, "must be sha256:<hex>");
	}
}

/** Return whether an unknown value is a plain object record. */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Append a normalized steering queue validation error. */
export function addError(
	errors: SteeringQueueValidationError[],
	code: string,
	path: string,
	message: string,
) {
	errors.push({ code: `${code}: ${message}`, path, severity: "error" });
}

function validateArtifact(
	value: unknown,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (!isRecord(value)) {
		addError(errors, "invalid_artifact", path, "must be an object");
		return;
	}
	requireAllowedKeys(value, ARTIFACT_KEYS, path, errors);
	requireSafePointer(value.artifactRef, `${path}.artifactRef`, errors);
	requireHeadSha(value.headSha, `${path}.headSha`, errors);
	requireIso(value.producedAt, `${path}.producedAt`, errors);
	if (value.sha256 !== null) {
		requireSha256(value.sha256, `${path}.sha256`, errors);
	}
	requireNullableSafePointer(value.receiptId, `${path}.receiptId`, errors);
}

function validateStalePrecondition(
	value: unknown,
	path: string,
	errors: SteeringQueueValidationError[],
) {
	if (!isRecord(value)) {
		addError(errors, "invalid_stale_precondition", path, "must be an object");
		return;
	}
	requireAllowedKeys(value, STALE_PRECONDITION_KEYS, path, errors);
	requireEnum(value.kind, STEERING_QUEUE_STALE_KINDS, `${path}.kind`, errors);
	requireSafePointer(value.expected, `${path}.expected`, errors);
	requireSafePointer(value.actual, `${path}.actual`, errors);
	requireSafePointer(value.evidenceRef, `${path}.evidenceRef`, errors);
}
