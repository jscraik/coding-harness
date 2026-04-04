import { runLocalMemoryPreflight } from "../lib/preflight/local-memory.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	PREFLIGHT_FAILED: 1,
	USAGE_ERROR: 2,
} as const;

export interface LocalMemoryPreflightCliOptions {
	configPath?: string;
	daemonLogPath?: string;
	json?: boolean;
}

/**
 * Run the local-memory preflight check and print its result to the console.
 *
 * The function invokes the preflight routine and emits either a pretty-printed
 * JSON object (when `options.json` is true) or line-oriented messages to
 * stdout/stderr depending on the overall pass state. Errors thrown by the
 * preflight routine or by console operations are propagated to the caller.
 *
 * @param options - CLI options; when `options.json` is true output is JSON, otherwise messages are printed line-by-line. `configPath` and `daemonLogPath` (if provided) are forwarded to the preflight routine.
 * @returns The process exit code: `EXIT_CODES.SUCCESS` when the preflight passed, `EXIT_CODES.PREFLIGHT_FAILED` when it did not.
 */
export async function runLocalMemoryPreflightCLI(
	options: LocalMemoryPreflightCliOptions,
): Promise<number> {
	const result = await runLocalMemoryPreflight(options);

	if (options.json) {
		console.info(JSON.stringify(result, null, 2));
	} else {
		const stream = result.passed ? console.info : console.error;
		for (const message of result.messages) {
			stream(message);
		}
	}

	return result.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.PREFLIGHT_FAILED;
}
