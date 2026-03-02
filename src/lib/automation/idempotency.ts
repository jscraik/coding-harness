import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

export type AutomationRunStatus = "in_progress" | "succeeded" | "failed";

export interface AutomationKeyParts {
	repo: string;
	headSha: string;
	automationName: string;
	contractVersion: string;
	inputFingerprint: string;
}

export interface AutomationRunRecord {
	attemptId: string;
	status: AutomationRunStatus;
	artifactUri: string;
	artifactChecksum: string;
	startedAt: string;
	completedAt?: string;
	reason?: string;
	previousAttemptId?: string;
}

export interface AutomationIdempotencyState {
	schemaVersion: "automation-idempotency/v1";
	runs: Record<string, AutomationRunRecord>;
}

export interface AutomationExecuteResult {
	ok: boolean;
	payload: Record<string, unknown>;
	reason?: string;
}

export interface RunWithIdempotencyOptions {
	keyParts: AutomationKeyParts;
	artifactsDir: string;
	statePath: string;
	force?: boolean;
	execute: () => AutomationExecuteResult;
}

export type IdempotencyRunResult =
	| {
			ok: true;
			replayed: boolean;
			key: string;
			run: AutomationRunRecord;
			statePath: string;
	  }
	| {
			ok: false;
			code: "IN_PROGRESS";
			key: string;
			run: AutomationRunRecord;
			statePath: string;
	  };

function createAttemptId(name: string): string {
	const random = Math.random().toString(16).slice(2, 10);
	return `${name}-${Date.now().toString(36)}-${random}`;
}

export function computeAutomationIdempotencyKey(
	parts: AutomationKeyParts,
): string {
	return [
		parts.repo,
		parts.headSha,
		parts.automationName,
		parts.contractVersion,
		parts.inputFingerprint,
	].join("|");
}

function defaultState(): AutomationIdempotencyState {
	return {
		schemaVersion: "automation-idempotency/v1",
		runs: {},
	};
}

export function loadAutomationState(
	statePath: string,
): AutomationIdempotencyState {
	if (!existsSync(statePath)) {
		return defaultState();
	}
	try {
		const parsed = JSON.parse(readFileSync(statePath, "utf-8")) as unknown;
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			(parsed as { schemaVersion?: unknown }).schemaVersion ===
				"automation-idempotency/v1" &&
			typeof (parsed as { runs?: unknown }).runs === "object" &&
			(parsed as { runs?: unknown }).runs !== null
		) {
			return parsed as AutomationIdempotencyState;
		}
		return defaultState();
	} catch {
		return defaultState();
	}
}

export function saveAutomationState(
	statePath: string,
	state: AutomationIdempotencyState,
): void {
	mkdirSync(dirname(statePath), { recursive: true });
	const tmpPath = `${statePath}.tmp.${Date.now()}`;
	writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf-8");
	renameSync(tmpPath, statePath);
}

function writeAutomationArtifact(
	artifactsDir: string,
	parts: AutomationKeyParts,
	attemptId: string,
	status: "succeeded" | "failed",
	payload: Record<string, unknown>,
	reason?: string,
): { artifactUri: string; artifactChecksum: string } {
	const targetDir = join(artifactsDir, parts.automationName);
	mkdirSync(targetDir, { recursive: true });
	const artifactUri = join(targetDir, `${attemptId}.json`);
	const report = {
		schemaVersion: "automation-report/v1",
		attemptId,
		status,
		idempotencyKey: computeAutomationIdempotencyKey(parts),
		keyParts: parts,
		timestamp: new Date().toISOString(),
		payload,
		...(reason ? { reason } : {}),
	};
	const reportText = JSON.stringify(report, null, 2);
	const artifactChecksum = createHash("sha256")
		.update(reportText)
		.digest("hex");
	writeFileSync(artifactUri, reportText, "utf-8");
	return { artifactUri, artifactChecksum };
}

export function runAutomationWithIdempotency(
	options: RunWithIdempotencyOptions,
): IdempotencyRunResult {
	const key = computeAutomationIdempotencyKey(options.keyParts);
	const state = loadAutomationState(options.statePath);
	const existing = state.runs[key];
	const force = options.force ?? false;

	if (existing) {
		if (existing.status === "in_progress") {
			return {
				ok: false,
				code: "IN_PROGRESS",
				key,
				run: existing,
				statePath: options.statePath,
			};
		}
		if (!force) {
			return {
				ok: true,
				replayed: true,
				key,
				run: existing,
				statePath: options.statePath,
			};
		}
	}

	const attemptId = createAttemptId(options.keyParts.automationName);
	const startedAt = new Date().toISOString();
	const previousAttemptId = existing?.attemptId;
	state.runs[key] = {
		attemptId,
		status: "in_progress",
		artifactUri: "",
		artifactChecksum: "",
		startedAt,
		...(previousAttemptId ? { previousAttemptId } : {}),
	};
	saveAutomationState(options.statePath, state);

	let executeResult: AutomationExecuteResult;
	try {
		executeResult = options.execute();
	} catch (error) {
		executeResult = {
			ok: false,
			payload: {},
			reason: error instanceof Error ? error.message : String(error),
		};
	}

	const terminalStatus = executeResult.ok ? "succeeded" : "failed";
	const artifact = writeAutomationArtifact(
		options.artifactsDir,
		options.keyParts,
		attemptId,
		terminalStatus,
		executeResult.payload,
		executeResult.reason,
	);
	const completedAt = new Date().toISOString();
	state.runs[key] = {
		attemptId,
		status: terminalStatus,
		artifactUri: artifact.artifactUri,
		artifactChecksum: artifact.artifactChecksum,
		startedAt,
		completedAt,
		...(executeResult.reason ? { reason: executeResult.reason } : {}),
		...(previousAttemptId ? { previousAttemptId } : {}),
	};
	saveAutomationState(options.statePath, state);
	const finalRun = state.runs[key];
	if (!finalRun) {
		throw new Error(
			"Idempotency state write failed: missing terminal run record",
		);
	}

	return {
		ok: true,
		replayed: false,
		key,
		run: finalRun,
		statePath: options.statePath,
	};
}
