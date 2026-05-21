import type { ReplayOptions } from "../lib/replay/options.js";
import type { ExecutionTrace, replayTrace } from "../lib/replay/tracer.js";

type ReplayTraceResult = Awaited<ReturnType<typeof replayTrace>>;

/**
 * Log a replay error to stderr, respecting the JSON output option.
 *
 * @param options - Replay options that determine output format.
 * @param code - Error code for JSON output.
 * @param message - Human-readable error message.
 * @param hint - Optional hint to print in plain-text mode.
 */
export function logReplayError(
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
export function printTraceList(
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
export function printReplayResult(
	options: ReplayOptions,
	traceId: string,
	trace: ExecutionTrace,
	result: ReplayTraceResult,
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
