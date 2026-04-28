import { createHash, randomUUID } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { PathTraversalError, validatePath } from "../input/validator.js";

/** Public API export. */
export type VerifyRunMode = "fresh" | "resume";
/** Public API export. */
export type VerifyRunStatus = "running" | "passed" | "failed" | "blocked";
/** Public API export. */
export type VerifyGateExecutionClass = "read_only_parallel" | "serial_guarded";
/** Public API export. */
export type VerifyGateFailureClass =
	| "transient_infra"
	| "contract_policy"
	| "internal_unknown";
/** Public API export. */
export type VerifyGateStatus = "passed" | "failed" | "blocked";

/** Public API export. */
export interface VerifyLaneConfig {
	fastMode: boolean;
	changedOnly: boolean;
	strictMode: boolean;
}

/** Public API export. */
export interface VerifyIdentityTupleEntry {
	gateId: string;
	provider: string;
	externalIdPattern: string;
	githubCheckName: string | null;
}

/** Public API export. */
export interface VerifyRunMetadata {
	runId: string;
	mode: VerifyRunMode;
	sourceRunId: string | null;
	status: VerifyRunStatus;
	startedAt: string;
	finishedAt?: string;
	resumeFromGateId: string | null;
	repoRoot: string;
	providerClass: string;
	schemaVersion: string;
	contractVersion: string;
	lane: VerifyLaneConfig;
	identityTupleHash?: string;
}

/** Public API export. */
export interface VerifyRunSummary {
	runId: string;
	overallStatus: "passed" | "failed" | "blocked";
	failedGateId: string | null;
	freshVsResumed: VerifyRunMode;
	durationMs: number;
}

/** Public API export. */
export interface VerifyGateResult {
	runId: string;
	gateId: string;
	executionClass: VerifyGateExecutionClass;
	attempt: number;
	status: VerifyGateStatus;
	failureClass: VerifyGateFailureClass;
	startedAt: string;
	finishedAt: string;
	nextAction: string;
	exitCode: number;
	reused?: boolean;
	sourceRunId?: string;
	idempotencyKey?: string;
}

/** Public API export. */
export interface VerifyRunPaths {
	runsDir: string;
	runDir: string;
	runPath: string;
	summaryPath: string;
	gatesDir: string;
}

/** Public API export. */
export type RunStateErrorCode =
	| "E_PATH"
	| "E_IO"
	| "E_PARSE"
	| "E_VALIDATION"
	| "E_IDEMPOTENCY_CONFLICT";

/** Public API export. */
export class RunStateError extends Error {
	constructor(
		message: string,
		public readonly code: RunStateErrorCode,
	) {
		super(message);
		this.name = "RunStateError";
	}
}

/** Public API export. */
export interface LoadedGateResult {
	gateId: string;
	status: VerifyGateStatus;
	attempt: number;
	runId?: string;
	idempotencyKey?: string;
	raw: Record<string, unknown>;
}

/**
 * Validate that a value is a non-null, non-array object and narrow its type.
 *
 * @param value - The value to validate
 * @returns The same value narrowed to a plain object (`Record<string, unknown>`)
 * @throws RunStateError with code `E_PARSE` if `value` is null, not an object, or an array
 */
function toObject(value: unknown): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new RunStateError("Expected object value", "E_PARSE");
	}
	return value as Record<string, unknown>;
}

/**
 * Validate that a value is a non-empty string.
 *
 * @param value - The value to validate.
 * @param field - Field name used in the error message if validation fails.
 * @returns The validated non-empty string.
 * @throws RunStateError with code `E_PARSE` if `value` is not a non-empty string.
 */
function asString(value: unknown, field: string): string {
	if (typeof value !== "string" || value.length === 0) {
		throw new RunStateError(
			`Expected non-empty string for ${field}`,
			"E_PARSE",
		);
	}
	return value;
}

/**
 * Get the input as a non-empty string if it is one.
 *
 * @param value - The value to check
 * @returns The string if `value` is a non-empty string, `undefined` otherwise.
 */
function asOptionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Ensure a value is a boolean.
 *
 * @param value - The value to validate.
 * @param field - Field name used in the error message when validation fails.
 * @returns The validated boolean value.
 * @throws RunStateError with code `E_PARSE` if `value` is not a boolean.
 */
function asBoolean(value: unknown, field: string): boolean {
	if (typeof value !== "boolean") {
		throw new RunStateError(`Expected boolean for ${field}`, "E_PARSE");
	}
	return value;
}

/**
 * Validate that a value is an integer.
 *
 * @param value - The value to validate.
 * @param field - Field name included in the error message when validation fails.
 * @returns The validated integer.
 * @throws RunStateError with code `E_PARSE` if `value` is not an integer.
 */
function asInteger(value: unknown, field: string): number {
	if (typeof value !== "number" || !Number.isInteger(value)) {
		throw new RunStateError(`Expected integer for ${field}`, "E_PARSE");
	}
	return value;
}

/**
 * Validate that a value is a verify gate status and return it.
 *
 * @param value - The value to validate.
 * @param field - The name of the source field (included in error messages).
 * @returns The validated gate status: `'passed'`, `'failed'`, or `'blocked'`.
 * @throws RunStateError with code `E_PARSE` if `value` is not one of the allowed statuses.
 */
function asGateStatus(value: unknown, field: string): VerifyGateStatus {
	if (value === "passed" || value === "failed" || value === "blocked") {
		return value;
	}
	throw new RunStateError(`Invalid gate status for ${field}`, "E_PARSE");
}

/**
 * Resolve a repository-relative path to an absolute filesystem path constrained within the repository root.
 *
 * @param repoRoot - Absolute repository root directory against which `relativePath` is resolved.
 * @param relativePath - Path relative to `repoRoot`; must not escape the repository root.
 * @returns The resolved absolute path located inside `repoRoot`.
 * @throws RunStateError with code `"E_PATH"` if `relativePath` would traverse outside `repoRoot`.
 * @throws Any other error encountered during path resolution is rethrown unchanged.
 */
function safePath(repoRoot: string, relativePath: string): string {
	try {
		return validatePath(repoRoot, relativePath);
	} catch (error) {
		if (error instanceof PathTraversalError) {
			throw new RunStateError(
				`Path escapes repository root: ${relativePath}`,
				"E_PATH",
			);
		}
		throw error;
	}
}

/**
 * Produce a deterministically ordered equivalent of a JSON-like value by recursively sorting object keys.
 *
 * @param value - Any JSON-serializable value (objects, arrays, primitives)
 * @returns A value equivalent to `value` with all object keys sorted lexicographically; arrays and primitive values are preserved
 */
function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((entry) => canonicalize(entry));
	}
	if (typeof value === "object" && value !== null) {
		const record = value as Record<string, unknown>;
		return Object.keys(record)
			.sort()
			.reduce<Record<string, unknown>>((acc, key) => {
				acc[key] = canonicalize(record[key]);
				return acc;
			}, {});
	}
	return value;
}

/**
 * Produce a deterministically ordered JSON string for a value.
 *
 * Serializes the input so that object keys are emitted in a stable, lexicographic order,
 * yielding identical text for semantically equivalent values regardless of original key order.
 *
 * @param value - Any JSON-like value to serialize
 * @returns JSON text of `value` with object keys ordered deterministically, suitable for stable hashing and comparisons
 */
function stableJson(value: unknown): string {
	return JSON.stringify(canonicalize(value));
}

/**
 * Compute the SHA-256 hex digest for the given text.
 *
 * @param text - The input string to hash.
 * @returns The SHA-256 digest of `text` encoded as a lowercase hexadecimal string.
 */
function sha256(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

/**
 * Atomically writes `data` as pretty-printed JSON to `path`, creating parent directories if needed.
 *
 * Attempts to write to a temporary file and rename it into place to ensure atomic replacement. On failure it best-effort removes the temp file and throws a `RunStateError` with code `E_IO`.
 *
 * @param path - Destination filesystem path for the JSON file
 * @param data - Value to serialize to JSON (will be written with two-space indentation and a trailing newline)
 */
function atomicWriteJson(path: string, data: unknown): void {
	const content = `${JSON.stringify(data, null, 2)}\n`;
	const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
	mkdirSync(dirname(path), { recursive: true });
	try {
		writeFileSync(tempPath, content, "utf-8");
		renameSync(tempPath, path);
	} catch (error) {
		try {
			rmSync(tempPath, { force: true });
		} catch {
			// Best effort cleanup.
		}
		throw new RunStateError(
			`Unable to write ${path}: ${error instanceof Error ? error.message : String(error)}`,
			"E_IO",
		);
	}
}

/**
 * Load a UTF-8 file and validate its contents as a plain JSON object.
 *
 * @param path - Filesystem path to the JSON file to read
 * @returns A non-null object containing the parsed JSON (arrays are rejected)
 * @throws RunStateError with code `E_PARSE` if the file cannot be read, parsed, or does not contain a plain object; rethrows an existing `RunStateError` unchanged
 */
function readJsonObject(path: string): Record<string, unknown> {
	try {
		return toObject(JSON.parse(readFileSync(path, "utf-8")) as unknown);
	} catch (error) {
		if (error instanceof RunStateError) {
			throw error;
		}
		throw new RunStateError(
			`Unable to parse JSON at ${path}: ${error instanceof Error ? error.message : String(error)}`,
			"E_PARSE",
		);
	}
}

/**
 * Produces a filesystem-safe filename for a gate result by appending `.json` to a validated gate id.
 *
 * @param gateId - Gate identifier; must match `/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/`.
 * @returns The gate result filename, e.g. `"<gateId>.json"`.
 * @throws RunStateError with code `E_VALIDATION` if `gateId` does not match the allowed pattern.
 */
function gateFileName(gateId: string): string {
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(gateId)) {
		throw new RunStateError(`Invalid gate id: ${gateId}`, "E_VALIDATION");
	}
	return `${gateId}.json`;
}

/**
 * Produces a stable 16-character hex fingerprint for a set of identity-tuple entries.
 *
 * The fingerprint is computed deterministically from the provided entries and is independent of the input order. Missing `githubCheckName` values are treated as an empty string.
 *
 * @param entries - The identity-tuple entries to include in the fingerprint
 * @returns A 16-character hexadecimal string representing the normalized entries
 */
export function deriveIdentityTupleHash(
	entries: VerifyIdentityTupleEntry[],
): string {
	const normalized = entries
		.map((entry) => ({
			gateId: entry.gateId,
			provider: entry.provider,
			externalIdPattern: entry.externalIdPattern,
			githubCheckName: entry.githubCheckName ?? "",
		}))
		.sort((left, right) => {
			const leftKey = `${left.gateId}::${left.provider}::${left.externalIdPattern}::${left.githubCheckName}`;
			const rightKey = `${right.gateId}::${right.provider}::${right.externalIdPattern}::${right.githubCheckName}`;
			return leftKey.localeCompare(rightKey);
		});
	return sha256(JSON.stringify(normalized)).slice(0, 16);
}

/**
 * Computes validated filesystem paths for a verify run's persisted artifacts under the repository root.
 *
 * @param repoRoot - Filesystem path of the repository root used to resolve and validate run artifact locations.
 * @param runId - Run identifier; must match /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/. Invalid values cause a validation error.
 * @returns An object containing validated paths:
 *  - `runsDir`: directory containing all runs (".harness/runs")
 *  - `runDir`: directory for this run (".harness/runs/<runId>")
 *  - `runPath`: path to the run metadata file (".harness/runs/<runId>/run.json")
 *  - `summaryPath`: path to the run summary file (".harness/runs/<runId>/summary.json")
 *  - `gatesDir`: directory for per-gate result files (".harness/runs/<runId>/gates")
 * @throws {RunStateError} With code `E_VALIDATION` if `runId` does not meet the required pattern.
 * @throws {RunStateError} With code `E_PATH` if resolving any path would escape the provided `repoRoot`.
 */
export function resolveVerifyRunPaths(
	repoRoot: string,
	runId: string,
): VerifyRunPaths {
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(runId)) {
		throw new RunStateError(`Invalid run id: ${runId}`, "E_VALIDATION");
	}
	const runsDir = safePath(repoRoot, ".harness/runs");
	const runDir = safePath(repoRoot, join(".harness/runs", runId));
	const runPath = safePath(repoRoot, join(".harness/runs", runId, "run.json"));
	const summaryPath = safePath(
		repoRoot,
		join(".harness/runs", runId, "summary.json"),
	);
	const gatesDir = safePath(repoRoot, join(".harness/runs", runId, "gates"));
	return { runsDir, runDir, runPath, summaryPath, gatesDir };
}

/**
 * Persist verify run metadata to the run's run.json file under the repository.
 *
 * Writes `metadata` to the resolved path for `metadata.runId` (under `.harness/runs/<runId>/run.json`) using an atomic write.
 *
 * @param repoRoot - Filesystem root of the repository used to resolve safe storage paths.
 * @param metadata - Verify run metadata; `metadata.runId` is used to determine the target path.
 * @returns The filesystem path to the written `run.json`.
 * @throws RunStateError with code `E_VALIDATION` if `metadata.runId` is invalid, `E_PATH` for path traversal issues, or `E_IO` for filesystem write/rename failures.
 */
export function writeVerifyRunMetadata(
	repoRoot: string,
	metadata: VerifyRunMetadata,
): string {
	const paths = resolveVerifyRunPaths(repoRoot, metadata.runId);
	atomicWriteJson(paths.runPath, metadata);
	return paths.runPath;
}

/**
 * Persist the verify run summary to the run's summary.json file.
 *
 * Writes `summary` atomically to `.harness/runs/<runId>/summary.json`.
 *
 * @param repoRoot - Repository root used to resolve run artifact paths.
 * @param runId - Target run identifier; must conform to run-id path rules.
 * @param summary - Summary object to persist. `summary.runId` must match `runId`.
 * @returns The full filesystem path to the written `summary.json`.
 * @throws RunStateError with code `E_VALIDATION` if `runId` is invalid or `summary.runId` does not match `runId`; `E_PATH` if the resolved path is outside `repoRoot`; `E_IO` on write or rename failures.
 */
export function writeVerifyRunSummary(
	repoRoot: string,
	runId: string,
	summary: VerifyRunSummary,
): string {
	if (summary.runId !== runId) {
		throw new RunStateError(
			`Summary runId mismatch: expected ${runId}, received ${summary.runId}`,
			"E_VALIDATION",
		);
	}
	const paths = resolveVerifyRunPaths(repoRoot, runId);
	atomicWriteJson(paths.summaryPath, summary);
	return paths.summaryPath;
}

/**
 * Load and validate a persisted gate result JSON from disk, returning a typed representation.
 *
 * @param path - Filesystem path to the gate result JSON file
 * @returns A `LoadedGateResult` containing validated fields (`gateId`, `status`, `attempt`), optional `runId` and `idempotencyKey` when present, and the original parsed `raw` object
 * @throws RunStateError with code `E_IO` if the file cannot be read
 * @throws RunStateError with code `E_PARSE` if the file is not valid JSON or required fields fail validation (including non-positive `attempt`)
 */
function parseLoadedGateResult(path: string): LoadedGateResult {
	const parsed = readJsonObject(path);
	const gateId = asString(parsed.gateId, "gateId");
	const status = asGateStatus(parsed.status, "status");
	const attempt = asInteger(parsed.attempt, "attempt");
	if (attempt <= 0) {
		throw new RunStateError("Gate attempt must be positive", "E_PARSE");
	}
	const runId = asOptionalString(parsed.runId);
	const idempotencyKey = asOptionalString(parsed.idempotencyKey);
	return {
		gateId,
		status,
		attempt,
		...(runId ? { runId } : {}),
		...(idempotencyKey ? { idempotencyKey } : {}),
		raw: parsed,
	};
}

/**
 * Build the canonical idempotency key used to identify a specific gate write.
 *
 * @param runId - The verify run identifier
 * @param gateId - The gate identifier
 * @param attempt - The gate attempt number (must be > 0)
 * @returns The idempotency key in the format `runId:gateId:attempt`
 */
function gateWriteKey(runId: string, gateId: string, attempt: number): string {
	return `${runId}:${gateId}:${attempt}`;
}

/**
 * Persist a single gate result file for a verify run, enforcing idempotency rules.
 *
 * Writes a JSON file at `.harness/runs/<runId>/gates/<gateId>.json` (atomic rename). If a file already exists it compares an idempotency key computed from `runId:gateId:attempt`:
 * - If the existing record has the same idempotency key and identical canonical JSON, no write is performed and the operation is reported as idempotent.
 * - If the existing record has the same idempotency key but different content, an idempotency conflict error is raised.
 * - Otherwise the provided result (augmented with an `idempotencyKey`) is written atomically.
 *
 * @param repoRoot - Repository root used to resolve `.harness/runs` paths.
 * @param runId - Target verify run identifier; `result.runId` must equal this value.
 * @param result - Gate result to persist; `attempt` must be > 0.
 * @returns An object with:
 *   - `path`: filesystem path written (or where an identical record was found),
 *   - `written`: `true` when a new file was created, `false` when an identical record already existed,
 *   - `idempotent`: `true` when the existing file matched the idempotency key and content, `false` otherwise.
 *
 * @throws RunStateError with code `E_VALIDATION` if `result.runId !== runId` or `result.attempt <= 0`.
 * @throws RunStateError with code `E_IDEMPOTENCY_CONFLICT` if an existing file shares the idempotency key but differs in content.
 * @throws RunStateError with codes such as `E_PATH` or `E_IO` when path validation or filesystem operations fail.
 */
export function writeVerifyGateResult(
	repoRoot: string,
	runId: string,
	result: VerifyGateResult,
): { path: string; written: boolean; idempotent: boolean } {
	if (result.runId !== runId) {
		throw new RunStateError(
			"Gate result runId must match target run id",
			"E_VALIDATION",
		);
	}
	if (result.attempt <= 0) {
		throw new RunStateError("Gate attempt must be positive", "E_VALIDATION");
	}

	resolveVerifyRunPaths(repoRoot, runId);
	const gatePath = safePath(
		repoRoot,
		join(".harness/runs", runId, "gates", gateFileName(result.gateId)),
	);
	const writeKey = gateWriteKey(runId, result.gateId, result.attempt);
	const nextRecord: VerifyGateResult = {
		...result,
		idempotencyKey: writeKey,
	};

	if (existsSync(gatePath)) {
		const existing = parseLoadedGateResult(gatePath);
		const existingKey =
			existing.idempotencyKey ??
			gateWriteKey(existing.runId ?? runId, existing.gateId, existing.attempt);

		if (existingKey === writeKey) {
			if (stableJson(existing.raw) === stableJson(nextRecord)) {
				return { path: gatePath, written: false, idempotent: true };
			}
			throw new RunStateError(
				`Idempotency conflict for gate ${result.gateId} attempt ${result.attempt}`,
				"E_IDEMPOTENCY_CONFLICT",
			);
		}
	}

	atomicWriteJson(gatePath, nextRecord);
	return { path: gatePath, written: true, idempotent: false };
}

/**
 * Load and validate a run's persisted metadata from the repository's .harness/runs/<runId>/run.json.
 *
 * @param repoRoot - Filesystem path to the repository root used to resolve run storage under `.harness/runs`.
 * @param runId - Run identifier whose metadata will be loaded; must refer to an existing run directory and `run.json`.
 * @returns The parsed and validated VerifyRunMetadata for the given run.
 * @throws RunStateError with code "E_IO" if the run.json file is missing or cannot be read; with code "E_PARSE" if JSON is malformed or fields have invalid types; with code "E_VALIDATION" for semantic validation failures.
 */
export function loadVerifyRunMetadata(
	repoRoot: string,
	runId: string,
): VerifyRunMetadata {
	const paths = resolveVerifyRunPaths(repoRoot, runId);
	if (!existsSync(paths.runPath)) {
		throw new RunStateError(`Missing run.json for ${runId}`, "E_IO");
	}
	const parsed = readJsonObject(paths.runPath);
	const parsedRunId = asString(parsed.runId, "runId");
	if (parsedRunId !== runId) {
		throw new RunStateError(
			`Mismatched runId: ${parsedRunId} != ${runId}`,
			"E_VALIDATION",
		);
	}
	const lane = toObject(parsed.lane);
	const finishedAt = asOptionalString(parsed.finishedAt);
	const identityTupleHash = asOptionalString(parsed.identityTupleHash);
	const finishedAtEntry = finishedAt !== undefined ? { finishedAt } : {};
	const identityTupleHashEntry =
		identityTupleHash !== undefined ? { identityTupleHash } : {};

	return {
		runId: parsedRunId,
		mode: (() => {
			const mode = asString(parsed.mode, "mode");
			if (mode === "fresh" || mode === "resume") {
				return mode;
			}
			throw new RunStateError(`Invalid run mode: ${mode}`, "E_PARSE");
		})(),
		sourceRunId:
			parsed.sourceRunId === null
				? null
				: (asOptionalString(parsed.sourceRunId) ?? null),
		status: (() => {
			const status = asString(parsed.status, "status");
			if (
				status === "running" ||
				status === "passed" ||
				status === "failed" ||
				status === "blocked"
			) {
				return status;
			}
			throw new RunStateError(`Invalid run status: ${status}`, "E_PARSE");
		})(),
		startedAt: asString(parsed.startedAt, "startedAt"),
		...finishedAtEntry,
		resumeFromGateId:
			parsed.resumeFromGateId === null
				? null
				: (asOptionalString(parsed.resumeFromGateId) ?? null),
		repoRoot: asString(parsed.repoRoot, "repoRoot"),
		providerClass: asString(parsed.providerClass, "providerClass"),
		schemaVersion: asString(parsed.schemaVersion, "schemaVersion"),
		contractVersion: asString(parsed.contractVersion, "contractVersion"),
		lane: {
			fastMode: asBoolean(lane.fastMode, "lane.fastMode"),
			changedOnly: asBoolean(lane.changedOnly, "lane.changedOnly"),
			strictMode: asBoolean(lane.strictMode, "lane.strictMode"),
		},
		...identityTupleHashEntry,
	};
}

/**
 * Load and validate the run's summary.json from the repository and return its parsed summary.
 *
 * Parses summary.json under `.harness/runs/<runId>/summary.json`, enforces allowed values for
 * `overallStatus` (`"passed" | "failed" | "blocked"`) and `freshVsResumed` (`"fresh" | "resume"`),
 * coerces `failedGateId` to `string | null`, and validates `durationMs` as an integer.
 *
 * @param repoRoot - Filesystem path of the repository root used to resolve `.harness/runs`.
 * @param runId - The run identifier; validated when resolving run paths.
 * @returns A VerifyRunSummary with properties: `runId`, `overallStatus`, `failedGateId` (`string | null`), `freshVsResumed`, and `durationMs`.
 * @throws RunStateError with code `E_IO` if the summary file is missing or not readable.
 * @throws RunStateError with code `E_PARSE` if the summary JSON is malformed or contains invalid/unsupported values.
 * @throws RunStateError from path resolution (e.g., `E_VALIDATION` or `E_PATH`) if `runId` or resolved paths are invalid.
 */
export function loadVerifyRunSummary(
	repoRoot: string,
	runId: string,
): VerifyRunSummary {
	const paths = resolveVerifyRunPaths(repoRoot, runId);
	if (!existsSync(paths.summaryPath)) {
		throw new RunStateError(`Missing summary.json for ${runId}`, "E_IO");
	}
	const parsed = readJsonObject(paths.summaryPath);
	const parsedRunId = asString(parsed.runId, "runId");
	if (parsedRunId !== runId) {
		throw new RunStateError(
			`Mismatched runId: ${parsedRunId} != ${runId}`,
			"E_VALIDATION",
		);
	}
	const overallStatus = asString(parsed.overallStatus, "overallStatus");
	if (
		overallStatus !== "passed" &&
		overallStatus !== "failed" &&
		overallStatus !== "blocked"
	) {
		throw new RunStateError(
			`Invalid summary overallStatus: ${overallStatus}`,
			"E_PARSE",
		);
	}

	const mode = asString(parsed.freshVsResumed, "freshVsResumed");
	if (mode !== "fresh" && mode !== "resume") {
		throw new RunStateError(
			`Invalid summary freshVsResumed: ${mode}`,
			"E_PARSE",
		);
	}

	return {
		runId: parsedRunId,
		overallStatus,
		failedGateId:
			parsed.failedGateId === null
				? null
				: (asOptionalString(parsed.failedGateId) ?? null),
		freshVsResumed: mode,
		durationMs: asInteger(parsed.durationMs, "durationMs"),
	};
}

/**
 * Load and validate the persisted gate result for a given run and gate.
 *
 * Resolves and validates storage paths under the repository root, verifies the gate result file exists, and parses it into a `LoadedGateResult`.
 *
 * @param repoRoot - Repository root used to resolve `.harness/runs`
 * @param runId - Run identifier whose gate result should be loaded
 * @param gateId - Gate identifier corresponding to the result file
 * @returns The `LoadedGateResult` parsed from the gate result file
 * @throws {RunStateError} with code `E_VALIDATION` if `runId` is invalid
 * @throws {RunStateError} with code `E_PATH` if any resolved path would escape `repoRoot`
 * @throws {RunStateError} with code `E_IO` if the gate result file does not exist or cannot be read
 */
export function loadVerifyGateResult(
	repoRoot: string,
	runId: string,
	gateId: string,
): LoadedGateResult {
	resolveVerifyRunPaths(repoRoot, runId);
	const gatePath = safePath(
		repoRoot,
		join(".harness/runs", runId, "gates", gateFileName(gateId)),
	);
	if (!existsSync(gatePath)) {
		throw new RunStateError(
			`Missing gate result for ${runId}/${gateId}`,
			"E_IO",
		);
	}
	const loaded = parseLoadedGateResult(gatePath);
	if (loaded.runId !== runId) {
		throw new RunStateError(
			`Mismatched runId: ${loaded.runId ?? "<missing>"} != ${runId}`,
			"E_VALIDATION",
		);
	}
	if (loaded.gateId !== gateId) {
		throw new RunStateError(
			`Mismatched gateId: ${loaded.gateId} != ${gateId}`,
			"E_VALIDATION",
		);
	}
	return loaded;
}

/**
 * Compute run recency by scanning a run directory recursively and returning
 * the maximum mtime across the run folder and all nested artifacts.
 */
function computeRunRecencyMs(runDir: string): number {
	let newestMtimeMs = 0;
	const pendingPaths: string[] = [runDir];

	while (pendingPaths.length > 0) {
		const currentPath = pendingPaths.pop();
		if (!currentPath) {
			continue;
		}
		try {
			const stats = statSync(currentPath);
			newestMtimeMs = Math.max(newestMtimeMs, stats.mtimeMs);
			if (!stats.isDirectory()) {
				continue;
			}
			const entries = readdirSync(currentPath);
			for (const entry of entries) {
				pendingPaths.push(join(currentPath, entry));
			}
		} catch {
			// Ignore files disappearing mid-scan and continue ranking.
		}
	}

	return newestMtimeMs;
}

/**
 * Produce a list of absolute paths for subdirectories of `runsDir`, ordered by
 * most-recent run activity first.
 *
 * Ignores entries that are not directories or that cannot be stat'ed. If
 * `runsDir` does not exist, returns an empty array.
 */
function listRunDirsByMtime(runsDir: string): string[] {
	if (!existsSync(runsDir)) {
		return [];
	}
	const recencyCache = new Map<string, number>();
	const runRecency = (runDir: string): number => {
		const cached = recencyCache.get(runDir);
		if (cached !== undefined) {
			return cached;
		}
		const recency = computeRunRecencyMs(runDir);
		recencyCache.set(runDir, recency);
		return recency;
	};
	return readdirSync(runsDir)
		.map((entry) => join(runsDir, entry))
		.filter((entryPath) => {
			try {
				return statSync(entryPath).isDirectory();
			} catch {
				return false;
			}
		})
		.sort((left, right) => {
			const delta = runRecency(right) - runRecency(left);
			return delta !== 0 ? delta : right.localeCompare(left);
		});
}

/**
 * List verify run IDs found under the repository's `.harness/runs` directory,
 * ordered from most-recently modified to oldest.
 *
 * @param repoRoot - Repository root path used to resolve `.harness/runs`
 * @returns An array of run ID strings sorted by descending directory modification time; returns an empty array if the runs directory does not exist
 *
 * @throws RunStateError with code `E_PATH` if `repoRoot` or the resolved runs path is invalid or would escape the repository root
 */
export function listVerifyRunIds(repoRoot: string): string[] {
	const runsDir = safePath(repoRoot, ".harness/runs");
	return listRunDirsByMtime(runsDir).map((runDir) => basename(runDir));
}

/** Public API export. */
export interface PruneVerifyRunsOptions {
	repoRoot: string;
	keepCount?: number;
	protectLatestFailed?: boolean;
}

/** Public API export. */
export interface PruneVerifyRunsResult {
	deletedRunIds: string[];
	keptRunIds: string[];
	latestFailedRunId: string | null;
}

/**
 * Remove old verify-run directories under `.harness/runs/` while retaining a configured number and optionally protecting the latest failed/blocked run.
 *
 * Validates `options.keepCount` as a positive integer. Scans `.harness/runs/` sorted by directory modification time (newest first), preserves the newest `keepCount` runs and, if `options.protectLatestFailed` is `true` (default), also preserves the most-recent run whose `summary.json` has `overallStatus` of `"failed"` or `"blocked"`. All other run directories are deleted from disk.
 *
 * @param options - Pruning options:
 *   - `repoRoot`: repository root used to locate `.harness/runs/`.
 *   - `keepCount` (optional): number of most-recent runs to keep; defaults to `50`.
 *   - `protectLatestFailed` (optional): when `true` (default), also keep the latest failed/blocked run even if it falls outside `keepCount`.
 *
 * @returns An object with:
 *   - `deletedRunIds`: basenames of run directories that were removed.
 *   - `keptRunIds`: basenames of run directories that remain.
 *   - `latestFailedRunId`: basename of the protected failed/blocked run if one was found, otherwise `null`.
 *
 * @throws RunStateError with code `E_VALIDATION` if `keepCount` is not a positive integer.
 * @throws RunStateError with code `E_PATH` if `repoRoot` resolves to an unsafe path.
 */
export function pruneVerifyRuns(
	options: PruneVerifyRunsOptions,
): PruneVerifyRunsResult {
	const keepCount = options.keepCount ?? 50;
	if (!Number.isInteger(keepCount) || keepCount < 1) {
		throw new RunStateError(
			"keepCount must be a positive integer",
			"E_VALIDATION",
		);
	}

	const runsDir = safePath(options.repoRoot, ".harness/runs");
	const runDirs = listRunDirsByMtime(runsDir);
	if (runDirs.length <= keepCount) {
		return {
			deletedRunIds: [],
			keptRunIds: runDirs.map((entry) => basename(entry)),
			latestFailedRunId: null,
		};
	}

	let latestFailedDir: string | null = null;
	if (options.protectLatestFailed ?? true) {
		for (const runDir of runDirs) {
			const summaryPath = join(runDir, "summary.json");
			if (!existsSync(summaryPath)) {
				continue;
			}
			try {
				const summary = readJsonObject(summaryPath);
				const status = summary.overallStatus;
				if (status === "failed" || status === "blocked") {
					latestFailedDir = runDir;
					break;
				}
			} catch {
				// Ignore malformed summaries during pruning.
			}
		}
	}

	const deletedRunIds: string[] = [];
	const keptRunIds: string[] = [];

	for (const [index, runDir] of runDirs.entries()) {
		const runId = basename(runDir);
		if (index < keepCount || runDir === latestFailedDir) {
			keptRunIds.push(runId);
			continue;
		}
		rmSync(runDir, { recursive: true, force: true });
		deletedRunIds.push(runId);
	}

	return {
		deletedRunIds,
		keptRunIds,
		latestFailedRunId: latestFailedDir ? basename(latestFailedDir) : null,
	};
}
