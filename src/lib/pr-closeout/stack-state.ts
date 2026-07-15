import type { PrCloseoutStackState } from "./types.js";

const STACK_STATUSES = new Set([
	"stable",
	"unstable",
	"unknown",
	"not_applicable",
]);

/** Return whether a stack reference is a positive integer identifier. */
function isPositiveInteger(value: unknown): value is number {
	return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Return whether an optional stack text field is a string or null. */
function isNullableString(value: unknown): value is string | null {
	return value === null || typeof value === "string";
}

/** Return whether a stack evidence field is a non-empty string array. */
function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.every((item) => typeof item === "string" && item.trim().length > 0)
	);
}

/** Return whether a value is a non-array object record. */
function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Validate optional stack evidence-reference arrays. */
function hasValidStackReferences(stack: Record<string, unknown>): boolean {
	return (
		(stack.evidenceRefs === undefined || isStringArray(stack.evidenceRefs)) &&
		(stack.blockerRefs === undefined || isStringArray(stack.blockerRefs))
	);
}

/** Validate optional numeric parent and lower-layer PR references. */
function hasValidStackNumbers(stack: Record<string, unknown>): boolean {
	return (
		(stack.parentPr === undefined ||
			stack.parentPr === null ||
			isPositiveInteger(stack.parentPr)) &&
		(stack.lowerPrs === undefined ||
			(Array.isArray(stack.lowerPrs) &&
				stack.lowerPrs.every(isPositiveInteger)))
	);
}

/** Validate optional stack reason and base-SHA text fields. */
function hasValidStackText(stack: Record<string, unknown>): boolean {
	return (
		(stack.reason === undefined || isNullableString(stack.reason)) &&
		(stack.baseSha === undefined || isNullableString(stack.baseSha))
	);
}

/** Validate the optional scalar and collection fields on stack evidence. */
function hasValidOptionalStackFields(stack: Record<string, unknown>): boolean {
	return (
		(stack.required === undefined || typeof stack.required === "boolean") &&
		hasValidStackReferences(stack) &&
		hasValidStackNumbers(stack) &&
		hasValidStackText(stack)
	);
}

/** Validate optional stacked-PR evidence before it enters the closeout model. */
export function isPrCloseoutStackState(
	value: unknown,
): value is PrCloseoutStackState {
	if (!isObjectRecord(value)) return false;
	return (
		typeof value.status === "string" &&
		STACK_STATUSES.has(value.status) &&
		hasValidOptionalStackFields(value)
	);
}

/** Reject malformed stacked-PR evidence with a source-qualified diagnostic. */
export function assertPrCloseoutStackState(
	value: unknown,
	source: string,
): asserts value is PrCloseoutStackState | undefined {
	if (value !== undefined && !isPrCloseoutStackState(value)) {
		throw new Error(`${source} must be a valid stack state object`);
	}
}
