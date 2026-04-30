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

/** Redact override diagnostics before they are emitted to command output. */
export function sanitizeLearningOverrideDiagnostic(value: string): string {
	return redactSensitiveText(value);
}

/** Load and validate an optional learning override file. */
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

/** Apply valid learning overrides to gate findings and return audit findings. */
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

function extractLearningId(findingId: string): string | undefined {
	return findingId.startsWith("learnings-gate.learning.")
		? findingId.slice("learnings-gate.learning.".length)
		: undefined;
}

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

function isExpired(suppression: LearningSuppression, now: Date): boolean {
	return Date.parse(suppression.expiresAt) < now.getTime();
}

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

function normalizePath(path: string): string {
	return path.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}
