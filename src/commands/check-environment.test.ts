import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONTRACT } from "../lib/contract/types.js";

vi.mock("node:child_process", () => ({
	spawnSync: vi.fn(),
}));

describe("runCheckEnvironment runtime dependency checks", () => {
	let tempDir: string;
	const contractPath = "harness.contract.json";
	const originalCwd = process.cwd();
	const originalEnv = { ...process.env };

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "check-environment-test-"));
		writeFileSync(
			join(tempDir, contractPath),
			JSON.stringify(DEFAULT_CONTRACT, null, 2),
			"utf-8",
		);
		process.chdir(tempDir);
		process.env = {
			...originalEnv,
			CLAUDE_APPROVAL_POSTURE: "require",
			CLAUDE_SECRET_FILTER: "configured",
		};
		vi.resetModules();
	});

	afterEach(() => {
		process.chdir(originalCwd);
		process.env = { ...originalEnv };
		rmSync(tempDir, { recursive: true, force: true });
		vi.clearAllMocks();
	});

	it("passes when python, uv, and ralph are present with expected versions", async () => {
		const { spawnSync } = await import("node:child_process");
		const { runCheckEnvironment } = await import("./check-environment.js");
		vi.mocked(spawnSync).mockImplementation((command) => {
			if (command === "python3") {
				return {
					status: 0,
					stdout: "Python 3.12.10\n",
					stderr: "",
				} as never;
			}
			if (command === "uv") {
				return {
					status: 0,
					stdout: "uv 0.9.5\n",
					stderr: "",
				} as never;
			}
			return {
				status: 0,
				stdout: "ralph-gold 1.0.0\n",
				stderr: "",
			} as never;
		});

		const result = await runCheckEnvironment({ contractPath });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.output.passed).toBe(true);
		expect(result.output.violations).toHaveLength(0);
		expect(result.output.posture.runtime?.pythonVersion).toBe("3.12.10");
		expect(result.output.posture.runtime?.uvVersion).toBe("0.9.5");
		expect(result.output.posture.runtime?.ralphVersion).toBe("1.0.0");
	});

	it("fails when ralph is missing", async () => {
		const { spawnSync } = await import("node:child_process");
		const { runCheckEnvironment } = await import("./check-environment.js");
		vi.mocked(spawnSync).mockImplementation((command) => {
			if (command === "python3") {
				return {
					status: 0,
					stdout: "Python 3.12.10\n",
					stderr: "",
				} as never;
			}
			if (command === "uv") {
				return {
					status: 0,
					stdout: "uv 0.9.5\n",
					stderr: "",
				} as never;
			}
			return {
				status: 1,
				stdout: "",
				stderr: "command not found",
				error: new Error("ENOENT"),
			} as never;
		});

		const result = await runCheckEnvironment({ contractPath });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.output.passed).toBe(false);
		expect(
			result.output.violations.some(
				(v) =>
					v.type === "runtime_dependency_missing" && /ralph/i.test(v.message),
			),
		).toBe(true);
	});

	it("falls back to default contract when contract file is missing", async () => {
		rmSync(join(tempDir, contractPath), { force: true });
		const { spawnSync } = await import("node:child_process");
		const { runCheckEnvironment } = await import("./check-environment.js");
		vi.mocked(spawnSync).mockImplementation((command) => {
			if (command === "python3") {
				return {
					status: 0,
					stdout: "Python 3.12.10\n",
					stderr: "",
				} as never;
			}
			if (command === "uv") {
				return {
					status: 0,
					stdout: "uv 0.9.5\n",
					stderr: "",
				} as never;
			}
			return {
				status: 0,
				stdout: "ralph-gold 1.0.0\n",
				stderr: "",
			} as never;
		});

		const result = await runCheckEnvironment({ contractPath });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.output.passed).toBe(true);
	});
});
