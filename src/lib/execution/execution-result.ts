import { createHash } from "node:crypto";

/** Versioned result contract emitted by local execution. */
export const EXECUTION_RESULT_SCHEMA_VERSION = "harness-execution-result/v1";

export const EXECUTION_RESOURCE_LANES = [
	"repo-read",
	"repo-write",
	"validation",
	"style",
	"artifacts",
	"runtime",
	"git",
	"external",
] as const;
/** Valid resource lanes for a local execution request. */
export type ExecutionResourceLane = (typeof EXECUTION_RESOURCE_LANES)[number];
/** Terminal status emitted by the local execution coordinator. */
export type ExecutionStatus =
	| "pass"
	| "fail"
	| "blocked"
	| "timeout"
	| "canceled";
/** Failure classification that keeps local process and scheduling failures distinct. */
export type ExecutionFailureClass =
	| "command_failure"
	| "timeout"
	| "canceled"
	| "blocked_conflict"
	| "request_key_conflict"
	| "environment_failure"
	| "artifact_failure"
	| null;

/** Explicit boundary for claims made by an execution result. */
export interface ExecutionClaimsBoundary {
	localExecution: "proven" | "not_checked";
	hostedCi: "proven" | "not_checked";
	reviewState: "proven" | "not_checked";
	mergeReadiness: "proven" | "not_checked";
}

/** Paths written by the local coordinator, relative to the artifact root. */
export interface ExecutionArtifacts {
	resultPath: string;
	stdoutPath: string;
	stderrPath: string;
}

/** Machine-readable local execution result. */
export interface ExecutionResult {
	schemaVersion: typeof EXECUTION_RESULT_SCHEMA_VERSION;
	runId: string;
	status: ExecutionStatus;
	failureClass: ExecutionFailureClass;
	command: string[];
	cwd: string;
	requestKey: string;
	fingerprint: string;
	resourceLanes: ExecutionResourceLane[];
	parallelSafe: boolean;
	conflictsWith: ExecutionResourceLane[];
	timeoutSeconds: number;
	attempt: number;
	retryDecision: "safe" | "conditional" | "manual";
	queueWaitMs: number;
	durationMs: number;
	exitCode: number | null;
	signal: string | null;
	artifacts: ExecutionArtifacts;
	artifactError: string | null;
	nextAction: string;
	claimsBoundary: ExecutionClaimsBoundary;
	replayed: boolean;
}

/** Inputs accepted by the local single-process coordinator. */
export interface ExecutionRequest {
	command: string[];
	cwd: string;
	requestKey?: string;
	resourceLanes: ExecutionResourceLane[];
	parallelSafe?: boolean;
	conflictsWith?: ExecutionResourceLane[];
	timeoutSeconds?: number;
	attempt?: number;
	retryDecision?: "safe" | "conditional" | "manual";
	artifactsDir: string;
}

/** Stable request fingerprint used for idempotent reconnects. */
export function executionFingerprint(request: ExecutionRequest): string {
	const canonical = JSON.stringify({
		command: request.command,
		cwd: request.cwd,
		resourceLanes: [...request.resourceLanes].toSorted(),
		parallelSafe: request.parallelSafe ?? false,
		conflictsWith: [...(request.conflictsWith ?? [])].toSorted(),
		timeoutSeconds: request.timeoutSeconds ?? 300,
	});
	return createHash("sha256").update(canonical).digest("hex").slice(0, 24);
}

/** Default boundary: local process truth only. */
export const LOCAL_EXECUTION_CLAIMS: ExecutionClaimsBoundary = {
	localExecution: "proven",
	hostedCi: "not_checked",
	reviewState: "not_checked",
	mergeReadiness: "not_checked",
};
