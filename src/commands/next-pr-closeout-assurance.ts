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
const READY_PR_CLOSEOUT_THRESHOLD_OPERATORS = new Set(["<=", ">="]);
const READY_PR_CLOSEOUT_LIFECYCLE_FIELDS = [
	"automationState",
	"branchWorktreeState",
	"linearState",
	"mergeState",
	"nextLaneRouting",
	"prState",
	"reviewThreadState",
] as const;

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

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function hasOptionalThresholdShape(value: unknown): boolean {
	if (value === undefined || value === null) return true;
	if (!isObjectRecord(value)) return false;
	return (
		typeof value.metric === "string" &&
		READY_PR_CLOSEOUT_THRESHOLD_OPERATORS.has(String(value.operator)) &&
		typeof value.unit === "string" &&
		isFiniteNumber(value.value) &&
		(value.observed === undefined || isFiniteNumber(value.observed))
	);
}

function hasOptionalLifecycleStateShape(value: unknown): boolean {
	if (value === undefined || value === null) return true;
	if (!isObjectRecord(value)) return false;
	return (
		READY_PR_CLOSEOUT_LIFECYCLE_FIELDS.every(
			(field) => value[field] === undefined || typeof value[field] === "string",
		) &&
		(value.unobservedHorizon === undefined ||
			value.unobservedHorizon === null ||
			typeof value.unobservedHorizon === "string")
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
		hasOptionalAssuranceStrings(value) &&
		hasOptionalThresholdShape(value.threshold) &&
		hasOptionalLifecycleStateShape(value.lifecycleState)
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
	try {
		return validateHarnessAssuranceEntries(value).valid;
	} catch {
		return false;
	}
}
