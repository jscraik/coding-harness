import {
	emitTerminalRunRecord,
	hashRunRecordValue,
} from "../lib/contract/run-record-emitter.js";
import type { AutomationRunOptions } from "./automation-run.js";

/** Inputs recorded for a terminal automation-run run record. */
export interface RunRecordParams {
	outcome: "success" | "failed" | "blocked";
	classification:
		| "ok"
		| "validation_failed"
		| "runtime_failed"
		| "precondition_failed";
	exitCode: number;
	artifacts?: Array<{ type: string; path: string; checksum?: string }>;
	payload: Record<string, unknown>;
}

/**
 * Creates a writer that emits one terminal automation-run record for the configured run.
 *
 * @param options - Automation command options that provide repository and policy context
 * @param startedAt - ISO timestamp captured when the command started
 * @returns A writer that returns null on success or an error string when record emission fails
 */
export function createRunRecordWriter(
	options: AutomationRunOptions,
	startedAt: string,
): (params: RunRecordParams) => string | null {
	return (params) => {
		try {
			emitTerminalRunRecord({
				command: "automation-run",
				startedAt,
				outcome: params.outcome,
				classification: params.classification,
				exitCode: params.exitCode,
				...(options.runRecordsDir ? { baseDir: options.runRecordsDir } : {}),
				repo: {
					repository: options.repo,
					headSha: options.headSha,
				},
				contract: {
					path: "harness.contract.json",
					version: options.contractVersion,
				},
				policyContext: {
					mode: options.force ? "force" : "default",
					safetyPosture: "strict",
					effectivePolicySource: "automation-idempotency",
					hash: hashRunRecordValue({
						policy: "automation-idempotency",
						mode: options.force ? "force" : "default",
						safetyPosture: "strict",
						contractVersion: options.contractVersion,
						inputFingerprint: options.inputFingerprint,
					}),
				},
				preconditions: {
					inputValid: params.classification !== "validation_failed",
				},
				...(params.artifacts ? { artifacts: params.artifacts } : {}),
				event: {
					eventType: "decision",
					status: eventStatus(params.classification),
					severity: eventSeverity(params.classification),
					payload: params.payload,
				},
			});
			return null;
		} catch (error) {
			return String(error);
		}
	};
}

function eventStatus(
	classification: RunRecordParams["classification"],
): "completed" | "blocked" | "failed" {
	if (classification === "ok") return "completed";
	return classification === "precondition_failed" ? "blocked" : "failed";
}

function eventSeverity(
	classification: RunRecordParams["classification"],
): "info" | "warn" | "error" {
	if (classification === "ok") return "info";
	return classification === "precondition_failed" ? "warn" : "error";
}
