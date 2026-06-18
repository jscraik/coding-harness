import type { RemediationOutcome } from "../lib/remediation/types.js";

type SuccessfulOutcome = Extract<RemediationOutcome, { ok: true }>;
type RemediationOutput = SuccessfulOutcome["output"];

function renderActions(output: RemediationOutput): void {
	if (output.actions.length === 0) {
		return;
	}
	console.info("\nActions:");
	for (const action of output.actions) {
		const dryRunLabel = action.dryRun ? " (dry-run)" : "";
		console.info(
			`  - ${action.type}${dryRunLabel}: ${action.findingId} - ${action.reason}`,
		);
	}
}

function renderSkipped(output: RemediationOutput): void {
	if (output.skipped.length === 0) {
		return;
	}
	console.info("\nSkipped:");
	for (const skip of output.skipped) {
		console.info(`  - ${skip.findingId}: ${skip.reason}`);
	}
}

function renderTelemetry(output: RemediationOutput): void {
	if (!output.telemetry) {
		return;
	}
	console.info("\nTelemetry:");
	console.info(`  API calls: ${output.telemetry.apiCalls}`);
	console.info(`  Cache hits: ${output.telemetry.cacheHits}`);
}

function renderTransactions(output: RemediationOutput): void {
	if (!output.transactions || output.transactions.length === 0) {
		return;
	}
	console.info("\nTransactions:");
	for (const transaction of output.transactions) {
		console.info(
			`  - ${transaction.status}: ${transaction.findingId} (${transaction.reason})`,
		);
	}
}

function renderSuccess(outcome: SuccessfulOutcome): void {
	const { output } = outcome;
	console.info("Remediation complete:");
	console.info(`  Findings processed: ${output.findingsProcessed}`);
	console.info(`  Actions taken: ${output.actions.length}`);
	console.info(`  Skipped: ${output.skipped.length}`);
	renderActions(output);
	renderSkipped(output);
	renderTelemetry(output);
	renderTransactions(output);
}

function renderFailure(
	outcome: Extract<RemediationOutcome, { ok: false }>,
): void {
	console.error(`Remediation failed: ${outcome.error.message}`);
	if (outcome.error.code === "E_RACE_DETECTED") {
		console.error("  A concurrent change was detected. Please retry.");
	}
	if (outcome.error.context) {
		console.error(`  Context: ${JSON.stringify(outcome.error.context)}`);
	}
}

/**
 * Render remediation command output in human-readable mode.
 */
export function renderRemediationOutput(outcome: RemediationOutcome): void {
	if (outcome.ok) {
		renderSuccess(outcome);
		return;
	}
	renderFailure(outcome);
}
