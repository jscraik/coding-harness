/**
 * Pilot Rollback CLI command
 *
 * Machine-proof rollback interface for transitioning between
 * autonomous and manual remediation modes. Writes completion
 * marker artifacts for verification.
 */

import { randomUUID } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { loadContract } from "../lib/contract/loader.js";
import {
	emitTerminalRunRecord,
	hashRunRecordValue,
} from "../lib/contract/run-record-emitter.js";
import type { PilotRollbackPolicy } from "../lib/contract/types.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { PathTraversalError, validatePath } from "../lib/input/validator.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	VALIDATION: 1,
	PRECONDITION: 2,
	INTERNAL: 10,
} as const;

/**
 * Rollback operating mode values.
 */
export type PilotMode = "autonomous" | "manual";

/**
 * Canonical rollback completion marker payload.
 */
export interface RollbackMarker {
	schemaVersion: "pilot-rollback-marker/v1";
	incidentId: string;
	modeBefore: PilotMode;
	modeAfter: PilotMode;
	requestedAt: string;
	completedAt: string;
	rollbackEventsId: string;
	result: "success" | "failed";
	reason: string;
}

/**
 * One rollback event entry persisted to the events store.
 */
export interface RollbackEventsRecord {
	id: string;
	incidentId: string;
	modeTransition: { from: PilotMode; to: PilotMode };
	triggeredAt: string;
	triggeredBy: "automation" | "manual";
	triggerReason: string;
}

/**
 * Rollback event log container persisted as JSON.
 */
export interface RollbackEventsStore {
	schemaVersion: "pilot-rollback-events/v1";
	events: RollbackEventsRecord[];
}

/**
 * CLI options accepted by `harness pilot-rollback`.
 */
export interface PilotRollbackOptions {
	/** Incident ID that triggered the rollback */
	incidentId: string;
	/** Target mode to transition to */
	mode: PilotMode;
	/** Path to contract file */
	contractPath?: string;
	/** Path to artifacts directory */
	artifactsDir?: string;
	/** Path to output JSON file for result */
	outputPath?: string;
	/** Optional override for rollback completion marker path */
	completionMarkerPath?: string;
	/** Output as JSON to stdout */
	json?: boolean;
	/** Reason for rollback */
	reason?: string;
	/** Optional override for canonical run-record base dir */
	runRecordsDir?: string;
}

/**
 * Success result envelope for pilot rollback execution.
 */
export interface PilotRollbackResult {
	ok: true;
	output: {
		incidentId: string;
		modeBefore: PilotMode;
		modeAfter: PilotMode;
		requestedAt: string;
		completedAt: string;
		rollbackEventsId: string;
		result: "success";
		reason: string;
	};
}

/**
 * Error result envelope for pilot rollback execution.
 */
export interface PilotRollbackError {
	ok: false;
	error: {
		code: "E_VALIDATION" | "E_PRECONDITION" | "E_NOT_FOUND" | "E_INTERNAL";
		message: string;
		context?: Record<string, unknown>;
	};
}

const DEFAULT_ARTIFACTS_DIR = "artifacts/pilot";
const DEFAULT_CONTRACT_PATH = "harness.contract.json";
const ROLLBACK_MARKER_FILE = "rollback-marker.json";
const ROLLBACK_EVENTS_FILE = "rollback-events.jsonl";

function nowIso(): string {
	return new Date().toISOString();
}

function generateEventsId(): string {
	const timestamp = Date.now().toString(36);
	const uuid = randomUUID().slice(0, 8);
	return `rollback-${timestamp}-${uuid}`;
}

function normalizePath(baseDir: string, userPath: string): string {
	try {
		return validatePath(baseDir, userPath);
	} catch (error) {
		if (error instanceof PathTraversalError) {
			throw new Error(`Path traversal detected: ${userPath}`);
		}
		throw error;
	}
}

function resolveArtifactsDir(artifactsDir?: string): string {
	const base = process.cwd();
	const targetDir = artifactsDir
		? resolve(base, artifactsDir)
		: resolve(base, DEFAULT_ARTIFACTS_DIR);
	// Always validate — covers both user-supplied paths and the default.
	// normalizePath is symlink-aware (uses realpathSync internally via validatePath).
	return normalizePath(base, targetDir);
}

function readCurrentMode(contractPath: string): PilotMode {
	try {
		const contract = loadContract(contractPath);
		// Check if pilotRollbackPolicy exists and has a mode field
		const policy = contract.pilotRollbackPolicy as
			| PilotRollbackPolicy
			| undefined;
		return policy?.mode ?? "manual";
	} catch {
		// Default to manual if contract can't be loaded
		return "manual";
	}
}

function readRollbackPolicy(
	contractPath: string,
): PilotRollbackPolicy | undefined {
	try {
		return loadContract(contractPath).pilotRollbackPolicy as
			| PilotRollbackPolicy
			| undefined;
	} catch {
		return undefined;
	}
}

/** Append a rollback event record using a temp-file write and atomic rename. */
function appendRollbackEvent(
	eventsPath: string,
	record: RollbackEventsRecord,
): void {
	mkdirSync(dirname(eventsPath), { recursive: true });
	const line = `${JSON.stringify(record)}\n`;

	// Atomic append: write to temp file, then rename (prevents race conditions)
	const tempPath = `${eventsPath}.${process.pid}.${randomUUID()}.tmp`;
	try {
		// Atomic append without loading the entire file into memory:
		// copy existing log to temp, then append the new line to the temp file.
		if (existsSync(eventsPath)) {
			copyFileSync(eventsPath, tempPath);
			writeFileSync(tempPath, line, { flag: "a", encoding: "utf-8" });
		} else {
			writeFileSync(tempPath, line, { encoding: "utf-8" });
		}
		renameSync(tempPath, eventsPath);
	} catch {
		// Clean up temp file on failure
		try {
			if (existsSync(tempPath)) {
				rmSync(tempPath);
			}
		} catch {
			// Ignore cleanup errors
		}
		// Fallback to direct append if atomic fails (e.g., cross-filesystem)
		writeFileSync(eventsPath, line, { flag: "a", encoding: "utf-8" });
	}
}

function writeRollbackMarker(markerPath: string, marker: RollbackMarker): void {
	mkdirSync(dirname(markerPath), { recursive: true });
	writeFileSync(markerPath, JSON.stringify(marker, null, 2), "utf-8");
}

type WriteRunRecord = (params: {
	outcome: "success" | "failed" | "blocked";
	classification:
		| "ok"
		| "validation_failed"
		| "precondition_failed"
		| "runtime_failed";
	exitCode: number;
	payload: Record<string, unknown>;
	artifacts?: Array<{ type: string; path: string; checksum?: string }>;
	contractPath?: string;
	headSha?: string;
	strict?: boolean;
}) => string | null;

/**
 * Build a run-record writer for pilot-rollback.
 */
function buildRunRecordWriter(
	options: PilotRollbackOptions,
	startedAt: string,
): WriteRunRecord {
	return (params): string | null => {
		try {
			const record = emitTerminalRunRecord({
				command: "pilot-rollback",
				startedAt,
				outcome: params.outcome,
				classification: params.classification,
				exitCode: params.exitCode,
				...(options.runRecordsDir ? { baseDir: options.runRecordsDir } : {}),
				repo: {
					repository: "unknown/unknown",
					...(params.headSha ? { headSha: params.headSha } : {}),
				},
				contract: {
					path:
						params.contractPath ??
						options.contractPath ??
						DEFAULT_CONTRACT_PATH,
				},
				policyContext: {
					mode: options.mode,
					safetyPosture: "strict",
					effectivePolicySource: "pilot-rollback-policy",
					hash: hashRunRecordValue({
						policy: "pilot-rollback-policy",
						mode: options.mode,
						incidentId: options.incidentId,
					}),
				},
				preconditions: {
					hasIncidentId: Boolean(options.incidentId?.trim()),
				},
				...(params.artifacts ? { artifacts: params.artifacts } : {}),
				event: {
					eventType:
						params.classification === "ok" ? "rollback" : "precondition",
					status:
						params.classification === "ok"
							? "completed"
							: params.classification === "precondition_failed"
								? "blocked"
								: "failed",
					severity: params.classification === "ok" ? "info" : "error",
					payload: params.payload,
				},
			});
			return record.manifestPath;
		} catch (error) {
			if (params.strict ?? false) {
				throw error;
			}
			console.error(
				`pilot-rollback: failed to emit canonical run record: ${sanitizeError(error)}`,
			);
			return sanitizeError(error);
		}
	};
}

/**
 * Validate required rollback inputs.
 */
function validateRollbackInputs(
	options: PilotRollbackOptions,
	writeRunRecord: WriteRunRecord,
): PilotRollbackError | null {
	if (!options.incidentId?.trim()) {
		writeRunRecord({
			outcome: "failed",
			classification: "validation_failed",
			exitCode: EXIT_CODES.VALIDATION,
			payload: { error: "missing_incident_id" },
			strict: false,
		});
		return {
			ok: false,
			error: {
				code: "E_VALIDATION",
				message: "Missing required option: --incident-id",
			},
		};
	}

	if (options.mode !== "autonomous" && options.mode !== "manual") {
		writeRunRecord({
			outcome: "failed",
			classification: "validation_failed",
			exitCode: EXIT_CODES.VALIDATION,
			payload: {
				error: "invalid_mode",
				mode: options.mode,
			},
			strict: false,
		});
		return {
			ok: false,
			error: {
				code: "E_VALIDATION",
				message: `Invalid mode: ${options.mode}. Must be 'autonomous' or 'manual'`,
			},
		};
	}

	return null;
}

/**
 * Emit a success run record for a completed rollback.
 */
function emitRollbackSuccess(
	options: PilotRollbackOptions,
	writeRunRecord: WriteRunRecord,
	contractPath: string,
	modeBefore: PilotMode,
	rollbackEventsId: string,
	eventsPath: string,
	markerPath: string,
): void {
	writeRunRecord({
		outcome: "success",
		classification: "ok",
		exitCode: EXIT_CODES.SUCCESS,
		contractPath,
		payload: {
			incidentId: options.incidentId,
			modeBefore,
			modeAfter: options.mode,
			rollbackEventsId,
		},
		artifacts: [
			{
				type: "rollback-events",
				path: eventsPath,
			},
			{
				type: "rollback-marker",
				path: markerPath,
			},
			...(options.outputPath
				? [{ type: "rollback-output", path: options.outputPath }]
				: []),
		],
		strict: true,
	});
}

/**
 * Handle rollback errors and emit run records.
 */
function handleRollbackError(
	error: unknown,
	writeRunRecord: WriteRunRecord,
): PilotRollbackError {
	if (error instanceof PathTraversalError) {
		writeRunRecord({
			outcome: "failed",
			classification: "validation_failed",
			exitCode: EXIT_CODES.VALIDATION,
			payload: {
				error: "path_traversal",
			},
			strict: false,
		});
		return {
			ok: false,
			error: {
				code: "E_VALIDATION",
				message: "Path traversal detected in provided paths",
			},
		};
	}
	writeRunRecord({
		outcome: "failed",
		classification: "runtime_failed",
		exitCode: EXIT_CODES.INTERNAL,
		payload: {
			error: "rollback_failed",
			message: sanitizeError(error),
		},
		strict: false,
	});
	return {
		ok: false,
		error: {
			code: "E_INTERNAL",
			message: `Rollback failed: ${sanitizeError(error)}`,
		},
	};
}

/**
 * Verify the contract file exists and emit a precondition record if missing.
 */
function ensureContractExists(
	contractPath: string,
	writeRunRecord: WriteRunRecord,
): PilotRollbackError | null {
	if (existsSync(contractPath)) {
		return null;
	}
	const runRecordError = writeRunRecord({
		outcome: "blocked",
		classification: "precondition_failed",
		exitCode: EXIT_CODES.PRECONDITION,
		contractPath,
		payload: {
			error: "missing_contract",
			contractPath,
		},
		strict: false,
	});
	return {
		ok: false,
		error: {
			code: "E_PRECONDITION",
			message: `Contract not found: ${contractPath}`,
			context: {
				contractPath,
				...(runRecordError ? { runRecordError } : {}),
			},
		},
	};
}

/**
 * Execute the pilot rollback workflow.
 *
 * @param options - Parsed pilot-rollback options
 * @returns Success or typed error payload
 */
export async function runPilotRollback(
	options: PilotRollbackOptions,
): Promise<PilotRollbackResult | PilotRollbackError> {
	const startedAt = new Date().toISOString();
	const writeRunRecord = buildRunRecordWriter(options, startedAt);

	try {
		const validationError = validateRollbackInputs(options, writeRunRecord);
		if (validationError) {
			return validationError;
		}

		const cwd = process.cwd();
		const contractPath = resolve(
			cwd,
			options.contractPath ?? DEFAULT_CONTRACT_PATH,
		);
		const artifactsDir = resolveArtifactsDir(options.artifactsDir);

		const contractError = ensureContractExists(contractPath, writeRunRecord);
		if (contractError) {
			return contractError;
		}

		const rollbackPolicy = readRollbackPolicy(contractPath);
		const modeBefore = rollbackPolicy?.mode ?? readCurrentMode(contractPath);

		if (modeBefore === options.mode) {
			process.stderr.write(
				`[pilot-rollback] Warning: requested mode '${options.mode}' is already the active mode \u2014 recording event but no state change will occur.\n`,
			);
		}
		const requestedAt = nowIso();

		const rollbackEventsId = generateEventsId();
		const eventsPath = normalizePath(
			cwd,
			resolve(artifactsDir, ROLLBACK_EVENTS_FILE),
		);

		const eventRecord: RollbackEventsRecord = {
			id: rollbackEventsId,
			incidentId: options.incidentId,
			modeTransition: { from: modeBefore, to: options.mode },
			triggeredAt: requestedAt,
			triggeredBy: "manual",
			triggerReason: options.reason ?? "Manual rollback requested",
		};

		appendRollbackEvent(eventsPath, eventRecord);

		const completedAt = nowIso();
		const markerPath = normalizePath(
			cwd,
			options.completionMarkerPath ??
				rollbackPolicy?.completionMarkerPath ??
				resolve(artifactsDir, ROLLBACK_MARKER_FILE),
		);

		const marker: RollbackMarker = {
			schemaVersion: "pilot-rollback-marker/v1",
			incidentId: options.incidentId,
			modeBefore,
			modeAfter: options.mode,
			requestedAt,
			completedAt,
			rollbackEventsId,
			result: "success",
			reason: options.reason ?? "Manual rollback requested",
		};

		writeRollbackMarker(markerPath, marker);

		if (options.outputPath) {
			const outputPath = normalizePath(cwd, options.outputPath);
			mkdirSync(dirname(outputPath), { recursive: true });
			writeFileSync(outputPath, JSON.stringify(marker, null, 2), "utf-8");
		}

		emitRollbackSuccess(
			options,
			writeRunRecord,
			contractPath,
			modeBefore,
			rollbackEventsId,
			eventsPath,
			markerPath,
		);

		return {
			ok: true,
			output: {
				incidentId: options.incidentId,
				modeBefore,
				modeAfter: options.mode,
				requestedAt,
				completedAt,
				rollbackEventsId,
				result: "success",
				reason: marker.reason,
			},
		};
	} catch (error) {
		return handleRollbackError(error, writeRunRecord);
	}
}

/**
 * Execute pilot rollback in CLI mode and return process exit code.
 *
 * @param options - Parsed CLI options
 * @returns Exit code for shell usage
 */
export async function runPilotRollbackCLI(
	options: PilotRollbackOptions,
): Promise<number> {
	const result = await runPilotRollback(options);

	if (!result.ok) {
		if (options.json) {
			console.error(JSON.stringify({ ok: false, error: result.error }));
		} else {
			console.error(result.error.message);
			if (result.error.context) {
				console.error(`Context: ${JSON.stringify(result.error.context)}`);
			}
		}

		switch (result.error.code) {
			case "E_VALIDATION":
				return EXIT_CODES.VALIDATION;
			case "E_PRECONDITION":
			case "E_NOT_FOUND":
				return EXIT_CODES.PRECONDITION;
			default:
				return EXIT_CODES.INTERNAL;
		}
	}

	const { output } = result;

	if (options.json) {
		console.info(
			JSON.stringify(
				{
					schemaVersion: "pilot-rollback-result/v1",
					ok: true,
					output,
				},
				null,
				2,
			),
		);
	} else {
		console.info("Rollback completed:");
		console.info(`  Incident: ${output.incidentId}`);
		console.info(`  Mode: ${output.modeBefore} → ${output.modeAfter}`);
		console.info(`  Events ID: ${output.rollbackEventsId}`);
		console.info(`  Completed at: ${output.completedAt}`);
		console.info(`  Reason: ${output.reason}`);
	}

	return EXIT_CODES.SUCCESS;
}
