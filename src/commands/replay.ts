import { join } from "node:path";
import {
	EXIT_CODES,
	emitInvalidTraceDirectoryRunRecord,
	emitReplayRunRecord,
} from "./replay-run-record.js";
import { listTraces, replayTrace } from "../lib/replay/tracer.js";
import {
	logReplayError,
	printReplayResult,
	printTraceList,
} from "./replay-output.js";
import type {
	ReplayOptions,
	ReplayTraceConfig,
	ReplayTraceResolutionFailure,
} from "../lib/replay/options.js";
import { resolveReplayConfig, resolveTrace } from "./replay-resolution.js";

export { EXIT_CODES } from "./replay-run-record.js";
export type { ReplayOptions } from "../lib/replay/options.js";

/**
 * Emit the final run record for a replay execution.
 */
function emitReplayResult(
	startedAt: string,
	options: ReplayOptions,
	traceId: string,
	config: ReplayTraceConfig | undefined,
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
			config?: ReplayTraceConfig;
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
