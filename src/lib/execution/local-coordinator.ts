import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { randomUUID } from "node:crypto";
import {
	executionFingerprint,
	LOCAL_EXECUTION_CLAIMS,
	type ExecutionRequest,
	type ExecutionResourceLane,
	type ExecutionResult,
	type ExecutionStatus,
} from "./execution-result.js";
import {
	spawnProcessExecutor,
	type ProcessHandle,
	type ProcessExecutor,
	type ProcessOutcome,
} from "./process-executor.js";

/** Handle returned for one local execution request. */
export interface ExecutionHandle {
	result: Promise<ExecutionResult>;
	cancel(): void;
	pid?: number;
}

interface ActiveRun {
	request: ExecutionRequest;
	fingerprint: string;
	result: Promise<ExecutionResult>;
}

const DEFAULT_TIMEOUT_SECONDS = 300;

/** Determine whether two requests share a scheduling lane. */
function hasLaneConflict(
	left: readonly ExecutionResourceLane[],
	right: readonly ExecutionResourceLane[],
): boolean {
	return left.some((lane) => right.includes(lane));
}

/** Fill conservative defaults for an execution request. */
function normalizedRequest(
	request: ExecutionRequest,
): Required<ExecutionRequest> {
	return {
		...request,
		requestKey: request.requestKey ?? executionFingerprint(request),
		parallelSafe: request.parallelSafe ?? false,
		conflictsWith: request.conflictsWith ?? [...request.resourceLanes],
		timeoutSeconds: request.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS,
		attempt: request.attempt ?? 1,
		retryDecision: request.retryDecision ?? "conditional",
	};
}

/** Map a child exit outcome to the local result status. */
function statusForOutcome(outcome: ProcessOutcome): {
	status: ExecutionStatus;
	failureClass: Exclude<ExecutionResult["failureClass"], null> | null;
} {
	if (outcome.exitCode === 0) return { status: "pass", failureClass: null };
	return { status: "fail", failureClass: "command_failure" };
}

/** Build a run-scoped artifact path. */
function safeArtifactPath(
	root: string,
	runId: string,
	filename: string,
): string {
	return join(root, runId, filename);
}

/** Persist raw logs and the structured execution result. */
function writeArtifacts(
	request: Required<ExecutionRequest>,
	runId: string,
	result: Omit<ExecutionResult, "artifactError" | "artifacts">,
	outcome: Pick<ProcessOutcome, "stdout" | "stderr">,
): ExecutionResult {
	const resultPath = safeArtifactPath(
		request.artifactsDir,
		runId,
		"execution-result.json",
	);
	const stdoutPath = safeArtifactPath(
		request.artifactsDir,
		runId,
		"stdout.log",
	);
	const stderrPath = safeArtifactPath(
		request.artifactsDir,
		runId,
		"stderr.log",
	);
	let artifactError: string | null = null;
	try {
		mkdirSync(join(request.artifactsDir, runId), { recursive: true });
		writeFileSync(stdoutPath, outcome.stdout, "utf8");
		writeFileSync(stderrPath, outcome.stderr, "utf8");
		writeFileSync(
			resultPath,
			`${JSON.stringify(
				{
					...result,
					artifacts: {
						resultPath: relative(request.artifactsDir, resultPath),
						stdoutPath: relative(request.artifactsDir, stdoutPath),
						stderrPath: relative(request.artifactsDir, stderrPath),
					},
					artifactError: null,
				},
				null,
				2,
			)}\n`,
			"utf8",
		);
	} catch (error) {
		artifactError = error instanceof Error ? error.message : String(error);
	}
	return {
		...result,
		artifacts: {
			resultPath: relative(request.artifactsDir, resultPath),
			stdoutPath: relative(request.artifactsDir, stdoutPath),
			stderrPath: relative(request.artifactsDir, stderrPath),
		},
		artifactError,
	};
}

/** Build and persist an immediate scheduling-block result. */
function blockedResult(
	request: Required<ExecutionRequest>,
	fingerprint: string,
	failureClass: "blocked_conflict" | "request_key_conflict",
	conflictsWith: ExecutionResourceLane[],
): Promise<ExecutionResult> {
	const runId = randomUUID();
	const startedAt = Date.now();
	const result = {
		schemaVersion: "harness-execution-result/v1" as const,
		runId,
		status: "blocked" as const,
		failureClass,
		command: [...request.command],
		cwd: request.cwd,
		requestKey: request.requestKey,
		fingerprint,
		resourceLanes: [...request.resourceLanes],
		parallelSafe: request.parallelSafe,
		conflictsWith,
		timeoutSeconds: request.timeoutSeconds,
		attempt: request.attempt,
		retryDecision: request.retryDecision,
		queueWaitMs: 0,
		durationMs: Date.now() - startedAt,
		exitCode: null,
		signal: null,
		nextAction: "Resolve the conflicting active request before retrying.",
		claimsBoundary: LOCAL_EXECUTION_CLAIMS,
		replayed: false,
	};
	return Promise.resolve(
		writeArtifacts(request, runId, result, { stdout: "", stderr: "" }),
	);
}

interface ActiveExecutionContext {
	request: Required<ExecutionRequest>;
	fingerprint: string;
	runId: string;
	startedAt: number;
	resolve: (result: ExecutionResult) => void;
	settled: boolean;
	timer?: NodeJS.Timeout;
}

/** Finalize an active request exactly once and preserve its result. */
function settleActiveExecution(
	context: ActiveExecutionContext,
	status: ExecutionStatus,
	failureClass: Exclude<ExecutionResult["failureClass"], null> | null,
	outcome: ProcessOutcome,
	onComplete: (result: ExecutionResult) => void,
): void {
	if (context.settled) return;
	context.settled = true;
	if (context.timer) clearTimeout(context.timer);
	const { request } = context;
	const base = {
		schemaVersion: "harness-execution-result/v1" as const,
		runId: context.runId,
		status,
		failureClass,
		command: [...request.command],
		cwd: request.cwd,
		requestKey: request.requestKey,
		fingerprint: context.fingerprint,
		resourceLanes: [...request.resourceLanes],
		parallelSafe: request.parallelSafe,
		conflictsWith: [...request.conflictsWith],
		timeoutSeconds: request.timeoutSeconds,
		attempt: request.attempt,
		retryDecision: request.retryDecision,
		queueWaitMs: 0,
		durationMs: Date.now() - context.startedAt,
		exitCode: outcome.exitCode,
		signal: outcome.signal,
		nextAction:
			status === "pass"
				? "No local retry required."
				: "Inspect the execution result and logs before retrying.",
		claimsBoundary: LOCAL_EXECUTION_CLAIMS,
		replayed: false,
	};
	const result = writeArtifacts(request, context.runId, base, outcome);
	onComplete(result);
	context.resolve(result);
}

/** Observe child completion and classify launch failures. */
function observeProcess(
	processHandle: ProcessHandle,
	settle: (
		status: ExecutionStatus,
		failureClass: Exclude<ExecutionResult["failureClass"], null> | null,
		outcome: ProcessOutcome,
	) => void,
): void {
	processHandle.result
		.then((outcome) => {
			const status = statusForOutcome(outcome);
			settle(status.status, status.failureClass, outcome);
		})
		.catch((error: unknown) => {
			settle("fail", "environment_failure", {
				exitCode: null,
				signal: null,
				stdout: "",
				stderr: error instanceof Error ? error.message : String(error),
			});
		});
}

/** Single-process local coordinator for conflict-aware execution. */
export class LocalExecutionCoordinator {
	private readonly active = new Map<string, ActiveRun>();
	private readonly completed = new Map<
		string,
		{ fingerprint: string; result: ExecutionResult }
	>();
	private readonly executor: ProcessExecutor;

	/** Create a coordinator with the real or an injected process executor. */
	constructor(executor: ProcessExecutor = spawnProcessExecutor) {
		this.executor = executor;
	}

	/** Start and supervise one request after scheduling checks pass. */
	private startActiveRun(
		request: Required<ExecutionRequest>,
		fingerprint: string,
	): ExecutionHandle {
		let resolveResult!: (result: ExecutionResult) => void;
		const result = new Promise<ExecutionResult>((resolve) => {
			resolveResult = resolve;
		});
		const context: ActiveExecutionContext = {
			request,
			fingerprint,
			runId: randomUUID(),
			startedAt: Date.now(),
			resolve: resolveResult,
			settled: false,
		};
		/** Finalize this request and update coordinator state. */
		const settle = (
			status: ExecutionStatus,
			failureClass: Exclude<ExecutionResult["failureClass"], null> | null,
			outcome: ProcessOutcome,
		): void =>
			settleActiveExecution(
				context,
				status,
				failureClass,
				outcome,
				(completed) => {
					this.active.delete(request.requestKey);
					this.completed.set(request.requestKey, {
						fingerprint,
						result: completed,
					});
				},
			);
		let processHandle: ProcessHandle;
		try {
			processHandle = this.executor.start(request);
		} catch (error) {
			settle("fail", "environment_failure", {
				exitCode: null,
				signal: null,
				stdout: "",
				stderr: error instanceof Error ? error.message : String(error),
			});
			return { result, cancel: () => undefined };
		}
		this.active.set(request.requestKey, { request, fingerprint, result });
		observeProcess(processHandle, settle);
		context.timer = setTimeout(() => {
			processHandle.cancel();
			settle("timeout", "timeout", {
				exitCode: null,
				signal: "SIGTERM",
				stdout: "",
				stderr: "Execution timed out.",
			});
		}, request.timeoutSeconds * 1000);
		const handle: ExecutionHandle = {
			result,
			cancel: () => {
				processHandle.cancel();
				settle("canceled", "canceled", {
					exitCode: null,
					signal: "SIGTERM",
					stdout: "",
					stderr: "Execution canceled.",
				});
			},
		};
		if (processHandle.pid !== undefined) handle.pid = processHandle.pid;
		return handle;
	}

	/** Start a request, reconnecting or blocking when the request key requires it. */
	run(input: ExecutionRequest): ExecutionHandle {
		const request = normalizedRequest(input);
		const fingerprint = executionFingerprint(request);
		const completed = this.completed.get(request.requestKey);
		if (completed) {
			if (completed.fingerprint === fingerprint) {
				return {
					result: Promise.resolve({ ...completed.result, replayed: true }),
					cancel: () => undefined,
				};
			}
			return {
				result: blockedResult(request, fingerprint, "request_key_conflict", []),
				cancel: () => undefined,
			};
		}
		const active = this.active.get(request.requestKey);
		if (active) {
			if (active.fingerprint === fingerprint)
				return { result: active.result, cancel: () => undefined };
			return {
				result: blockedResult(request, fingerprint, "request_key_conflict", []),
				cancel: () => undefined,
			};
		}
		const conflicting = [...this.active.values()].find(
			(candidate) =>
				hasLaneConflict(
					request.conflictsWith,
					candidate.request.resourceLanes,
				) && !(request.parallelSafe && candidate.request.parallelSafe),
		);
		if (conflicting) {
			return {
				result: blockedResult(
					request,
					fingerprint,
					"blocked_conflict",
					conflicting.request.resourceLanes,
				),
				cancel: () => undefined,
			};
		}
		return this.startActiveRun(request, fingerprint);
	}
}

/** Return a safe artifact directory label for concise operator summaries. */
export function executionArtifactLabel(result: ExecutionResult): string {
	return `${basename(result.artifacts.resultPath)} (${result.status})`;
}
