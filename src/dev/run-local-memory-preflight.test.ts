import { describe, expect, it } from "vitest";
import { parseLocalMemoryPreflightRunnerArgs } from "./run-local-memory-preflight.js";

describe("parseLocalMemoryPreflightRunnerArgs", () => {
	it("rejects --config without a value", () => {
		const result = parseLocalMemoryPreflightRunnerArgs(["--config", "--json"]);
		expect(result).toEqual({
			error: "--config requires a path",
		});
	});

	it("rejects --daemon-log without a value", () => {
		const result = parseLocalMemoryPreflightRunnerArgs([
			"--daemon-log",
			"--json",
		]);
		expect(result).toEqual({
			error: "--daemon-log requires a path",
		});
	});

	it("parses config and daemon-log values without consuming later flags", () => {
		const result = parseLocalMemoryPreflightRunnerArgs([
			"--config",
			"/tmp/config.yaml",
			"--daemon-log",
			"/tmp/daemon.log",
			"--json",
		]);
		expect(result).toEqual({
			options: {
				configPath: "/tmp/config.yaml",
				daemonLogPath: "/tmp/daemon.log",
				json: true,
			},
		});
	});
});
