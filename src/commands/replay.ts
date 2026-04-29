import { join } from "node:path";
import {
	emitTerminalRunRecord,
	hashRunRecordValue,
} from "../lib/contract/run-record-emitter.js";
import { validatePath } from "../lib/input/validator.js";
import {
	type ExecutionTrace,
	isValidTraceId,
	listTraces,
	loadTrace,
	replayTrace,
} from "../lib/replay/tracer.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	TRACE_NOT_FOUND: 1,
	VALIDATION_ERROR: 2,
	REPLAY_ERROR: 3,
	SYSTEM_ERROR: 10,
} as const;

/**
 * CLI options for `harness replay`.
 */
export interface ReplayOptions {
	/** Trace ID to replay */
	traceId?: string;
	/** List available traces */
	list?: boolean;
	/** Dry run - don't execute, just show what would happen */
	dryRun?: boolean;
	/** Output as JSON */
	json?: boolean;
	/** Base directory for trace storage */
	traceDir?: string;
	/** Optional override for canonical run-record base dir */
	runRecordsDir?: string;
}

/**
 * Emit a canonical run record for a replay command and return the exit code.
 */
function emitReplayRunRecord(
	startedAt: string,
	options: ReplayOptions,
	params: {
		outcome: "success" | "failed" | "blocked";
		classification:
			| "ok"
			| "validation_failed"
			| "precondition_failed"
			| "runtime_failed";
		exitCode: number;
		payload: Record<string, unknown>;
		artifacts?: Array<{ type: string; path: string; checksum?: string }>;
	},
): number {
	try {
		emitTerminalRunRecord({
			command: "replay",
			startedAt,
			outcome: params.outcome,
			classification: params.classification,
			exitCode: params.exitCode,
			...(options.runRecordsDir ? { baseDir: options.runRecordsDir } : {}),
			policyContext: {
				mode: options.dryRun ? "dry-run" : "default",
				safetyPosture: "strict",
				effectivePolicySource: "replay-trace-policy",
				hash: hashRunRecordValue({
					policy: "replay-trace-policy",
					mode: options.dryRun ? "dry-run" : "default",
					list: Boolean(options.list),
					traceId: options.traceId ?? null,
				}),
			},
			preconditions: {
				traceIdProvided: Boolean(options.traceId),
				listMode: Boolean(options.list),
			},
			...(params.artifacts ? { artifacts: params.artifacts } : {}),
			event: {
				eventType: "decision",
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
	} catch (error) {
		console.error(
			`Failed to emit canonical run record for replay: ${String(error)}`,
		);
		return EXIT_CODES.SYSTEM_ERROR;
	}
	return params.exitCode;
}

/**
 * Log a replay error to stderr, respecting the JSON output option.
 *
 * @param options - Replay options that determine output format.
 * @param code - Error code for JSON output.
 * @param message - Human-readable error message.
 * @param hint - Optional hint to print in plain-text mode.
 */
function logReplayError(
	options: ReplayOptions,
	code: string,
	message: string,
	hint?: string,
): void {
	if (options.json) {
		console.error(JSON.stringify({ error: { code, message } }, null, 2));
	} else {
		console.error(`Error: ${message}`);
		if (hint) {
			console.error("");
			console.error(hint);
		}
	}
}

/**
 * Print the list of available traces, respecting the JSON output option.
 */
function printTraceList(
	options: ReplayOptions,
	traces: Array<{ traceId: string; command: string; createdAt: string }>,
): void {
	if (options.json) {
		console.info(JSON.stringify({ traces }, null, 2));
		return;
	}
	if (traces.length === 0) {
		console.info("No traces found.");
		return;
	}
	console.info(`Available traces (${traces.length}):`);
	console.info("");
	for (const trace of traces) {
		console.info(`  ${trace.traceId}`);
		console.info(`    Command: ${trace.command}`);
		console.info(`    Created: ${trace.createdAt}`);
		console.info("");
	}
}

/**
 * Print replay output to stdout, respecting the JSON output option.
 */
function printReplayResult(
	options: ReplayOptions,
	traceId: string,
	trace: ExecutionTrace,
	result: Awaited<ReturnType<typeof replayTrace>>,
): void {
	if (options.json) {
		console.info(
			JSON.stringify(
				{
					success: result.success,
					traceId,
					replayedEvents: result.replayedEvents,
					message: result.message,
					command: trace.command,
					args: trace.args,
					createdAt: trace.createdAt,
				},
				null,
				2,
			),
		);
		return;
	}

	console.info(`Replay: ${traceId}`);
	console.info(`Command: ${trace.command} ${trace.args.join(" ")}`);
	console.info(`Created: ${trace.createdAt}`);
	console.info(`Events: ${trace.events.length}`);
	console.info("");

	if (options.dryRun) {
		console.info("(Dry run - no events executed)");
	}

	if (result.success) {
		console.info(`✓ ${result.message}`);
	} else {
		console.error(`✗ ${result.message}`);
	}
}

/**
 * Validate trace input and load the trace if it exists.
 */
async function resolveTrace(
	options: ReplayOptions,
	config?: { baseDir: string; maxTraces: number },
): Promise<
	| { ok: true; trace: ExecutionTrace }
	| { ok: false; code: string; message: string; hint?: string }
> {
	if (!options.traceId) {
		return {
			ok: false,
			code: "VALIDATION_ERROR",
			message: "Trace ID required (--trace-id or --list)",
		};
	}
	if (!isValidTraceId(options.traceId)) {
		return {
			ok: false,
			code: "VALIDATION_ERROR",
			message: `Invalid trace ID format: ${options.traceId}`,
		};
	}
	const trace = await loadTrace(options.traceId, config);
	if (!trace) {
		return {
			ok: false,
			code: "TRACE_NOT_FOUND",
			message: `Trace not found: ${options.traceId}`,
			hint: "Use --list to see available traces.",
		};
	}
	return { ok: true, trace };
}

/**
 * Emit the final run record for a replay execution.
 */
function emitReplayResult(
	startedAt: string,
	options: ReplayOptions,
	traceId: string,
	config: { baseDir: string; maxTraces: number } | undefined,
	result: Awaited<ReturnType<typeof replayTrace>>,
): number {
	return emitReplayRunRecord(startedAt, options, {
		outcome: result.success ? "success" : "failed",
		classification: result.success ? "ok" : "runtime_failed",
		exitCode: result.success ? EXIT_CODES.SUCCESS : EXIT_CODES.REPLAY_ERROR,
		payload: {
			mode: options.dryRun ? "dry-run" : "replay",
			traceId,
			replayedEvents: result.replayedEvents,
			success: result.success,
		},
		artifacts: [
			{
				type: "trace",
				path: join(config?.baseDir ?? ".traces", traceId, "trace.json"),
			},
		],
	});
}

/**
 * Execute the replay command and return a process-style exit code.
 */
export async function runReplayCLI(options: ReplayOptions): Promise<number> {
	const startedAt = new Date().toISOString();

	try {
		let config:
			| {
					baseDir: string;
					maxTraces: number;
			  }
			| undefined;
		if (options.traceDir) {
			try {
				config = {
					baseDir: validatePath(process.cwd(), options.traceDir),
					maxTraces: 100,
				};
			} catch {
				logReplayError(
					options,
					"VALIDATION_ERROR",
					`Invalid trace directory: ${options.traceDir}`,
				);
				return emitReplayRunRecord(startedAt, options, {
					outcome: "failed",
					classification: "validation_failed",
					exitCode: EXIT_CODES.VALIDATION_ERROR,
					payload: {
						error: "invalid_trace_directory",
						traceDir: options.traceDir,
					},
				});
			}
		}

		if (options.list) {
			const traces = await listTraces(config);
			printTraceList(options, traces);
			return emitReplayRunRecord(startedAt, options, {
				outcome: "success",
				classification: "ok",
				exitCode: EXIT_CODES.SUCCESS,
				payload: {
					mode: "list",
					traceCount: traces.length,
				},
			});
		}

		const traceResult = await resolveTrace(options, config);
		if (!traceResult.ok) {
			logReplayError(
				options,
				traceResult.code,
				traceResult.message,
				traceResult.hint,
			);
			return emitReplayRunRecord(startedAt, options, {
				outcome: traceResult.code === "TRACE_NOT_FOUND" ? "blocked" : "failed",
				classification:
					traceResult.code === "TRACE_NOT_FOUND"
						? "precondition_failed"
						: "validation_failed",
				exitCode:
					traceResult.code === "TRACE_NOT_FOUND"
						? EXIT_CODES.TRACE_NOT_FOUND
						: EXIT_CODES.VALIDATION_ERROR,
				payload: {
					error:
						traceResult.code === "TRACE_NOT_FOUND"
							? "trace_not_found"
							: traceResult.code.toLowerCase(),
					traceId: options.traceId,
				},
			});
		}
		const traceId = options.traceId;
		if (!traceId) {
			throw new Error("Trace ID missing after validation");
		}

		const replayOptions: {
			dryRun?: boolean;
			config?: { baseDir: string; maxTraces: number };
		} = {
			...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
			...(config !== undefined ? { config } : {}),
		};
		const result = await replayTrace(traceId, replayOptions);
		printReplayResult(options, traceId, traceResult.trace, result);

		return emitReplayResult(startedAt, options, traceId, config, result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		logReplayError(options, "SYSTEM_ERROR", message);
		return emitReplayRunRecord(startedAt, options, {
			outcome: "failed",
			classification: "runtime_failed",
			exitCode: EXIT_CODES.SYSTEM_ERROR,
			payload: {
				error: "system_error",
				message,
			},
		});
	}
}
