/**
 * Preflight policy gate command
 *
 * Fast checks to run before expensive operations (tests, builds).
 */

import {
	normalisePreflightGateResult,
	renderGateDecision,
} from "../lib/output/normalise.js";
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
	const gateResult = normalisePreflightGateResult(result);

	if (options.json) {
		process.stdout.write(`${JSON.stringify(gateResult, null, 2)}\n`);
	} else {
		renderGateDecision(gateResult, result.summary, result.riskTier);
	}

	return result.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.POLICY_VIOLATION;
}