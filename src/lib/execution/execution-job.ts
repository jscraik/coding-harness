import { randomUUID } from "node:crypto";
import { EXECUTION_JOB_SCHEMA_VERSION } from "./execution-job-schema.js";
import {
	LOCAL_EXECUTION_CLAIMS,
	executionFingerprint,
	type ExecutionClaimsBoundary,
	type ExecutionFailureClass,
	type ExecutionRequest,
	type ExecutionResourceLane,
	type ExecutionResult,
} from "./execution-result.js";

export { EXECUTION_JOB_SCHEMA_VERSION } from "./execution-job-schema.js";

/** Versioned machine-readable envelope for the durable job command family. */
export const EXECUTION_JOB_RESPONSE_SCHEMA_VERSION =
	"harness-execution-job-response/v1";

/** Lifecycle state of one durable local execution ticket. */
export type ExecutionJobStatus =
	| "queued"
	| "running"
	| "pass"
	| "fail"
	| "blocked"
	| "timeout"
	| "canceled";

/** Durable state written beneath the local execution artifact root. */
export interface ExecutionJob {
	schemaVersion: typeof EXECUTION_JOB_SCHEMA_VERSION;
	ticket: string;
	requestKey: string;
	fingerprint: string;
	command: string[];
	cwd: string;
	artifactsDir: string;
	resourceLanes: ExecutionResourceLane[];
	parallelSafe: boolean;
	conflictsWith: ExecutionResourceLane[];
	timeoutSeconds: number;
	attempt: number;
	retryDecision: "safe" | "conditional" | "manual";
	status: ExecutionJobStatus;
	createdAt: string;
	startedAt: string | null;
	completedAt: string | null;
	queueWaitMs: number;
	durationMs: number;
	cancelRequested: boolean;
	pid: number | null;
	workerPid: number | null;
	processToken: string | null;
	resultPath: string | null;
	failureClass: ExecutionFailureClass;
	nextAction: string;
	claimsBoundary: ExecutionClaimsBoundary;
}

/** Result returned by a submit operation when idempotency is evaluated. */
export interface ExecutionJobSubmitResult {
	status: "submitted" | "replayed" | "request_key_conflict";
	job: ExecutionJob;
}

/** Top-level command operation represented by a durable job response. */
export type ExecutionJobOperation =
	| "submit"
	| "list"
	| "status"
	| "wait"
	| "cancel";

/** Machine-readable outcome for one durable job command operation. */
export type ExecutionJobResponseOutcome =
	| ExecutionJobStatus
	| "submitted"
	| "replayed"
	| "request_key_conflict"
	| "listed"
	| "not_found"
	| "wait_timeout";

/** Stable JSON envelope returned by `harness job ... --json`. */
export interface ExecutionJobResponse {
	schemaVersion: typeof EXECUTION_JOB_RESPONSE_SCHEMA_VERSION;
	operation: ExecutionJobOperation;
	outcome: ExecutionJobResponseOutcome;
	timedOut: boolean;
	job: ExecutionJob | null;
	jobs: ExecutionJob[];
}

/** Optional payload values for one machine-readable job response. */
export interface ExecutionJobResponseOptions {
	job?: ExecutionJob | null;
	jobs?: ExecutionJob[];
	timedOut?: boolean;
}

/** Build a stable JSON envelope without changing the durable ticket shape. */
export function createExecutionJobResponse(
	operation: ExecutionJobOperation,
	outcome: ExecutionJobResponseOutcome,
	options: ExecutionJobResponseOptions = {},
): ExecutionJobResponse {
	return {
		schemaVersion: EXECUTION_JOB_RESPONSE_SCHEMA_VERSION,
		operation,
		outcome,
		timedOut: options.timedOut ?? false,
		job: options.job ?? null,
		jobs: options.jobs ?? [],
	};
}

/** Return whether a job has reached a terminal execution state. */
export function isTerminalExecutionJob(status: ExecutionJobStatus): boolean {
	return status !== "queued" && status !== "running";
}

/** Convert a terminal execution result into durable job state. */
export function executionJobStatus(
	result: ExecutionResult,
): ExecutionJobStatus {
	return result.status;
}

/** Create a queued job record from one validated local execution request. */
export function createExecutionJob(
	ticket: string = randomUUID(),
	request: ExecutionRequest,
	now = new Date(),
): ExecutionJob {
	const canonicalRequest: Required<ExecutionRequest> = {
		...request,
		requestKey: request.requestKey ?? executionFingerprint(request),
		parallelSafe: request.parallelSafe ?? false,
		conflictsWith: request.conflictsWith ?? [...request.resourceLanes],
		timeoutSeconds: request.timeoutSeconds ?? 300,
		attempt: request.attempt ?? 1,
		retryDecision: request.retryDecision ?? "conditional",
	};
	const fingerprint = executionFingerprint(canonicalRequest);
	const requestKey = canonicalRequest.requestKey;
	return {
		schemaVersion: EXECUTION_JOB_SCHEMA_VERSION,
		ticket,
		requestKey,
		fingerprint,
		command: [...canonicalRequest.command],
		cwd: canonicalRequest.cwd,
		artifactsDir: canonicalRequest.artifactsDir,
		resourceLanes: [...canonicalRequest.resourceLanes],
		parallelSafe: canonicalRequest.parallelSafe,
		conflictsWith: [...canonicalRequest.conflictsWith],
		timeoutSeconds: canonicalRequest.timeoutSeconds,
		attempt: canonicalRequest.attempt,
		retryDecision: canonicalRequest.retryDecision,
		status: "queued",
		createdAt: now.toISOString(),
		startedAt: null,
		completedAt: null,
		queueWaitMs: 0,
		durationMs: 0,
		cancelRequested: false,
		pid: null,
		workerPid: null,
		processToken: null,
		resultPath: null,
		failureClass: null,
		nextAction: "Wait for the local Conductor to start this ticket.",
		claimsBoundary: LOCAL_EXECUTION_CLAIMS,
	};
}

/** Reconstruct the execution request that a worker must run for a ticket. */
export function executionRequestFromJob(job: ExecutionJob): ExecutionRequest {
	return {
		command: [...job.command],
		cwd: job.cwd,
		requestKey: job.requestKey,
		resourceLanes: [...job.resourceLanes],
		parallelSafe: job.parallelSafe,
		conflictsWith: [...job.conflictsWith],
		timeoutSeconds: job.timeoutSeconds,
		attempt: job.attempt,
		retryDecision: job.retryDecision,
		artifactsDir: job.artifactsDir,
	};
}
export { decodeExecutionJob } from "./execution-job-decoder.js";
