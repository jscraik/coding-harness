import type { ReplayOptions } from "../lib/replay/options.js";
import type { ExecutionTrace, replayTrace } from "../lib/replay/tracer.js";

type ReplayTraceResult = Awaited<ReturnType<typeof replayTrace>>;

/**
 * Log a replay error to stderr, formatted according to the provided options.
 *
 * When JSON output is enabled, emits an object with an `error` key containing
 * the `code` and `message`. Otherwise emits a plain-text `Error: <message>`
 * line and, if provided, a brief `hint` on a following line.
 *
 * @param options - Replay options that determine output format
 * @param code - Error code included in JSON output
 * @param message - Human-readable error message
 * @param hint - Optional hint printed after the error in plain-text mode
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
 * Print available execution traces to stdout, using JSON when `options.json` is true or a human-readable list otherwise.
 *
 * @param options - Replay options that control output formatting (e.g., `options.json` toggles JSON output)
 * @param traces - Array of trace descriptors; each item must include `traceId`, `command`, and `createdAt`
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
 * Render replay results either as pretty JSON or as a human-readable report and emit a failure marker to stderr.
 *
 * When `options.json` is true, writes a JSON object containing `success`, `traceId`, `replayedEvents`, `message`,
 * `command`, `args`, and `createdAt`. Otherwise writes a textual report with trace metadata, an optional dry-run
 * notice when `options.dryRun` is true, and a final success line to stdout or a failure line to stderr.
 *
 * @param options - Replay options that control output format and dry-run behaviour
 * @param traceId - Identifier of the replayed trace
 * @param trace - Execution trace metadata (command, args, createdAt, events)
 * @param result - Replay result containing `success`, `replayedEvents`, and `message`
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
