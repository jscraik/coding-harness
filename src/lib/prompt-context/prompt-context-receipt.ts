export const PROMPT_CONTEXT_RECEIPT_SCHEMA_VERSION =
	"prompt-context-receipt/v1" as const;

export const PROMPT_CONTEXT_EVIDENCE_USES = [
	"orientation",
	"audit_trail",
] as const;

export const PROMPT_CONTEXT_FRESHNESS = [
	"current",
	"stale",
	"missing",
	"unknown",
	"not_applicable",
] as const;

export const PROMPT_CONTEXT_REDACTION_STATUSES = [
	"redacted",
	"not_applicable",
	"unknown",
	"blocked",
] as const;

export const PROMPT_CONTEXT_SOURCE_KINDS = [
	"system",
	"developer",
	"user",
	"agents",
	"skill",
	"plugin",
	"mcp",
	"goal",
	"environment",
	"permission",
	"extension",
	"unknown",
] as const;

export const PROMPT_CONTEXT_AUTHORITY_LAYERS = [
	"system_policy",
	"developer_policy",
	"repo_instruction",
	"trusted_skill",
	"plugin_metadata",
	"artifact_data",
	"review_feedback",
	"telemetry",
	"user_steering",
	"untrusted_external",
] as const;

export const PROMPT_CONTEXT_INSTRUCTION_AUTHORITY_LAYERS = [
	"system_policy",
	"developer_policy",
	"repo_instruction",
	"trusted_skill",
	"user_steering",
] as const;

const PROMPT_CONTEXT_INSTRUCTION_AUTHORITY_LAYER_SET = new Set<string>(
	PROMPT_CONTEXT_INSTRUCTION_AUTHORITY_LAYERS,
);

export const PROMPT_CONTEXT_STALE_CLASSIFICATIONS = [
	"current",
	"stale",
	"missing",
	"unknown",
] as const;

const MAX_CONTEXT_POINTER_LENGTH = 512;
const MAX_CONTEXT_HASH_LENGTH = 256;
const DISALLOWED_RAW_CONTEXT_KEYS = new Set([
	"rawPrompt",
	"promptText",
	"promptBody",
	"systemPrompt",
	"developerPrompt",
	"userPrompt",
	"transcript",
	"rawTranscript",
	"secret",
	"token",
	"apiKey",
	"password",
]);
const PROMPT_CONTEXT_RECEIPT_KEYS = new Set([
	"schemaVersion",
	"generatedAt",
	"producer",
	"runtimeStatus",
	"evidenceUse",
	"freshness",
	"redactionStatus",
	"instructionSources",
	"selectedSkills",
	"selectedPlugins",
	"selectedMcpServers",
	"permissionProfile",
	"goalContextRefs",
	"capabilitySurfaceRefs",
	"staleState",
	"blockedBy",
]);
const SOURCE_REF_KEYS = new Set([
	"ref",
	"sourceKind",
	"authorityLayer",
	"hash",
	"freshness",
	"redactionStatus",
]);
const PERMISSION_PROFILE_KEYS = new Set([
	"sandboxMode",
	"approvalPolicy",
	"networkAccess",
	"writableRoots",
]);
const STALE_STATE_KEYS = new Set(["sourceRef", "classification", "reason"]);
const RAW_OR_SENSITIVE_CONTEXT_PATTERNS = [
	/[\r\n]/u,
	/\{\s*"schemaVersion"/u,
	/\b(raw[-_ ]?prompt|system[-_ ]?prompt|developer[-_ ]?prompt|user[-_ ]?prompt|prompt[-_ ]?text|transcript|raw[-_ ]?events?)\b/iu,
	/\b(password|secret|token|credential|api[-_ ]?key)\s*[:=]/iu,
	/\bsk-[A-Za-z0-9_-]{16,}\b/u,
	/-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
] as const;

/** Allowed use of a prompt-context receipt: orientation or audit trail only. */
export type PromptContextEvidenceUse =
	(typeof PROMPT_CONTEXT_EVIDENCE_USES)[number];
/** Freshness classification for prompt-context source references. */
export type PromptContextFreshness = (typeof PROMPT_CONTEXT_FRESHNESS)[number];
/** Redaction classification for pointer-only prompt-context receipts. */
export type PromptContextRedactionStatus =
	(typeof PROMPT_CONTEXT_REDACTION_STATUSES)[number];
/** Source category for an instruction, capability, tool, or goal context ref. */
export type PromptContextSourceKind =
	(typeof PROMPT_CONTEXT_SOURCE_KINDS)[number];
/** Authority layer for deciding whether a source can steer agent behavior. */
export type PromptContextAuthorityLayer =
	(typeof PROMPT_CONTEXT_AUTHORITY_LAYERS)[number];
/** Staleness classification for context surfaces visible to the turn. */
export type PromptContextStaleClassification =
	(typeof PROMPT_CONTEXT_STALE_CLASSIFICATIONS)[number];

/** Pointer-only reference to a context source that influenced an agent turn. */
export interface PromptContextSourceRef {
	ref: string;
	sourceKind: PromptContextSourceKind;
	authorityLayer: PromptContextAuthorityLayer;
	hash: string | null;
	freshness: PromptContextFreshness;
	redactionStatus: PromptContextRedactionStatus;
}

/** Permission and sandbox posture observed for prompt-context orientation. */
export interface PromptContextPermissionProfile {
	sandboxMode: string;
	approvalPolicy: string;
	networkAccess: "enabled" | "restricted" | "disabled" | "unknown";
	writableRoots: string[];
}

/** Stale, missing, or unknown context state that cannot support delivery claims. */
export interface PromptContextStaleState {
	sourceRef: string;
	classification: PromptContextStaleClassification;
	reason: string;
}

/** Contract-only receipt for prompt, instruction, permission, and capability context. */
export interface PromptContextReceipt {
	schemaVersion: typeof PROMPT_CONTEXT_RECEIPT_SCHEMA_VERSION;
	generatedAt: string;
	producer: string;
	runtimeStatus: "not_yet_emitted";
	evidenceUse: PromptContextEvidenceUse;
	freshness: PromptContextFreshness;
	redactionStatus: PromptContextRedactionStatus;
	instructionSources: PromptContextSourceRef[];
	selectedSkills: PromptContextSourceRef[];
	selectedPlugins: PromptContextSourceRef[];
	selectedMcpServers: PromptContextSourceRef[];
	permissionProfile: PromptContextPermissionProfile;
	goalContextRefs: PromptContextSourceRef[];
	capabilitySurfaceRefs: PromptContextSourceRef[];
	staleState: PromptContextStaleState[];
	blockedBy: string;
}

/** Validation error emitted by the PromptContextReceipt contract validator. */
export interface PromptContextReceiptValidationError {
	code: string;
	path: string;
	severity: "error";
}

/** Validation result for PromptContextReceipt/v1 packets. */
export interface PromptContextReceiptValidationResult {
	valid: boolean;
	errors: PromptContextReceiptValidationError[];
}

/** Validate a PromptContextReceipt/v1 packet without promoting it to claim support. */
export function validatePromptContextReceipt(
	value: unknown,
): PromptContextReceiptValidationResult {
	const errors: PromptContextReceiptValidationError[] = [];
	validateNoRawContextFields(value, "receipt", errors);

	if (!isRecord(value)) {
		addPromptContextError(errors, "receipt must be an object", "receipt");
		return { valid: false, errors };
	}
	requireAllowedKeys(value, PROMPT_CONTEXT_RECEIPT_KEYS, "receipt", errors);

	requireLiteral(
		value.schemaVersion,
		PROMPT_CONTEXT_RECEIPT_SCHEMA_VERSION,
		"schemaVersion",
		errors,
	);
	requireIsoTimestamp(value.generatedAt, "generatedAt", errors);
	requireSafeContextPointer(value.producer, "producer", errors, {
		maxLength: 256,
	});
	requireLiteral(
		value.runtimeStatus,
		"not_yet_emitted",
		"runtimeStatus",
		errors,
	);
	requireEnum(
		value.evidenceUse,
		PROMPT_CONTEXT_EVIDENCE_USES,
		"evidenceUse",
		errors,
	);
	requireEnum(value.freshness, PROMPT_CONTEXT_FRESHNESS, "freshness", errors);
	requireEnum(
		value.redactionStatus,
		PROMPT_CONTEXT_REDACTION_STATUSES,
		"redactionStatus",
		errors,
	);
	requireSourceRefArray(
		value.instructionSources,
		"instructionSources",
		errors,
		{
			instructionAuthorityOnly: true,
		},
	);
	requireSourceRefArray(value.selectedSkills, "selectedSkills", errors);
	requireSourceRefArray(value.selectedPlugins, "selectedPlugins", errors);
	requireSourceRefArray(value.selectedMcpServers, "selectedMcpServers", errors);
	validatePermissionProfile(
		value.permissionProfile,
		"permissionProfile",
		errors,
	);
	requireSourceRefArray(value.goalContextRefs, "goalContextRefs", errors);
	requireSourceRefArray(
		value.capabilitySurfaceRefs,
		"capabilitySurfaceRefs",
		errors,
	);
	validateStaleStateArray(value.staleState, "staleState", errors);
	requireSafeContextPointer(value.blockedBy, "blockedBy", errors);

	return { valid: errors.length === 0, errors };
}

/** Return whether a scalar is safe to store as a prompt-context pointer. */
export function isSafePromptContextPointer(value: string): boolean {
	return (
		value.length <= MAX_CONTEXT_POINTER_LENGTH &&
		!RAW_OR_SENSITIVE_CONTEXT_PATTERNS.some((pattern) => pattern.test(value))
	);
}

function validateNoRawContextFields(
	value: unknown,
	path: string,
	errors: PromptContextReceiptValidationError[],
): void {
	if (Array.isArray(value)) {
		value.forEach((entry, index) => {
			validateNoRawContextFields(entry, `${path}[${index}]`, errors);
		});
		return;
	}
	if (!isRecord(value)) {
		return;
	}
	for (const [key, nestedValue] of Object.entries(value)) {
		const nestedPath = `${path}.${key}`;
		if (DISALLOWED_RAW_CONTEXT_KEYS.has(key)) {
			addPromptContextError(
				errors,
				`${key} is not allowed in prompt-context receipts`,
				nestedPath,
			);
		}
		validateNoRawContextFields(nestedValue, nestedPath, errors);
	}
}

function requireSourceRefArray(
	value: unknown,
	path: string,
	errors: PromptContextReceiptValidationError[],
	options: { instructionAuthorityOnly?: boolean } = {},
): void {
	if (!Array.isArray(value)) {
		addPromptContextError(errors, `${path} must be an array`, path);
		return;
	}
	value.forEach((entry, index) => {
		validateSourceRef(entry, `${path}[${index}]`, errors, options);
	});
}

function validateSourceRef(
	value: unknown,
	path: string,
	errors: PromptContextReceiptValidationError[],
	options: { instructionAuthorityOnly?: boolean } = {},
): void {
	if (!isRecord(value)) {
		addPromptContextError(errors, `${path} must be an object`, path);
		return;
	}
	requireAllowedKeys(value, SOURCE_REF_KEYS, path, errors);
	requireSafeContextPointer(value.ref, `${path}.ref`, errors);
	requireEnum(
		value.sourceKind,
		PROMPT_CONTEXT_SOURCE_KINDS,
		`${path}.sourceKind`,
		errors,
	);
	requireEnum(
		value.authorityLayer,
		PROMPT_CONTEXT_AUTHORITY_LAYERS,
		`${path}.authorityLayer`,
		errors,
	);
	if (
		options.instructionAuthorityOnly &&
		typeof value.authorityLayer === "string" &&
		!PROMPT_CONTEXT_INSTRUCTION_AUTHORITY_LAYER_SET.has(value.authorityLayer)
	) {
		addPromptContextError(
			errors,
			`${path}.authorityLayer must be instruction authority for instructionSources`,
			`${path}.authorityLayer`,
		);
	}
	requireNullableSafeContextPointer(value.hash, `${path}.hash`, errors, {
		maxLength: MAX_CONTEXT_HASH_LENGTH,
	});
	requireEnum(
		value.freshness,
		PROMPT_CONTEXT_FRESHNESS,
		`${path}.freshness`,
		errors,
	);
	requireEnum(
		value.redactionStatus,
		PROMPT_CONTEXT_REDACTION_STATUSES,
		`${path}.redactionStatus`,
		errors,
	);
}

function validatePermissionProfile(
	value: unknown,
	path: string,
	errors: PromptContextReceiptValidationError[],
): void {
	if (!isRecord(value)) {
		addPromptContextError(errors, `${path} must be an object`, path);
		return;
	}
	requireAllowedKeys(value, PERMISSION_PROFILE_KEYS, path, errors);
	requireSafeContextPointer(value.sandboxMode, `${path}.sandboxMode`, errors, {
		maxLength: 128,
	});
	requireSafeContextPointer(
		value.approvalPolicy,
		`${path}.approvalPolicy`,
		errors,
		{
			maxLength: 128,
		},
	);
	requireEnum(
		value.networkAccess,
		["enabled", "restricted", "disabled", "unknown"],
		`${path}.networkAccess`,
		errors,
	);
	if (!Array.isArray(value.writableRoots)) {
		addPromptContextError(
			errors,
			`${path}.writableRoots must be an array`,
			`${path}.writableRoots`,
		);
		return;
	}
	value.writableRoots.forEach((root, index) => {
		requireSafeContextPointer(root, `${path}.writableRoots[${index}]`, errors);
	});
}

function validateStaleStateArray(
	value: unknown,
	path: string,
	errors: PromptContextReceiptValidationError[],
): void {
	if (!Array.isArray(value)) {
		addPromptContextError(errors, `${path} must be an array`, path);
		return;
	}
	value.forEach((entry, index) => {
		const entryPath = `${path}[${index}]`;
		if (!isRecord(entry)) {
			addPromptContextError(
				errors,
				`${entryPath} must be an object`,
				entryPath,
			);
			return;
		}
		requireAllowedKeys(entry, STALE_STATE_KEYS, entryPath, errors);
		requireSafeContextPointer(
			entry.sourceRef,
			`${entryPath}.sourceRef`,
			errors,
		);
		requireEnum(
			entry.classification,
			PROMPT_CONTEXT_STALE_CLASSIFICATIONS,
			`${entryPath}.classification`,
			errors,
		);
		requireSafeContextPointer(entry.reason, `${entryPath}.reason`, errors);
	});
}

function requireAllowedKeys(
	value: Record<string, unknown>,
	allowed: ReadonlySet<string>,
	path: string,
	errors: PromptContextReceiptValidationError[],
): void {
	for (const key of Object.keys(value)) {
		if (!allowed.has(key)) {
			addPromptContextError(
				errors,
				`${path}.${key} is not allowed in prompt-context receipts`,
				`${path}.${key}`,
			);
		}
	}
}

function requireLiteral(
	value: unknown,
	expected: string,
	path: string,
	errors: PromptContextReceiptValidationError[],
): void {
	if (value !== expected) {
		addPromptContextError(errors, `${path} must be ${expected}`, path);
	}
}

function requireEnum<T extends readonly string[]>(
	value: unknown,
	allowed: T,
	path: string,
	errors: PromptContextReceiptValidationError[],
): void {
	if (typeof value !== "string" || !allowed.includes(value)) {
		addPromptContextError(
			errors,
			`${path} must be one of ${allowed.join(", ")}`,
			path,
		);
	}
}

function requireSafeContextPointer(
	value: unknown,
	path: string,
	errors: PromptContextReceiptValidationError[],
	options: { maxLength?: number } = {},
): void {
	if (typeof value !== "string" || value.trim() === "") {
		addPromptContextError(errors, `${path} must be a non-empty string`, path);
		return;
	}
	const maxLength = options.maxLength ?? MAX_CONTEXT_POINTER_LENGTH;
	if (value.length > maxLength || !isSafePromptContextPointer(value)) {
		addPromptContextError(
			errors,
			`${path} must be a compact safe context pointer`,
			path,
		);
	}
}

function requireNullableSafeContextPointer(
	value: unknown,
	path: string,
	errors: PromptContextReceiptValidationError[],
	options: { maxLength?: number } = {},
): void {
	if (value === null) {
		return;
	}
	requireSafeContextPointer(value, path, errors, options);
}

function requireIsoTimestamp(
	value: unknown,
	path: string,
	errors: PromptContextReceiptValidationError[],
): void {
	requireSafeContextPointer(value, path, errors, { maxLength: 64 });
	if (typeof value !== "string" || value.trim() === "") {
		return;
	}
	if (!isStrictIsoTimestamp(value)) {
		addPromptContextError(
			errors,
			`${path} must be an ISO-8601 timestamp`,
			path,
		);
	}
}

function isStrictIsoTimestamp(value: string): boolean {
	const match =
		/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u.exec(
			value,
		);
	if (!match) {
		return false;
	}

	const [, yearText, monthText, dayText, hourText, minuteText, secondText] =
		match;
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);
	const hour = Number(hourText);
	const minute = Number(minuteText);
	const second = Number(secondText);
	const utcDate = new Date(
		Date.UTC(year, month - 1, day, hour, minute, second),
	);

	return (
		utcDate.getUTCFullYear() === year &&
		utcDate.getUTCMonth() === month - 1 &&
		utcDate.getUTCDate() === day &&
		utcDate.getUTCHours() === hour &&
		utcDate.getUTCMinutes() === minute &&
		utcDate.getUTCSeconds() === second &&
		!Number.isNaN(Date.parse(value))
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addPromptContextError(
	errors: PromptContextReceiptValidationError[],
	code: string,
	path: string,
): void {
	errors.push({ code, path, severity: "error" });
}
