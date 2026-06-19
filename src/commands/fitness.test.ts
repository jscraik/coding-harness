import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { COMMAND_SPECS } from "../lib/cli/registry/command-specs.js";
import { runFitnessCLI } from "./fitness.js";

describe("runFitnessCLI", () => {
	const cleanup: string[] = [];

	afterEach(() => {
		vi.restoreAllMocks();
		for (const path of cleanup.splice(0)) {
			rmSync(path, { force: true, recursive: true });
		}
	});

	it("returns failure when required gate evidence is missing", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		expect(runFitnessCLI(["--json"])).toBe(1);

		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.schemaVersion).toBe("harness-fitness/v1");
		expect(result.status).toBe("needs_evidence");
		expect(result.lanes).toHaveLength(4);
		expect(result.lanes[0]).toEqual(
			expect.objectContaining({
				id: "architecture-fitness",
				command: "pnpm architecture:check",
				status: "not_run",
			}),
		);
	});

	it("returns failure when ingested architecture findings include errors", () => {
		const dir = mkdtempSync(join(tmpdir(), "fitness-cli-"));
		cleanup.push(dir);
		const reportPath = join(dir, "architecture.json");
		writeFileSync(
			reportPath,
			JSON.stringify({
				violations: [
					{
						rule: "commands-no-cross-import",
						severity: "error",
						file: "src/commands/a.ts",
						message: "Command facade imports another command facade.",
					},
				],
			}),
			"utf8",
		);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		expect(runFitnessCLI(["--json", "--architecture-report", reportPath])).toBe(
			1,
		);

		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.status).toBe("fail");
		expect(result.summary.failures).toBe(1);
	});

	it("reports usage when architecture report flag is missing a value", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		expect(runFitnessCLI(["--json", "--architecture-report"])).toBe(2);

		const result = JSON.parse(String(infoSpy.mock.calls.at(-1)?.[0]));
		expect(result.error.code).toBe("fitness.architecture_report_required");
	});

	it("is registered as a command capability", () => {
		expect(COMMAND_SPECS.some((spec) => spec.name === "fitness")).toBe(true);
	});
});
