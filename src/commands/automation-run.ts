import { resolve } from "node:path";
import {
	type AutomationKeyParts,
	type IdempotencyRunResult,
	computeAutomationIdempotencyKey,
	runAutomationWithIdempotency,
} from "../lib/contract/idempotency.js";
import {
	emitTerminalRunRecord,
	hashRunRecordValue,
} from "../lib/contract/run-record-emitter.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	USAGE: 2,
	IN_PROGRESS: 3,
	FAILED: 4,
	SYSTEM: 10,
} as const;

const ALLOWED_AUTOMATIONS = [
	"pulse",
	"upskill",
	"green-prs",
	"drift-check",
] as const;
type AllowedAutomation = (typeof ALLOWED_AUTOMATIONS)[number];

/**
 * CLI/runtime options for automation run execution.
 */
export interface AutomationRunOptions {
	name: string;
	repo: string;
	headSha: string;
	contractVersion: string;
	inputFingerprint: string;
	artifactsDir?: string;
	statePath?: string;
	force?: boolean;
	simulateFailure?: boolean;
	json?: boolean;
	runRecordsDir?: string;
}

/**
 * Canonical output shape for an automation run invocation.
 */
export interface AutomationRunOutput {
	automationName: string;
	status: "in_progress" | "succeeded" | "failed";
	replayed: boolean;
	forceApplied: boolean;
	idempotencyKey: string;
	attemptId: string;
	artifactUri: string;
	artifactChecksum: string;
	statePath: string;
	reason?: string;
}

/**
 * Result envelope for automation run execution.
 */
export type AutomationRunResult =
	| { ok: true; output: AutomationRunOutput }
	| { ok: false; error: { code: string; message: string } };

function isAllowedAutomation(value: string): value is AllowedAutomation {
	return (ALLOWED_AUTOMATIONS as readonly string[]).includes(value);
}

function validateRequired(option: string, value: string): string | null {
	if (value.trim().length === 0) {
		return `Missing required option: ${option}`;
	}
	return null;
}

function buildPayload(
	options: AutomationRunOptions,
	keyParts: AutomationKeyParts,
): Record<string, unknown> {
	return {
		summary: `${keyParts.automationName} automation report`,
		repository: keyParts.repo,
		headSha: keyParts.headSha,
		contractVersion: keyParts.contractVersion,
		inputFingerprint: keyParts.inputFingerprint,
		mode: options.force ? "force" : "default",
	};
}

interface RunRecordParams {
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
 * Creates a run-record writer bound to the given options and start time.
 *
 * @param options - The automation run options.
 * @param startedAt - ISO timestamp when the run started.
 * @returns A function that emits a run record and returns an error string, or null on success.
 */
function createRunRecordWriter(
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
					status:
						params.classification === "ok"
							? "completed"
							: params.classification === "precondition_failed"
								? "blocked"
								: "failed",
					severity:
						params.classification === "ok"
							? "info"
							: params.classification === "precondition_failed"
								? "warn"
								: "error",
					payload: params.payload,
				},
			});
			return null;
		} catch (error) {
			return String(error);
		}
	};
}

/**
 * Validates the automation name and required options.
 *
 * @param options - The automation run options.
 * @param writeRunRecord - Function to emit a run record on validation failure.
 * @returns An error result if validation fails, otherwise null.
 */
function validateAutomationRun(
	options: AutomationRunOptions,
	writeRunRecord: (params: RunRecordParams) => string | null,
): AutomationRunResult | null {
	if (!isAllowedAutomation(options.name)) {
		const runRecordError = writeRunRecord({
			outcome: "failed",
			classification: "validation_failed",
			exitCode: EXIT_CODES.USAGE,
			payload: {
				automationName: options.name,
				error: "invalid_automation_name",
			},
		});
		if (runRecordError) {
			return {
				ok: false,
				error: {
					code: "RUN_RECORD_ERROR",
					message: `Failed to emit canonical run record: ${runRecordError}`,
				},
			};
		}
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message: `Invalid automation name '${options.name}'. Expected one of: ${ALLOWED_AUTOMATIONS.join(", ")}`,
			},
		};
	}

	const missing =
		validateRequired("--repo", options.repo) ??
		validateRequired("--head-sha", options.headSha) ??
		validateRequired("--contract-version", options.contractVersion) ??
		validateRequired("--input-fingerprint", options.inputFingerprint);
	if (missing) {
		const runRecordError = writeRunRecord({
			outcome: "failed",
			classification: "validation_failed",
			exitCode: EXIT_CODES.USAGE,
			payload: {
				automationName: options.name,
				error: "missing_required_option",
				message: missing,
			},
		});
		if (runRecordError) {
			return {
				ok: false,
				error: {
					code: "RUN_RECORD_ERROR",
					message: `Failed to emit canonical run record: ${runRecordError}`,
				},
			};
		}
		return {
			ok: false,
			error: { code: "VALIDATION_ERROR", message: missing },
		};
	}

	return null;
}

/**
 * Handles a run that was blocked by the idempotency gate.
 *
 * @param runResult - The idempotency result for a blocked run.
 * @param options - The automation run options.
 * @param writeRunRecord - Function to emit a run record.
 * @returns The automation run result.
 */
function handleBlockedRun(
	runResult: Extract<IdempotencyRunResult, { ok: false }>,
	options: AutomationRunOptions,
	writeRunRecord: (params: RunRecordParams) => string | null,
): AutomationRunResult {
	const runRecordError = writeRunRecord({
		outcome: "blocked",
		classification: "precondition_failed",
		exitCode: EXIT_CODES.IN_PROGRESS,
		artifacts: [
			{
				type: "automation-report",
				path: runResult.run.artifactUri,
				checksum: runResult.run.artifactChecksum,
			},
			{
				type: "idempotency-state",
				path: runResult.statePath,
			},
		],
		payload: {
			automationName: options.name,
			status: runResult.run.status,
			reason: "idempotency_in_progress",
		},
	});
	if (runRecordError) {
		return {
			ok: false,
			error: {
				code: "RUN_RECORD_ERROR",
				message: `Failed to emit canonical run record: ${runRecordError}`,
			},
		};
	}
	return {
		ok: true,
		output: {
			automationName: options.name,
			status: runResult.run.status,
			replayed: false,
			forceApplied: options.force ?? false,
			idempotencyKey: runResult.key,
			attemptId: runResult.run.attemptId,
			artifactUri: runResult.run.artifactUri,
			artifactChecksum: runResult.run.artifactChecksum,
			statePath: runResult.statePath,
			reason:
				"Idempotency gate blocked duplicate run while prior attempt is in progress",
		},
	};
}

/**
 * Handles a successful or failed automation run after idempotency checks.
 *
 * @param runResult - The idempotency result for a successful run.
 * @param options - The automation run options.
 * @param keyParts - The key parts used for idempotency.
 * @param writeRunRecord - Function to emit a run record.
 * @returns The automation run result.
 */
function handleSuccessfulRun(
	runResult: Extract<IdempotencyRunResult, { ok: true }>,
	options: AutomationRunOptions,
	keyParts: AutomationKeyParts,
	writeRunRecord: (params: RunRecordParams) => string | null,
): AutomationRunResult {
	const runRecordError = writeRunRecord({
		outcome: runResult.run.status === "failed" ? "failed" : "success",
		classification: runResult.run.status === "failed" ? "runtime_failed" : "ok",
		exitCode:
			runResult.run.status === "failed"
				? EXIT_CODES.FAILED
				: EXIT_CODES.SUCCESS,
		artifacts: [
			{
				type: "automation-report",
				path: runResult.run.artifactUri,
				checksum: runResult.run.artifactChecksum,
			},
			{
				type: "idempotency-state",
				path: runResult.statePath,
			},
		],
		payload: {
			automationName: options.name,
			status: runResult.run.status,
			replayed: runResult.replayed,
			forceApplied: options.force ?? false,
			idempotencyKey: computeAutomationIdempotencyKey(keyParts),
		},
	});
	if (runRecordError) {
		return {
			ok: false,
			error: {
				code: "RUN_RECORD_ERROR",
				message: `Failed to emit canonical run record: ${runRecordError}`,
			},
		};
	}

	return {
		ok: true,
		output: {
			automationName: options.name,
			status: runResult.run.status,
			replayed: runResult.replayed,
			forceApplied: options.force ?? false,
			idempotencyKey: computeAutomationIdempotencyKey(keyParts),
			attemptId: runResult.run.attemptId,
			artifactUri: runResult.run.artifactUri,
			artifactChecksum: runResult.run.artifactChecksum,
			statePath: runResult.statePath,
			...(runResult.run.reason ? { reason: runResult.run.reason } : {}),
		},
	};
}

/**
 * Execute the automation-run command and return structured result data.
 *
 * @param options - Parsed automation-run options
 * @returns Structured success or error result
 */
export function runAutomationRun(
	options: AutomationRunOptions,
): AutomationRunResult {
	const startedAt = new Date().toISOString();
	const writeRunRecord = createRunRecordWriter(options, startedAt);

	const validationError = validateAutomationRun(options, writeRunRecord);
	if (validationError) {
		return validationError;
	}

	const artifactsDir = resolve(options.artifactsDir ?? "artifacts/automation");
	const statePath = resolve(
		options.statePath ?? `${artifactsDir}/idempotency-state.json`,
	);
	const keyParts: AutomationKeyParts = {
		repo: options.repo,
		headSha: options.headSha,
		automationName: options.name,
		contractVersion: options.contractVersion,
		inputFingerprint: options.inputFingerprint,
	};

	const runResult = runAutomationWithIdempotency({
		keyParts,
		artifactsDir,
		statePath,
		...(options.force !== undefined ? { force: options.force } : {}),
		execute: () => {
			if (options.simulateFailure) {
				return {
					ok: false,
					payload: buildPayload(options, keyParts),
					reason: "Simulated automation failure",
				};
			}
			return {
				ok: true,
				payload: buildPayload(options, keyParts),
			};
		},
	});

	if (!runResult.ok) {
		return handleBlockedRun(runResult, options, writeRunRecord);
	}

	return handleSuccessfulRun(runResult, options, keyParts, writeRunRecord);
}

/**
 * Execute automation-run in CLI mode and return process exit code.
 *
 * @param options - Parsed automation-run options
 * @returns Exit code for shell usage
 */
export function runAutomationRunCLI(options: AutomationRunOptions): number {
	const result = runAutomationRun(options);

	if (!result.ok) {
		if (options.json) {
			console.error(JSON.stringify({ error: result.error }, null, 2));
		} else {
			console.error(result.error.message);
		}
		return result.error.code === "RUN_RECORD_ERROR"
			? EXIT_CODES.SYSTEM
			: EXIT_CODES.USAGE;
	}

	if (options.json) {
		console.info(JSON.stringify(result.output, null, 2));
	} else {
		console.info(
			`${result.output.automationName}: ${result.output.status}${result.output.replayed ? " (replayed)" : ""}`,
		);
		console.info(`  idempotency_key: ${result.output.idempotencyKey}`);
		console.info(`  attempt_id: ${result.output.attemptId}`);
		console.info(`  artifact_uri: ${result.output.artifactUri}`);
	}

	if (result.output.reason?.includes("in progress")) {
		return EXIT_CODES.IN_PROGRESS;
	}
	if (result.output.status === "failed") {
		return EXIT_CODES.FAILED;
	}
	return EXIT_CODES.SUCCESS;
}
