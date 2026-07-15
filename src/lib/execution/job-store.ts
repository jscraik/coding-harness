import {
	closeSync,
	openSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
	renameSync,
	mkdirSync,
	readdirSync,
	existsSync,
	statSync,
} from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { decodeExecutionJob, type ExecutionJob } from "./execution-job.js";

const JOB_FILE = "job.json";
const WORKER_IDENTITY_FILE = ".worker-identity.json";
const LOCK_FILE = ".conductor.lock";
const LOCK_STALE_MS = 30_000;
const LOCK_WAIT_MS = 50;

/** Result of an exclusive scheduler-lock acquisition. */
export interface SchedulerLock {
	release(): void;
}

/** Ephemeral worker identity used to reject PID-reuse updates. */
export interface WorkerIdentity {
	pid: number;
	token: string;
}

/** Sleep without introducing a shell or process dependency. */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Write JSON through a same-directory temporary file and rename. */
function writeAtomic(path: string, value: unknown): void {
	const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
	writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
	renameSync(temporaryPath, path);
}

/** Check whether a lock owner process is alive. */
function processAlive(pid: number): boolean {
	if (pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/** Decide whether a lock is safe to recover after owner death or age. */
function staleLock(path: string): boolean {
	try {
		const lock = JSON.parse(readFileSync(path, "utf8")) as {
			pid?: unknown;
			createdAt?: unknown;
		};
		const pid = typeof lock.pid === "number" ? lock.pid : -1;
		const createdAt =
			typeof lock.createdAt === "string" ? Date.parse(lock.createdAt) : NaN;
		return (
			!processAlive(pid) &&
			(!Number.isFinite(createdAt) || Date.now() - createdAt > LOCK_STALE_MS)
		);
	} catch {
		try {
			return Date.now() - statSync(path).mtimeMs > LOCK_STALE_MS;
		} catch {
			return false;
		}
	}
}

/** File-backed local job state with atomic writes and stale-lock recovery. */
export class ExecutionJobStore {
	readonly root: string;
	private readonly lockPath: string;

	/** Create a store rooted at the local execution artifact directory. */
	constructor(root: string) {
		this.root = root;
		this.lockPath = join(root, LOCK_FILE);
	}

	/** Ensure the artifact root exists before a mutating operation. */
	ensureRoot(): void {
		mkdirSync(this.root, { recursive: true });
	}

	/** Return the canonical path for one ticket record. */
	jobPath(ticket: string): string {
		return join(this.root, ticket, JOB_FILE);
	}

	/** Return the ephemeral worker identity path for one ticket. */
	workerIdentityPath(ticket: string): string {
		return join(this.root, ticket, WORKER_IDENTITY_FILE);
	}

	/** Persist one worker identity beside its durable ticket. */
	writeWorkerIdentity(ticket: string, identity: WorkerIdentity): void {
		mkdirSync(join(this.root, ticket), { recursive: true });
		writeAtomic(this.workerIdentityPath(ticket), identity);
	}

	/** Read a worker identity, treating malformed state as absent. */
	readWorkerIdentity(ticket: string): WorkerIdentity | undefined {
		const path = this.workerIdentityPath(ticket);
		if (!existsSync(path)) return undefined;
		try {
			const value = JSON.parse(readFileSync(path, "utf8")) as {
				pid?: unknown;
				token?: unknown;
			};
			if (
				typeof value.pid !== "number" ||
				!Number.isInteger(value.pid) ||
				value.pid <= 0 ||
				typeof value.token !== "string" ||
				value.token.length === 0
			) {
				return undefined;
			}
			return { pid: value.pid, token: value.token };
		} catch {
			return undefined;
		}
	}

	/** Remove an ephemeral worker identity after terminal settlement. */
	clearWorkerIdentity(ticket: string): void {
		try {
			unlinkSync(this.workerIdentityPath(ticket));
		} catch {
			// The identity may already be absent after stale recovery.
		}
	}

	/** Create a new queued ticket and reject accidental overwrite. */
	create(job: ExecutionJob): ExecutionJob {
		this.ensureRoot();
		const path = this.jobPath(job.ticket);
		if (existsSync(path))
			throw new Error(`Execution ticket already exists: ${job.ticket}`);
		mkdirSync(join(this.root, job.ticket), { recursive: true });
		writeAtomic(path, job);
		return job;
	}

	/** Read one ticket, returning undefined when it has not been submitted. */
	read(ticket: string): ExecutionJob | undefined {
		const path = this.jobPath(ticket);
		if (!existsSync(path)) return undefined;
		return decodeExecutionJob(
			JSON.parse(readFileSync(path, "utf8")) as unknown,
		);
	}

	/** Update one ticket atomically from its current decoded state. */
	update(
		ticket: string,
		updater: (job: ExecutionJob) => ExecutionJob,
	): ExecutionJob {
		const current = this.read(ticket);
		if (!current) throw new Error(`Execution ticket not found: ${ticket}`);
		const next = updater(current);
		writeAtomic(this.jobPath(ticket), next);
		return next;
	}

	/** List valid ticket records in deterministic creation order. */
	list(): ExecutionJob[] {
		if (!existsSync(this.root)) return [];
		return readdirSync(this.root, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => this.read(entry.name))
			.filter((job): job is ExecutionJob => job !== undefined)
			.toSorted((left, right) => left.createdAt.localeCompare(right.createdAt));
	}

	/** Find the newest ticket with a request key for idempotent submission. */
	findByRequestKey(requestKey: string): ExecutionJob | undefined {
		return this.list().find((job) => job.requestKey === requestKey);
	}

	/** Acquire the scheduler lock, recovering only a stale or dead owner. */
	async withSchedulerLock<T>(work: () => T | Promise<T>): Promise<T> {
		this.ensureRoot();
		const lock = await this.acquireLock();
		try {
			return await work();
		} finally {
			lock.release();
		}
	}

	/** Acquire the lock with bounded stale-owner recovery. */
	private async acquireLock(): Promise<SchedulerLock> {
		const startedAt = new Date().toISOString();
		for (;;) {
			try {
				const descriptor = openSync(this.lockPath, "wx");
				writeFileSync(
					descriptor,
					JSON.stringify({ pid: process.pid, createdAt: startedAt }),
					"utf8",
				);
				closeSync(descriptor);
				return {
					release: () => {
						try {
							unlinkSync(this.lockPath);
						} catch {
							// A stale-owner recovery may have removed this lock already.
						}
					},
				};
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
				if (staleLock(this.lockPath)) {
					try {
						unlinkSync(this.lockPath);
					} catch {
						// Another worker won the stale-recovery race.
					}
					continue;
				}
				await sleep(LOCK_WAIT_MS);
			}
		}
	}
}
