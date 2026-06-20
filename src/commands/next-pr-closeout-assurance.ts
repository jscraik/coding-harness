import {
	HARNESS_ASSURANCE_LAYERS,
	type HarnessAssuranceEntry,
	validateHarnessAssuranceEntries,
} from "../lib/harness-assurance.js";

const READY_PR_CLOSEOUT_ASSURANCE_LAYERS = new Set<string>(
	HARNESS_ASSURANCE_LAYERS,
);
const READY_PR_CLOSEOUT_ASSURANCE_STATUSES = new Set([
	"pass",
	"partial",
	"blocked",
	"n.a.",
]);
const READY_PR_CLOSEOUT_READY_ASSURANCE_STATUSES = new Set(["pass", "n.a."]);

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((item) => typeof item === "string")
	);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOptionalAssuranceStrings(value: Record<string, unknown>): boolean {
	return (
		(value.reason === undefined ||
			value.reason === null ||
			typeof value.reason === "string") &&
		(value.followUp === undefined ||
			value.followUp === null ||
			typeof value.followUp === "string")
	);
}

function isHarnessAssuranceEntryRecord(
	value: unknown,
): value is HarnessAssuranceEntry {
	if (!isObjectRecord(value)) return false;
	return (
		typeof value.layer === "string" &&
		READY_PR_CLOSEOUT_ASSURANCE_LAYERS.has(value.layer) &&
		typeof value.status === "string" &&
		READY_PR_CLOSEOUT_ASSURANCE_STATUSES.has(value.status) &&
		(value.evidence === undefined || isStringArray(value.evidence)) &&
		hasOptionalAssuranceStrings(value)
	);
}

function hasReadyAssuranceStatuses(
	entries: readonly HarnessAssuranceEntry[],
): boolean {
	return entries.every((entry) =>
		READY_PR_CLOSEOUT_READY_ASSURANCE_STATUSES.has(entry.status),
	);
}

/** Validate ready pr-closeout assurance evidence without trusting parsed JSON as typed. */
export function hasValidReadyPrCloseoutAssuranceEntries(
	value: unknown,
): boolean {
	if (!Array.isArray(value) || value.length === 0) return false;
	if (!value.every(isHarnessAssuranceEntryRecord)) return false;
	if (!hasReadyAssuranceStatuses(value)) return false;
	return validateHarnessAssuranceEntries(value).valid;
}
