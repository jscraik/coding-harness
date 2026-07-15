import { isTerminalExecutionJob, type ExecutionJob } from "./execution-job.js";
import {
	LOCAL_EXECUTION_CLAIMS,
	type ExecutionFailureClass,
} from "./execution-result.js";
import type { ExecutionJobStore } from "./job-store.js";

/** Check whether a worker or child process is still alive. */
function processAlive(pid: number | null): boolean {
	if (pid === null || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/** Terminate a child process group without making cleanup throw. */
export function terminateProcess(pid: number | null): void {
	if (pid === null || pid <= 0) return;
	try {
		if (process.platform !== "win32") process.kill(-pid, "SIGTERM");
		else process.kill(pid, "SIGTERM");
	} catch {
		try {
			process.kill(pid, "SIGTERM");
		} catch {
			// The process already exited; the durable state remains authoritative.
		}
	}
}

/** Map a terminal failure class to the durable job status. */
function terminalStatusForFailure(
	failureClass: ExecutionFailureClass,
): ExecutionJob["status"] {
	if (failureClass === "timeout") return "timeout";
	if (failureClass === "canceled") return "canceled";
	return "fail";
}

/** Build a terminal environment or cancellation failure record. */
export function failedJob(
	job: ExecutionJob,
	failureClass: Exclude<ExecutionFailureClass, null>,
	nextAction: string,
): ExecutionJob {
	return {
		...job,
		status: terminalStatusForFailure(failureClass),
		completedAt: new Date().toISOString(),
		failureClass,
		nextAction,
		pid: null,
		workerPid: null,
		processToken: null,
		claimsBoundary: LOCAL_EXECUTION_CLAIMS,
	};
}

/** Mark running tickets whose worker identity has disappeared. */
export function recoverStaleJobsLocked(store: ExecutionJobStore): void {
	for (const job of store.list()) {
		const identity = store.readWorkerIdentity(job.ticket);
		const identityMatches =
			identity?.pid === job.workerPid && identity.token === job.processToken;
		if (
			job.status !== "running" ||
			job.workerPid === null ||
			(identityMatches && processAlive(job.workerPid))
		)
			continue;
		terminateProcess(job.pid);
		store.update(job.ticket, (current) =>
			failedJob(
				current,
				"environment_failure",
				"Previous worker exited before a terminal result was persisted.",
			),
		);
		store.clearWorkerIdentity(job.ticket);
	}
}

/** Update a ticket only while this worker still owns its PID/token pair. */
export async function updateOwnedWorker(
	store: ExecutionJobStore,
	ticket: string,
	processToken: string,
	updater: (job: ExecutionJob) => ExecutionJob,
): Promise<ExecutionJob | undefined> {
	return store.withSchedulerLock(() => {
		const current = store.read(ticket);
		if (
			!current ||
			current.workerPid !== process.pid ||
			current.processToken !== processToken
		) {
			return current;
		}
		const next = store.update(ticket, updater);
		if (isTerminalExecutionJob(next.status)) store.clearWorkerIdentity(ticket);
		return next;
	});
}
