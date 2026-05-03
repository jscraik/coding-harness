import type { RemediationOutcome } from "../lib/remediation/types.js";

/**
 * Render remediation command output in human-readable mode.
 */
export function renderRemediationOutput(outcome: RemediationOutcome): void {
	if (outcome.ok) {
		const { output } = outcome;
		console.info("Remediation complete:");
		console.info(`  Findings processed: ${output.findingsProcessed}`);
		console.info(`  Actions taken: ${output.actions.length}`);
		console.info(`  Skipped: ${output.skipped.length}`);

		if (output.actions.length > 0) {
			console.info("\nActions:");
			for (const action of output.actions) {
				const dryRunLabel = action.dryRun ? " (dry-run)" : "";
				console.info(
					`  - ${action.type}${dryRunLabel}: ${action.findingId} - ${action.reason}`,
				);
			}
		}

		if (output.skipped.length > 0) {
			console.info("\nSkipped:");
			for (const skip of output.skipped) {
				console.info(`  - ${skip.findingId}: ${skip.reason}`);
			}
		}

		if (output.telemetry) {
			console.info("\nTelemetry:");
			console.info(`  API calls: ${output.telemetry.apiCalls}`);
			console.info(`  Cache hits: ${output.telemetry.cacheHits}`);
		}

		if (output.transactions && output.transactions.length > 0) {
			console.info("\nTransactions:");
			for (const transaction of output.transactions) {
				console.info(
					`  - ${transaction.status}: ${transaction.findingId} (${transaction.reason})`,
				);
			}
		}
		return;
	}

	console.error(`Remediation failed: ${outcome.error.message}`);
	if (outcome.error.code === "E_RACE_DETECTED") {
		console.error("  A concurrent change was detected. Please retry.");
	}
	if (outcome.error.context) {
		console.error(`  Context: ${JSON.stringify(outcome.error.context)}`);
	}
}
