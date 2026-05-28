import {
	type ToolExposureClassCounts,
	type RuntimeCardToolExposureProjection,
	TOOL_EXPOSURE_BLOCKED_REASONS,
	TOOL_EXPOSURE_CLASS_NAMES,
	TOOL_EXPOSURE_EVIDENCE_USES,
	TOOL_EXPOSURE_KEY_TOOL_NAME_LIMIT,
	TOOL_EXPOSURE_NETWORK_ACCESS,
	TOOL_EXPOSURE_PERMISSION_KINDS,
	TOOL_EXPOSURE_SCHEMA_VERSION,
	type ToolExposureSnapshot,
	type ToolExposureValidationError,
	type ToolExposureValidationResult,
} from "./types.js";

const SAFE_POINTER_PATTERN = /^[A-Za-z0-9#][A-Za-z0-9._:/#@+-]{0,511}$/;
const ISO_TIMESTAMP_PATTERN =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

const FORBIDDEN_KEYS = new Set([
	"arguments",
	"command",
	"commandLine",
	"payload",
	"rawPayload",
	"rawToolCall",
	"rawToolResult",
	"stderr",
	"stdin",
	"stdout",
	"transcript",
	"writableRoots",
]);

const SECRET_ASSIGNMENT_PATTERN =
	/(password|secret|token|credential|api[-_ ]?key)\s*[:=]/i;
const STANDALONE_SECRET_PATTERN = /^(password|secret|token|api[-_]?key)$/i;
const RAW_PAYLOAD_OR_COMMAND_FRAGMENT_PATTERN =
	/(sk-[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\{\s*"schemaVersion"|\s--?\w+|[;&|]\s*\w+)/i;

const COUNT_KEYS: (keyof ToolExposureClassCounts)[] = [
	"visible",
	"deferred",
	"hidden",
	"unavailable",
	"notAttempted",
	"claimFailed",
];

function addError(
	errors: ToolExposureValidationError[],
	code: string,
	path: string,
): void {
	errors.push({ code, path, severity: "error" });
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateObject(
	value: unknown,
	path: string,
	errors: ToolExposureValidationError[],
): value is Record<string, unknown> {
	if (!isRecord(value)) {
		addError(errors, `${path} must be an object`, path);
		return false;
	}
	return true;
}

function validateAllowedKeys(
	value: Record<string, unknown>,
	allowed: readonly string[],
	path: string,
	errors: ToolExposureValidationError[],
): void {
	const allowedSet = new Set(allowed);
	for (const key of Object.keys(value)) {
		if (FORBIDDEN_KEYS.has(key)) {
			addError(
				errors,
				`${path}.${key} must not contain raw tool data`,
				`${path}.${key}`,
			);
			continue;
		}
		if (!allowedSet.has(key)) {
			addError(
				errors,
				`${path}.${key} is not part of tool-exposure-snapshot/v1`,
				`${path}.${key}`,
			);
		}
	}
}

function validateLiteral(
	value: unknown,
	expected: string,
	path: string,
	errors: ToolExposureValidationError[],
): void {
	if (value !== expected) addError(errors, `${path} must be ${expected}`, path);
}

function validateEnum<T extends string>(
	value: unknown,
	allowed: readonly T[],
	path: string,
	errors: ToolExposureValidationError[],
): value is T {
	if (!allowed.includes(value as T)) {
		addError(errors, `${path} must be one of ${allowed.join(", ")}`, path);
		return false;
	}
	return true;
}

function validateNonNegativeInteger(
	value: unknown,
	path: string,
	errors: ToolExposureValidationError[],
): value is number {
	if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
		addError(errors, `${path} must be a non-negative integer`, path);
		return false;
	}
	return true;
}

function validateSafeString(
	value: unknown,
	path: string,
	errors: ToolExposureValidationError[],
): value is string {
	if (typeof value !== "string" || value.trim().length === 0) {
		addError(errors, `${path} must be a non-empty string`, path);
		return false;
	}
	if (!SAFE_POINTER_PATTERN.test(value)) {
		addError(
			errors,
			`${path} must be a compact pointer without raw paths or command text`,
			path,
		);
	}
	if (value.includes("/") && !value.includes("://")) {
		addError(errors, `${path} must not contain filesystem-like paths`, path);
	}
	if (
		SECRET_ASSIGNMENT_PATTERN.test(value) ||
		STANDALONE_SECRET_PATTERN.test(value) ||
		RAW_PAYLOAD_OR_COMMAND_FRAGMENT_PATTERN.test(value)
	) {
		addError(
			errors,
			`${path} must not contain secrets, raw payloads, or command fragments`,
			path,
		);
	}
	return true;
}

function validateTruncationState(
	keyToolNamesLength: number,
	originalKeyToolNameCount: unknown,
	namesTruncated: unknown,
	path: string,
	errors: ToolExposureValidationError[],
): void {
	if (
		typeof originalKeyToolNameCount !== "number" ||
		!Number.isInteger(originalKeyToolNameCount) ||
		originalKeyToolNameCount < 0 ||
		typeof namesTruncated !== "boolean"
	) {
		return;
	}
	if (originalKeyToolNameCount < keyToolNamesLength) {
		addError(
			errors,
			`${path}.originalKeyToolNameCount must be greater than or equal to projected keyToolNames length`,
			`${path}.originalKeyToolNameCount`,
		);
	}
	const expectedTruncated = originalKeyToolNameCount > keyToolNamesLength;
	if (namesTruncated !== expectedTruncated) {
		addError(
			errors,
			`${path}.namesTruncated must match whether originalKeyToolNameCount exceeds projected keyToolNames length`,
			`${path}.namesTruncated`,
		);
	}
}

function validateNullableSafeString(
	value: unknown,
	path: string,
	errors: ToolExposureValidationError[],
): value is string | null {
	if (value === null) return true;
	return validateSafeString(value, path, errors);
}

function validateTimestamp(
	value: unknown,
	path: string,
	errors: ToolExposureValidationError[],
): void {
	if (typeof value !== "string" || !ISO_TIMESTAMP_PATTERN.test(value)) {
		addError(errors, `${path} must be an ISO timestamp ending in Z`, path);
	}
}

function validateCounts(
	value: unknown,
	path: string,
	errors: ToolExposureValidationError[],
): ToolExposureClassCounts | null {
	if (!validateObject(value, path, errors)) return null;
	validateAllowedKeys(value, COUNT_KEYS, path, errors);
	const counts = {} as ToolExposureClassCounts;
	for (const key of COUNT_KEYS) {
		if (validateNonNegativeInteger(value[key], `${path}.${key}`, errors)) {
			counts[key] = value[key] as number;
		}
	}
	return counts;
}

function sumCounts(counts: ToolExposureClassCounts): number {
	return COUNT_KEYS.reduce((total, key) => total + counts[key], 0);
}

function validateKeyToolNames(
	value: unknown,
	path: string,
	errors: ToolExposureValidationError[],
): string[] {
	if (!Array.isArray(value)) {
		addError(errors, `${path} must be an array`, path);
		return [];
	}
	if (value.length > TOOL_EXPOSURE_KEY_TOOL_NAME_LIMIT) {
		addError(
			errors,
			`${path} must contain at most ${TOOL_EXPOSURE_KEY_TOOL_NAME_LIMIT} entries`,
			path,
		);
	}
	const names: string[] = [];
	for (const [index, entry] of value.entries()) {
		if (validateSafeString(entry, `${path}.${String(index)}`, errors)) {
			names.push(entry);
		}
	}
	return names;
}

function validateToolClasses(
	value: unknown,
	errors: ToolExposureValidationError[],
): {
	counts: ToolExposureClassCounts;
	keyNames: string[];
	originalKeyNameCount: number;
	namesTruncated: boolean;
} {
	const totals: ToolExposureClassCounts = {
		visible: 0,
		deferred: 0,
		hidden: 0,
		unavailable: 0,
		notAttempted: 0,
		claimFailed: 0,
	};
	const keyNames: string[] = [];
	let originalKeyNameCount = 0;
	let namesTruncated = false;
	if (!Array.isArray(value)) {
		addError(errors, "toolClasses must be an array", "toolClasses");
		return { counts: totals, keyNames, originalKeyNameCount, namesTruncated };
	}
	for (const [index, entry] of value.entries()) {
		const path = `toolClasses.${String(index)}`;
		if (!validateObject(entry, path, errors)) continue;
		validateAllowedKeys(
			entry,
			[
				"className",
				"statusCounts",
				"keyToolNames",
				"originalKeyToolNameCount",
				"namesTruncated",
				"failureClass",
			],
			path,
			errors,
		);
		validateEnum(
			entry.className,
			TOOL_EXPOSURE_CLASS_NAMES,
			`${path}.className`,
			errors,
		);
		const counts = validateCounts(
			entry.statusCounts,
			`${path}.statusCounts`,
			errors,
		);
		const names = validateKeyToolNames(
			entry.keyToolNames,
			`${path}.keyToolNames`,
			errors,
		);
		if (
			validateNonNegativeInteger(
				entry.originalKeyToolNameCount,
				`${path}.originalKeyToolNameCount`,
				errors,
			)
		) {
			originalKeyNameCount += entry.originalKeyToolNameCount as number;
		}
		if (typeof entry.namesTruncated !== "boolean") {
			addError(
				errors,
				`${path}.namesTruncated must be a boolean`,
				`${path}.namesTruncated`,
			);
		} else if (entry.namesTruncated) {
			namesTruncated = true;
		}
		validateTruncationState(
			names.length,
			entry.originalKeyToolNameCount,
			entry.namesTruncated,
			path,
			errors,
		);
		validateNullableSafeString(
			entry.failureClass,
			`${path}.failureClass`,
			errors,
		);
		if (counts) {
			for (const key of COUNT_KEYS) totals[key] += counts[key];
			if (
				counts.unavailable + counts.notAttempted + counts.claimFailed > 0 &&
				entry.failureClass === null
			) {
				addError(
					errors,
					`${path}.failureClass is required for unavailable, not-attempted, or claim-failed tools`,
					`${path}.failureClass`,
				);
			}
		}
		keyNames.push(...names);
	}
	if (keyNames.length > TOOL_EXPOSURE_KEY_TOOL_NAME_LIMIT) {
		addError(
			errors,
			`toolClasses keyToolNames must project at most ${TOOL_EXPOSURE_KEY_TOOL_NAME_LIMIT} names in total`,
			"toolClasses",
		);
	}
	return { counts: totals, keyNames, originalKeyNameCount, namesTruncated };
}

function validateBlockedPermissionAttempts(
	value: unknown,
	errors: ToolExposureValidationError[],
): void {
	if (!Array.isArray(value)) {
		addError(
			errors,
			"blockedPermissionAttempts must be an array",
			"blockedPermissionAttempts",
		);
		return;
	}
	for (const [index, entry] of value.entries()) {
		const path = `blockedPermissionAttempts.${String(index)}`;
		if (!validateObject(entry, path, errors)) continue;
		validateAllowedKeys(
			entry,
			["attemptId", "permissionKind", "reason", "evidenceRef", "failureClass"],
			path,
			errors,
		);
		validateSafeString(entry.attemptId, `${path}.attemptId`, errors);
		validateEnum(
			entry.permissionKind,
			TOOL_EXPOSURE_PERMISSION_KINDS,
			`${path}.permissionKind`,
			errors,
		);
		validateEnum(
			entry.reason,
			TOOL_EXPOSURE_BLOCKED_REASONS,
			`${path}.reason`,
			errors,
		);
		validateSafeString(entry.evidenceRef, `${path}.evidenceRef`, errors);
		validateSafeString(entry.failureClass, `${path}.failureClass`, errors);
	}
}

function validateSummaryClassCounts(
	value: Record<string, unknown>,
	classTotals: ToolExposureClassCounts,
	errors: ToolExposureValidationError[],
): void {
	for (const key of COUNT_KEYS) {
		if (
			validateNonNegativeInteger(value[key], `summary.${key}`, errors) &&
			value[key] !== classTotals[key]
		) {
			addError(
				errors,
				`summary.${key} must match toolClasses totals`,
				`summary.${key}`,
			);
		}
	}
}

function validateSummaryCollectionCounts(
	value: Record<string, unknown>,
	snapshot: Record<string, unknown>,
	errors: ToolExposureValidationError[],
): void {
	if (
		validateNonNegativeInteger(
			value.totalToolClassCount,
			"summary.totalToolClassCount",
			errors,
		) &&
		Array.isArray(snapshot.toolClasses) &&
		value.totalToolClassCount !== snapshot.toolClasses.length
	) {
		addError(
			errors,
			"summary.totalToolClassCount must match toolClasses length",
			"summary.totalToolClassCount",
		);
	}
	if (
		validateNonNegativeInteger(
			value.blockedPermissionAttemptCount,
			"summary.blockedPermissionAttemptCount",
			errors,
		) &&
		Array.isArray(snapshot.blockedPermissionAttempts) &&
		value.blockedPermissionAttemptCount !==
			snapshot.blockedPermissionAttempts.length
	) {
		addError(
			errors,
			"summary.blockedPermissionAttemptCount must match blockedPermissionAttempts length",
			"summary.blockedPermissionAttemptCount",
		);
	}
	if (
		validateNonNegativeInteger(
			value.writableRootCount,
			"summary.writableRootCount",
			errors,
		) &&
		value.writableRootCount !== snapshot.writableRootCount
	) {
		addError(
			errors,
			"summary.writableRootCount must match writableRootCount",
			"summary.writableRootCount",
		);
	}
}

function validateSummaryKeyNames(
	value: Record<string, unknown>,
	classTotals: ToolExposureClassCounts,
	keyNameCount: number,
	originalKeyNameCount: number,
	namesTruncated: boolean,
	errors: ToolExposureValidationError[],
): void {
	if (
		validateNonNegativeInteger(
			value.keyToolNameCount,
			"summary.keyToolNameCount",
			errors,
		) &&
		value.keyToolNameCount !== keyNameCount
	) {
		addError(
			errors,
			"summary.keyToolNameCount must match projected keyToolNames length",
			"summary.keyToolNameCount",
		);
	}
	if (
		validateNonNegativeInteger(
			value.originalKeyToolNameCount,
			"summary.originalKeyToolNameCount",
			errors,
		) &&
		value.originalKeyToolNameCount !== originalKeyNameCount
	) {
		addError(
			errors,
			"summary.originalKeyToolNameCount must match class originalKeyToolNameCount total",
			"summary.originalKeyToolNameCount",
		);
	}
	if (typeof value.namesTruncated !== "boolean") {
		addError(
			errors,
			"summary.namesTruncated must be a boolean",
			"summary.namesTruncated",
		);
	} else if (value.namesTruncated !== namesTruncated) {
		addError(
			errors,
			"summary.namesTruncated must match class truncation state",
			"summary.namesTruncated",
		);
	}
	if (sumCounts(classTotals) === 0 && keyNameCount > 0) {
		addError(
			errors,
			"summary keyToolNameCount cannot be positive when all tool counts are zero",
			"summary.keyToolNameCount",
		);
	}
	validateTruncationState(
		keyNameCount,
		value.originalKeyToolNameCount,
		value.namesTruncated,
		"summary",
		errors,
	);
}

function validateSummary(
	value: unknown,
	snapshot: Record<string, unknown>,
	classTotals: ToolExposureClassCounts,
	keyNameCount: number,
	originalKeyNameCount: number,
	namesTruncated: boolean,
	errors: ToolExposureValidationError[],
): void {
	if (!validateObject(value, "summary", errors)) return;
	validateAllowedKeys(
		value,
		[
			"totalToolClassCount",
			"visible",
			"deferred",
			"hidden",
			"unavailable",
			"notAttempted",
			"claimFailed",
			"blockedPermissionAttemptCount",
			"writableRootCount",
			"keyToolNameCount",
			"originalKeyToolNameCount",
			"namesTruncated",
		],
		"summary",
		errors,
	);
	validateSummaryClassCounts(value, classTotals, errors);
	validateSummaryCollectionCounts(value, snapshot, errors);
	validateSummaryKeyNames(
		value,
		classTotals,
		keyNameCount,
		originalKeyNameCount,
		namesTruncated,
		errors,
	);
}

/** Validates a full tool exposure snapshot before it can enter runtime evidence. */
export function validateToolExposureSnapshot(
	value: unknown,
): ToolExposureValidationResult {
	const errors: ToolExposureValidationError[] = [];
	if (!validateObject(value, "toolExposure", errors)) {
		return { valid: false, errors };
	}
	validateAllowedKeys(
		value,
		[
			"schemaVersion",
			"generatedAt",
			"producer",
			"runtimeStatus",
			"evidenceUse",
			"evidenceRef",
			"sandboxMode",
			"approvalPolicy",
			"networkAccess",
			"writableRootCount",
			"toolClasses",
			"blockedPermissionAttempts",
			"summary",
			"blockedBy",
		],
		"toolExposure",
		errors,
	);
	validateLiteral(
		value.schemaVersion,
		TOOL_EXPOSURE_SCHEMA_VERSION,
		"schemaVersion",
		errors,
	);
	validateTimestamp(value.generatedAt, "generatedAt", errors);
	validateSafeString(value.producer, "producer", errors);
	validateLiteral(
		value.runtimeStatus,
		"not_yet_emitted",
		"runtimeStatus",
		errors,
	);
	validateEnum(
		value.evidenceUse,
		TOOL_EXPOSURE_EVIDENCE_USES,
		"evidenceUse",
		errors,
	);
	validateSafeString(value.evidenceRef, "evidenceRef", errors);
	validateSafeString(value.sandboxMode, "sandboxMode", errors);
	validateSafeString(value.approvalPolicy, "approvalPolicy", errors);
	validateEnum(
		value.networkAccess,
		TOOL_EXPOSURE_NETWORK_ACCESS,
		"networkAccess",
		errors,
	);
	validateNonNegativeInteger(
		value.writableRootCount,
		"writableRootCount",
		errors,
	);
	const projection = validateToolClasses(value.toolClasses, errors);
	validateBlockedPermissionAttempts(value.blockedPermissionAttempts, errors);
	validateSummary(
		value.summary,
		value,
		projection.counts,
		projection.keyNames.length,
		projection.originalKeyNameCount,
		projection.namesTruncated,
		errors,
	);
	validateSafeString(value.blockedBy, "blockedBy", errors);
	return { valid: errors.length === 0, errors };
}

/** Returns a typed tool exposure snapshot or throws with compact validation failures. */
export function asToolExposureSnapshot(value: unknown): ToolExposureSnapshot {
	const validation = validateToolExposureSnapshot(value);
	if (!validation.valid) {
		throw new Error(
			`tool exposure snapshot failed validation: ${validation.errors
				.map((error) => error.code)
				.join("; ")}`,
		);
	}
	return value as ToolExposureSnapshot;
}

/** Validates the compact runtime-card projection derived from a tool exposure snapshot. */
export function validateRuntimeCardToolExposureProjection(
	value: unknown,
	path: string,
): ToolExposureValidationError[] {
	const errors: ToolExposureValidationError[] = [];
	if (!validateObject(value, path, errors)) return errors;
	validateAllowedKeys(
		value,
		[
			"evidenceRef",
			"evidenceUse",
			"sandboxMode",
			"approvalPolicy",
			"networkAccess",
			"visibleToolCount",
			"deferredToolCount",
			"hiddenToolCount",
			"unavailableToolCount",
			"notAttemptedToolCount",
			"claimFailedToolCount",
			"blockedPermissionAttemptCount",
			"writableRootCount",
			"keyToolNames",
			"originalKeyToolNameCount",
			"namesTruncated",
		],
		path,
		errors,
	);
	validateSafeString(value.evidenceRef, `${path}.evidenceRef`, errors);
	validateEnum(
		value.evidenceUse,
		TOOL_EXPOSURE_EVIDENCE_USES,
		`${path}.evidenceUse`,
		errors,
	);
	validateSafeString(value.sandboxMode, `${path}.sandboxMode`, errors);
	validateSafeString(value.approvalPolicy, `${path}.approvalPolicy`, errors);
	validateEnum(
		value.networkAccess,
		TOOL_EXPOSURE_NETWORK_ACCESS,
		`${path}.networkAccess`,
		errors,
	);
	for (const key of [
		"visibleToolCount",
		"deferredToolCount",
		"hiddenToolCount",
		"unavailableToolCount",
		"notAttemptedToolCount",
		"claimFailedToolCount",
		"blockedPermissionAttemptCount",
		"writableRootCount",
		"originalKeyToolNameCount",
	] as const satisfies readonly (keyof RuntimeCardToolExposureProjection)[]) {
		validateNonNegativeInteger(value[key], `${path}.${key}`, errors);
	}
	validateKeyToolNames(value.keyToolNames, `${path}.keyToolNames`, errors);
	if (Array.isArray(value.keyToolNames)) {
		validateTruncationState(
			value.keyToolNames.length,
			value.originalKeyToolNameCount,
			value.namesTruncated,
			path,
			errors,
		);
	}
	if (typeof value.namesTruncated !== "boolean") {
		addError(
			errors,
			`${path}.namesTruncated must be a boolean`,
			`${path}.namesTruncated`,
		);
	}
	return errors;
}
