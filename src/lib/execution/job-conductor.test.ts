import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createExecutionJob, decodeExecutionJob } from "./execution-job.js";
import { LocalJobConductor, type JobWorkerLauncher } from "./job-conductor.js";
import { ExecutionJobStore } from "./job-store.js";
import type { ExecutionRequest } from "./execution-result.js";
import type { ProcessExecutor, ProcessOutcome } from "./process-executor.js";

const tempDirs: string[] = [];

afterEach(() => {
	for (const directory of tempDirs.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

function root(): string {
	const directory = mkdtempSync(join(tmpdir(), "harness-job-conductor-"));
	tempDirs.push(directory);
	return directory;
}

function request(
	artifactsDir: string,
	overrides: Partial<ExecutionRequest> = {},
): ExecutionRequest {
	return {
		command: ["fake"],
		cwd: process.cwd(),
		artifactsDir,
		resourceLanes: ["repo-write"],
		parallelSafe: false,
		timeoutSeconds: 1,
		...overrides,
	};
}

function fakeExecutor(): {
	executor: ProcessExecutor;
	finish: (outcome?: Partial<ProcessOutcome>) => void;
	state: { starts: number; cancelCount: number };
} {
	const finishers: Array<(outcome: ProcessOutcome) => void> = [];
	const state = { starts: 0, cancelCount: 0 };
	return {
		executor: {
			start: () => {
				state.starts += 1;
				return {
					result: new Promise<ProcessOutcome>((resolve) =>
						finishers.push(resolve),
					),
					cancel: () => {
						state.cancelCount += 1;
					},
				};
			},
		},
		finish: (outcome = {}) =>
			finishers.shift()?.({
				exitCode: 0,
				signal: null,
				stdout: "ok\n",
				stderr: "",
				...outcome,
			}),
		state,
	};
}

const launcher: JobWorkerLauncher = { launch: () => undefined };

async function waitFor(predicate: () => boolean, limit = 100): Promise<void> {
	for (let index = 0; index < limit; index += 1) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
	throw new Error("Timed out waiting for the durable job state.");
}

describe("LocalJobConductor", () => {
	it("replays identical requests and fails closed on request-key drift", async () => {
		const artifactsDir = root();
		const conductor = new LocalJobConductor({
			storeRoot: artifactsDir,
			launcher,
		});
		const first = await conductor.submit(
			request(artifactsDir, { requestKey: "stable" }),
		);
		const replay = await conductor.submit(
			request(artifactsDir, { requestKey: "stable" }),
		);
		const conflict = await conductor.submit(
			request(artifactsDir, { requestKey: "stable", command: ["other"] }),
		);
		expect(first.status).toBe("submitted");
		expect(replay).toMatchObject({
			status: "replayed",
			job: { ticket: first.job.ticket },
		});
		expect(conflict).toMatchObject({
			status: "request_key_conflict",
			job: { ticket: first.job.ticket },
		});
	});

	it("keeps conflicting jobs FIFO and persists terminal results", async () => {
		const artifactsDir = root();
		const fake = fakeExecutor();
		const conductor = new LocalJobConductor({
			storeRoot: artifactsDir,
			executor: fake.executor,
			launcher,
			pollIntervalMs: 5,
		});
		const first = await conductor.submit(
			request(artifactsDir, { requestKey: "first" }),
		);
		const second = await conductor.submit(
			request(artifactsDir, { requestKey: "second" }),
		);
		const firstRun = conductor.runWorker(first.job.ticket);
		const secondRun = conductor.runWorker(second.job.ticket);
		await waitFor(() => fake.state.starts === 1);
		fake.finish();
		expect(await firstRun).toBe(0);
		await waitFor(() => fake.state.starts === 2);
		fake.finish();
		expect(await secondRun).toBe(0);
		expect(
			(
				await new LocalJobConductor({
					storeRoot: artifactsDir,
					launcher,
				}).status(first.job.ticket)
			)?.status,
		).toBe("pass");
		expect(
			(
				await new LocalJobConductor({
					storeRoot: artifactsDir,
					launcher,
				}).status(second.job.ticket)
			)?.resultPath,
		).toContain("execution-result.json");
	});

	it("allows parallel-safe read jobs to start together", async () => {
		const artifactsDir = root();
		const fake = fakeExecutor();
		const conductor = new LocalJobConductor({
			storeRoot: artifactsDir,
			executor: fake.executor,
			launcher,
			pollIntervalMs: 5,
		});
		const first = await conductor.submit(
			request(artifactsDir, {
				requestKey: "read-one",
				resourceLanes: ["repo-read"],
				parallelSafe: true,
			}),
		);
		const second = await conductor.submit(
			request(artifactsDir, {
				requestKey: "read-two",
				resourceLanes: ["repo-read"],
				parallelSafe: true,
			}),
		);
		const firstRun = conductor.runWorker(first.job.ticket);
		const secondRun = conductor.runWorker(second.job.ticket);
		await waitFor(() => fake.state.starts === 2);
		fake.finish();
		fake.finish();
		expect(await Promise.all([firstRun, secondRun])).toEqual([0, 0]);
	});

	it("cancels queued and running tickets and recovers stale workers", async () => {
		const artifactsDir = root();
		const fake = fakeExecutor();
		const conductor = new LocalJobConductor({
			storeRoot: artifactsDir,
			executor: fake.executor,
			launcher,
			pollIntervalMs: 5,
		});
		const queued = await conductor.submit(
			request(artifactsDir, { requestKey: "queued" }),
		);
		expect((await conductor.cancel(queued.job.ticket))?.status).toBe(
			"canceled",
		);
		const running = await conductor.submit(
			request(artifactsDir, { requestKey: "running" }),
		);
		const worker = conductor.runWorker(running.job.ticket);
		await waitFor(() => fake.state.starts === 1);
		expect((await conductor.cancel(running.job.ticket))?.cancelRequested).toBe(
			true,
		);
		expect(await worker).toBe(1);
		expect((await conductor.status(running.job.ticket))?.status).toBe(
			"canceled",
		);
		expect(fake.state.cancelCount).toBeGreaterThan(0);

		const store = new ExecutionJobStore(artifactsDir);
		const stale = store.create(
			createExecutionJob(
				"stale",
				request(artifactsDir, { requestKey: "stale" }),
			),
		);
		store.update(stale.ticket, (job) => ({
			...job,
			status: "running",
			startedAt: new Date().toISOString(),
			workerPid: 2_147_483_647,
		}));
		expect((await conductor.status(stale.ticket))?.failureClass).toBe(
			"environment_failure",
		);
	});

	it("rejects a live PID without a matching worker identity", async () => {
		const artifactsDir = root();
		const conductor = new LocalJobConductor({
			storeRoot: artifactsDir,
			launcher,
		});
		const store = new ExecutionJobStore(artifactsDir);
		const job = store.create(
			createExecutionJob(
				"identity-mismatch",
				request(artifactsDir, { requestKey: "identity-mismatch" }),
			),
		);
		store.update(job.ticket, (current) => ({
			...current,
			status: "running",
			startedAt: new Date().toISOString(),
			workerPid: process.pid,
			processToken: "unregistered-token",
		}));

		expect((await conductor.status(job.ticket))?.failureClass).toBe(
			"environment_failure",
		);
	});

	it("reports a polling deadline without changing a queued ticket", async () => {
		const artifactsDir = root();
		const conductor = new LocalJobConductor({
			storeRoot: artifactsDir,
			launcher,
			pollIntervalMs: 5,
		});
		const submitted = await conductor.submit(
			request(artifactsDir, { requestKey: "wait-timeout" }),
		);

		const waited = await conductor.waitForOutcome(submitted.job.ticket, 0.001);

		expect(waited).toMatchObject({ timedOut: true, job: { status: "queued" } });
	});

	it("keeps the runtime decoder aligned with the durable schema boundary", () => {
		const job = createExecutionJob(
			"decoder-boundary",
			request(root(), { requestKey: "decoder-boundary" }),
		);

		expect(() => decodeExecutionJob({ ...job, extraField: true })).toThrow(
			/unexpected field/,
		);
		expect(() =>
			decodeExecutionJob({ ...job, resourceLanes: ["repo-read", "repo-read"] }),
		).toThrow(/duplicate lane/);
		expect(() =>
			decodeExecutionJob({ ...job, createdAt: "not-a-date" }),
		).toThrow(/date-time/);
		expect(() =>
			decodeExecutionJob({ ...job, createdAt: "2026-07-15" }),
		).toThrow(/date-time/);
	});
});
