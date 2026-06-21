import {
	PROMPT_CONTEXT_DRIFT_BLOCKER_CLASSES,
	PROMPT_CONTEXT_DRIFT_NEXT_ACTION_CLASSES,
	type PromptContextDriftValidationResult,
} from "./prompt-context-drift-types.js";

const RAW_OR_SECRET_VALUE =
	/(sk-[A-Za-z0-9_-]{20,}|gh[opsru]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|Bearer\s+[A-Za-z0-9._~+/-]{20,}=*|BEGIN PRIVATE KEY|(?:token|secret|password|credential)=|raw prompt|full transcript|command output)/iu;
const RAW_OR_SECRET_KEY =
	/(raw|promptText|transcript|commandOutput|toolPayload|payload|screenshot|image|secret|token|password|credential|apiKey|privateKey)/iu;
const MAX_RAW_CONTENT_SCAN_DEPTH = 32;
const MAX_RAW_CONTENT_SCAN_NODES = 5_000;
const SAFE_REPO_REF = /^[^\r\n\0]{1,512}$/u;
const RFC3339 =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

interface RawContentScanEntry {
	value: unknown;
	path: string;
	depth: number;
}
const POINTER = /^[A-Za-z0-9][A-Za-z0-9:._/@#?=&+,-]{0,255}$/u;
const HEAD_SHA = /^[0-9a-f]{40}$/u;
const BLOCKER_KEYS = new Set(["blockerClass", "reason", "nextActionClass"]);
/** Validate blocker records in a prompt-context drift report. */
export function validateBlockers(
	blockers: unknown,
	path: string,
	errors: string[],
): void {
	if (!Array.isArray(blockers)) {
		errors.push(`${path}: must be an array`);
		return;
	}
	blockers.forEach((blocker, index) => {
		validateBlocker(blocker, `${path}[${index}]`, errors);
	});
}

function validateBlocker(
	blocker: unknown,
	path: string,
	errors: string[],
): void {
	if (!isRecord(blocker)) {
		errors.push(`${path}: must be an object`);
		return;
	}
	validateKnownKeys(blocker, BLOCKER_KEYS, path, errors);
	requireFields(blocker, BLOCKER_KEYS, path, errors);
	validateEnum(
		blocker.blockerClass,
		PROMPT_CONTEXT_DRIFT_BLOCKER_CLASSES,
		`${path}.blockerClass`,
		errors,
	);
	validateText(blocker.reason, `${path}.reason`, errors, 512);
	validateEnum(
		blocker.nextActionClass,
		PROMPT_CONTEXT_DRIFT_NEXT_ACTION_CLASSES,
		`${path}.nextActionClass`,
		errors,
	);
}

/** Reject raw prompts, transcripts, command output, and secret-like values. */
export function validateNoRawOrSecretContent(
	value: unknown,
	path: string,
	errors: string[],
): void {
	const pending: RawContentScanEntry[] = [{ value, path, depth: 0 }];
	let visited = 0;
	while (pending.length > 0) {
		visited += 1;
		if (visited > MAX_RAW_CONTENT_SCAN_NODES) {
			errors.push(`${path}: exceeds maximum validation node count`);
			return;
		}
		const current = pending.pop();
		if (!current) return;
		validateRawContentScanEntry(current, pending, errors);
	}
}

function validateRawContentScanEntry(
	current: RawContentScanEntry,
	pending: RawContentScanEntry[],
	errors: string[],
): void {
	if (current.depth > MAX_RAW_CONTENT_SCAN_DEPTH) {
		errors.push(`${current.path}: exceeds maximum validation depth`);
		return;
	}
	if (Array.isArray(current.value)) {
		current.value.forEach((entry, index) => {
			pending.push({
				value: entry,
				path: `${current.path}[${index}]`,
				depth: current.depth + 1,
			});
		});
		return;
	}
	if (!isRecord(current.value)) {
		if (
			typeof current.value === "string" &&
			RAW_OR_SECRET_VALUE.test(current.value)
		) {
			errors.push(`${current.path}: contains raw or secret-like content`);
		}
		return;
	}
	for (const [key, child] of Object.entries(current.value)) {
		const childPath = `${current.path}.${key}`;
		if (RAW_OR_SECRET_KEY.test(key)) {
			errors.push(`${childPath}: raw or secret-like field is forbidden`);
		}
		pending.push({
			value: child,
			path: childPath,
			depth: current.depth + 1,
		});
	}
}

/** Reject object keys outside the allowed schema key set. */
export function validateKnownKeys(
	value: Record<string, unknown>,
	allowed: Set<string>,
	path: string,
	errors: string[],
): void {
	Object.keys(value).forEach((key) => {
		if (!allowed.has(key)) errors.push(`${path}.${key}: unknown field`);
	});
}

/** Require a fixed schema key set to be present on an object. */
export function requireFields(
	value: Record<string, unknown>,
	required: Set<string>,
	path: string,
	errors: string[],
): void {
	for (const key of required) {
		if (!(key in value)) errors.push(`${path}.${key}: is required`);
	}
}

/** Validate a string enum member against the canonical allowed values. */
export function validateEnum<T extends readonly string[]>(
	value: unknown,
	allowed: T,
	path: string,
	errors: string[],
): void {
	if (!allowed.includes(String(value)))
		errors.push(`${path}: invalid enum value`);
}

/** Validate an RFC3339 timestamp string. */
export function validateTimestamp(
	value: unknown,
	path: string,
	errors: string[],
): void {
	if (typeof value !== "string" || !RFC3339.test(value))
		errors.push(`${path}: must be RFC3339 date-time`);
}

/** Validate a nullable lowercase Git HEAD SHA. */
export function validateNullableHead(
	value: unknown,
	path: string,
	errors: string[],
): void {
	if (value !== null && !HEAD_SHA.test(String(value)))
		errors.push(`${path}: must be null or 40-character lowercase git SHA`);
}

/** Validate a bounded machine-readable pointer string. */
export function validatePointer(
	value: unknown,
	path: string,
	errors: string[],
	maxLength = 256,
): void {
	if (
		typeof value !== "string" ||
		value.length > maxLength ||
		!POINTER.test(value)
	) {
		errors.push(`${path}: must be a safe pointer`);
	}
}

/** Validate bounded single-line text. */
export function validateText(
	value: unknown,
	path: string,
	errors: string[],
	maxLength: number,
): void {
	if (
		typeof value !== "string" ||
		value.length === 0 ||
		value.length > maxLength ||
		/[\r\n]/u.test(value)
	) {
		errors.push(`${path}: must be bounded single-line text`);
	}
}

/** Validate a bounded repo-relative evidence reference. */
export function validateRepoRef(
	value: unknown,
	path: string,
	errors: string[],
): void {
	if (typeof value !== "string" || !SAFE_REPO_REF.test(value)) {
		errors.push(`${path}: must be a safe repo-relative ref`);
		return;
	}
	if (unsafeRepoRef(value)) errors.push(`${path}: unsafe ref path`);
}

function unsafeRepoRef(value: string): boolean {
	return (
		value.trim().length === 0 ||
		value.includes("/./") ||
		value.endsWith("/.") ||
		value.split("/").some((segment) => segment.length === 0) ||
		value.includes("..") ||
		value.startsWith("/") ||
		value.startsWith("~") ||
		value.includes("://")
	);
}

/** Validate a boolean field. */
export function validateBoolean(
	value: unknown,
	path: string,
	errors: string[],
): void {
	if (typeof value !== "boolean") errors.push(`${path}: must be boolean`);
}

/** Push a validation error and return false for expression-oriented guards. */
export function fail(errors: string[], message: string): false {
	errors.push(message);
	return false;
}

/** Push a validation error and return null for nullable guard helpers. */
export function failNull(errors: string[], message: string): null {
	errors.push(message);
	return null;
}

/** Convert collected validation errors into the report validation result shape. */
export function result(errors: string[]): PromptContextDriftValidationResult {
	return { status: errors.length === 0 ? "pass" : "fail", errors };
}

/** Narrow unknown JSON values to plain object records. */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
