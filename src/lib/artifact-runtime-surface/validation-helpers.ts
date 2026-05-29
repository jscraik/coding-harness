import type { ArtifactRuntimeSurfaceValidationError } from "./types.js";
import {
	HEAD_SHA_PATTERN,
	MAX_TEXT_LENGTH,
	POINTER_PATTERN,
	PREVIEW_REF_PATTERN,
	RAW_KEY_PATTERN,
	RFC3339_DATE_TIME_PATTERN,
	SAFE_PATH_PATTERN,
	SECRET_VALUE_PATTERN,
	SHA256_PATTERN,
} from "./validation-constants.js";

/** Reject object keys outside the closed ArtifactRuntimeSurface contract. */
export function requireAllowedKeys(
	value: Record<string, unknown>,
	allowed: readonly string[],
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	for (const key of Object.keys(value)) {
		if (!allowed.includes(key)) {
			addError(errors, "unknown_field", `${path}.${key}`, "is not allowed");
		}
	}
}

/** Require a field to match one literal value. */
export function requireLiteral(
	value: unknown,
	expected: string,
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (value !== expected) {
		addError(errors, "invalid_literal", path, `must be ${expected}`);
	}
}

/** Require a field to be one of a closed string enum. */
export function requireEnum(
	value: unknown,
	allowed: readonly string[],
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (typeof value !== "string" || !allowed.includes(value)) {
		addError(
			errors,
			"invalid_enum",
			path,
			`must be one of ${allowed.join(", ")}`,
		);
	}
}

/** Require a field to be represented as an array. */
export function requireArray(
	value: unknown,
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (!Array.isArray(value)) {
		addError(errors, "invalid_array", path, "must be an array");
	}
}

/** Require a bounded pointer ref rather than raw inline evidence. */
export function requirePointer(
	value: unknown,
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (typeof value !== "string" || !POINTER_PATTERN.test(value)) {
		addError(errors, "invalid_pointer", path, "must be a bounded pointer");
	}
}

/** Require a safe repository-relative path that cannot escape the repo. */
export function requireRepoPath(
	value: unknown,
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (typeof value !== "string" || !SAFE_PATH_PATTERN.test(value)) {
		addError(errors, "unsafe_path", path, "must be a safe repo-relative path");
		return;
	}
	if (value.length > 256) {
		addError(errors, "unsafe_path", path, "must be <= 256 characters");
		return;
	}
	if (
		value.startsWith("/") ||
		value.startsWith("~") ||
		value.includes("..") ||
		value.includes("\\") ||
		/^[a-z][a-z0-9+.-]*:/iu.test(value)
	) {
		addError(
			errors,
			"unsafe_path",
			path,
			"absolute, traversal, home, URL, and backslash paths are forbidden",
		);
	}
}

/** Require a preview reference in the artifact-runtime preview namespace. */
export function requirePreviewRef(
	value: unknown,
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (typeof value !== "string" || !PREVIEW_REF_PATTERN.test(value)) {
		addError(
			errors,
			"invalid_preview_ref",
			path,
			"must use preview:browser, preview:file, preview:artifact, or preview:not-applicable",
		);
		return;
	}
	if (value.startsWith("preview:file/")) {
		requireRepoPath(value.slice("preview:file/".length), path, errors);
	}
}

/** Require an RFC3339 date-time string. */
export function requireIso(
	value: unknown,
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (typeof value !== "string" || !RFC3339_DATE_TIME_PATTERN.test(value)) {
		addError(errors, "invalid_datetime", path, "must be RFC3339 date-time");
	}
}

/** Require a lowercase git head SHA or an explicit null value. */
export function requireNullableHeadSha(
	value: unknown,
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (value !== null && !isHeadSha(value)) {
		addError(
			errors,
			"invalid_head_sha",
			path,
			"must be 40 lowercase hex or null",
		);
	}
}

/** Reject raw-content, prompt, transcript, command-output, or secret keys. */
export function validateNoRawKeys(
	value: unknown,
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			validateNoRawKeys(item, `${path}[${index}]`, errors);
		});
		return;
	}
	if (!isRecord(value)) return;
	for (const [key, nested] of Object.entries(value)) {
		if (RAW_KEY_PATTERN.test(key)) {
			addError(
				errors,
				"raw_or_secret_key",
				`${path}.${key}`,
				"raw content, prompts, transcripts, command output, tokens, secrets, and artifact bodies are forbidden",
			);
		}
		validateNoRawKeys(nested, `${path}.${key}`, errors);
	}
}

/** Reject overlong or secret-like scalar values anywhere in a packet. */
export function validateScalarValues(
	value: unknown,
	path: string,
	errors: ArtifactRuntimeSurfaceValidationError[],
) {
	if (Array.isArray(value)) {
		value.forEach((item, index) => {
			validateScalarValues(item, `${path}[${index}]`, errors);
		});
		return;
	}
	if (isRecord(value)) {
		for (const [key, nested] of Object.entries(value)) {
			validateScalarValues(nested, `${path}.${key}`, errors);
		}
		return;
	}
	if (typeof value !== "string") return;
	if (value.length > MAX_TEXT_LENGTH) {
		addError(
			errors,
			"overlong_text",
			path,
			`text values must be <= ${MAX_TEXT_LENGTH} characters`,
		);
	}
	if (SECRET_VALUE_PATTERN.test(value)) {
		addError(
			errors,
			"secret_like_value",
			path,
			"secret-like values are forbidden even in allowed fields",
		);
	}
}

/** Return whether the value is a non-array object record. */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Return whether the value is a lowercase 40-character git commit SHA. */
export function isHeadSha(value: unknown): value is string {
	return typeof value === "string" && HEAD_SHA_PATTERN.test(value);
}

/** Return whether the value is a sha256 digest with the expected prefix. */
export function isSha256(value: unknown): value is string {
	return typeof value === "string" && SHA256_PATTERN.test(value);
}

/** Parse a contract RFC3339 date-time value to epoch milliseconds. */
export function parseIso(value: unknown): number | null {
	if (typeof value !== "string" || !RFC3339_DATE_TIME_PATTERN.test(value)) {
		return null;
	}
	const time = Date.parse(value);
	return Number.isNaN(time) ? null : time;
}

/** Append a machine-readable validation error. */
export function addError(
	errors: ArtifactRuntimeSurfaceValidationError[],
	code: string,
	path: string,
	message: string,
) {
	errors.push({ code, path, message });
}
