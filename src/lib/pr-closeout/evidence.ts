import type { PrCloseoutCheckInput, PrCloseoutInput } from "./types.js";

/** Check one extracted key against an optional configured Linear allowlist. */
function isAllowedLinearIssueKey(
	issueKey: string,
	allowedPrefixes?: readonly string[],
): boolean {
	const separator = issueKey.indexOf("-");
	if (separator <= 0) return false;
	const prefix = issueKey.slice(0, separator).toUpperCase();
	if (allowedPrefixes === undefined) return prefix.length > 1;
	return allowedPrefixes.some(
		(allowedPrefix) => allowedPrefix.toUpperCase() === prefix,
	);
}

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
	return ["SUCCESS", "PASSED", "PASS"].includes(status);
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
export function hasLinearReference(
	body: string | null | undefined,
	allowedPrefixes?: readonly string[],
): boolean {
	const pattern = /\b(?:Refs|Closes|Fixes)\s+([A-Z][A-Z0-9]*-\d+)\b/giu;
	return Array.from((body ?? "").matchAll(pattern)).some((match) =>
		isAllowedLinearIssueKey(match[1] ?? "", allowedPrefixes),
	);
}

/** Apply configured Linear-prefix validation before closeout claims are built. */
export function applyConfiguredLinearIssueKeyPolicy(
	input: PrCloseoutInput,
): PrCloseoutInput {
	if (
		input.linearIssueKeyPrefixes === undefined ||
		hasLinearReference(input.pullRequest.body, input.linearIssueKeyPrefixes)
	) {
		return input;
	}
	return {
		...input,
		pullRequest: { ...input.pullRequest, body: null },
	};
}
