import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	spawnSync: vi.fn(),
}));

function mockFetchResponse(status: number, body: unknown): Promise<Response> {
	return Promise.resolve({
		ok: status >= 200 && status < 300,
		status,
		text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
	} as Response);
}

describe("runLocalMemoryPreflightCLI", () => {
	let tempDir: string;
	const originalFetch = global.fetch;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "local-memory-preflight-test-"));
		global.fetch = vi.fn() as unknown as typeof fetch;
		vi.resetModules();
	});

	afterEach(() => {
		global.fetch = originalFetch;
		rmSync(tempDir, { recursive: true, force: true });
		vi.clearAllMocks();
	});

	it("passes when REST health succeeds and the smoke cycle completes", async () => {
		const configPath = join(tempDir, "config.yaml");
		const daemonLogPath = join(tempDir, "daemon.log");
		writeFileSync(
			configPath,
			[
				"rest_api:",
				"  auto_port: false",
				"  host: 127.0.0.1",
				"  port: 3002",
			].join("\n"),
			"utf-8",
		);
		writeFileSync(daemonLogPath, '{"pending_migrations":0}\n', "utf-8");

		const { spawnSync } = await import("node:child_process");
		const { runLocalMemoryPreflight } = await import(
			"../lib/preflight/local-memory.js"
		);

		vi.mocked(spawnSync).mockImplementation((command, args) => {
			if (command === "local-memory" && args?.[0] === "--version") {
				return {
					status: 0,
					stdout: "local-memory version 1.4.3\n",
					stderr: "",
				} as never;
			}
			if (command === "local-memory" && args?.[0] === "status") {
				return {
					status: 0,
					stdout: '{"data":{"running":false}}\n',
					stderr: "",
				} as never;
			}
			return {
				status: 1,
				stdout: "",
				stderr: "unexpected command",
			} as never;
		});

		vi.mocked(global.fetch).mockImplementation((input, init) => {
			const url = String(input);
			if (!init?.method && url.endsWith("/api/v1/health")) {
				return mockFetchResponse(200, { success: true });
			}
			if (url.endsWith("/api/v1/observe")) {
				const payload = JSON.parse(String(init?.body ?? "{}")) as {
					content?: string;
					level?: string;
				};
				if (payload.level === "observation") {
					return mockFetchResponse(400, { error: "bad payload" });
				}
				if (payload.content?.includes("anchor")) {
					return mockFetchResponse(201, { id: "memory-a", success: true });
				}
				if (payload.content?.includes("evidence")) {
					return mockFetchResponse(201, { id: "memory-b", success: true });
				}
				return mockFetchResponse(201, { id: "duplicate", success: true });
			}
			if (url.endsWith("/api/v1/relationships")) {
				return mockFetchResponse(201, {
					id: "relationship-1",
					success: true,
				});
			}
			if (url.endsWith("/api/v1/memories/search")) {
				return mockFetchResponse(200, {
					search_info: { total_results: 2 },
				});
			}
			return mockFetchResponse(404, { error: "unexpected url" });
		});

		const result = await runLocalMemoryPreflight({
			configPath,
			daemonLogPath,
		});
		expect(result.passed).toBe(true);
		expect(result.messages).toContain(
			"✅ REST health ok: http://127.0.0.1:3002/api/v1/health",
		);
		expect(result.messages).toContain(
			"✅ smoke cycle ok: ids memory-a, memory-b; relationship relationship-1",
		);
		expect(result.messages).toContain("✅ local-memory preflight passed");
	});

	it("fails closed when the config host policy is wrong", async () => {
		const configPath = join(tempDir, "config.yaml");
		writeFileSync(
			configPath,
			[
				"rest_api:",
				"  auto_port: false",
				"  host: 0.0.0.0",
				"  port: 3002",
			].join("\n"),
			"utf-8",
		);

		const { spawnSync } = await import("node:child_process");
		const { runLocalMemoryPreflight } = await import(
			"../lib/preflight/local-memory.js"
		);

		vi.mocked(spawnSync).mockImplementation((command, args) => {
			if (command === "local-memory" && args?.[0] === "--version") {
				return {
					status: 0,
					stdout: "local-memory version 1.4.3\n",
					stderr: "",
				} as never;
			}
			return {
				status: 1,
				stdout: "",
				stderr: "unexpected command",
			} as never;
		});

		const result = await runLocalMemoryPreflight({ configPath });
		expect(result.passed).toBe(false);
		expect(result.messages).toContain(
			"❌ local-memory config host policy failed: expected host: 127.0.0.1",
		);
		expect(global.fetch).not.toHaveBeenCalled();
	});
});
