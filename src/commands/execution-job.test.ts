import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runExecutionJobCLI } from "./execution-job.js";

const tempDirs: string[] = [];

afterEach(() => {
	vi.restoreAllMocks();
	for (const directory of tempDirs.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

function artifactsDir(): string {
	const directory = mkdtempSync(join(process.cwd(), ".tmp-execution-job-cli-"));
	tempDirs.push(directory);
	return directory;
}

describe("execution job CLI JSON responses", () => {
	it("returns a schema-backed empty list envelope", async () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

		await expect(
			runExecutionJobCLI(["list", "--artifacts-dir", artifactsDir(), "--json"]),
		).resolves.toBe(0);

		expect(JSON.parse(String(info.mock.calls[0]?.[0]))).toEqual({
			schemaVersion: "harness-execution-job-response/v1",
			operation: "list",
			outcome: "listed",
			timedOut: false,
			job: null,
			jobs: [],
		});
	});

	it("returns a not-found envelope for status JSON", async () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

		await expect(
			runExecutionJobCLI([
				"status",
				"--artifacts-dir",
				artifactsDir(),
				"--ticket",
				"missing-ticket",
				"--json",
			]),
		).resolves.toBe(1);

		expect(JSON.parse(String(info.mock.calls[0]?.[0]))).toMatchObject({
			schemaVersion: "harness-execution-job-response/v1",
			operation: "status",
			outcome: "not_found",
			timedOut: false,
			job: null,
			jobs: [],
		});
	});
});
