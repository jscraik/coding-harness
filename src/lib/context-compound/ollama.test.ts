import { afterEach, describe, expect, it, vi } from "vitest";
import { EMBEDDING_DIMENSIONS } from "./constants.js";
import { OllamaClient } from "./ollama.js";

describe("OllamaClient.embed", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it("supports concurrent embed calls without aborting earlier requests", async () => {
		const pending: Array<{
			resolve: (value: {
				ok: boolean;
				status: number;
				statusText: string;
				json: () => Promise<{ embedding: number[] }>;
			}) => void;
			reject: (reason: unknown) => void;
			signal?: AbortSignal | null;
		}> = [];

		globalThis.fetch = vi.fn((_url: string, init?: RequestInit) => {
			return new Promise((resolve, reject) => {
				const signal = init?.signal;
				if (signal?.aborted) {
					reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
					return;
				}
				signal?.addEventListener(
					"abort",
					() =>
						reject(Object.assign(new Error("Aborted"), { name: "AbortError" })),
					{ once: true },
				);
				if (signal === undefined) {
					pending.push({ resolve, reject });
				} else {
					pending.push({ resolve, reject, signal });
				}
			});
		}) as never;

		const client = new OllamaClient();
		const firstPromise = client.embed("first");
		const secondPromise = client.embed("second");

		for (const request of pending) {
			request.resolve({
				ok: true,
				status: 200,
				statusText: "OK",
				json: async () => ({
					embedding: Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1),
				}),
			});
		}

		const [first, second] = await Promise.all([firstPromise, secondPromise]);

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
	});
});
