import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
	createExecutionJob,
	executionJobStatus,
	executionRequestFromJob,
	isTerminalExecutionJob,
	type ExecutionJob,
	type ExecutionJobSubmitResult,
} from "./execution-job.js";
import {
	LOCAL_EXECUTION_CLAIMS,
	type ExecutionRequest,
	type ExecutionResourceLane,
} from "./execution-result.js";
import {
	LocalExecutionCoordinator,
	type ExecutionHandle,
} from "./local-coordinator.js";
import {
	spawnProcessExecutor,
	type ProcessExecutor,
} from "./process-executor.js";
import { ExecutionJobStore, sleep } from "./job-store.js";
import {
	failedJob,
	recoverStaleJobsLocked,
	terminateProcess,
	updateOwnedWorker,
} from "./job-conductor-state.js";

/** Injectable detached worker launcher used by the durable local Conductor. */
export interface JobWorkerLauncher {
	launch(job: ExecutionJob): void;
}

/** Construct the source- or bundle-compatible detached worker launcher. */
export function spawnJobWorkerLauncher(): JobWorkerLauncher {
	return {
		/** Launch a detached process for one durable ticket. */
		launch(job) {
			const script = process.argv[1];
			if (!script) throw new Error("Cannot locate the harness CLI entrypoint.");
			const child = spawn(
				process.execPath,
				[
					...process.execArgv,
					script,
					"job",
					"worker",
					"--ticket",
					job.ticket,
					"--artifacts-dir",
					job.artifactsDir,
				],
				{
					cwd: job.cwd,
					detached: true,
					stdio: "ignore",
					windowsHide: true,
				},
			);
			child.unref();
		},
	};
}

/** Construction options for a local durable Conductor. */
export interface LocalJobConductorOptions {
	storeRoot: string;
	executor?: ProcessExecutor;
	launcher?: JobWorkerLauncher;
	pollIntervalMs?: number;
}

/** Result of polling a ticket until terminal state or the caller deadline. */
export interface ExecutionWaitOutcome {
	job: ExecutionJob | undefined;
	timedOut: boolean;
}

const DEFAULT_POLL_INTERVAL_MS = 100;

/** Return whether two resource-lane lists overlap. */
function intersects(
	left: readonly ExecutionResourceLane[],
	right: readonly ExecutionResourceLane[],
): boolean {
	return left.some((lane) => right.includes(lane));
}

/** Apply symmetric lane conflict rules with parallel-safe read escape hatch. */
function jobsConflict(left: ExecutionJob, right: ExecutionJob): boolean {
	return (
		!(left.parallelSafe && right.parallelSafe) &&
		(intersects(left.conflictsWith, right.resourceLanes) ||
			intersects(right.conflictsWith, left.resourceLanes))
	);
}

/** Compute a non-negative queue age from a persisted timestamp. */
function ageMs(iso: string, now = Date.now()): number {
	const parsed = Date.parse(iso);
	return Number.isFinite(parsed) ? Math.max(0, now - parsed) : 0;
}

/** Persistent local scheduler for reconnectable execution tickets. */
export class LocalJobConductor {
	private readonly store: ExecutionJobStore;
	private readonly executor: ProcessExecutor;
	private readonly launcher: JobWorkerLauncher;
	private readonly pollIntervalMs: number;

	/** Create a Conductor rooted at one local artifact directory. */
	constructor(options: LocalJobConductorOptions) {
		this.store = new ExecutionJobStore(options.storeRoot);
		this.executor = options.executor ?? spawnProcessExecutor;
		this.launcher = options.launcher ?? spawnJobWorkerLauncher();
		this.pollIntervalMs = Math.max(
			5,
			Math.min(options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS, 5_000),
		);
	}

	/** Submit or reconnect to one request using a durable request key. */
	async submit(request: ExecutionRequest): Promise<ExecutionJobSubmitResult> {
		const candidate = createExecutionJob(randomUUID(), request);
		const result = await this.store.withSchedulerLock(() => {
			recoverStaleJobsLocked(this.store);
			const existing = this.store.findByRequestKey(candidate.requestKey);
			if (existing) {
				return {
					status:
						candidate.fingerprint === existing.fingerprint
							? ("replayed" as const)
							: ("request_key_conflict" as const),
					job: existing,
				};
			}
			this.store.create(candidate);
			return { status: "submitted" as const, job: candidate };
		});
		if (result.status === "submitted") {
			try {
				this.launcher.launch(result.job);
			} catch (error) {
				this.store.update(result.job.ticket, (job) =>
					failedJob(
						job,
						"environment_failure",
						error instanceof Error ? error.message : String(error),
					),
				);
			}
		}
		return result;
	}

	/** List current durable tickets after stale-worker recovery. */
	async list(): Promise<ExecutionJob[]> {
		await this.store.withSchedulerLock(() =>
			recoverStaleJobsLocked(this.store),
		);
		return this.store.list();
	}

	/** Read one durable ticket after stale-worker recovery. */
	async status(ticket: string): Promise<ExecutionJob | undefined> {
		await this.store.withSchedulerLock(() =>
			recoverStaleJobsLocked(this.store),
		);
		return this.store.read(ticket);
	}

	/** Request cancellation, settling queued tickets immediately. */
	async cancel(ticket: string): Promise<ExecutionJob | undefined> {
		let childPid: number | null = null;
		const job = await this.store.withSchedulerLock(() => {
			recoverStaleJobsLocked(this.store);
			const current = this.store.read(ticket);
			if (!current || isTerminalExecutionJob(current.status)) return current;
			if (current.status === "queued") {
				return this.store.update(ticket, (next) => ({
					...next,
					status: "canceled",
					cancelRequested: true,
					completedAt: new Date().toISOString(),
					nextAction: "Canceled before a worker claimed this ticket.",
					failureClass: "canceled",
					claimsBoundary: LOCAL_EXECUTION_CLAIMS,
				}));
			}
			childPid = current.pid;
			return this.store.update(ticket, (next) => ({
				...next,
				cancelRequested: true,
				nextAction: "Cancellation requested; waiting for the worker to settle.",
			}));
		});
		if (childPid !== null) terminateProcess(childPid);
		return job;
	}

	/** Wait for a ticket to reach a terminal state without losing reconnectability. */
	async wait(
		ticket: string,
		timeoutSeconds = 300,
	): Promise<ExecutionJob | undefined> {
		return (await this.waitForOutcome(ticket, timeoutSeconds)).job;
	}

	/** Wait for a ticket while preserving an explicit polling-deadline signal. */
	async waitForOutcome(
		ticket: string,
		timeoutSeconds = 300,
	): Promise<ExecutionWaitOutcome> {
		const deadline = Date.now() + timeoutSeconds * 1_000;
		for (;;) {
			const job = await this.status(ticket);
			if (!job || isTerminalExecutionJob(job.status)) {
				return { job, timedOut: false };
			}
			if (Date.now() >= deadline) return { job, timedOut: true };
			await sleep(this.pollIntervalMs);
		}
	}

	/** Execute one detached worker ticket until terminal durable state. */
	async runWorker(ticket: string): Promise<number> {
		const claimed = await this.claimTicket(ticket);
		if (!claimed) return 1;
		if (isTerminalExecutionJob(claimed.status))
			return claimed.status === "pass" ? 0 : 1;
		const processToken = claimed.processToken;
		if (!processToken) return 1;

		let handle: ExecutionHandle | undefined;
		let cancelSent = false;
		const cancellationPoll = setInterval(() => {
			const current = this.store.read(ticket);
			if (current?.cancelRequested && !cancelSent) {
				cancelSent = true;
				handle?.cancel();
			}
		}, this.pollIntervalMs);
		try {
			handle = new LocalExecutionCoordinator(this.executor).run(
				executionRequestFromJob(claimed),
			);
			await updateOwnedWorker(this.store, ticket, processToken, (job) => ({
				...job,
				pid: handle?.pid ?? null,
			}));
			const result = await handle.result;
			const terminal = await updateOwnedWorker(
				this.store,
				ticket,
				processToken,
				(job) => ({
					...job,
					status: executionJobStatus(result),
					completedAt: new Date().toISOString(),
					durationMs: result.durationMs,
					resultPath: result.artifacts.resultPath,
					failureClass: result.artifactError
						? "artifact_failure"
						: result.failureClass,
					nextAction: result.nextAction,
					pid: null,
					workerPid: null,
					processToken: null,
					claimsBoundary: result.claimsBoundary,
				}),
			);
			if (!terminal) return 1;
			return terminal.status === "pass" ? 0 : 1;
		} catch (error) {
			await updateOwnedWorker(this.store, ticket, processToken, (job) =>
				failedJob(
					job,
					"environment_failure",
					error instanceof Error ? error.message : String(error),
				),
			);
			return 1;
		} finally {
			clearInterval(cancellationPoll);
		}
	}

	/** Claim a ticket when its FIFO resource lanes are available. */
	private async claimTicket(ticket: string): Promise<ExecutionJob | null> {
		for (;;) {
			const claimed = await this.store.withSchedulerLock(() => {
				recoverStaleJobsLocked(this.store);
				const current = this.store.read(ticket);
				if (!current) return null;
				if (isTerminalExecutionJob(current.status)) return current;
				if (current.cancelRequested) {
					return this.store.update(ticket, (job) => ({
						...job,
						status: "canceled",
						completedAt: new Date().toISOString(),
						failureClass: "canceled",
						nextAction: "Canceled before a worker started execution.",
					}));
				}
				const jobs = this.store.list();
				const blocked = jobs.some(
					(candidate) =>
						candidate.ticket !== ticket &&
						(candidate.status === "running" ||
							(candidate.status === "queued" &&
								candidate.createdAt < current.createdAt)) &&
						jobsConflict(current, candidate),
				);
				if (blocked) return undefined;
				const processToken = randomUUID();
				const claimed = this.store.update(ticket, (job) => ({
					...job,
					status: "running",
					startedAt: new Date().toISOString(),
					queueWaitMs: ageMs(job.createdAt),
					workerPid: process.pid,
					processToken,
					nextAction: "Worker is executing the local process.",
				}));
				this.store.writeWorkerIdentity(ticket, {
					pid: process.pid,
					token: processToken,
				});
				return claimed;
			});
			if (claimed) return claimed;
			await sleep(this.pollIntervalMs);
		}
	}
}
