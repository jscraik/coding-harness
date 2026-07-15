import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runExecutionCLI } from "./execution-run.js";

const tempDirs: string[] = [];

afterEach(() => {
	vi.restoreAllMocks();
	for (const directory of tempDirs.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe("runExecutionCLI", () => {
	it("keeps child --json arguments out of the harness output mode", async () => {
		const artifactsDir = mkdtempSync(
			join(process.cwd(), ".tmp-execution-run-"),
		);
		tempDirs.push(artifactsDir);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		await expect(
			runExecutionCLI([
				"--command",
				"node",
				"--artifacts-dir",
				artifactsDir,
				"--",
				"-e",
				"process.exit(0)",
				"--",
				"--json",
			]),
		).resolves.toBe(0);

		expect(infoSpy.mock.calls[0]?.[0]).toMatch(/^pass: node -e/);
	});
});
