import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	LocalExecutionCoordinator,
	type ExecutionHandle,
} from "./local-coordinator.js";
import type { ExecutionRequest, ExecutionResult } from "./execution-result.js";
import type { ProcessExecutor, ProcessOutcome } from "./process-executor.js";

const tempDirs: string[] = [];

afterEach(() => {
	for (const directory of tempDirs.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

function request(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
	const artifactsDir = mkdtempSync(join(tmpdir(), "harness-execution-"));
	tempDirs.push(artifactsDir);
	return {
		command: ["fake"],
		cwd: process.cwd(),
		artifactsDir,
		resourceLanes: ["repo-read"],
		parallelSafe: true,
		timeoutSeconds: 1,
		...overrides,
	};
}

function fakeExecutor(): {
	executor: ProcessExecutor;
	finish: (outcome?: Partial<ProcessOutcome>) => void;
	state: { cancelCount: number };
} {
	const finishers: Array<(outcome: ProcessOutcome) => void> = [];
	const state = { cancelCount: 0 };
	const executor: ProcessExecutor = {
		start: () => ({
			result: new Promise<ProcessOutcome>((resolve) => {
				finishers.push(resolve);
			}),
			cancel: () => {
				state.cancelCount += 1;
			},
		}),
	};
	return {
		executor,
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

async function settle(handle: ExecutionHandle): Promise<ExecutionResult> {
	return handle.result;
}

describe("LocalExecutionCoordinator", () => {
	it("blocks conflicting active resource lanes", async () => {
		const fake = fakeExecutor();
		const coordinator = new LocalExecutionCoordinator(fake.executor);
		const first = coordinator.run(
			request({
				requestKey: "first",
				parallelSafe: false,
				resourceLanes: ["repo-write"],
			}),
		);
		const second = coordinator.run(
			request({ parallelSafe: false, resourceLanes: ["repo-write"] }),
		);
		const blocked = await settle(second);
		expect(blocked.status).toBe("blocked");
		expect(blocked.failureClass).toBe("blocked_conflict");
		fake.finish();
		expect((await settle(first)).status).toBe("pass");
	});

	it("allows parallel-safe read lanes", async () => {
		const fake = fakeExecutor();
		const coordinator = new LocalExecutionCoordinator(fake.executor);
		const first = coordinator.run(request());
		const second = coordinator.run(request({ requestKey: "second" }));
		fake.finish();
		fake.finish();
		await expect(first.result).resolves.toMatchObject({ status: "pass" });
		await expect(second.result).resolves.toMatchObject({ status: "pass" });
	});

	it("replays a completed request with the same fingerprint", async () => {
		const fake = fakeExecutor();
		const coordinator = new LocalExecutionCoordinator(fake.executor);
		const first = coordinator.run(request({ requestKey: "stable" }));
		fake.finish();
		await first.result;
		const replay = await coordinator.run(request({ requestKey: "stable" }))
			.result;
		expect(replay.status).toBe("pass");
		expect(replay.replayed).toBe(true);
	});

	it("releases a lane after terminal completion for the next owner", async () => {
		const fake = fakeExecutor();
		const coordinator = new LocalExecutionCoordinator(fake.executor);
		const first = coordinator.run(
			request({
				requestKey: "owner-one",
				parallelSafe: false,
				resourceLanes: ["validation"],
			}),
		);
		fake.finish();
		await first.result;
		const next = coordinator.run(
			request({
				requestKey: "owner-two",
				parallelSafe: false,
				resourceLanes: ["validation"],
			}),
		);
		fake.finish();
		await expect(next.result).resolves.toMatchObject({ status: "pass" });
	});

	it("classifies cancellation and timeout without waiting for a child close", async () => {
		const fake = fakeExecutor();
		const coordinator = new LocalExecutionCoordinator(fake.executor);
		const canceled = coordinator.run(request({ requestKey: "cancel" }));
		canceled.cancel();
		await expect(canceled.result).resolves.toMatchObject({
			status: "canceled",
			failureClass: "canceled",
		});
		const timed = coordinator.run(
			request({ requestKey: "timeout", timeoutSeconds: 1 }),
		);
		await expect(timed.result).resolves.toMatchObject({
			status: "timeout",
			failureClass: "timeout",
		});
		expect(fake.state.cancelCount).toBeGreaterThanOrEqual(2);
	});

	it("writes a result and raw log artifacts", async () => {
		const fake = fakeExecutor();
		const input = request({ requestKey: "artifacts" });
		const coordinator = new LocalExecutionCoordinator(fake.executor);
		const handle = coordinator.run(input);
		fake.finish({ stdout: "hello\n", stderr: "warning\n" });
		const result = await handle.result;
		expect(
			readFileSync(
				join(input.artifactsDir, result.artifacts.stdoutPath),
				"utf8",
			),
		).toBe("hello\n");
		expect(
			readFileSync(
				join(input.artifactsDir, result.artifacts.stderrPath),
				"utf8",
			),
		).toBe("warning\n");
		expect(
			readFileSync(
				join(input.artifactsDir, result.artifacts.resultPath),
				"utf8",
			),
		).toContain("harness-execution-result/v1");
	});
});
