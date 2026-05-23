import { validatePath } from "../lib/input/validator.js";
import {
	type ExecutionTrace,
	isValidTraceId,
	loadTrace,
} from "../lib/replay/tracer.js";
import type {
	ReplayOptions,
	ReplayTraceConfig,
	ReplayTraceResolutionFailure,
} from "../lib/replay/options.js";
import { logReplayError } from "./replay-output.js";
import { EXIT_CODES } from "./replay-run-record.js";

/**
 * Resolve and validate replay trace storage configuration when a trace directory is provided.
 *
 * @param options - CLI replay options; `options.traceDir` selects and validates the trace storage directory and controls whether a config is produced.
 * @returns If `options.traceDir` is not set, `{ ok: true }`. If set and valid, `{ ok: true, config }` where `config` contains the resolved `baseDir` and `maxTraces` (100). If validation fails, `{ ok: false, exitCode: EXIT_CODES.VALIDATION_ERROR }`.
 */
export function resolveReplayConfig(
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
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		logReplayError(
			options,
			"VALIDATION_ERROR",
			`Invalid trace directory: ${options.traceDir} (${reason})`,
		);
		return {
			ok: false,
			exitCode: EXIT_CODES.VALIDATION_ERROR,
		};
	}
}

/**
 * Validate trace input and load the trace if it exists.
 */
export async function resolveTrace(
	options: ReplayOptions,
	config?: ReplayTraceConfig,
): Promise<
	| { ok: true; trace: ExecutionTrace; traceId: string }
	| ({ ok: false } & ReplayTraceResolutionFailure)
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
	try {
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
	} catch (error) {
		return {
			ok: false,
			code: "TRACE_LOAD_ERROR",
			message: `Failed to load trace ${options.traceId}: ${error instanceof Error ? error.message : String(error)}`,
			hint: "Ensure trace file is readable and properly formatted.",
		};
	}
}
