import type { GateResult } from "./types.js";

/**
 * Render a gate result to the console with consistent formatting.
 * Shared across all gate CLI entry points.
 *
 * @param gateResult - The normalized GateResult to render
 * @param summary - Optional summary object with passed/total counts and durationMs
 * @param riskTier - Optional risk tier to display
 */
export function renderGateDecision(
	gateResult: GateResult,
	summary?: { passed: number; total: number; durationMs: number },
	riskTier?: string,
): void {
	const icon =
		gateResult.status === "pass"
			? "✓"
			: gateResult.status === "warn"
				? "⚠"
				: "✗";
	console.info(`${icon} ${gateResult.gate} ${gateResult.status}`);
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
	if (summary) {
		console.info(
			`Summary: ${summary.passed}/${summary.total} checks passed (${summary.durationMs}ms)`,
		);
	}
	if (riskTier) {
		console.info(`Risk tier: ${riskTier}`);
	}
}
