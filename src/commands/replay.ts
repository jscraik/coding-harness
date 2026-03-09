import { join } from "node:path";
import {
	emitTerminalRunRecord,
	hashRunRecordValue,
} from "../lib/contract/run-record-emitter.js";
import { validatePath } from "../lib/input/validator.js";
import {
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
 * Run replay command and return exit code.
 */
export async function runReplayCLI(options: ReplayOptions): Promise<number> {
	const startedAt = new Date().toISOString();
	const finish = (params: {
		outcome: "success" | "failed" | "blocked";
		classification:
			| "ok"
			| "validation_failed"
			| "precondition_failed"
			| "runtime_failed";
		exitCode: number;
		payload: Record<string, unknown>;
		artifacts?: Array<{ type: string; path: string; checksum?: string }>;
	}): number => {
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
	};

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
				if (options.json) {
					console.error(
						JSON.stringify(
							{
								error: {
									code: "VALIDATION_ERROR",
									message: `Invalid trace directory: ${options.traceDir}`,
								},
							},
							null,
							2,
						),
					);
				} else {
					console.error(`Error: Invalid trace directory: ${options.traceDir}`);
				}
				return finish({
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

			return finish({
				outcome: "success",
				classification: "ok",
				exitCode: EXIT_CODES.SUCCESS,
				payload: {
					mode: "list",
					traceCount: traces.length,
				},
			});
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
			return finish({
				outcome: "failed",
				classification: "validation_failed",
				exitCode: EXIT_CODES.VALIDATION_ERROR,
				payload: {
					error: "missing_trace_id",
				},
			});
		}

		// Validate trace ID format
		if (!isValidTraceId(options.traceId)) {
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
					`Error: Invalid trace ID format. Expected trace-<16 hex chars>, got: ${options.traceId}`,
				);
			}
			return finish({
				outcome: "failed",
				classification: "validation_failed",
				exitCode: EXIT_CODES.VALIDATION_ERROR,
				payload: {
					error: "invalid_trace_id_format",
					traceId: options.traceId,
				},
			});
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
			return finish({
				outcome: "blocked",
				classification: "precondition_failed",
				exitCode: EXIT_CODES.TRACE_NOT_FOUND,
				payload: {
					error: "trace_not_found",
					traceId: options.traceId,
				},
			});
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

		return finish({
			outcome: result.success ? "success" : "failed",
			classification: result.success ? "ok" : "runtime_failed",
			exitCode: result.success ? EXIT_CODES.SUCCESS : EXIT_CODES.REPLAY_ERROR,
			payload: {
				mode: options.dryRun ? "dry-run" : "replay",
				traceId: options.traceId,
				replayedEvents: result.replayedEvents,
				success: result.success,
			},
			artifacts: [
				{
					type: "trace",
					path: join(
						config?.baseDir ?? ".traces",
						options.traceId,
						"trace.json",
					),
				},
			],
		});
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

		return finish({
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
