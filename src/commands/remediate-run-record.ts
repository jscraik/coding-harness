import {
	emitTerminalRunRecord,
	hashRunRecordValue,
} from "../lib/contract/run-record-emitter.js";
import type {
	ExitClassification,
	RunOutcome,
} from "../lib/contract/run-records.js";
import { DEFAULT_REMEDIATION_POLICY } from "../lib/contract/types.js";
import type {
	RemediateOptions,
	RemediateResult,
} from "../lib/remediate/types.js";
import { EXIT_CODES } from "./remediate-runner-helpers.js";

/**
 * Finalizes a remediate command result by optionally emitting canonical run-record evidence.
 */
export type RemediateFinalize = (
	result: RemediateResult,
	payload: Record<string, unknown>,
	options?: { emitRunRecord?: boolean },
) => RemediateResult;

/**
 * Build the list of artifacts to include in a remediation run record.
 *
 * @param options - Remediate CLI options that identify input artifacts.
 * @param result - Remediation result that may contain transaction artifacts.
 * @returns Canonical terminal run-record artifact descriptors.
 */
function buildRemediationArtifacts(
	options: RemediateOptions,
	result: RemediateResult,
): Array<{ type: string; path: string; checksum?: string }> {
	const artifacts: Array<{ type: string; path: string; checksum?: string }> =
		[];
	if (options.findings && options.findings !== "-") {
		artifacts.push({ type: "findings-input", path: options.findings });
	}
	if (result.outcome.ok && result.outcome.output.transactions) {
		for (const transaction of result.outcome.output.transactions) {
			artifacts.push({
				type: "remediation-transaction",
				path: transaction.artifactUri,
				checksum: transaction.artifactChecksum,
			});
		}
	}
	return artifacts;
}

/**
 * Determine the run-record outcome and classification for a remediation result.
 *
 * @param result - Remediation execution result.
 * @returns Terminal run outcome and exit classification.
 */
function classifyRemediationResult(result: RemediateResult): {
	outcome: RunOutcome;
	classification: ExitClassification;
} {
	const outcome: RunOutcome = !result.outcome.ok
		? "failed"
		: result.exitCode === EXIT_CODES.PARTIAL
			? "hold"
			: "success";
	const classification: ExitClassification = !result.outcome.ok
		? result.outcome.error.code === "E_POLICY"
			? "policy_blocked"
			: result.outcome.error.code === "E_ROLLBACK_MODE"
				? "precondition_failed"
				: result.outcome.error.code === "E_RACE_DETECTED"
					? "manual_intervention_required"
					: result.outcome.error.code === "E_VALIDATION" ||
							result.outcome.error.code === "E_CONTRACT"
						? "validation_failed"
						: "runtime_failed"
		: result.exitCode === EXIT_CODES.PARTIAL
			? "manual_intervention_required"
			: "ok";
	return { outcome, classification };
}

function runRecordFailureResult(
	result: RemediateResult,
	error: unknown,
): RemediateResult {
	const runRecordError = error instanceof Error ? error.message : String(error);
	if (result.outcome.ok) {
		return {
			outcome: {
				ok: false,
				error: {
					code: "E_INTERNAL",
					message: `Failed to emit canonical run record: ${runRecordError}`,
				},
			},
			exitCode: EXIT_CODES.INTERNAL,
		};
	}
	return {
		outcome: {
			ok: false,
			error: {
				...result.outcome.error,
				context: {
					...(result.outcome.error.context ?? {}),
					runRecordError,
				},
			},
		},
		exitCode: result.exitCode,
	};
}

function terminalStatus(classification: ExitClassification) {
	return classification === "ok"
		? "completed"
		: classification === "policy_blocked" ||
				classification === "precondition_failed" ||
				classification === "manual_intervention_required"
			? "blocked"
			: "failed";
}

function terminalSeverity(classification: ExitClassification) {
	return classification === "ok"
		? "info"
		: classification === "manual_intervention_required"
			? "warn"
			: "error";
}

/**
 * Create the canonical terminal run-record finalizer for remediate executions.
 *
 * @param options - Remediate CLI options that shape run-record metadata.
 * @param startedAt - ISO timestamp captured when the command starts.
 * @returns A finalizer that emits terminal run-record evidence unless explicitly disabled.
 */
export function createRemediateFinalizer(
	options: RemediateOptions,
	startedAt: string,
): RemediateFinalize {
	return (result, payload, finalizeOptions) => {
		if (finalizeOptions?.emitRunRecord === false) {
			return result;
		}
		try {
			const { outcome, classification } = classifyRemediationResult(result);
			emitTerminalRunRecord({
				command: "remediate",
				startedAt,
				outcome,
				classification,
				exitCode: result.exitCode,
				...(options.runRecordsDir ? { baseDir: options.runRecordsDir } : {}),
				contract: { path: options.contractPath ?? "harness.contract.json" },
				policyContext: {
					mode: options.subcommand ?? "run",
					safetyPosture: "strict",
					effectivePolicySource: "remediation-policy",
					hash: hashRunRecordValue({
						policy: "remediation-policy",
						defaultRemediationPolicy: DEFAULT_REMEDIATION_POLICY,
						mode: options.subcommand ?? "run",
						dryRun: options.dryRun ?? false,
						force: options.force ?? false,
					}),
				},
				preconditions: {
					dryRun: options.dryRun ?? false,
					force: options.force ?? false,
				},
				artifacts: buildRemediationArtifacts(options, result),
				event: {
					eventType: "decision",
					status: terminalStatus(classification),
					severity: terminalSeverity(classification),
					payload,
				},
			});
		} catch (error) {
			return runRecordFailureResult(result, error);
		}
		return result;
	};
}
