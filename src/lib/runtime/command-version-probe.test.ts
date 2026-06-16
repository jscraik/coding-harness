import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
	spawnSync: vi.fn(),
}));

describe("probeCommandVersion", () => {
	let tempDir: string;
	const originalCwd = process.cwd();

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "command-version-probe-"));
		process.chdir(tempDir);
		vi.resetModules();
		vi.mocked(spawnSync).mockReset();
	});

	afterEach(() => {
		process.chdir(originalCwd);
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("fails closed when mise cannot run for a pinned command", async () => {
		writeFileSync(join(tempDir, ".mise.toml"), '[tools]\npython = "3.12"\n');
		vi.mocked(spawnSync).mockReturnValue({
			status: 1,
			stdout: "",
			stderr: "mise config is untrusted",
		} as never);

		const { probeCommandVersion } = await import("./command-version-probe.js");
		const result = probeCommandVersion(
			"python3",
			["--version"],
			(output) => output.match(/Python ([0-9.]+)/)?.[1],
		);

		expect(result).toEqual({ available: false });
		expect(spawnSync).toHaveBeenCalledTimes(1);
		expect(spawnSync).toHaveBeenCalledWith(
			"mise",
			["--version"],
			expect.any(Object),
		);
	});

	it("fails closed when mise cannot resolve a pinned command", async () => {
		writeFileSync(join(tempDir, ".mise.toml"), '[tools]\npython = "3.12"\n');
		vi.mocked(spawnSync)
			.mockReturnValueOnce({
				status: 0,
				stdout: "2026.1.0\n",
				stderr: "",
			} as never)
			.mockReturnValueOnce({
				status: 1,
				stdout: "",
				stderr: "tool not installed",
			} as never);

		const { probeCommandVersion } = await import("./command-version-probe.js");
		const result = probeCommandVersion(
			"python3",
			["--version"],
			(output) => output.match(/Python ([0-9.]+)/)?.[1],
		);

		expect(result).toEqual({ available: false });
		expect(spawnSync).toHaveBeenCalledTimes(2);
		expect(spawnSync).toHaveBeenLastCalledWith(
			"mise",
			["--cd", process.cwd(), "which", "python3"],
			expect.any(Object),
		);
	});

	it("uses the command directly when the repo has no mise contract", async () => {
		vi.mocked(spawnSync).mockReturnValue({
			status: 0,
			stdout: "Python 3.12.10\n",
			stderr: "",
		} as never);

		const { probeCommandVersion } = await import("./command-version-probe.js");
		const result = probeCommandVersion(
			"python3",
			["--version"],
			(output) => output.match(/Python ([0-9.]+)/)?.[1],
		);

		expect(result).toEqual({
			available: true,
			rawOutput: "Python 3.12.10",
			version: "3.12.10",
		});
		expect(spawnSync).toHaveBeenCalledWith(
			"python3",
			["--version"],
			expect.any(Object),
		);
	});

	it("uses PATH for commands that are not governed by the mise contract", async () => {
		writeFileSync(join(tempDir, ".mise.toml"), '[tools]\npython = "3.12"\n');
		vi.mocked(spawnSync).mockReturnValue({
			status: 0,
			stdout: "sample-tool 1.0.0\n",
			stderr: "",
		} as never);

		const { probeCommandVersion } = await import("./command-version-probe.js");
		const result = probeCommandVersion(
			"sample-tool",
			["--version"],
			(output) => output.match(/(\d+\.\d+\.\d+)/)?.[1],
		);

		expect(result).toEqual({
			available: true,
			rawOutput: "sample-tool 1.0.0",
			version: "1.0.0",
		});
		expect(spawnSync).toHaveBeenCalledWith(
			"sample-tool",
			["--version"],
			expect.any(Object),
		);
	});
});
