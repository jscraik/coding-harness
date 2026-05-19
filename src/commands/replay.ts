import { join } from "node:path";
import {
	EXIT_CODES,
	emitInvalidTraceDirectoryRunRecord,
	emitReplayRunRecord,
} from "./replay-run-record.js";
import { validatePath } from "../lib/input/validator.js";
import {
	type ExecutionTrace,
	isValidTraceId,
	listTraces,
	loadTrace,
	replayTrace,
} from "../lib/replay/tracer.js";

export { EXIT_CODES } from "./replay-run-record.js";

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
	| { ok: true; trace: ExecutionTrace; traceId: string }
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
	return { ok: true, trace, traceId: options.traceId };
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

type ReplayTraceConfig = { baseDir: string; maxTraces: number };
type ReplayTraceResolutionFailure = {
	code: string;
	message: string;
	hint?: string;
};

function resolveReplayConfig(
	options: ReplayOptions,
): { ok: true; config?: ReplayTraceConfig } | { ok: false; exitCode: number } {
	if (!options.traceDir) return { ok: true };
	try {
		return {
			ok: true,
			config: {
				baseDir: validatePath(process.cwd(), options.traceDir),
				maxTraces: 100,
			},
		};
	} catch {
		logReplayError(
			options,
			"VALIDATION_ERROR",
			`Invalid trace directory: ${options.traceDir}`,
		);
		return {
			ok: false,
			exitCode: EXIT_CODES.VALIDATION_ERROR,
		};
	}
}

async function runTraceList(
	startedAt: string,
	options: ReplayOptions,
	config: ReplayTraceConfig | undefined,
): Promise<number> {
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

function emitTraceResolutionFailure(
	startedAt: string,
	options: ReplayOptions,
	traceResult: ReplayTraceResolutionFailure,
): number {
	const traceNotFound = traceResult.code === "TRACE_NOT_FOUND";
	logReplayError(
		options,
		traceResult.code,
		traceResult.message,
		traceResult.hint,
	);
	return emitReplayRunRecord(startedAt, options, {
		outcome: traceNotFound ? "blocked" : "failed",
		classification: traceNotFound ? "precondition_failed" : "validation_failed",
		exitCode: traceNotFound
			? EXIT_CODES.TRACE_NOT_FOUND
			: EXIT_CODES.VALIDATION_ERROR,
		payload: {
			error: traceNotFound ? "trace_not_found" : traceResult.code.toLowerCase(),
			traceId: options.traceId,
		},
	});
}

/**
 * Execute the replay command and return a process-style exit code.
 */
export async function runReplayCLI(options: ReplayOptions): Promise<number> {
	const startedAt = new Date().toISOString();

	try {
		const configResult = resolveReplayConfig(options);
		if (!configResult.ok) {
			return emitInvalidTraceDirectoryRunRecord(
				startedAt,
				options,
				configResult.exitCode,
			);
		}
		const config = configResult.config;

		if (options.list) {
			return runTraceList(startedAt, options, config);
		}

		const traceResult = await resolveTrace(options, config);
		if (!traceResult.ok) {
			return emitTraceResolutionFailure(startedAt, options, traceResult);
		}
		const replayOptions: {
			dryRun?: boolean;
			config?: { baseDir: string; maxTraces: number };
		} = {
			...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
			...(config !== undefined ? { config } : {}),
		};
		const result = await replayTrace(traceResult.traceId, replayOptions);
		printReplayResult(options, traceResult.traceId, traceResult.trace, result);

		return emitReplayResult(
			startedAt,
			options,
			traceResult.traceId,
			config,
			result,
		);
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
