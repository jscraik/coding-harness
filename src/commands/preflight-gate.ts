/**
 * Preflight policy gate command
 *
 * Fast checks to run before expensive operations (tests, builds).
 */

import { sanitizeError } from "../lib/input/sanitize.js";
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
	try {
		const result = await runPreflightGate(options);
		const gateResult = normalisePreflightGateResult(result);

		if (options.json) {
			process.stdout.write(`${JSON.stringify(gateResult, null, 2)}\n`);
		} else {
			renderGateDecision(gateResult, result.summary, result.riskTier);
		}

		if (result.passed) {
			return EXIT_CODES.SUCCESS;
		}
		const contractLoadFailure = result.checks.some(
			(check) =>
				(check.id === "contract-load" || check.id === "contract-exists") &&
				check.passed === false,
		);
		return contractLoadFailure
			? EXIT_CODES.CONTRACT_ERROR
			: EXIT_CODES.POLICY_VIOLATION;
	} catch (error) {
		console.error(
			`Preflight Gate Error: unexpected failure: ${sanitizeError(error)}`,
		);
		return EXIT_CODES.SYSTEM_ERROR;
	}
}
