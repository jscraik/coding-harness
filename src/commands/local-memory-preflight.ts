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
