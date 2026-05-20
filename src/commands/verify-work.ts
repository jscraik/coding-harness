import {
	EXIT_CODES,
	runVerifyWork,
	type VerifyWorkCliOptions,
	verifyWorkRuntime,
} from "../lib/verify-work.js";

export { EXIT_CODES, type VerifyWorkCliOptions, verifyWorkRuntime };

/**
 * Execute the repository's verify-work wrapper script with the given CLI options.
 */
export function runVerifyWorkCLI(options: VerifyWorkCliOptions): number {
	return runVerifyWork(options);
}
