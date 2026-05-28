import {
	type HeValidationError,
	isRecord,
	toValidationError,
	validateNullableString,
	validateNumber,
} from "../decision/validators.js";
import { validateRuntimeCardToolExposureProjection } from "../tool-exposure/validation.js";
import { validateRuntimeCardReferenceArray } from "./runtime-card-reference-validation.js";

const FORBIDDEN_RAW_EMBEDDING_FIELDS = new Set([
	"rawEvents",
	"rawEventStream",
	"eventStream",
	"rawPacket",
	"packetBody",
	"reviewBody",
	"rawReviewBody",
	"fullReviewBody",
]);

const CODEX_RUNTIME_PROJECTION_FIELDS = new Set([
	"provenanceRef",
	"collectedAt",
	"sourceCount",
	"blockedSourceCount",
	"blockerCount",
	"receiptRefs",
	"validationRefs",
	"reviewRefs",
	"sessionRefs",
	"staleStateRefs",
	"toolExposure",
]);

/** Reject bulky runtime-card fields that would embed raw Codex packets or reviews. */
export function rejectRawRuntimeCardEmbeddings(
	value: unknown,
	errors: HeValidationError[],
	path = "",
	seen = new WeakSet<object>(),
): void {
	if (Array.isArray(value)) {
		if (seen.has(value)) return;
		seen.add(value);
		for (const [index, entry] of value.entries()) {
			rejectRawRuntimeCardEmbeddings(entry, errors, `${path}.${index}`, seen);
		}
		return;
	}
	if (!isRecord(value)) return;
	if (seen.has(value)) return;
	seen.add(value);
	for (const [key, entry] of Object.entries(value)) {
		const fieldPath = path ? `${path}.${key}` : key;
		if (FORBIDDEN_RAW_EMBEDDING_FIELDS.has(key)) {
			errors.push(
				toValidationError(
					`${fieldPath} must not embed raw event streams, packets, or review bodies`,
					fieldPath,
				),
			);
			continue;
		}
		rejectRawRuntimeCardEmbeddings(entry, errors, fieldPath, seen);
	}
}

function getStringArray(value: unknown): string[] | null {
	if (
		!Array.isArray(value) ||
		value.some(
			(entry) => typeof entry !== "string" || entry.trim().length === 0,
		)
	) {
		return null;
	}
	return value;
}

function validateRefsAreProjected(
	value: unknown,
	field: string,
	receiptRefs: Set<string>,
	errors: HeValidationError[],
): void {
	const refs = getStringArray(value);
	if (!refs) return;
	for (const [index, ref] of refs.entries()) {
		if (!receiptRefs.has(ref)) {
			errors.push(
				toValidationError(
					`${field} entries must also appear in codexRuntime.receiptRefs`,
					`${field}.${String(index)}`,
				),
			);
		}
	}
}

function nonUsableReceiptSourceCount(
	receiptRefs: string[],
	sources: unknown[],
): number {
	const sourceStatusByRef = new Map<string, unknown>();
	for (const source of sources) {
		if (isRecord(source) && typeof source.ref === "string") {
			sourceStatusByRef.set(source.ref, source.status);
		}
	}
	return receiptRefs.filter((ref) => sourceStatusByRef.get(ref) !== "usable")
		.length;
}

function validateProjectionConsistency(
	value: Record<string, unknown>,
	errors: HeValidationError[],
): void {
	for (const key of Object.keys(value)) {
		if (!CODEX_RUNTIME_PROJECTION_FIELDS.has(key)) {
			errors.push(
				toValidationError(
					`codexRuntime.${key} is not part of the compact Codex runtime projection`,
					`codexRuntime.${key}`,
				),
			);
		}
	}
	if (
		typeof value.blockedSourceCount === "number" &&
		typeof value.sourceCount === "number" &&
		value.blockedSourceCount > value.sourceCount
	) {
		errors.push(
			toValidationError(
				"codexRuntime.blockedSourceCount must be less than or equal to codexRuntime.sourceCount",
				"codexRuntime.blockedSourceCount",
			),
		);
	}
	const receiptRefs = getStringArray(value.receiptRefs);
	if (!receiptRefs) return;
	const uniqueReceiptRefs = Array.from(new Set(receiptRefs));
	if (
		typeof value.sourceCount === "number" &&
		value.sourceCount < uniqueReceiptRefs.length
	) {
		errors.push(
			toValidationError(
				"codexRuntime.sourceCount must be greater than or equal to codexRuntime.receiptRefs length",
				"codexRuntime.sourceCount",
			),
		);
	}
	if (
		typeof value.blockedSourceCount === "number" &&
		typeof value.blockerCount === "number" &&
		value.blockedSourceCount > 0 &&
		value.blockerCount === 0
	) {
		errors.push(
			toValidationError(
				"codexRuntime.blockerCount must explain non-usable Codex runtime sources",
				"codexRuntime.blockerCount",
			),
		);
	}
	const receiptRefSet = new Set(uniqueReceiptRefs);
	if (isRecord(value.toolExposure)) {
		if (
			typeof value.toolExposure.evidenceRef === "string" &&
			!receiptRefSet.has(value.toolExposure.evidenceRef)
		) {
			errors.push(
				toValidationError(
					"codexRuntime.toolExposure.evidenceRef must also appear in codexRuntime.receiptRefs",
					"codexRuntime.toolExposure.evidenceRef",
				),
			);
		}
		const toolExposureHasBlockedRuntime =
			(typeof value.toolExposure.blockedPermissionAttemptCount === "number" &&
				value.toolExposure.blockedPermissionAttemptCount > 0) ||
			(typeof value.toolExposure.unavailableToolCount === "number" &&
				value.toolExposure.unavailableToolCount > 0) ||
			(typeof value.toolExposure.notAttemptedToolCount === "number" &&
				value.toolExposure.notAttemptedToolCount > 0) ||
			(typeof value.toolExposure.claimFailedToolCount === "number" &&
				value.toolExposure.claimFailedToolCount > 0);
		if (
			toolExposureHasBlockedRuntime &&
			typeof value.blockerCount === "number" &&
			value.blockerCount === 0
		) {
			errors.push(
				toValidationError(
					"codexRuntime.blockerCount must explain blocked, unavailable, not-attempted, or claim-failed tool exposure",
					"codexRuntime.blockerCount",
				),
			);
		}
	}
	validateRefsAreProjected(
		value.validationRefs,
		"codexRuntime.validationRefs",
		receiptRefSet,
		errors,
	);
	validateRefsAreProjected(
		value.reviewRefs,
		"codexRuntime.reviewRefs",
		receiptRefSet,
		errors,
	);
	validateRefsAreProjected(
		value.sessionRefs,
		"codexRuntime.sessionRefs",
		receiptRefSet,
		errors,
	);
	validateRefsAreProjected(
		value.staleStateRefs,
		"codexRuntime.staleStateRefs",
		receiptRefSet,
		errors,
	);
}

/** Verify codexRuntime projection counts and refs against runtime-card sources. */
export function validateCodexRuntimeSourceProjection(
	codexRuntime: unknown,
	sources: unknown,
	errors: HeValidationError[],
): void {
	if (!isRecord(codexRuntime) || !Array.isArray(sources)) return;
	const receiptRefs = getStringArray(codexRuntime.receiptRefs);
	if (!receiptRefs) return;
	const uniqueReceiptRefs = Array.from(new Set(receiptRefs));
	if (codexRuntime.sourceCount !== uniqueReceiptRefs.length) {
		errors.push(
			toValidationError(
				"codexRuntime.sourceCount must match codexRuntime.receiptRefs length",
				"codexRuntime.sourceCount",
			),
		);
	}
	const sourceRefs = new Set<string>();
	for (const source of sources) {
		if (isRecord(source) && typeof source.ref === "string") {
			sourceRefs.add(source.ref);
		}
	}
	for (const [index, ref] of uniqueReceiptRefs.entries()) {
		if (!sourceRefs.has(ref)) {
			errors.push(
				toValidationError(
					"codexRuntime.receiptRefs entries must be present in runtime-card sources",
					`codexRuntime.receiptRefs.${String(index)}`,
				),
			);
		}
	}
	const blockedSourceCount = nonUsableReceiptSourceCount(
		uniqueReceiptRefs,
		sources,
	);
	if (codexRuntime.blockedSourceCount !== blockedSourceCount) {
		errors.push(
			toValidationError(
				"codexRuntime.blockedSourceCount must match non-usable receipt-backed runtime-card sources",
				"codexRuntime.blockedSourceCount",
			),
		);
	}
}

/** Validate the optional compact Codex runtime projection on runtime-card/v1. */
export function validateOptionalCodexRuntimeProjection(
	value: unknown,
	errors: HeValidationError[],
): void {
	if (value === undefined) return;
	if (!isRecord(value)) {
		errors.push(
			toValidationError("codexRuntime must be an object", "codexRuntime"),
		);
		return;
	}
	validateNullableString(
		value.provenanceRef,
		"codexRuntime.provenanceRef",
		errors,
	);
	validateNullableString(value.collectedAt, "codexRuntime.collectedAt", errors);
	validateNumber(value.sourceCount, "codexRuntime.sourceCount", errors);
	validateNumber(
		value.blockedSourceCount,
		"codexRuntime.blockedSourceCount",
		errors,
	);
	validateNumber(value.blockerCount, "codexRuntime.blockerCount", errors);
	validateRuntimeCardReferenceArray(
		value.receiptRefs,
		"codexRuntime.receiptRefs",
		errors,
	);
	validateRuntimeCardReferenceArray(
		value.validationRefs,
		"codexRuntime.validationRefs",
		errors,
	);
	validateRuntimeCardReferenceArray(
		value.reviewRefs,
		"codexRuntime.reviewRefs",
		errors,
	);
	validateRuntimeCardReferenceArray(
		value.sessionRefs,
		"codexRuntime.sessionRefs",
		errors,
	);
	validateRuntimeCardReferenceArray(
		value.staleStateRefs,
		"codexRuntime.staleStateRefs",
		errors,
	);
	if (value.toolExposure !== undefined) {
		for (const error of validateRuntimeCardToolExposureProjection(
			value.toolExposure,
			"codexRuntime.toolExposure",
		)) {
			errors.push(toValidationError(error.code, error.path));
		}
	}
	validateProjectionConsistency(value, errors);
}
