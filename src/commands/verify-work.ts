import {
	EXIT_CODES,
	runVerifyWork,
	runVerifyWorkFromCliArgs,
	type VerifyWorkCliOptions,
	verifyWorkRuntime,
} from "../lib/verify-work.js";

export { EXIT_CODES, type VerifyWorkCliOptions, verifyWorkRuntime };

/**
 * Run the repository's verify-work wrapper using the provided CLI options.
 *
 * @param options - CLI options that control verify-work execution
 * @returns The process exit code: `0` for success, non-zero for failure
 */
export function runVerifyWorkCLI(options: VerifyWorkCliOptions): number {
	return runVerifyWork(options);
}

/**
 * Run the repository's verify-work wrapper using raw CLI argument strings.
 *
 * @param args - Raw CLI argument strings (for example, `process.argv.slice(2)`)
 * @returns The numeric exit code produced by the wrapper
 */
export function runVerifyWorkArgsCLI(args: string[]): number {
	return runVerifyWorkFromCliArgs(args);
}
