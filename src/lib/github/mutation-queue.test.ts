import { describe, expect, it, vi } from "vitest";
import {
	MutationQueue,
	computeMutationBackoffDelay,
} from "./mutation-queue.js";

describe("mutation queue", () => {
	it("serializes concurrent mutation operations", async () => {
		const queue = new MutationQueue({});
		let active = 0;
		let maxActive = 0;
		const started: number[] = [];

		const op = async (id: number) => {
			active += 1;
			maxActive = Math.max(maxActive, active);
			started.push(id);
			await new Promise((resolve) => setTimeout(resolve, 5));
			active -= 1;
			return id;
		};

		const p1 = queue.execute(() => op(1));
		const p2 = queue.execute(() => op(2));
		const p3 = queue.execute(() => op(3));

		const result = await Promise.all([p1, p2, p3]);

		expect(result).toEqual([1, 2, 3]);
		expect(started).toEqual([1, 2, 3]);
		expect(maxActive).toBe(1);
	});

	it("retries retryable failures and eventually succeeds", async () => {
		vi.useFakeTimers();

		const queue = new MutationQueue({
			baseDelayMs: 20,
			maxAttempts: 3,
			backoffFactor: 2,
			jitterRatio: 0,
			random: () => 0,
		});

		const retryError = new Error("Retryable GitHub error") as Error & {
			status: number;
		};
		retryError.status = 429;

		const operation = vi
			.fn()
			.mockRejectedValueOnce(retryError)
			.mockRejectedValueOnce(retryError)
			.mockResolvedValue("ok");

		const resultPromise = queue.execute(operation);
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result).toBe("ok");
		expect(operation).toHaveBeenCalledTimes(3);
		await vi.useRealTimers();
	});

	it("uses base delay on the first retry", async () => {
		vi.useFakeTimers();
		const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

		const queue = new MutationQueue({
			baseDelayMs: 20,
			maxAttempts: 3,
			backoffFactor: 2,
			jitterRatio: 0,
			random: () => 0,
		});

		const retryError = new Error("Retryable GitHub error") as Error & {
			status: number;
		};
		retryError.status = 429;

		const operation = vi
			.fn()
			.mockRejectedValueOnce(retryError)
			.mockRejectedValueOnce(retryError)
			.mockResolvedValue("ok");

		const resultPromise = queue.execute(operation);
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result).toBe("ok");
		expect(operation).toHaveBeenCalledTimes(3);
		expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 20);
		expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 40);

		setTimeoutSpy.mockRestore();
		await vi.useRealTimers();
	});

	it("returns an error after exhausting retry attempts", async () => {
		vi.useFakeTimers();

		const queue = new MutationQueue({
			baseDelayMs: 10,
			maxAttempts: 2,
			jitterRatio: 0,
			random: () => 0,
		});

		const retryError = new Error("Retryable GitHub error") as Error & {
			status: number;
		};
		retryError.status = 503;

		const operation = vi.fn().mockRejectedValue(retryError);
		const resultPromise = queue.execute(operation);

		await vi.runAllTimersAsync();
		await expect(resultPromise).rejects.toBe(retryError);
		expect(operation).toHaveBeenCalledTimes(2);
		await vi.useRealTimers();
	});

	it("computes backoff with jitter bounds", () => {
		expect(
			computeMutationBackoffDelay(0, {
				baseDelayMs: 100,
				maxDelayMs: 1000,
				backoffFactor: 2,
				jitterRatio: 0.1,
				random: () => 1,
			}),
		).toBe(110);
		expect(
			computeMutationBackoffDelay(0, {
				baseDelayMs: 100,
				maxDelayMs: 1000,
				backoffFactor: 2,
				jitterRatio: 0.1,
				random: () => 0,
			}),
		).toBe(90);
	});
});
