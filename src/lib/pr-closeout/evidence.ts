import type { PrCloseoutCheckInput } from "./types.js";

/** Normalize provider status strings before verifier comparisons. */
export function normalizeStatus(value: string | null | undefined): string {
	return (value ?? "").trim().toUpperCase();
}

function firstStatusValue(
	...values: readonly (string | null | undefined)[]
): string | null {
	for (const value of values) {
		if (typeof value === "string" && value.trim().length > 0) {
			return value;
		}
	}
	return null;
}

/** Return whether a check result counts as passing closeout evidence. */
export function isPassingCheck(check: PrCloseoutCheckInput): boolean {
	const status = normalizeStatus(
		firstStatusValue(check.conclusion, check.state),
	);
	return ["SUCCESS", "PASSED", "PASS", "NEUTRAL", "SKIPPED"].includes(status);
}

/** Return whether a check result counts as failed closeout evidence. */
export function isFailedCheck(check: PrCloseoutCheckInput): boolean {
	const status = normalizeStatus(
		firstStatusValue(check.conclusion, check.state),
	);
	return [
		"FAILURE",
		"FAILED",
		"FAIL",
		"ERROR",
		"CANCELLED",
		"TIMED_OUT",
	].includes(status);
}

/** Return whether a check result counts as pending closeout evidence. */
export function isPendingCheck(check: PrCloseoutCheckInput): boolean {
	const status = normalizeStatus(
		firstStatusValue(check.conclusion, check.state),
	);
	return ["PENDING", "QUEUED", "IN_PROGRESS", "EXPECTED", "WAITING"].includes(
		status,
	);
}

/** Return whether PR prose contains the required Linear issue reference. */
export function hasLinearReference(body: string | null | undefined): boolean {
	return /\b(?:Refs|Closes)\s+[A-Z][A-Z0-9]+-\d+\b/u.test(body ?? "");
}
