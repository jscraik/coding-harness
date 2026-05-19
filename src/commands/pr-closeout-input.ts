import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import {
	HARNESS_CLOSEOUT_GATES_SCHEMA_VERSION,
	HE_PHASE_EXIT_SCHEMA_VERSION,
	type HePhaseExit,
	validateHePhaseExit,
} from "../lib/decision/he-phase-exit.js";
import type { PrCloseoutInput } from "../lib/pr-closeout.js";

const ACCEPTED_CLOSEOUT_GATES_SCHEMA_VERSIONS = [
	HARNESS_CLOSEOUT_GATES_SCHEMA_VERSION,
	HE_PHASE_EXIT_SCHEMA_VERSION,
] as const;

/**
 * Parse a JSON string and ensure the document root is a non-null plain object.
 *
 * @param value - The JSON text to parse.
 * @param source - Identifier used in the thrown error message when validation fails.
 * @returns The parsed value as a `Record<string, unknown>`.
 * @throws Error - If the parsed value is `null`, not an object, or an array. The error message will be `${source} must contain a JSON object`.
 */
export function parseJsonObject(
	value: string,
	source: string,
): Record<string, unknown> {
	const parsed = JSON.parse(value) as unknown;
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error(`${source} must contain a JSON object`);
	}
	return parsed as Record<string, unknown>;
}

/**
 * Validate and normalize a PR closeout input JSON string.
 *
 * Ensures the parsed root is an object containing a `pullRequest` with a `number` greater than
 * or equal to 1, enforces that at most one of `closeoutGates` or `phaseExit` is present, and
 * normalizes/validates any provided closeout-gates/phase-exit artifact into the canonical shape.
 * Error messages include the provided `source` to identify the input.
 *
 * @param value - JSON text containing the PR closeout input
 * @param source - Human-readable source label used in error messages (e.g., file path)
 * @returns The validated and normalized PR closeout input
 */
export function parseInput(value: string, source: string): PrCloseoutInput {
	const parsed = parseJsonObject(value, source);
	const pullRequest = parsed.pullRequest;
	if (
		!pullRequest ||
		typeof pullRequest !== "object" ||
		Array.isArray(pullRequest)
	) {
		throw new Error(`${source} must include a pullRequest object`);
	}
	const prNumber = (pullRequest as Record<string, unknown>).number;
	if (
		typeof prNumber !== "number" ||
		!Number.isInteger(prNumber) ||
		prNumber <= 0
	) {
		throw new Error(`${source} pullRequest.number must be a positive integer`);
	}
	if (parsed.closeoutGates !== undefined && parsed.phaseExit !== undefined) {
		throw new Error(
			`${source} must include either closeoutGates or phaseExit, not both`,
		);
	}
	if (parsed.closeoutGates !== undefined) {
		parsed.closeoutGates = normalizeCloseoutGatesArtifact(
			parsed.closeoutGates,
			`${source} closeoutGates`,
		);
	}
	if (parsed.phaseExit !== undefined) {
		parsed.phaseExit = normalizeCloseoutGatesArtifact(
			parsed.phaseExit,
			`${source} phaseExit`,
		);
	}
	assertOptionalObject(parsed.branch, `${source} branch`);
	assertOptionalArray(parsed.checks, `${source} checks`);
	assertOptionalObject(parsed.reviewThreads, `${source} reviewThreads`);
	assertOptionalObject(parsed.traceability, `${source} traceability`);
	assertOptionalArray(parsed.dirtyPaths, `${source} dirtyPaths`);
	assertOptionalArray(parsed.tools, `${source} tools`);
	return parsed as unknown as PrCloseoutInput;
}

/**
 * Read and parse a normalized PR closeout input file.
 *
 * @param path - Filesystem path to the input JSON file
 * @returns The parsed and normalized `PrCloseoutInput` object
 */
export function loadInput(path: string): PrCloseoutInput {
	return parseInput(readFileSync(path, "utf8"), path);
}

/**
 * Load a closeout-gates JSON file (resolved relative to the repository root) and normalize it into a `HePhaseExit` artifact.
 *
 * @param path - Repository-relative path to the closeout-gates JSON file
 * @param repoRoot - Filesystem path of the repository root used to resolve `path`
 * @returns The normalized `HePhaseExit` artifact
 */
export function loadCloseoutGates(path: string, repoRoot: string): HePhaseExit {
	const resolvedPath = resolve(repoRoot, path);
	const rel = relative(repoRoot, resolvedPath)
		.split(/[/\\]+/)
		.join("/");
	if (rel.length === 0 || rel.startsWith("..")) {
		throw new Error(
			`${path} must resolve to a file inside the repository root`,
		);
	}
	const parsed = JSON.parse(readFileSync(resolvedPath, "utf8")) as unknown;
	return normalizeCloseoutGatesArtifact(parsed, path);
}

function assertOptionalObject(value: unknown, source: string): void {
	if (value === undefined) return;
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(`${source} must be an object when provided`);
	}
}

function assertOptionalArray(value: unknown, source: string): void {
	if (value === undefined) return;
	if (!Array.isArray(value)) {
		throw new Error(`${source} must be an array when provided`);
	}
}

/**
 * Produce a human-readable list of accepted closeout-gates schema versions.
 *
 * @returns A string listing accepted closeout-gates schema versions separated by " or "
 */
function closeoutGatesSchemaList(): string {
	return ACCEPTED_CLOSEOUT_GATES_SCHEMA_VERSIONS.join(" or ");
}

/**
 * Normalize a closeout-gates artifact to the canonical phase-exit shape and validate it.
 *
 * @param value - Parsed JSON value containing the artifact (may be any JSON type).
 * @param source - Human-readable identifier used in validation error messages (for example a file path or input name).
 * @returns The normalized `HePhaseExit` phase-exit artifact.
 * @throws Error if the artifact is invalid; the message includes the `source`, accepted schema versions, and validation error codes.
 */
export function normalizeCloseoutGatesArtifact(
	value: unknown,
	source: string,
): HePhaseExit {
	const record =
		value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: null;
	const normalized =
		record?.schemaVersion === HARNESS_CLOSEOUT_GATES_SCHEMA_VERSION
			? { ...record, schemaVersion: HE_PHASE_EXIT_SCHEMA_VERSION }
			: value;
	const validation = validateHePhaseExit(normalized);
	if (!validation.valid) {
		throw new Error(
			`${source} must be a valid Coding Harness closeout-gates artifact (${closeoutGatesSchemaList()}): ${validation.errors.map((error) => error.code).join(", ")}`,
		);
	}
	return normalized as HePhaseExit;
}
