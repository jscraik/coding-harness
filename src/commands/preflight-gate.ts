/**
 * Preflight policy gate command
 *
 * Fast checks to run before expensive operations (tests, builds).
 */

import { normalisePreflightGateResult } from "../lib/output/normalise.js";
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
		const icon =
			gateResult.status === "pass"
				? "✓"
				: gateResult.status === "warn"
					? "⚠"
					: "✗";
		console.info(`${icon} preflight-gate ${gateResult.status}`);
		console.info(`Reason: ${gateResult.reason}`);
		if (gateResult.action_now.length > 0) {
			console.info("Action now:");
			for (const step of gateResult.action_now) {
				console.info(`- ${step}`);
			}
		}
		if (gateResult.action_later.length > 0) {
			console.info("Action later:");
			for (const step of gateResult.action_later) {
				console.info(`- ${step}`);
			}
		}
		console.info(
			`Summary: ${result.summary.passed}/${result.summary.total} checks passed (${result.summary.durationMs}ms)`,
		);
		if (result.riskTier) {
			console.info(`Risk tier: ${result.riskTier}`);
		}
	}

	return result.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.POLICY_VIOLATION;
}
