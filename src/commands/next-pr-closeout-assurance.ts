import {
	HARNESS_ASSURANCE_LAYERS,
	type HarnessAssuranceEntry,
	validateHarnessAssuranceEntries,
} from "../lib/harness-assurance.js";

const readyAssuranceLayers = new Set<string>(HARNESS_ASSURANCE_LAYERS);
const readyAssuranceStatuses = new Set(["pass", "partial", "blocked", "n.a."]);
const readyAssuranceAcceptedStatuses = new Set(["pass", "n.a."]);
const thresholdOperators = new Set(["<=", ">="]);
const lifecycleFields = [
	"automationState",
	"branchWorktreeState",
	"linearState",
	"mergeState",
	"nextLaneRouting",
	"prState",
	"reviewThreadState",
] as const;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((item) => typeof item === "string")
	);
}

function isOptionalStringOrNull(value: unknown): boolean {
	return value === undefined || value === null || typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function hasOptionalThresholdShape(value: unknown): boolean {
	if (value === undefined || value === null) return true;
	if (!isObjectRecord(value)) return false;
	return (
		typeof value.metric === "string" &&
		thresholdOperators.has(String(value.operator)) &&
		typeof value.unit === "string" &&
		isFiniteNumber(value.value) &&
		(value.observed === undefined || isFiniteNumber(value.observed))
	);
}

function hasOptionalLifecycleStateShape(value: unknown): boolean {
	if (value === undefined || value === null) return true;
	if (!isObjectRecord(value)) return false;
	const typedLifecycleFields = lifecycleFields.every(
		(field) => value[field] === undefined || typeof value[field] === "string",
	);
	return (
		typedLifecycleFields && isOptionalStringOrNull(value.unobservedHorizon)
	);
}

function hasKnownLayerAndStatus(value: Record<string, unknown>): boolean {
	return (
		typeof value.layer === "string" &&
		readyAssuranceLayers.has(value.layer) &&
		typeof value.status === "string" &&
		readyAssuranceStatuses.has(value.status)
	);
}

function hasValidOptionalFields(value: Record<string, unknown>): boolean {
	return (
		(value.evidence === undefined || isStringArray(value.evidence)) &&
		isOptionalStringOrNull(value.reason) &&
		isOptionalStringOrNull(value.followUp) &&
		hasOptionalThresholdShape(value.threshold) &&
		hasOptionalLifecycleStateShape(value.lifecycleState)
	);
}

function isHarnessAssuranceEntryRecord(
	value: unknown,
): value is HarnessAssuranceEntry {
	if (!isObjectRecord(value)) return false;
	return hasKnownLayerAndStatus(value) && hasValidOptionalFields(value);
}

function hasReadyAssuranceStatuses(
	entries: readonly HarnessAssuranceEntry[],
): boolean {
	return entries.every((entry) =>
		readyAssuranceAcceptedStatuses.has(entry.status),
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
