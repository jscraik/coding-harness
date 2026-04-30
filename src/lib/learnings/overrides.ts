import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GateFinding } from "../output/types.js";
import type { LearningFileMatch } from "./fuzzy-match.js";
import { redactSensitiveText } from "./sensitive-text.js";

/** Learning override schema version. */
export const LEARNING_OVERRIDE_SCHEMA_VERSION = "learning-override/v1";

/** Default repository path for learning overrides. */
export const DEFAULT_LEARNING_OVERRIDES_PATH =
	".harness/learnings/overrides.json";

/** Override expiry handling mode. */
export type LearningOverrideMode = "strict" | "advisory";

/** Audited suppression entry for one learning/path combination. */
export interface LearningSuppression {
	/** Learning ID to suppress. */
	learningId: string;
	/** Path pattern for the changed file affected by the suppression. */
	pathPattern: string;
	/** Human-readable reason. */
	reason: string;
	/** Owner accountable for revisiting the suppression. */
	owner: string;
	/** ISO date or datetime after which the suppression is expired. */
	expiresAt: string;
	/** Replacement action to follow instead of applying the learning literally. */
	replacementAction: string;
}

/** Parsed override file. */
export interface LearningOverrideFile {
	/** Override schema version. */
	schemaVersion: typeof LEARNING_OVERRIDE_SCHEMA_VERSION;
	/** Audited suppressions. */
	suppressions: LearningSuppression[];
}

/** Result of loading learning overrides. */
export type LearningOverrideLoadResult =
	| { ok: true; overrides: LearningOverrideFile; warnings: GateFinding[] }
	| { ok: false; findings: GateFinding[] };

/** Finding with optional override audit metadata. */
export type OverrideAwareGateFinding = GateFinding & {
	/** Override support and audit state for learning gates. */
	overrideSupport?: {
		suppressible: boolean;
		suppressed?: boolean;
		override?: {
			learningId: string;
			pathPattern: string;
			reason: string;
			owner: string;
			expiresAt: string;
			replacementAction: string;
		};
	};
	/** Learning/file match metadata for measurement. */
	match?: LearningFileMatch;
};

/**
 * Sanitize a diagnostic string derived from an override by redacting sensitive content.
 *
 * @param value - The original diagnostic text potentially containing sensitive data
 * @returns The input string with sensitive information redacted
 */
export function sanitizeLearningOverrideDiagnostic(value: string): string {
	return redactSensitiveText(value);
}

/**
 * Load and validate an optional learning overrides JSON file and return parsed suppressions or validation findings.
 *
 * @param options - Loader options.
 * @param options.path - Path to the overrides JSON file; if omitted or the file does not exist, an empty overrides set is returned.
 * @param options.repoRoot - Directory used to resolve `path`; defaults to the current working directory.
 * @param options.mode - Expiration handling mode; `"strict"` makes expired suppressions produce error findings, `"advisory"` makes them produce warnings. Defaults to `"strict"`.
 * @param options.now - Reference time used when evaluating `expiresAt`; defaults to the current time.
 * @returns A `LearningOverrideLoadResult`: `ok: true` with `overrides` and optional `warnings` for expired suppressions when parsing/validation succeeds, or `ok: false` with `findings` describing parse or schema validation errors.
 */
export function loadLearningOverrides(options: {
	path?: string;
	repoRoot?: string;
	mode?: LearningOverrideMode;
	now?: Date;
}): LearningOverrideLoadResult {
	const overridePath = options.path;
	if (!overridePath) {
		return {
			ok: true,
			overrides: {
				schemaVersion: LEARNING_OVERRIDE_SCHEMA_VERSION,
				suppressions: [],
			},
			warnings: [],
		};
	}
	const resolvedPath = resolve(options.repoRoot ?? process.cwd(), overridePath);
	if (!existsSync(resolvedPath)) {
		return {
			ok: true,
			overrides: {
				schemaVersion: LEARNING_OVERRIDE_SCHEMA_VERSION,
				suppressions: [],
			},
			warnings: [],
		};
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(resolvedPath, "utf-8"));
	} catch (error) {
		return {
			ok: false,
			findings: [
				overrideFileFinding(
					"learnings-gate.override.file_invalid_json",
					"error",
					`Learning override file is not valid JSON: ${sanitizeLearningOverrideDiagnostic(error instanceof Error ? error.message : String(error))}`,
				),
			],
		};
	}
	const validation = parseOverrideFile(parsed, options.now ?? new Date());
	if (validation.errors.length > 0) {
		return { ok: false, findings: validation.errors };
	}
	const mode = options.mode ?? "strict";
	const expiredFindings = validation.expired.map((suppression) =>
		expiredOverrideFinding(suppression, mode),
	);
	return {
		ok: true,
		overrides: {
			schemaVersion: LEARNING_OVERRIDE_SCHEMA_VERSION,
			suppressions: validation.suppressions,
		},
		warnings: expiredFindings,
	};
}

/**
 * Applies active learning suppressions to gate findings, replacing matched findings with audit findings that indicate suppression and attaching sanitized override metadata.
 *
 * @returns An array where findings matched by a non-expired suppression are replaced by an `info` audit finding describing the suppression (id follows `learnings-gate.override.suppressed.<learningId>`, `fix.manual` is set to the suppression's `replacementAction`, and `overrideSupport.override` contains sanitized override audit data); findings not matched remain unchanged except that each will have `overrideSupport.suppressible` set to indicate whether it was eligible for suppression.
 */
export function applyLearningOverrides(options: {
	findings: OverrideAwareGateFinding[];
	overrides: LearningOverrideFile;
	now?: Date;
}): OverrideAwareGateFinding[] {
	const now = options.now ?? new Date();
	const output: OverrideAwareGateFinding[] = [];
	for (const finding of options.findings) {
		const learningId = extractLearningId(finding.id);
		const suppressible = finding.fix.suppressible === true;
		finding.overrideSupport = { suppressible };
		if (!learningId || !suppressible || !finding.path) {
			output.push(finding);
			continue;
		}
		const suppression = options.overrides.suppressions.find(
			(candidate) =>
				candidate.learningId === learningId &&
				!isExpired(candidate, now) &&
				patternMatchesFile(candidate.pathPattern, finding.path ?? ""),
		);
		if (!suppression) {
			output.push(finding);
			continue;
		}
		const audit = buildOverrideAudit(suppression);
		output.push({
			id: `learnings-gate.override.suppressed.${learningId}`,
			severity: "info",
			gate: finding.gate,
			message: `Suppressed learning ${learningId}; replacement action: ${suppression.replacementAction}`,
			path: finding.path,
			baseline: false,
			fix: {
				manual: suppression.replacementAction,
				suppressible: false,
			},
			overrideSupport: {
				suppressible: false,
				suppressed: true,
				override: audit,
			},
		});
	}
	return output;
}

/**
 * Parses and validates a parsed overrides JSON object and extracts valid suppressions.
 *
 * @param value - The parsed JSON value of an overrides file to validate and parse
 * @param now - Reference time used to classify suppressions as expired
 * @returns An object containing `suppressions` (valid entries), `expired` (valid entries whose `expiresAt` is before `now`), and `errors` (schema or entry-level findings)
 */
function parseOverrideFile(
	value: unknown,
	now: Date,
): {
	suppressions: LearningSuppression[];
	expired: LearningSuppression[];
	errors: GateFinding[];
} {
	if (
		typeof value !== "object" ||
		value === null ||
		(value as { schemaVersion?: unknown }).schemaVersion !==
			LEARNING_OVERRIDE_SCHEMA_VERSION ||
		!Array.isArray((value as { suppressions?: unknown }).suppressions)
	) {
		return {
			suppressions: [],
			expired: [],
			errors: [
				overrideFileFinding(
					"learnings-gate.override.schema_invalid",
					"error",
					"Learning override file must use schemaVersion learning-override/v1 and a suppressions array.",
				),
			],
		};
	}
	const suppressions: LearningSuppression[] = [];
	const expired: LearningSuppression[] = [];
	const errors: GateFinding[] = [];
	for (const [index, item] of (
		value as { suppressions: unknown[] }
	).suppressions.entries()) {
		const parsed = parseSuppression(item, index);
		if (!parsed.ok) {
			errors.push(parsed.finding);
			continue;
		}
		suppressions.push(parsed.suppression);
		if (isExpired(parsed.suppression, now)) expired.push(parsed.suppression);
	}
	return { suppressions, expired, errors };
}

/**
 * Validate and parse a single suppression entry from the overrides file.
 *
 * @param value - The raw value to validate (an item from the parsed `suppressions` array)
 * @param index - The zero-based index of the entry in the `suppressions` array (used in generated finding IDs)
 * @returns `{ ok: true, suppression }` with a fully-typed `LearningSuppression` when the entry is valid; `{ ok: false, finding }` with a schema validation `GateFinding` describing the error otherwise.
 */
function parseSuppression(
	value: unknown,
	index: number,
):
	| { ok: true; suppression: LearningSuppression }
	| { ok: false; finding: GateFinding } {
	if (typeof value !== "object" || value === null) {
		return {
			ok: false,
			finding: overrideFileFinding(
				`learnings-gate.override.entry_invalid.${index}`,
				"error",
				`Learning override suppression ${index} must be an object.`,
			),
		};
	}
	const record = value as Record<string, unknown>;
	for (const key of [
		"learningId",
		"pathPattern",
		"reason",
		"owner",
		"expiresAt",
		"replacementAction",
	]) {
		if (typeof record[key] !== "string" || record[key].trim().length === 0) {
			return {
				ok: false,
				finding: overrideFileFinding(
					`learnings-gate.override.entry_invalid.${index}`,
					"error",
					`Learning override suppression ${index} is missing required field ${key}.`,
				),
			};
		}
	}
	const suppression: LearningSuppression = {
		learningId: record.learningId as string,
		pathPattern: record.pathPattern as string,
		reason: record.reason as string,
		owner: record.owner as string,
		expiresAt: record.expiresAt as string,
		replacementAction: record.replacementAction as string,
	};
	if (Number.isNaN(Date.parse(suppression.expiresAt))) {
		return {
			ok: false,
			finding: overrideFileFinding(
				`learnings-gate.override.entry_invalid.${index}`,
				"error",
				`Learning override suppression ${index} has invalid expiresAt.`,
			),
		};
	}
	return { ok: true, suppression };
}

/**
 * Create a GateFinding that indicates a learning override has expired.
 *
 * The finding's severity is `"error"` when `mode` is `"strict"` and `"warning"` otherwise.
 *
 * @param suppression - The expired suppression entry
 * @param mode - Determines whether expiry is treated as an error (`"strict"`) or a warning
 * @returns A `GateFinding` whose `id` is `learnings-gate.override.expired.<learningId>`, with a message instructing the owner to renew or remove the override and a manual fix pointing to the overrides file
 */
function expiredOverrideFinding(
	suppression: LearningSuppression,
	mode: LearningOverrideMode,
): GateFinding {
	return overrideFileFinding(
		`learnings-gate.override.expired.${suppression.learningId}`,
		mode === "strict" ? "error" : "warning",
		`Learning override for ${suppression.learningId} expired on ${suppression.expiresAt}; ${suppression.owner} must renew or remove it.`,
	);
}

/**
 * Create a standardized GateFinding referencing the learnings override file for schema or entry errors.
 *
 * @param id - Unique finding identifier
 * @param severity - Finding severity level (`"info" | "warning" | "error"`)
 * @param message - Human-readable description of the issue
 * @returns A GateFinding for the "learnings-gate" with a non-suppressible manual fix pointing to `.harness/learnings/overrides.json`
 */
function overrideFileFinding(
	id: string,
	severity: GateFinding["severity"],
	message: string,
): GateFinding {
	return {
		id,
		severity,
		gate: "learnings-gate",
		message,
		baseline: false,
		fix: {
			manual:
				"Update .harness/learnings/overrides.json with owner, reason, expiry, and replacement action, or remove the override.",
			suppressible: false,
		},
	};
}

/**
 * Extracts the learning identifier from a findings ID that uses the `learnings-gate.learning.` prefix.
 *
 * @param findingId - The finding identifier to parse
 * @returns The learning identifier substring when `findingId` starts with `learnings-gate.learning.`, `undefined` otherwise
 */
function extractLearningId(findingId: string): string | undefined {
	return findingId.startsWith("learnings-gate.learning.")
		? findingId.slice("learnings-gate.learning.".length)
		: undefined;
}

/**
 * Builds a sanitized audit object describing a learning suppression.
 *
 * @param suppression - The suppression entry to convert into audit metadata; sensitive fields are sanitized
 * @returns An object containing `learningId`, `pathPattern`, `reason`, `owner`, `expiresAt`, and `replacementAction`, where `reason`, `owner`, and `replacementAction` are sanitized for diagnostics
 */
function buildOverrideAudit(suppression: LearningSuppression) {
	return {
		learningId: suppression.learningId,
		pathPattern: suppression.pathPattern,
		reason: sanitizeLearningOverrideDiagnostic(suppression.reason),
		owner: sanitizeLearningOverrideDiagnostic(suppression.owner),
		expiresAt: suppression.expiresAt,
		replacementAction: sanitizeLearningOverrideDiagnostic(
			suppression.replacementAction,
		),
	};
}

/**
 * Determines whether a suppression has expired at the provided time.
 *
 * @param suppression - The suppression entry whose `expiresAt` timestamp will be checked
 * @param now - The reference time used to evaluate expiration
 * @returns `true` if `suppression.expiresAt` is earlier than `now`, `false` otherwise
 */
function isExpired(suppression: LearningSuppression, now: Date): boolean {
	return Date.parse(suppression.expiresAt) < now.getTime();
}

/**
 * Determines whether a file path matches a path pattern supporting exact matches, single-level (`/*`) and recursive (`/**`) wildcards.
 *
 * Both `pattern` and `file` are normalized (trimmed, backslashes converted to forward slashes, leading `./` removed) before matching.
 *
 * @param pattern - The path pattern to test; may be an exact path, end with `/*` to match a single directory level, or end with `/**` to match the prefix and any nested paths.
 * @param file - The file path to test against `pattern`.
 * @returns `true` if `file` matches `pattern`, `false` otherwise.
 */
function patternMatchesFile(pattern: string, file: string): boolean {
	const normalized = normalizePath(pattern);
	const normalizedFile = normalizePath(file);
	if (normalized.endsWith("/**")) {
		const prefix = normalized.slice(0, -3);
		return normalizedFile === prefix || normalizedFile.startsWith(`${prefix}/`);
	}
	if (normalized.endsWith("/*")) {
		const prefix = normalized.slice(0, -2);
		const rest = normalizedFile.startsWith(`${prefix}/`)
			? normalizedFile.slice(prefix.length + 1)
			: "";
		return rest.length > 0 && !rest.includes("/");
	}
	return normalized === normalizedFile;
}

/**
 * Normalizes a file path for pattern matching.
 *
 * @param path - The input file path to normalize
 * @returns The path trimmed of surrounding whitespace, with backslashes converted to forward slashes and a leading "./" removed if present
 */
function normalizePath(path: string): string {
	return path.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}
