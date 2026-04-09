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

export type VerifyRunMode = "fresh" | "resume";
export type VerifyRunStatus = "running" | "passed" | "failed" | "blocked";
export type VerifyGateExecutionClass = "read_only_parallel" | "serial_guarded";
export type VerifyGateFailureClass =
	| "transient_infra"
	| "contract_policy"
	| "internal_unknown";
export type VerifyGateStatus = "passed" | "failed" | "blocked";

export interface VerifyLaneConfig {
	fastMode: boolean;
	changedOnly: boolean;
	strictMode: boolean;
}

export interface VerifyIdentityTupleEntry {
	gateId: string;
	provider: string;
	externalIdPattern: string;
	githubCheckName: string | null;
}

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

export interface VerifyRunSummary {
	runId: string;
	overallStatus: "passed" | "failed" | "blocked";
	failedGateId: string | null;
	freshVsResumed: VerifyRunMode;
	durationMs: number;
}

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

export interface VerifyRunPaths {
	runsDir: string;
	runDir: string;
	runPath: string;
	summaryPath: string;
	gatesDir: string;
}

export type RunStateErrorCode =
	| "E_PATH"
	| "E_IO"
	| "E_PARSE"
	| "E_VALIDATION"
	| "E_IDEMPOTENCY_CONFLICT";

export class RunStateError extends Error {
	constructor(
		message: string,
		public readonly code: RunStateErrorCode,
	) {
		super(message);
		this.name = "RunStateError";
	}
}

export interface LoadedGateResult {
	gateId: string;
	status: VerifyGateStatus;
	attempt: number;
	runId?: string;
	idempotencyKey?: string;
	raw: Record<string, unknown>;
}

function toObject(value: unknown): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new RunStateError("Expected object value", "E_PARSE");
	}
	return value as Record<string, unknown>;
}

function asString(value: unknown, field: string): string {
	if (typeof value !== "string" || value.length === 0) {
		throw new RunStateError(
			`Expected non-empty string for ${field}`,
			"E_PARSE",
		);
	}
	return value;
}

function asOptionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asBoolean(value: unknown, field: string): boolean {
	if (typeof value !== "boolean") {
		throw new RunStateError(`Expected boolean for ${field}`, "E_PARSE");
	}
	return value;
}

function asInteger(value: unknown, field: string): number {
	if (typeof value !== "number" || !Number.isInteger(value)) {
		throw new RunStateError(`Expected integer for ${field}`, "E_PARSE");
	}
	return value;
}

function asGateStatus(value: unknown, field: string): VerifyGateStatus {
	if (value === "passed" || value === "failed" || value === "blocked") {
		return value;
	}
	throw new RunStateError(`Invalid gate status for ${field}`, "E_PARSE");
}

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

function stableJson(value: unknown): string {
	return JSON.stringify(canonicalize(value));
}

function sha256(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

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

function gateFileName(gateId: string): string {
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(gateId)) {
		throw new RunStateError(`Invalid gate id: ${gateId}`, "E_VALIDATION");
	}
	return `${gateId}.json`;
}

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

export function writeVerifyRunMetadata(
	repoRoot: string,
	metadata: VerifyRunMetadata,
): string {
	const paths = resolveVerifyRunPaths(repoRoot, metadata.runId);
	atomicWriteJson(paths.runPath, metadata);
	return paths.runPath;
}

export function writeVerifyRunSummary(
	repoRoot: string,
	runId: string,
	summary: VerifyRunSummary,
): string {
	const paths = resolveVerifyRunPaths(repoRoot, runId);
	atomicWriteJson(paths.summaryPath, summary);
	return paths.summaryPath;
}

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

function gateWriteKey(runId: string, gateId: string, attempt: number): string {
	return `${runId}:${gateId}:${attempt}`;
}

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

export function loadVerifyRunMetadata(
	repoRoot: string,
	runId: string,
): VerifyRunMetadata {
	const paths = resolveVerifyRunPaths(repoRoot, runId);
	if (!existsSync(paths.runPath)) {
		throw new RunStateError(`Missing run.json for ${runId}`, "E_IO");
	}
	const parsed = readJsonObject(paths.runPath);
	const lane = toObject(parsed.lane);
	const finishedAt = asOptionalString(parsed.finishedAt);
	const identityTupleHash = asOptionalString(parsed.identityTupleHash);
	const finishedAtEntry = finishedAt !== undefined ? { finishedAt } : {};
	const identityTupleHashEntry =
		identityTupleHash !== undefined ? { identityTupleHash } : {};

	return {
		runId: asString(parsed.runId, "runId"),
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

export function loadVerifyRunSummary(
	repoRoot: string,
	runId: string,
): VerifyRunSummary {
	const paths = resolveVerifyRunPaths(repoRoot, runId);
	if (!existsSync(paths.summaryPath)) {
		throw new RunStateError(`Missing summary.json for ${runId}`, "E_IO");
	}
	const parsed = readJsonObject(paths.summaryPath);
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
		runId: asString(parsed.runId, "runId"),
		overallStatus,
		failedGateId:
			parsed.failedGateId === null
				? null
				: (asOptionalString(parsed.failedGateId) ?? null),
		freshVsResumed: mode,
		durationMs: asInteger(parsed.durationMs, "durationMs"),
	};
}

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
	return parseLoadedGateResult(gatePath);
}

function listRunDirsByMtime(runsDir: string): string[] {
	if (!existsSync(runsDir)) {
		return [];
	}
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
			const leftStat = statSync(left);
			const rightStat = statSync(right);
			return rightStat.mtimeMs - leftStat.mtimeMs;
		});
}

export function listVerifyRunIds(repoRoot: string): string[] {
	const runsDir = safePath(repoRoot, ".harness/runs");
	return listRunDirsByMtime(runsDir).map((runDir) => basename(runDir));
}

export interface PruneVerifyRunsOptions {
	repoRoot: string;
	keepCount?: number;
	protectLatestFailed?: boolean;
}

export interface PruneVerifyRunsResult {
	deletedRunIds: string[];
	keptRunIds: string[];
	latestFailedRunId: string | null;
}

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
