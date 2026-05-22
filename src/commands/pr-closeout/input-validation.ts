import {
	HARNESS_ASSURANCE_LAYERS,
	type HarnessAssuranceEntry,
	type HarnessAssuranceStatus,
	validateHarnessAssuranceEntries,
} from "../../lib/harness-assurance.js";
import {
	RUNTIME_EVIDENCE_CONTRACT_SCHEMA_VERSION,
	type RuntimeEvidenceContract,
	validateRuntimeEvidenceContract,
} from "../../lib/runtime/runtime-evidence-contract.js";

const HARNESS_ASSURANCE_STATUSES = new Set<HarnessAssuranceStatus>([
	"pass",
	"partial",
	"blocked",
	"n.a.",
]);

/** Normalize and validate embedded assurance evidence before report building. */
export function normalizeAssuranceEntries(
	value: unknown,
	source: string,
): HarnessAssuranceEntry[] {
	const entries = extractAssuranceEntries(value);
	if (entries === null) {
		throw new Error(
			`${source} must be a seven-layer assurance matrix array or an object with an entries array`,
		);
	}
	for (const [index, entry] of entries.entries()) {
		assertAssuranceEntryShape(entry, `${source}.entries[${index}]`);
	}
	const normalized = entries as HarnessAssuranceEntry[];
	const validation = validateHarnessAssuranceEntries(normalized);
	if (!validation.valid) {
		throw new Error(
			`${source} must be a valid seven-layer assurance matrix: ${validation.findings.map((finding) => `${finding.layer}:${finding.blockerClass}`).join(", ")}`,
		);
	}
	return normalized;
}

/** Normalize and validate embedded runtime evidence before report building. */
export function normalizeRuntimeEvidenceContract(
	value: unknown,
	source: string,
): RuntimeEvidenceContract {
	assertRuntimeEvidenceContract(value, source);
	const validation = validateRuntimeEvidenceContract(value);
	if (!validation.valid) {
		throw new Error(
			`${source} must be a valid runtime-evidence-contract/v1 object: ${validation.findings.map((finding) => finding.code).join(", ")}`,
		);
	}
	return value;
}

function extractAssuranceEntries(value: unknown): unknown[] | null {
	if (Array.isArray(value)) return value;
	if (isRecord(value) && Array.isArray(value.entries)) return value.entries;
	return null;
}

function assertAssuranceEntryShape(value: unknown, source: string): void {
	if (!isRecord(value)) {
		throw new Error(`${source} must be a JSON object`);
	}
	if (!isAssuranceLayer(value.layer)) {
		throw new Error(`${source}.layer must be a canonical assurance layer`);
	}
	if (!isAssuranceStatus(value.status)) {
		throw new Error(`${source}.status must be a canonical assurance status`);
	}
	if (value.evidence !== undefined && !isStringArray(value.evidence)) {
		throw new Error(`${source}.evidence must be an array of strings`);
	}
	if (!isOptionalString(value.reason)) {
		throw new Error(`${source}.reason must be null or a string`);
	}
	if (!isOptionalString(value.followUp)) {
		throw new Error(`${source}.followUp must be null or a string`);
	}
	assertOptionalThreshold(value.threshold, `${source}.threshold`);
	assertOptionalLifecycleState(
		value.lifecycleState,
		`${source}.lifecycleState`,
	);
}

function assertRuntimeEvidenceContract(
	value: unknown,
	source: string,
): asserts value is RuntimeEvidenceContract {
	if (!isRecord(value)) {
		throw new Error(
			`${source} must be a runtime-evidence-contract/v1 JSON object`,
		);
	}
	if (value.schemaVersion !== RUNTIME_EVIDENCE_CONTRACT_SCHEMA_VERSION) {
		throw new Error(
			`${source}.schemaVersion must be runtime-evidence-contract/v1`,
		);
	}
	assertDeclaredIntent(value.declaredIntent, `${source}.declaredIntent`);
	assertResolvedState(value.resolvedState, `${source}.resolvedState`);
	assertVerifierResult(value.verifierResult, `${source}.verifierResult`);
	assertEvaluation(value.evaluation, `${source}.evaluation`);
	assertOutcomeMapping(value.outcomeMapping, `${source}.outcomeMapping`);
}

function assertDeclaredIntent(value: unknown, source: string): void {
	const record = requireRecord(value, source);
	if (typeof record.objective !== "string") {
		throw new Error(`${source}.objective must be a string`);
	}
	if (typeof record.requestedScope !== "string") {
		throw new Error(`${source}.requestedScope must be a string`);
	}
	if (!isStringArray(record.sourceRefs)) {
		throw new Error(`${source}.sourceRefs must be an array of strings`);
	}
}

function assertResolvedState(value: unknown, source: string): void {
	const record = requireRecord(value, source);
	if (typeof record.permissionProfile !== "string") {
		throw new Error(`${source}.permissionProfile must be a string`);
	}
	if (!isOptionalString(record.goalStatus)) {
		throw new Error(`${source}.goalStatus must be null or a string`);
	}
	if (!isOptionalString(record.serviceTier)) {
		throw new Error(`${source}.serviceTier must be null or a string`);
	}
	if (!isStringArray(record.pluginAttribution)) {
		throw new Error(`${source}.pluginAttribution must be an array of strings`);
	}
	if (record.runtimeProbe !== null && !isRecord(record.runtimeProbe)) {
		throw new Error(`${source}.runtimeProbe must be null or a JSON object`);
	}
}

function assertVerifierResult(value: unknown, source: string): void {
	const record = requireRecord(value, source);
	if (typeof record.status !== "string") {
		throw new Error(`${source}.status must be a string`);
	}
	if (typeof record.owner !== "string") {
		throw new Error(`${source}.owner must be a string`);
	}
	if (!isStringArray(record.evidenceRefs)) {
		throw new Error(`${source}.evidenceRefs must be an array of strings`);
	}
	if (typeof record.verifiedAt !== "string") {
		throw new Error(`${source}.verifiedAt must be a string`);
	}
	if (!isOptionalString(record.reason)) {
		throw new Error(`${source}.reason must be null or a string`);
	}
}

function assertEvaluation(value: unknown, source: string): void {
	const record = requireRecord(value, source);
	if (typeof record.portable !== "boolean") {
		throw new Error(`${source}.portable must be a boolean`);
	}
	if (!isOptionalString(record.command)) {
		throw new Error(`${source}.command must be null or a string`);
	}
	if (typeof record.status !== "string") {
		throw new Error(`${source}.status must be a string`);
	}
}

function assertOutcomeMapping(value: unknown, source: string): void {
	const record = requireRecord(value, source);
	if (typeof record.outcome !== "string") {
		throw new Error(`${source}.outcome must be a string`);
	}
	if (typeof record.exitClassification !== "string") {
		throw new Error(`${source}.exitClassification must be a string`);
	}
}

function assertOptionalThreshold(value: unknown, source: string): void {
	if (value === undefined || value === null) return;
	const record = requireRecord(value, source);
	for (const key of ["metric", "operator", "unit"] as const) {
		if (typeof record[key] !== "string") {
			throw new Error(`${source}.${key} must be a string`);
		}
	}
	if (typeof record.value !== "number") {
		throw new Error(`${source}.value must be a number`);
	}
	if (record.observed !== undefined && typeof record.observed !== "number") {
		throw new Error(`${source}.observed must be a number`);
	}
}

function assertOptionalLifecycleState(value: unknown, source: string): void {
	if (value === undefined || value === null) return;
	const record = requireRecord(value, source);
	for (const key of [
		"automationState",
		"branchWorktreeState",
		"linearState",
		"mergeState",
		"nextLaneRouting",
		"prState",
		"reviewThreadState",
	] as const) {
		if (record[key] !== undefined && typeof record[key] !== "string") {
			throw new Error(`${source}.${key} must be a string`);
		}
	}
	if (!isOptionalString(record.unobservedHorizon)) {
		throw new Error(`${source}.unobservedHorizon must be null or a string`);
	}
}

function requireRecord(
	value: unknown,
	source: string,
): Record<string, unknown> {
	if (!isRecord(value)) {
		throw new Error(`${source} must be a JSON object`);
	}
	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) && value.every((item) => typeof item === "string")
	);
}

function isOptionalString(value: unknown): boolean {
	return value === undefined || value === null || typeof value === "string";
}

function isAssuranceLayer(
	value: unknown,
): value is (typeof HARNESS_ASSURANCE_LAYERS)[number] {
	return (
		typeof value === "string" &&
		HARNESS_ASSURANCE_LAYERS.includes(
			value as (typeof HARNESS_ASSURANCE_LAYERS)[number],
		)
	);
}

function isAssuranceStatus(value: unknown): value is HarnessAssuranceStatus {
	return (
		typeof value === "string" &&
		HARNESS_ASSURANCE_STATUSES.has(value as HarnessAssuranceStatus)
	);
}
