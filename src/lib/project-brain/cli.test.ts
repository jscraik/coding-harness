import { afterEach, describe, expect, it, vi } from "vitest";
import { runBrainCLI } from "./cli.js";

describe("Project Brain CLI help", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("prints top-level brain help", () => {
		const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
		const exitCode = runBrainCLI(["--help"]);

		expect(exitCode).toBe(0);
		expect(stdout).toHaveBeenCalledWith(
			expect.stringContaining("Usage: harness brain <subcommand>"),
		);
		const output = stdout.mock.calls.map((call) => String(call[0])).join("");
		expect(output).toContain("--domain cli");
		expect(output).not.toContain("--domain api");
	});

	it.each([
		["status", "Usage: harness brain status"],
		["query", "Usage: harness brain query"],
		["add", "Usage: harness brain add"],
		["preflight", "Usage: harness brain preflight"],
		["stale", "Usage: harness brain stale"],
		["lint", "Usage: harness brain lint"],
	])("prints %s subcommand help before argument validation", (subcommand, usage) => {
		const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
		const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
		const exitCode = runBrainCLI([subcommand, "--help"]);

		expect(exitCode).toBe(0);
		expect(stdout).toHaveBeenCalledWith(expect.stringContaining(usage));
		expect(stderr).not.toHaveBeenCalled();
	});
});
