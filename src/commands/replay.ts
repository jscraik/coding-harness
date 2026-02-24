import { listTraces, loadTrace, replayTrace } from "../lib/replay/tracer.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	TRACE_NOT_FOUND: 1,
	VALIDATION_ERROR: 2,
	REPLAY_ERROR: 3,
	SYSTEM_ERROR: 10,
} as const;

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
}

/**
 * Run replay command and return exit code.
 */
export async function runReplayCLI(options: ReplayOptions): Promise<number> {
	try {
		const config = options.traceDir
			? { baseDir: options.traceDir, maxTraces: 100 }
			: undefined;

		// List mode
		if (options.list) {
			const traces = await listTraces(config);

			if (options.json) {
				console.info(JSON.stringify({ traces }, null, 2));
			} else {
				if (traces.length === 0) {
					console.info("No traces found.");
				} else {
					console.info(`Available traces (${traces.length}):`);
					console.info("");
					for (const trace of traces) {
						console.info(`  ${trace.traceId}`);
						console.info(`    Command: ${trace.command}`);
						console.info(`    Created: ${trace.createdAt}`);
						console.info("");
					}
				}
			}

			return EXIT_CODES.SUCCESS;
		}

		// Replay mode - require trace ID
		if (!options.traceId) {
			if (options.json) {
				console.error(
					JSON.stringify(
						{
							error: {
								code: "VALIDATION_ERROR",
								message: "Trace ID required (--trace-id or --list)",
							},
						},
						null,
						2,
					),
				);
			} else {
				console.error(
					"Error: Trace ID required. Use --trace-id <id> or --list",
				);
			}
			return EXIT_CODES.VALIDATION_ERROR;
		}

		// Validate trace ID format
		if (!options.traceId.startsWith("trace-")) {
			if (options.json) {
				console.error(
					JSON.stringify(
						{
							error: {
								code: "VALIDATION_ERROR",
								message: `Invalid trace ID format: ${options.traceId}`,
							},
						},
						null,
						2,
					),
				);
			} else {
				console.error(
					`Error: Invalid trace ID format. Expected trace-<hash>, got: ${options.traceId}`,
				);
			}
			return EXIT_CODES.VALIDATION_ERROR;
		}

		// Check if trace exists
		const trace = await loadTrace(options.traceId, config);
		if (!trace) {
			if (options.json) {
				console.error(
					JSON.stringify(
						{
							error: {
								code: "TRACE_NOT_FOUND",
								message: `Trace not found: ${options.traceId}`,
							},
						},
						null,
						2,
					),
				);
			} else {
				console.error(`Error: Trace not found: ${options.traceId}`);
				console.error("");
				console.error("Use --list to see available traces.");
			}
			return EXIT_CODES.TRACE_NOT_FOUND;
		}

		// Replay the trace
		const replayOptions: {
			dryRun?: boolean;
			config?: { baseDir: string; maxTraces: number };
		} = {
			...(options.dryRun !== undefined ? { dryRun: options.dryRun } : {}),
			...(config !== undefined ? { config } : {}),
		};
		const result = await replayTrace(options.traceId, replayOptions);

		if (options.json) {
			console.info(
				JSON.stringify(
					{
						success: result.success,
						traceId: options.traceId,
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
		} else {
			console.info(`Replay: ${options.traceId}`);
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

		return result.success ? EXIT_CODES.SUCCESS : EXIT_CODES.REPLAY_ERROR;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";

		if (options.json) {
			console.error(
				JSON.stringify(
					{
						error: {
							code: "SYSTEM_ERROR",
							message,
						},
					},
					null,
					2,
				),
			);
		} else {
			console.error(`System error: ${message}`);
		}

		return EXIT_CODES.SYSTEM_ERROR;
	}
}
