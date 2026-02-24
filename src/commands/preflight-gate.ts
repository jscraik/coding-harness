/**
 * Preflight policy gate command
 *
 * Fast checks to run before expensive operations (tests, builds).
 */

import {
	EXIT_CODES,
	type PreflightGateOptions,
	runPreflightGate,
} from "../lib/preflight/validator.js";

export { runPreflightGate, EXIT_CODES };
export type { PreflightGateOptions };

/**
 * CLI entry point for preflight gate
 */
export async function runPreflightGateCLI(
	options: PreflightGateOptions,
): Promise<number> {
	const result = await runPreflightGate(options);

	if (options.json) {
		// biome-ignore lint/suspicious/noConsoleLog: CLI output
		console.log(JSON.stringify(result, null, 2));
	} else {
		// Print summary header
		const statusIcon = result.passed ? "✓" : "✗";
		const statusText = result.passed ? "PASSED" : "FAILED";
		// biome-ignore lint/suspicious/noConsoleLog: CLI output
		console.log(`${statusIcon} Preflight gate ${statusText}`);
		// biome-ignore lint/suspicious/noConsoleLog: CLI output
		console.log();

		// Print individual checks
		for (const check of result.checks) {
			const icon = check.passed ? "✓" : check.severity === "error" ? "✗" : "⚠";
			// biome-ignore lint/suspicious/noConsoleLog: CLI output
			console.log(`${icon} ${check.description} (${check.durationMs}ms)`);
			if (!check.passed && check.message) {
				// biome-ignore lint/suspicious/noConsoleLog: CLI output
				console.log(`  ${check.message}`);
			}
		}

		// biome-ignore lint/suspicious/noConsoleLog: CLI output
		console.log();
		// biome-ignore lint/suspicious/noConsoleLog: CLI output
		console.log(
			`Summary: ${result.summary.passed}/${result.summary.total} checks passed (${result.summary.durationMs}ms)`,
		);

		if (result.riskTier) {
			// biome-ignore lint/suspicious/noConsoleLog: CLI output
			console.log(`Risk tier: ${result.riskTier}`);
		}
	}

	return result.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.POLICY_VIOLATION;
}
