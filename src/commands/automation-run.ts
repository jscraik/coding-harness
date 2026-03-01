import { resolve } from "node:path";
import {
	type AutomationKeyParts,
	computeAutomationIdempotencyKey,
	runAutomationWithIdempotency,
} from "../lib/automation/idempotency.js";

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
}

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

export function runAutomationRun(
	options: AutomationRunOptions,
): AutomationRunResult {
	if (!isAllowedAutomation(options.name)) {
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
		return {
			ok: false,
			error: { code: "VALIDATION_ERROR", message: missing },
		};
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

export function runAutomationRunCLI(options: AutomationRunOptions): number {
	const result = runAutomationRun(options);

	if (!result.ok) {
		if (options.json) {
			console.error(JSON.stringify({ error: result.error }, null, 2));
		} else {
			console.error(result.error.message);
		}
		return EXIT_CODES.USAGE;
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
