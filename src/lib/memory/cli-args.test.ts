import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildMemoryGateOptionsFromCliArgs,
	runMemoryGateFromCliArgs,
} from "./cli-args.js";
import { runMemoryGateCLI } from "./cli.js";

vi.mock("./cli.js", () => ({
	runMemoryGateCLI: vi.fn(() => 48),
}));

describe("buildMemoryGateOptionsFromCliArgs", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("projects memory, FORJAMIE, metrics, and JSON flags into the command contract", () => {
		expect(
			buildMemoryGateOptionsFromCliArgs([
				"--memory",
				".harness/memory/LEARNINGS.md",
				"--forjamie",
				"codex/FORJAMIE.md",
				"--metrics",
				"artifacts/memory-metrics.json",
				"--json",
			]),
		).toEqual({
			memoryPath: ".harness/memory/LEARNINGS.md",
			forjamiePath: "codex/FORJAMIE.md",
			metricsPath: "artifacts/memory-metrics.json",
			json: true,
		});
	});

	it("omits path flags when values are missing or another flag follows", () => {
		expect(
			buildMemoryGateOptionsFromCliArgs([
				"--memory",
				"--forjamie",
				"FORJAMIE.md",
				"--metrics",
			]),
		).toEqual({
			forjamiePath: "FORJAMIE.md",
		});
	});

	it("runs the CLI with projected options", () => {
		expect(
			runMemoryGateFromCliArgs(["--forjamie", "FORJAMIE.md", "--json"]),
		).toBe(48);
		expect(runMemoryGateCLI).toHaveBeenCalledWith({
			forjamiePath: "FORJAMIE.md",
			json: true,
		});
	});
});
